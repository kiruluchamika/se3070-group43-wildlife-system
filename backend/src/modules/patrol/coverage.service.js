const { NotFoundError } = require('../../shared/errors/AppError')
const { polygonCentroid } = require('../../shared/utils/geo')
const { toId } = require('../../shared/utils/serialize')
const { hoursBetween, MS_PER_HOUR } = require('../../shared/utils/time')
const { TEAM_STATUS } = require('../teams/ranger-team.model')
const { createCoveragePolicy } = require('./policies/coverage-policy')

const RECENT_ROUTE_HOURS = 72

/** Hours patrolled inside [windowStart, now]; ongoing patrols count up to now. */
function patrolHoursInWindow(records, windowStart, now) {
  return records.reduce((total, record) => {
    const start = Math.max(new Date(record.startTime).getTime(), windowStart.getTime())
    const end = Math.min(record.endTime ? new Date(record.endTime).getTime() : now.getTime(), now.getTime())
    return end > start ? total + (end - start) / MS_PER_HOUR : total
  }, 0)
}

/** Latest time the zone was patrolled; `now` when a patrol is still in progress. */
function lastPatrolledAt(records, now) {
  if (records.some((record) => !record.endTime)) return now
  return records.reduce((latest, record) => {
    const end = new Date(record.endTime)
    return !latest || end > latest ? end : latest
  }, null)
}

const groupBy = (items, keyOf) =>
  items.reduce((groups, item) => {
    const key = keyOf(item)
    if (key) groups.set(key, [...(groups.get(key) ?? []), item])
    return groups
  }, new Map())

/**
 * Pure coverage calculation for every zone of a park. Kept free of I/O so it
 * can be unit tested and reused by UC02 analytics.
 */
function assessZones({ park, zones, records, alerts, assignments, now }) {
  const policy = createCoveragePolicy(park.coveragePolicy)
  const windowStart = new Date(now.getTime() - policy.settings.windowDays * 24 * MS_PER_HOUR)
  const recordsByZone = groupBy(records, (record) => toId(record.zone))
  const alertsByZone = groupBy(alerts, (alert) => toId(alert.zone))
  const assignmentsByZone = groupBy(assignments, (assignment) => toId(assignment.zone))

  const assessments = zones.map((zone) => {
    const zoneId = toId(zone._id)
    const zoneRecords = recordsByZone.get(zoneId) ?? []
    const zoneAlerts = alertsByZone.get(zoneId) ?? []
    const zoneAssignments = assignmentsByZone.get(zoneId) ?? []

    const patrolHours = patrolHoursInWindow(zoneRecords, windowStart, now)
    const coveragePercent = Math.min(100, Math.round((patrolHours / zone.targetWeeklyPatrolHours) * 100))
    const lastPatrol = lastPatrolledAt(zoneRecords, now)
    const hoursSinceLastPatrol = lastPatrol ? Math.max(0, hoursBetween(lastPatrol, now)) : null
    const effectiveRisk = policy.effectiveRisk(zone.riskLevel, zoneAlerts)
    const evaluation = policy.evaluate({
      risk: effectiveRisk,
      coveragePercent,
      hoursSinceLastPatrol,
      hasActiveAssignment: zoneAssignments.length > 0
    })

    return {
      zone: {
        id: zoneId,
        code: zone.code,
        name: zone.name,
        riskLevel: zone.riskLevel,
        description: zone.description,
        targetWeeklyPatrolHours: zone.targetWeeklyPatrolHours,
        boundary: zone.boundary,
        centroid: polygonCentroid(zone.boundary)
      },
      effectiveRisk,
      status: evaluation.status,
      reasons: evaluation.reasons,
      coveragePercent,
      patrolHours: Math.round(patrolHours * 10) / 10,
      lastPatrolledAt: lastPatrol,
      hoursSinceLastPatrol: hoursSinceLastPatrol === null ? null : Math.round(hoursSinceLastPatrol * 10) / 10,
      maxGapHours: evaluation.maxGapHours,
      activeAlerts: zoneAlerts.length,
      assignedTeams: zoneAssignments.map((assignment) => ({
        id: toId(assignment.team),
        name: assignment.team?.name,
        allocationType: assignment.allocationType
      })),
      recommendedAction: policy.recommendedAction({ status: evaluation.status, risk: effectiveRisk, gapExceeded: evaluation.gapExceeded }),
      priorityScore: policy.priorityScore({ risk: effectiveRisk, hoursSinceLastPatrol, coveragePercent, alertCount: zoneAlerts.length })
    }
  })

  // Under-patrolled first, then by priority.
  const statusRank = { 'under-patrolled': 0, adequate: 1, covered: 2 }
  assessments.sort((first, second) => statusRank[first.status] - statusRank[second.status] || second.priorityScore - first.priorityScore)

  return { policy: policy.settings, windowStart, assessments }
}

