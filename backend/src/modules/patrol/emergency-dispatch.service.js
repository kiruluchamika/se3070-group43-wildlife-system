const { BusinessRuleError, ConflictError } = require('../../shared/errors/AppError')
const { estimateEtaMinutes, haversineKm } = require('../../shared/utils/geo')
const { toId } = require('../../shared/utils/serialize')
const { DISPATCHABLE_STATUSES } = require('../alerts/alert.service')
const { TEAM_STATUS } = require('../teams/ranger-team.model')
const { DECISION_TYPES } = require('./allocation-decision.model')
const { ALLOCATION_TYPES, ASSIGNMENT_STATUS } = require('./patrol-assignment.model')

const DISPATCHABLE_SEVERITIES = ['high', 'critical']

/**
 * UC04 alternate flow A4 (Generate Emergency Dispatch), plus the agreed
 * improvements:
 * - candidates are ranked by distance and ETA, and the manager may override the choice
 * - when no team is free, a team on a lower-priority patrol can be diverted (E2 fallback)
 * - the alert moves to "dispatched" as part of the same transaction
 */
function createEmergencyDispatchService({
  transactionRunner,
  teamRepository,
  patrolRepository,
  teamService,
  alertService,
  notificationService,
  coverageService,
  clock = () => new Date()
}) {
  async function requireDispatchableAlert(alertId) {
    const alert = await alertService.findById(alertId)
    if (!DISPATCHABLE_SEVERITIES.includes(alert.severity)) {
      throw new BusinessRuleError('Emergency dispatch is reserved for high and critical alerts.', 'ALERT_NOT_ELIGIBLE')
    }
    if (!DISPATCHABLE_STATUSES.includes(alert.status)) {
      throw new ConflictError(`A team has already been ${alert.status === 'resolved' ? 'sent and the alert resolved' : 'dispatched'}.`, 'ALERT_ALREADY_HANDLED')
    }
    if (!alert.zone || !alert.location) {
      throw new BusinessRuleError('This alert has no zone or location, so a team cannot be routed to it.', 'ALERT_WITHOUT_LOCATION')
    }
    return alert
  }

  /** Available teams nearest first; otherwise teams on non-emergency patrols, lowest-priority zone first. */
  async function rankCandidates(alert) {
    const parkId = toId(alert.park)
    const [teams, assignments, { assessments }] = await Promise.all([
      teamRepository.listByPark(parkId),
      patrolRepository.listActiveAssignments(parkId),
      coverageService.assessPark(parkId)
    ])
    const assignmentByTeam = new Map(assignments.map((assignment) => [toId(assignment.team), assignment]))
    const priorityByZone = new Map(assessments.map((assessment) => [assessment.zone.id, assessment.priorityScore]))

    const describe = (team) => {
      const distanceKm = haversineKm(team.lastKnownLocation, alert.location)
      const assignment = assignmentByTeam.get(toId(team._id))
      return {
        team: { id: toId(team._id), name: team.name, status: team.status, members: team.members?.length ?? 0, baseLocationName: team.baseLocationName },
        distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
        etaMinutes: estimateEtaMinutes(distanceKm),
        currentAssignment: assignment ? { id: toId(assignment._id), zone: assignment.zone, allocationType: assignment.allocationType } : null,
        currentZonePriority: assignment ? priorityByZone.get(toId(assignment.zone)) ?? 0 : null
      }
    }
    const byDistance = (first, second) => (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity)

    const available = teams.filter((team) => team.status === TEAM_STATUS.AVAILABLE).map(describe).sort(byDistance)
    const divertible = teams
      .filter((team) => team.status === TEAM_STATUS.ON_PATROL)
      .map(describe)
      .filter((candidate) => candidate.currentAssignment && candidate.currentAssignment.allocationType !== ALLOCATION_TYPES.EMERGENCY)
      .sort((first, second) => first.currentZonePriority - second.currentZonePriority || byDistance(first, second))

    return { available, divertible }
  }

  return {
    async recommend(alertId) {
      const alert = await requireDispatchableAlert(alertId)
      const { available, divertible } = await rankCandidates(alert)
      return {
        alert,
        mode: available.length ? 'available' : divertible.length ? 'divert' : 'none',
        recommended: available[0] ?? divertible[0] ?? null,
        available,
        divertible
      }
    },

    async dispatch({ alertId, teamId, notes }, manager) {
      const alert = await requireDispatchableAlert(alertId)
      const { available, divertible } = await rankCandidates(alert)
      const candidates = [...available, ...divertible]
      if (!candidates.length) {
        throw new ConflictError('No ranger team is available or can be diverted. Arrange a response by radio or telephone.', 'NO_TEAM_AVAILABLE')
      }

      const chosen = teamId ? candidates.find((candidate) => candidate.team.id === teamId) : candidates[0]
      if (!chosen) {
        throw new ConflictError('The selected team can no longer be dispatched. Refresh the recommendations.', 'TEAM_NOT_AVAILABLE')
      }

      const team = await teamRepository.findById(chosen.team.id)
      const now = clock()

      return transactionRunner.run(async (session) => {
        let divertedFrom = null
        if (chosen.currentAssignment) {
          divertedFrom = await patrolRepository.closeAssignment(chosen.currentAssignment.id, { status: ASSIGNMENT_STATUS.SUPERSEDED, endedAt: now }, { session })
          if (!divertedFrom) throw new ConflictError(`${team.name}'s patrol changed while dispatching. Try again.`, 'CONCURRENT_UPDATE')
          await patrolRepository.createRecord(
            { park: divertedFrom.park, zone: divertedFrom.zone, team: divertedFrom.team, assignment: divertedFrom._id, startTime: divertedFrom.assignedAt, endTime: now },
            { session }
          )
        }

        await teamService.commitTeam(team._id, TEAM_STATUS.RESPONDING, {
          session,
          fromStatuses: [TEAM_STATUS.AVAILABLE, TEAM_STATUS.ON_PATROL]
        })
        const assignment = await patrolRepository.createAssignment(
          {
            park: alert.park,
            zone: alert.zone,
            team: team._id,
            allocationType: ALLOCATION_TYPES.EMERGENCY,
            priority: 'critical',
            notes,
            alert: alert._id,
            previousAssignment: divertedFrom?._id,
            assignedBy: manager.id,
            assignedAt: now
          },
          { session }
        )
        const dispatch = await patrolRepository.createDispatch(
          {
            park: alert.park,
            alert: alert._id,
            zone: alert.zone,
            team: team._id,
            assignment: assignment._id,
            divertedFromAssignment: divertedFrom?._id,
            dispatchedBy: manager.id,
            distanceKm: chosen.distanceKm,
            etaMinutes: chosen.etaMinutes,
            notes
          },
          { session }
        )
        await alertService.markDispatched(alert._id, { session })
        await patrolRepository.recordDecision(
          {
            type: DECISION_TYPES.EMERGENCY,
            park: alert.park,
            zone: alert.zone,
            fromZone: divertedFrom?.zone,
            team: team._id,
            assignment: assignment._id,
            alert: alert._id,
            decidedBy: manager.id,
            notes
          },
          { session }
        )
        await notificationService.notifyUsers(
          team.members ?? [],
          {
            type: 'emergency-dispatch',
            title: `EMERGENCY: ${alert.title}`,
            message: `Respond immediately. ETA ${chosen.etaMinutes ?? '?'} min.${notes ? ` ${notes}` : ''}`,
            link: '/my-assignment'
          },
          { session }
        )

        return { dispatch, assignment, team: chosen.team, alert: { id: toId(alert._id), title: alert.title }, diverted: Boolean(divertedFrom) }
      })
    }
  }
}

module.exports = { createEmergencyDispatchService, DISPATCHABLE_SEVERITIES }
