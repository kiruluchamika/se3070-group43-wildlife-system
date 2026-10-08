const { createConflictAccess } = require('../modules/conflicts/conflict-access')
const { createConflictNotifier } = require('../modules/conflicts/conflict-notifier')
const { createConflictWorkflow } = require('../modules/conflicts/conflict-workflow')
const { OPEN_TASK_STATUSES } = require('../modules/conflicts/conflict.constants')
const { createNotificationDispatcher } = require('../modules/notifications/notification-dispatcher')
const { createTeamService } = require('../modules/teams/team.service')
const { nextId } = require('./ids')

/*
 * In-memory stand-ins for the UC01 dependencies, so service tests exercise the
 * real rules, workflow and notifier without a database.
 */

const clone = (value) => structuredClone(value)
const duplicateKeyError = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 })

function setPath(target, path, value) {
  const keys = path.split('.')
  let cursor = target
  for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {}
  if (value === undefined) delete cursor[keys.at(-1)]
  else cursor[keys.at(-1)] = value
}

/** Applies the subset of MongoDB update operators the repository uses. */
function applyUpdate(document, update) {
  for (const [path, value] of Object.entries(update.$set ?? {})) setPath(document, path, clone(value))
  for (const [field, value] of Object.entries(update.$push ?? {})) {
    document[field] ??= []
    document[field].push(...clone(value?.$each ?? [value]))
  }
  for (const [field, value] of Object.entries(update.$addToSet ?? {})) {
    document[field] ??= []
    if (!document[field].map(String).includes(String(value))) document[field].push(value)
  }
  return document
}

function createFakeConflictRepository({ clock = () => new Date() } = {}) {
  const reports = new Map()
  const tasks = new Map()
  const actions = new Map()

  const store = (map, data, defaults = {}) => {
    const document = { _id: nextId(), createdAt: clock(), ...defaults, ...clone(data) }
    map.set(document._id, document)
    return clone(document)
  }
  const find = (map, id) => (map.has(String(id)) ? clone(map.get(String(id))) : null)
  const updateIf = (map, id, fromStatuses, update) => {
    const document = map.get(String(id))
    if (!document || !fromStatuses.includes(document.status)) return null
    return clone(applyUpdate(document, update))
  }
  const newestFirst = (first, second) => second.createdAt - first.createdAt

  return {
    reports,
    tasks,
    actions,
    failNextTaskCreate: null,

    async createReport(data) {
      if ([...reports.values()].some((report) => report.reference === data.reference)) throw duplicateKeyError()
      return store(reports, data, { history: [], contactAttempts: [], linkedReports: [], evidence: [], contactStatus: 'ok' })
    },
    async findReportById(id) {
      return find(reports, id)
    },
    async listReports({ park, statuses, reporter } = {}) {
      return [...reports.values()]
        .filter((report) => (!park || String(report.park) === String(park)) && (!reporter || String(report.reporter) === String(reporter)))
        .filter((report) => !statuses?.length || statuses.includes(report.status))
        .sort(newestFirst)
        .map(clone)
    },
    async countByStatus({ park } = {}) {
      const counts = {}
      for (const report of reports.values()) {
        if (!park || String(report.park) === String(park)) counts[report.status] = (counts[report.status] ?? 0) + 1
      }
      return counts
    },
    async listRecentOpenReports({ park, from, to, excludeStatuses, excludeId }) {
      return [...reports.values()]
        .filter((report) => report._id !== String(excludeId) && String(report.park) === String(park) && !excludeStatuses.includes(report.status))
        .filter((report) => report.occurredAt >= from && report.occurredAt <= to)
        .map(clone)
    },
    async updateReportIf(id, fromStatuses, update) {
      return updateIf(reports, id, fromStatuses, update)
    },
    async updateReport(id, update) {
      const report = reports.get(String(id))
      return report ? clone(applyUpdate(report, update)) : null
    },

    async createTask(data) {
      if (this.failNextTaskCreate) {
        const error = this.failNextTaskCreate
        this.failNextTaskCreate = null
        throw error
      }
      const open = [...tasks.values()].some((task) => String(task.report) === String(data.report) && OPEN_TASK_STATUSES.includes(task.status))
      if (open && OPEN_TASK_STATUSES.includes(data.status)) throw duplicateKeyError()
      return store(tasks, data)
    },
    async findTaskById(id) {
      return find(tasks, id)
    },
    async findOpenTaskByReport(reportId) {
      const task = [...tasks.values()].find((entry) => String(entry.report) === String(reportId) && OPEN_TASK_STATUSES.includes(entry.status))
      return task ? clone(task) : null
    },
    async listTasksByReport(reportId) {
      return [...tasks.values()].filter((task) => String(task.report) === String(reportId)).sort(newestFirst).map(clone)
    },
    async listTasks({ park, team, statuses } = {}) {
      return [...tasks.values()]
        .filter((task) => (!park || String(task.park) === String(park)) && (!team || String(task.team) === String(team)))
        .filter((task) => !statuses?.length || statuses.includes(task.status))
        .sort(newestFirst)
        .map(clone)
    },
    async updateTaskIf(id, fromStatuses, update) {
      return updateIf(tasks, id, fromStatuses, update)
    },

    async createAction(data) {
      const existing = [...actions.values()].find((action) => action.clientUpdateId === data.clientUpdateId)
      if (existing) return { action: clone(existing), created: false }
      return { action: store(actions, data), created: true }
    },
    async findActionByClientId(clientUpdateId) {
      const action = [...actions.values()].find((entry) => entry.clientUpdateId === clientUpdateId)
      return action ? clone(action) : null
    },
    async listActionsByTasks(taskIds) {
      const ids = taskIds.map(String)
      return [...actions.values()].filter((action) => ids.includes(String(action.task))).map(clone)
    }
  }
}