function summarise(assessments, alerts, teams) {
  const coverageTotal = assessments.reduce((total, assessment) => total + assessment.coveragePercent, 0)
  return {
    overallCoverage: assessments.length ? Math.round(coverageTotal / assessments.length) : 0,
    zoneCount: assessments.length,
    underPatrolledZones: assessments.filter((assessment) => assessment.status === 'under-patrolled').length,
    coveredZones: assessments.filter((assessment) => assessment.status === 'covered').length,
    activeAlerts: alerts.length,
    criticalAlerts: alerts.filter((alert) => alert.severity === 'critical').length,
    totalTeams: teams.length,
    availableTeams: teams.filter((team) => team.status === TEAM_STATUS.AVAILABLE).length
  }
}

/** UC04 "View Real-Time Patrol Coverage" and "Identify Under-Patrolled Zones" (PatrolCtrl). */
function createCoverageService({ parkRepository, patrolRepository, teamRepository, alertService, clock = () => new Date() }) {
  async function loadPark(parkId) {
    const park = await parkRepository.findParkById(parkId)
    if (!park) throw new NotFoundError('The selected park was not found.', 'PARK_NOT_FOUND')
    return park
  }

  async function assessPark(parkId) {
    const now = clock()
    const park = await loadPark(parkId)
    const policy = createCoveragePolicy(park.coveragePolicy)
    const since = new Date(now.getTime() - Math.max(policy.settings.windowDays * 24, RECENT_ROUTE_HOURS) * MS_PER_HOUR)

    const [zones, records, alerts, assignments] = await Promise.all([
      parkRepository.listZones(parkId),
      patrolRepository.listRecordsSince(parkId, since),
      alertService.listActive(parkId),
      patrolRepository.listActiveAssignments(parkId)
    ])

    return { now, park, zones, records, alerts, assignments, ...assessZones({ park, zones, records, alerts, assignments, now }) }
  }

  return {
    assessPark,

    async getCoverage(parkId) {
      const { now, park, records, alerts, assignments, assessments, policy } = await assessPark(parkId)
      const teams = await teamRepository.listByPark(parkId)
      const assignmentByTeam = new Map(assignments.map((assignment) => [toId(assignment.team), assignment]))
      const zoneNames = new Map(assessments.map((assessment) => [assessment.zone.id, assessment.zone.name]))
      const routeCutoff = now.getTime() - RECENT_ROUTE_HOURS * MS_PER_HOUR

      return {
        park,
        policy,
        generatedAt: now,
        summary: summarise(assessments, alerts, teams),
        zones: assessments,
        routes: records
          .filter((record) => record.route?.length > 1 && (!record.endTime || new Date(record.endTime).getTime() >= routeCutoff))
          .map((record) => ({ id: toId(record._id), team: toId(record.team), zone: toId(record.zone), route: record.route, endTime: record.endTime })),
        teams: teams.map((team) => {
          const assignment = assignmentByTeam.get(toId(team._id))
          return {
            id: toId(team._id),
            name: team.name,
            status: team.status,
            location: team.lastKnownLocation,
            baseLocationName: team.baseLocationName,
            assignedZone: assignment ? { id: toId(assignment.zone), name: zoneNames.get(toId(assignment.zone)) } : null
          }
        })
      }
    }
  }
}

module.exports = { createCoverageService, assessZones, patrolHoursInWindow, lastPatrolledAt }
