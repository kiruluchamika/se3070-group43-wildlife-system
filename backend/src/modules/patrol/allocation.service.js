const { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } = require('../../shared/errors/AppError')
const { estimateEtaMinutes, haversineKm, polygonCentroid } = require('../../shared/utils/geo')
const { toId } = require('../../shared/utils/serialize')
const { TEAM_STATUS } = require('../teams/ranger-team.model')
const { DECISION_TYPES } = require('./allocation-decision.model')
const { ALLOCATION_TYPES, ASSIGNMENT_STATUS } = require('./patrol-assignment.model')

const PRIORITY_FOR_RISK = { high: 'high', medium: 'medium', low: 'low' }
const TEAM_STATUS_ORDER = { available: 0, 'on-patrol': 1, responding: 2, 'off-duty': 3 }

/**
 * UC04 allocation and reassignment of ranger teams (main flow steps 7–12,
 * alternate flow A3, exception flows E2 and E3).
 *
 * Every write runs in a single MongoDB transaction: updating the assignment,
 * changing the team status, recording the allocation decision and notifying
 * the team either all succeed or all roll back, so a failure leaves the
 * previous patrol assignment unchanged (E3).
 */
function createAllocationService({
  transactionRunner,
  parkRepository,
  teamRepository,
  patrolRepository,
  teamService,
  alertService,
  notificationService,
  coverageService,
  clock = () => new Date()
}) {
  async function requireZone(zoneId) {
    const zone = await parkRepository.findZoneById(zoneId)
    if (!zone) throw new NotFoundError('The selected zone was not found.', 'ZONE_NOT_FOUND')
    return zone
  }

  async function requireTeam(teamId) {
    const team = await teamRepository.findById(teamId)
    if (!team) throw new NotFoundError('The selected ranger team was not found.', 'TEAM_NOT_FOUND')
    return team
  }

  function assertSamePark(zone, team) {
    if (toId(zone.park) !== toId(team.park)) {
      throw new BusinessRuleError(`${team.name} belongs to a different park and cannot patrol ${zone.name}.`, 'TEAM_PARK_MISMATCH')
    }
  }

  function notifyTeam(team, { title, message }, session) {
    return notificationService.notifyUsers(team.members ?? [], { type: 'patrol-assignment', title, message, link: '/my-assignment' }, { session })
  }

  /** Records the patrol the team performed before its assignment ended, so coverage reflects it. */
  function recordPatrolFor(assignment, endTime, session) {
    return patrolRepository.createRecord(
      { park: assignment.park, zone: assignment.zone, team: assignment.team, assignment: assignment._id, startTime: assignment.assignedAt, endTime },
      { session }
    )
  }

  async function priorityOf(parkId, zoneIds) {
    const { assessments } = await coverageService.assessPark(parkId)
    return new Map(assessments.filter((assessment) => zoneIds.includes(assessment.zone.id)).map((assessment) => [assessment.zone.id, assessment]))
  }

  return {
    /** RangerCtrl.requestAvailableRangerTeams(area): teams with status, current assignment and distance to the zone. */
    async listTeams(parkId, { zoneId } = {}) {
      const [teams, assignments, zone] = await Promise.all([
        teamRepository.listByPark(parkId),
        patrolRepository.listActiveAssignments(parkId),
        zoneId ? requireZone(zoneId) : null
      ])
      const target = zone ? polygonCentroid(zone.boundary) : null
      const assignmentByTeam = new Map(assignments.map((assignment) => [toId(assignment.team), assignment]))

      return teams
        .map((team) => {
          const assignment = assignmentByTeam.get(toId(team._id))
          const distanceKm = target ? haversineKm(team.lastKnownLocation, target) : null
          return {
            ...team,
            currentAssignment: assignment
              ? {
                  id: toId(assignment._id),
                  zone: assignment.zone,
                  allocationType: assignment.allocationType,
                  assignedAt: assignment.assignedAt,
                  acknowledgedAt: assignment.acknowledgedAt,
                  alert: assignment.alert
                }
              : null,
            distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
            etaMinutes: estimateEtaMinutes(distanceKm)
          }
        })
        .sort(
          (first, second) =>
            (TEAM_STATUS_ORDER[first.status] ?? 9) - (TEAM_STATUS_ORDER[second.status] ?? 9) ||
            (first.distanceKm ?? 0) - (second.distanceKm ?? 0) ||
            first.name.localeCompare(second.name)
        )
    },

    listActiveAssignments(parkId) {
      return patrolRepository.listActiveAssignments(parkId)
    },

    listDecisions(parkId) {
      return patrolRepository.listDecisions(parkId)
    },

    /** Main flow steps 8–12: allocate an available team to a zone. */
    async allocate({ zoneId, teamId, notes }, manager) {
      const [zone, team] = await Promise.all([requireZone(zoneId), requireTeam(teamId)])
      assertSamePark(zone, team)

      if (team.status !== TEAM_STATUS.AVAILABLE) {
        const canReassign = team.status === TEAM_STATUS.ON_PATROL
        throw new ConflictError(
          canReassign
            ? `${team.name} is already on patrol. Use reassignment to move it to ${zone.name}.`
            : `${team.name} is not available (currently ${team.status}).`,
          'TEAM_NOT_AVAILABLE',
          { status: team.status, canReassign }
        )
      }

      const now = clock()
      return transactionRunner.run(async (session) => {
        await teamService.commitTeam(teamId, TEAM_STATUS.ON_PATROL, { session })
        const assignment = await patrolRepository.createAssignment(
          {
            park: zone.park,
            zone: zone._id,
            team: team._id,
            allocationType: ALLOCATION_TYPES.ALLOCATION,
            priority: PRIORITY_FOR_RISK[zone.riskLevel],
            notes,
            assignedBy: manager.id,
            assignedAt: now
          },
          { session }
        )
        await patrolRepository.recordDecision(
          { type: DECISION_TYPES.ALLOCATE, park: zone.park, zone: zone._id, team: team._id, assignment: assignment._id, decidedBy: manager.id, notes },
          { session }
        )
        await notifyTeam(team, { title: `New patrol assignment: ${zone.name}`, message: notes || `${team.name} has been assigned to ${zone.name}.` }, session)

        return { assignment, team: { id: toId(team._id), name: team.name }, zone: { id: toId(zone._id), name: zone.name } }
      })
    },

    /**
     * A3: move a team that is on patrol to a higher-priority zone. The manager
     * must give a reason, and moving a team into a zone that is not of higher
     * priority needs an explicit override.
     */
    async reassign({ zoneId, teamId, reason, notes, override = false }, manager) {
      const [zone, team] = await Promise.all([requireZone(zoneId), requireTeam(teamId)])
      assertSamePark(zone, team)

      if (team.status === TEAM_STATUS.AVAILABLE) {
        throw new ConflictError(`${team.name} is available. Allocate it directly instead of reassigning.`, 'TEAM_IS_AVAILABLE')
      }
      if (team.status === TEAM_STATUS.RESPONDING) {
        throw new ConflictError(`${team.name} is responding to an emergency and cannot be reassigned.`, 'TEAM_RESPONDING')
      }

      const current = await patrolRepository.findActiveAssignmentByTeam(teamId)
      if (team.status !== TEAM_STATUS.ON_PATROL || !current) {
        throw new ConflictError(`${team.name} has no active patrol to reassign from.`, 'NO_ACTIVE_ASSIGNMENT')
      }
      if (toId(current.zone) === toId(zone._id)) {
        throw new ConflictError(`${team.name} is already patrolling ${zone.name}.`, 'SAME_ZONE')
      }

      const priorities = await priorityOf(toId(zone.park), [toId(current.zone), toId(zone._id)])
      const fromAssessment = priorities.get(toId(current.zone))
      const toAssessment = priorities.get(toId(zone._id))
      if (!override && fromAssessment && toAssessment && fromAssessment.priorityScore >= toAssessment.priorityScore) {
        throw new ConflictError(
          `${fromAssessment.zone.name} has equal or higher priority than ${zone.name}. Confirm the override to reassign anyway.`,
          'PRIORITY_DOWNGRADE',
          { fromZone: fromAssessment.zone.name, fromPriority: fromAssessment.priorityScore, toPriority: toAssessment.priorityScore }
        )
      }

      const now = clock()
      return transactionRunner.run(async (session) => {
        const superseded = await patrolRepository.closeAssignment(current._id, { status: ASSIGNMENT_STATUS.SUPERSEDED, endedAt: now }, { session })
        if (!superseded) throw new ConflictError(`${team.name}'s assignment was changed by someone else. Refresh and try again.`, 'CONCURRENT_UPDATE')

        await recordPatrolFor(current, now, session)
        const assignment = await patrolRepository.createAssignment(
          {
            park: zone.park,
            zone: zone._id,
            team: team._id,
            allocationType: ALLOCATION_TYPES.REASSIGNMENT,
            priority: PRIORITY_FOR_RISK[zone.riskLevel],
            notes,
            reason,
            previousAssignment: current._id,
            assignedBy: manager.id,
            assignedAt: now
          },
          { session }
        )
        await patrolRepository.recordDecision(
          {
            type: DECISION_TYPES.REASSIGN,
            park: zone.park,
            zone: zone._id,
            fromZone: current.zone,
            team: team._id,
            assignment: assignment._id,
            decidedBy: manager.id,
            notes: reason
          },
          { session }
        )
        await notifyTeam(team, { title: `Reassigned to ${zone.name}`, message: reason }, session)

        return {
          assignment,
          team: { id: toId(team._id), name: team.name },
          zone: { id: toId(zone._id), name: zone.name },
          vacatedZone: fromAssessment ? { id: fromAssessment.zone.id, name: fromAssessment.zone.name } : { id: toId(current.zone) }
        }
      })
    },

    /** Ends an active patrol: records it, frees the team and resolves the alert of an emergency. */
    async complete(assignmentId, manager) {
      const assignment = await patrolRepository.findAssignmentById(assignmentId)
      if (!assignment) throw new NotFoundError('The patrol assignment was not found.', 'ASSIGNMENT_NOT_FOUND')
      if (assignment.status !== ASSIGNMENT_STATUS.ACTIVE) {
        throw new ConflictError('This patrol assignment has already ended.', 'ASSIGNMENT_NOT_ACTIVE')
      }

      const [zone, now] = [await requireZone(assignment.zone), clock()]
      return transactionRunner.run(async (session) => {
        const completed = await patrolRepository.closeAssignment(assignment._id, { status: ASSIGNMENT_STATUS.COMPLETED, endedAt: now }, { session })
        if (!completed) throw new ConflictError('This patrol assignment has already ended.', 'ASSIGNMENT_NOT_ACTIVE')

        await recordPatrolFor(assignment, now, session)
        await teamService.releaseTeam(assignment.team, { session })
        await teamRepository.updateLocation(assignment.team, { ...polygonCentroid(zone.boundary), updatedAt: now }, { session })
        if (assignment.allocationType === ALLOCATION_TYPES.EMERGENCY && assignment.alert) {
          await alertService.resolve(assignment.alert, { session })
        }
        await patrolRepository.recordDecision(
          { type: DECISION_TYPES.COMPLETE, park: assignment.park, zone: assignment.zone, team: assignment.team, assignment: assignment._id, decidedBy: manager.id },
          { session }
        )
        return completed
      })
    },

    /** The ranger (supporting actor) confirms that the team received its assignment. */
    async acknowledge(assignmentId, ranger) {
      const [assignment, team] = await Promise.all([patrolRepository.findAssignmentById(assignmentId), teamRepository.findByMember(ranger.id)])
      if (!assignment || assignment.status !== ASSIGNMENT_STATUS.ACTIVE) {
        throw new NotFoundError('This patrol assignment is no longer active.', 'ASSIGNMENT_NOT_ACTIVE')
      }
      if (!team || toId(team._id) !== toId(assignment.team)) {
        throw new ForbiddenError('Only members of the assigned team can acknowledge this assignment.', 'NOT_TEAM_MEMBER')
      }
      if (assignment.acknowledgedAt) return assignment

      return (await patrolRepository.acknowledgeAssignment(assignmentId, ranger.id, clock())) ?? assignment
    },

    /** Ranger view: the signed-in ranger's team and its active assignment (if any). */
    async getMyAssignment(rangerId) {
      const team = await teamRepository.findByMember(rangerId)
      if (!team) return { team: null, assignment: null }

      const assignment = await patrolRepository.findActiveAssignmentByTeam(team._id, { populate: true })
      return { team, assignment }
    }
  }
}

module.exports = { createAllocationService }
