const { createAlertService } = require('../modules/alerts/alert.service')
const { createNotificationService } = require('../modules/notifications/notification.service')
const { createAllocationService } = require('../modules/patrol/allocation.service')
const { createCoverageService } = require('../modules/patrol/coverage.service')
const { createEmergencyDispatchService } = require('../modules/patrol/emergency-dispatch.service')
const { createTeamService } = require('../modules/teams/team.service')
const { nextId } = require('./ids')

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-10-01T12:00:00.000Z')

/** A 0.1° square whose centroid is `{ lat: lat + 0.05, lng: lng + 0.05 }`. */
const square = (lng, lat) => ({ type: 'Polygon', coordinates: [[[lng, lat], [lng + 0.1, lat], [lng + 0.1, lat + 0.1], [lng, lat + 0.1], [lng, lat]]] })

const same = (first, second) => String(first) === String(second)
const copy = (document) => (document ? { ...document } : null)

/**
 * In-memory stand-ins for the UC04 repositories, wired to the real team, alert,
 * notification, coverage, allocation and dispatch services. The transaction
 * runner simply runs the work; real rollback is covered by patrol.api.test.js.
 */
function createPatrolWorld({ now = NOW, coveragePolicy } = {}) {
  const park = { _id: nextId(), code: 'YALA', name: 'Yala National Park', coveragePolicy }
  const state = { zones: [], teams: [], assignments: [], records: [], decisions: [], dispatches: [], alerts: [], notifications: [] }
  const hoursAgo = (hours) => new Date(now.getTime() - hours * HOUR)

  const find = (collection, id) => state[collection].find((document) => same(document._id, id)) ?? null
  const insert = (collection, data) => {
    const document = { _id: nextId(), ...data }
    state[collection].push(document)
    return document
  }
  const populate = (assignment) => ({
    ...assignment,
    zone: copy(find('zones', assignment.zone)),
    team: copy(find('teams', assignment.team)),
    alert: assignment.alert ? copy(find('alerts', assignment.alert)) : undefined
  })

  const parkRepository = {
    findParkById: vi.fn(async (id) => (same(id, park._id) ? copy(park) : null)),
    listZones: vi.fn(async (parkId) => state.zones.filter((zone) => same(zone.park, parkId)).map(copy)),
    findZoneById: vi.fn(async (id) => copy(find('zones', id)))
  }

  const teamRepository = {
    listByPark: vi.fn(async (parkId) => state.teams.filter((team) => same(team.park, parkId)).map(copy)),
    findById: vi.fn(async (id) => copy(find('teams', id))),
    findByMember: vi.fn(async (userId) => copy(state.teams.find((team) => team.members.some((member) => same(member, userId))))),
    updateStatusIf: vi.fn(async (id, fromStatuses, status) => {
      const team = find('teams', id)
      if (!team || !fromStatuses.includes(team.status)) return null
      team.status = status
      return copy(team)
    }),
    setStatus: vi.fn(async (id, status) => {
      const team = find('teams', id)
      if (!team) return null
      team.status = status
      return copy(team)
    }),
    updateLocation: vi.fn(async (id, location) => {
      const team = find('teams', id)
      if (!team) return null
      team.lastKnownLocation = location
      return copy(team)
    })
  }

  const patrolRepository = {
    listRecordsSince: vi.fn(async (parkId, since) =>
      state.records.filter((record) => same(record.park, parkId) && (!record.endTime || record.endTime >= since)).map(copy)
    ),
    createRecord: vi.fn(async (data) => copy(insert('records', data))),
    listActiveAssignments: vi.fn(async (parkId) =>
      state.assignments.filter((assignment) => same(assignment.park, parkId) && assignment.status === 'active').map(populate)
    ),
    findAssignmentById: vi.fn(async (id) => copy(find('assignments', id))),
    findActiveAssignmentByTeam: vi.fn(async (teamId, { populate: populated = false } = {}) => {
      const assignment = state.assignments.find((entry) => same(entry.team, teamId) && entry.status === 'active')
      if (!assignment) return null
      return populated ? populate(assignment) : copy(assignment)
    }),
    createAssignment: vi.fn(async (data) => copy(insert('assignments', { status: 'active', ...data }))),
    closeAssignment: vi.fn(async (id, changes) => {
      const assignment = find('assignments', id)
      if (!assignment || assignment.status !== 'active') return null
      Object.assign(assignment, changes)
      return copy(assignment)
    }),
    acknowledgeAssignment: vi.fn(async (id, userId, acknowledgedAt) => {
      const assignment = find('assignments', id)
      if (!assignment || assignment.status !== 'active' || assignment.acknowledgedAt) return null
      Object.assign(assignment, { acknowledgedBy: userId, acknowledgedAt })
      return copy(assignment)
    }),
    recordDecision: vi.fn(async (data) => copy(insert('decisions', data))),
    listDecisions: vi.fn(async (parkId) => state.decisions.filter((decision) => same(decision.park, parkId)).map(copy)),
    createDispatch: vi.fn(async (data) => copy(insert('dispatches', data)))
  }

  const alertRepository = {
    listByPark: vi.fn(async (parkId, { statuses } = {}) =>
      state.alerts.filter((alert) => same(alert.park, parkId) && (!statuses?.length || statuses.includes(alert.status))).map(copy)
    ),
    findById: vi.fn(async (id) => copy(find('alerts', id))),
    create: vi.fn(async (data) => copy(insert('alerts', data))),
    updateIfStatus: vi.fn(async (id, fromStatuses, changes) => {
      const alert = find('alerts', id)
      if (!alert || !fromStatuses.includes(alert.status)) return null
      Object.assign(alert, changes)
      return copy(alert)
    })
  }

  const notificationRepository = {
    createMany: vi.fn(async (notifications) => notifications.map((notification) => copy(insert('notifications', notification))))
  }

  const clock = () => now
  const transactionRunner = { run: vi.fn((work) => work('session')) }
  const teamService = createTeamService({ teamRepository })
  const alertService = createAlertService({ alertRepository, clock })
  const notificationService = createNotificationService({ notificationRepository, clock })
  const dependencies = { transactionRunner, clock, parkRepository, teamRepository, patrolRepository, teamService, alertService, notificationService }
  const coverageService = createCoverageService(dependencies)

  return {
    now,
    park,
    state,
    hoursAgo,
    repositories: { parkRepository, teamRepository, patrolRepository, alertRepository, notificationRepository },
    transactionRunner,
    coverageService,
    allocationService: createAllocationService({ ...dependencies, coverageService }),
    emergencyDispatchService: createEmergencyDispatchService({ ...dependencies, coverageService }),

    addZone({ name, riskLevel = 'medium', targetWeeklyPatrolHours = 14, lng = 81, lat = 6, parkId = park._id, ...rest }) {
      return insert('zones', { park: parkId, code: name.split(' ')[0].toUpperCase(), name, riskLevel, targetWeeklyPatrolHours, boundary: square(lng, lat), ...rest })
    },

    addTeam({ name, status = 'available', location = { lat: 6, lng: 81 }, members = [], parkId = park._id, ...rest }) {
      return insert('teams', { park: parkId, code: name.split(' ')[1].toUpperCase(), name, status, lastKnownLocation: location, members, ...rest })
    },

    /** An active assignment; the team is put on patrol (or responding for an emergency). */
    addAssignment({ zone, team, allocationType = 'allocation', startedHoursAgo = 2, ...rest }) {
      team.status = allocationType === 'emergency' ? 'responding' : 'on-patrol'
      return insert('assignments', { park: zone.park, zone: zone._id, team: team._id, allocationType, status: 'active', assignedAt: hoursAgo(startedHoursAgo), ...rest })
    },

    /** A patrol record; leave `endedHoursAgo` out for a patrol that is still in progress. */
    addRecord({ zone, team, startedHoursAgo, endedHoursAgo, route = [] }) {
      return insert('records', {
        park: zone.park,
        zone: zone._id,
        team: team?._id,
        startTime: hoursAgo(startedHoursAgo),
        endTime: endedHoursAgo === undefined ? null : hoursAgo(endedHoursAgo),
        route
      })
    },

    addAlert({ zone, severity = 'critical', status = 'active', title = 'Possible Poaching Activity', location, ...rest }) {
      return insert('alerts', { park: zone?.park ?? park._id, zone: zone?._id, type: 'poaching', severity, status, title, location, createdAt: hoursAgo(1), ...rest })
    }
  }
}

module.exports = { createPatrolWorld, square, HOUR, NOW }