/** A Yala-like park with two zones, three teams and one account per UC01 role. */
function createConflictWorld({ now = new Date('2026-09-30T06:00:00Z'), smsMode = 'simulated' } = {}) {
  const clock = () => new Date(now)
  const park = { _id: nextId(), name: 'Yala National Park', code: 'YALA' }
  const otherPark = { _id: nextId(), name: 'Sinharaja Forest Reserve', code: 'SINHARAJA' }
  const square = (lng, lat) => ({ type: 'Polygon', coordinates: [[[lng, lat], [lng + 0.1, lat], [lng + 0.1, lat + 0.1], [lng, lat + 0.1], [lng, lat]]] })
  const zones = [
    { _id: nextId(), park: park._id, name: 'West Sector', boundary: square(81.26, 6.38) },
    { _id: nextId(), park: park._id, name: 'East Zone', boundary: square(81.46, 6.4) }
  ]

  const users = {
    villager: { _id: nextId(), name: 'Sunil Bandara', role: 'villager', phone: '+94 71 555 0101' },
    otherVillager: { _id: nextId(), name: 'Kamala Perera', role: 'villager' },
    officer: { _id: nextId(), name: 'Dilani Gunasekara', role: 'liaison-officer', park: park._id },
    outsideOfficer: { _id: nextId(), name: 'Ruwan Silva', role: 'liaison-officer', park: otherPark._id },
    manager: { _id: nextId(), name: 'Sampath Herath', role: 'park-manager', park: park._id },
    ranger: { _id: nextId(), name: 'Nuwan Silva', role: 'ranger', park: park._id },
    otherRanger: { _id: nextId(), name: 'Kasun Rathnayake', role: 'ranger', park: park._id }
  }
  const teams = new Map(
    [
      { _id: nextId(), park: park._id, name: 'Team Alpha', status: 'available', members: [users.ranger._id], lastKnownLocation: { lat: 6.45, lng: 81.31 } },
      { _id: nextId(), park: park._id, name: 'Team Charlie', status: 'available', members: [users.otherRanger._id], lastKnownLocation: { lat: 6.33, lng: 81.37 } },
      { _id: nextId(), park: park._id, name: 'Team Bravo', status: 'on-patrol', members: [], lastKnownLocation: { lat: 6.42, lng: 81.4 } },
      { _id: nextId(), park: otherPark._id, name: 'Team Echo', status: 'available', members: [], lastKnownLocation: { lat: 6.43, lng: 80.42 } }
    ].map((team) => [team._id, team])
  )
  const teamByName = (name) => [...teams.values()].find((team) => team.name === name)

  const userRepository = {
    findById: vi.fn(async (id) => Object.values(users).find((user) => user._id === String(id)) ?? null),
    listByRole: vi.fn(async (role, { park: parkId } = {}) =>
      Object.values(users).filter((user) => user.role === role && (!parkId || !user.park || user.park === String(parkId)))
    )
  }
  const parkRepository = {
    findParkById: vi.fn(async (id) => [park, otherPark].find((entry) => entry._id === String(id)) ?? null),
    listZones: vi.fn(async (parkId) => zones.filter((zone) => zone.park === String(parkId)))
  }
  const teamRepository = {
    findById: vi.fn(async (id) => (teams.has(String(id)) ? clone(teams.get(String(id))) : null)),
    listByPark: vi.fn(async (parkId) => [...teams.values()].filter((team) => team.park === String(parkId)).map(clone)),
    findByMember: vi.fn(async (userId) => clone([...teams.values()].find((team) => team.members.includes(String(userId))) ?? null)),
    updateStatusIf: vi.fn(async (id, fromStatuses, status) => {
      const team = teams.get(String(id))
      if (!team || !fromStatuses.includes(team.status)) return null
      team.status = status
      return clone(team)
    }),
    setStatus: vi.fn(async (id, status) => {
      const team = teams.get(String(id))
      if (!team) return null
      team.status = status
      return clone(team)
    })
  }
  const alertService = {
    raise: vi.fn(async (data) => ({ _id: nextId(), ...data, status: 'active' })),
    markDispatched: vi.fn(async (id) => ({ _id: id, status: 'dispatched' })),
    resolve: vi.fn(async (id) => ({ _id: id, status: 'resolved' }))
  }
  const notificationService = { notifyUsers: vi.fn(async (ids, payload) => ids.map((recipient) => ({ recipient, ...payload }))) }
  const smsGateway = {
    send: vi.fn(async () => {
      if (smsMode === 'unavailable') throw new Error('The SMS gateway is unavailable.')
      return { status: 'simulated', providerRef: 'SIM-1' }
    })
  }
  const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

  const conflictRepository = createFakeConflictRepository({ clock })
  const transactionRunner = { run: vi.fn(async (work) => work('tx')) }
  const access = createConflictAccess({ userRepository })
  const teamService = createTeamService({ teamRepository })
  const notificationDispatcher = createNotificationDispatcher({ notificationService, smsGateway, logger })
  const workflow = createConflictWorkflow({ conflictRepository, parkRepository, alertService, clock })
  const notifier = createConflictNotifier({ userRepository, notificationService, notificationDispatcher, conflictRepository, clock, logger })

  const actor = (key) => {
    const user = users[key]
    return { id: user._id, role: user.role, name: user.name, park: user.park ?? null, team: null }
  }

  return {
    now,
    clock,
    park,
    otherPark,
    zones,
    users,
    teams,
    teamByName,
    actor,
    logger,
    dependencies: {
      transactionRunner,
      conflictRepository,
      parkRepository,
      teamRepository,
      teamService,
      alertService,
      access,
      workflow,
      notifier,
      clock
    },
    mocks: { userRepository, notificationService, smsGateway, alertService, transactionRunner }
  }
}

module.exports = { createFakeConflictRepository, createConflictWorld, applyUpdate }
