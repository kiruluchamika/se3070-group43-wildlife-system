const request = require('supertest')
const { createApp } = require('../../app')
const { createTransactionRunner } = require('../../config/database')
const { loadConfig } = require('../../config/env')
const { createContainer, createRepositories } = require('../../container')
const { createSmsGateway } = require('../notifications/sms-gateway')
const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')
const { nextId } = require('../../test-support/ids')
const { square, HOUR } = require('../../test-support/patrol-fakes')
const { createAllocationService } = require('./allocation.service')

/**
 * UC04 through HTTP against an in-memory MongoDB replica set: real routes,
 * role checks, validation, repositories and multi-document transactions.
 */
describe.skipIf(!hasTestDatabase)('UC04 patrol management API (in-memory MongoDB)', () => {
  let db
  let app
  let container
  let world

  beforeAll(async () => {
    db = await connectTestDatabase('patrol')
    const config = loadConfig({ JWT_SECRET: 'test-secret' })
    container = createContainer({
      config,
      repositories: createRepositories(db.models),
      transactionRunner: createTransactionRunner(db.connection),
      smsGateway: createSmsGateway({ logger: {} })
    })
    app = createApp({ config, routes: container.routes, logger: { error: vi.fn() } })
  })

  afterAll(async () => {
    await db?.disconnect()
  })

  beforeEach(async () => {
    await db.clear()
    const { Park, Zone, RangerTeam, User, PatrolAssignment, Alert } = db.models
    const park = await Park.create({ code: 'YALA', name: 'Yala National Park' })
    const [east, central] = await Zone.create([
      { park: park._id, code: 'EAST', name: 'East Zone', riskLevel: 'high', targetWeeklyPatrolHours: 21, boundary: square(81, 6) },
      { park: park._id, code: 'CENTRAL', name: 'Central Zone', riskLevel: 'low', targetWeeklyPatrolHours: 7, boundary: square(81.6, 6) }
    ])
    const person = (name, role) => ({ name, role, email: `${name.split(' ')[0].toLowerCase()}@example.com`, passwordHash: 'x', park: park._id })
    const [manager, nuwan, isuru, villager] = await User.create([
      person('Sampath Herath', 'park-manager'),
      person('Nuwan Silva', 'ranger'),
      person('Isuru Weerasinghe', 'ranger'),
      person('Sunil Bandara', 'villager')
    ])
    const [alpha, bravo] = await RangerTeam.create([
      { park: park._id, code: 'ALPHA', name: 'Team Alpha', status: 'available', members: [nuwan._id], lastKnownLocation: { lat: 6.06, lng: 81.06 } },
      { park: park._id, code: 'BRAVO', name: 'Team Bravo', status: 'on-patrol', members: [isuru._id], lastKnownLocation: { lat: 6.05, lng: 81.65 } }
    ])
    const bravoAssignment = await PatrolAssignment.create({
      park: park._id,
      zone: central._id,
      team: bravo._id,
      allocationType: 'allocation',
      assignedBy: manager._id,
      assignedAt: new Date(Date.now() - 2 * HOUR)
    })
    const alert = await Alert.create({
      park: park._id,
      zone: east._id,
      type: 'poaching',
      severity: 'critical',
      title: 'Possible Poaching Activity',
      location: { lat: 6.05, lng: 81.05 }
    })
    world = { park, east, central, manager, nuwan, isuru, villager, alpha, bravo, bravoAssignment, alert }
  })

  const token = (user) => `Bearer ${container.tokenService.sign(user)}`
  const as = (user) => ({
    get: (path) => request(app).get(path).set('Authorization', token(user)),
    post: (path, body) => request(app).post(path).set('Authorization', token(user)).send(body),
    patch: (path, body) => request(app).patch(path).set('Authorization', token(user)).send(body ?? {})
  })
  const id = (document) => String(document._id)
  const teamStatus = async (team) => (await db.models.RangerTeam.findById(team._id).lean()).status

  describe('access control (E4)', () => {
    it('requires a signed-in user', async () => {
      const response = await request(app).get(`/api/patrol/coverage?parkId=${id(world.park)}`)

      expect(response.status).toBe(401)
    })

    it('denies park-manager functions to every other role', async () => {
      const coverage = await as(world.nuwan).get(`/api/patrol/coverage?parkId=${id(world.park)}`)
      const allocate = await as(world.villager).post('/api/patrol/assignments', { zoneId: id(world.east), teamId: id(world.alpha) })
      const dispatch = await as(world.nuwan).post('/api/patrol/emergency-dispatches', { alertId: id(world.alert) })

      for (const response of [coverage, allocate, dispatch]) {
        expect(response.status).toBe(403)
        expect(response.body.code).toBe('ACCESS_DENIED')
      }
      await expect(teamStatus(world.alpha)).resolves.toBe('available')
    })

    it('keeps the ranger screens for rangers', async () => {
      const response = await as(world.manager).get('/api/patrol/my-assignment')

      expect(response.status).toBe(403)
      expect(response.body.code).toBe('ACCESS_DENIED')
    })
  })

  describe('request validation', () => {
    it('rejects an invalid park id', async () => {
      const response = await as(world.manager).get('/api/patrol/coverage?parkId=not-an-id')

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Park id is not valid.' })
    })

    it('requires a zone and a team to allocate', async () => {
      const response = await as(world.manager).post('/api/patrol/assignments', { zoneId: id(world.east) })

      expect(response.status).toBe(400)
      expect(response.body.details).toEqual([{ field: 'teamId', message: 'Ranger team is required.' }])
    })

    it('requires a reason of at least 5 characters to reassign', async () => {
      const body = { zoneId: id(world.east), teamId: id(world.bravo) }

      const missing = await as(world.manager).post('/api/patrol/assignments/reassign', body)
      const short = await as(world.manager).post('/api/patrol/assignments/reassign', { ...body, reason: 'no' })

      expect(missing.status).toBe(400)
      expect(missing.body.message).toBe('A reason is required when reassigning a team.')
      expect(short.body.message).toBe('Explain the reassignment in at least 5 characters.')
    })

    it('limits notes to 500 characters', async () => {
      const response = await as(world.manager).post('/api/patrol/assignments', { zoneId: id(world.east), teamId: id(world.alpha), notes: 'x'.repeat(501) })

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Notes must not exceed 500 characters.')
    })
  })

  describe('GET /api/patrol/coverage', () => {
    it('returns the zones, summary, teams and routes of the park', async () => {
      await db.models.PatrolRecord.create({
        park: world.park._id,
        zone: world.central._id,
        team: world.bravo._id,
        startTime: new Date(Date.now() - 2 * HOUR),
        route: [[6.01, 81.61], [6.02, 81.62]]
      })

      const response = await as(world.manager).get(`/api/patrol/coverage?parkId=${id(world.park)}`)

      expect(response.status).toBe(200)
      expect(response.body.policy).toEqual({ windowDays: 7, minCoveragePercent: 50, maxGapHours: { high: 24, medium: 48, low: 72 } })
      expect(response.body.summary).toMatchObject({ zoneCount: 2, underPatrolledZones: 1, coveredZones: 1, activeAlerts: 1, criticalAlerts: 1, totalTeams: 2, availableTeams: 1 })
      expect(response.body.zones.map((assessment) => [assessment.zone.name, assessment.status])).toEqual([
        ['East Zone', 'under-patrolled'],
        ['Central Zone', 'covered']
      ])
      expect(response.body.zones[0]).toMatchObject({
        zone: { id: id(world.east) },
        reasons: ['Never patrolled in the coverage window', 'Coverage below 50%'],
        recommendedAction: 'Allocate a ranger team',
        activeAlerts: 1
      })
      expect(response.body.zones[1].assignedTeams).toEqual([{ id: id(world.bravo), name: 'Team Bravo', allocationType: 'allocation' }])
      expect(response.body.routes).toHaveLength(1)
      expect(response.body.teams.find((team) => team.name === 'Team Bravo').assignedZone).toEqual({ id: id(world.central), name: 'Central Zone' })
    })

    it('reports an unknown park', async () => {
      const response = await as(world.manager).get(`/api/patrol/coverage?parkId=${nextId()}`)

      expect(response.status).toBe(404)
      expect(response.body.code).toBe('PARK_NOT_FOUND')
    })
  })

  describe('GET /api/patrol/teams', () => {
    it('lists teams with their distance to the zone and current assignment', async () => {
      const response = await as(world.manager).get(`/api/patrol/teams?parkId=${id(world.park)}&zoneId=${id(world.east)}`)

      expect(response.status).toBe(200)
      expect(response.body.teams.map((team) => team.name)).toEqual(['Team Alpha', 'Team Bravo'])
      expect(response.body.teams[0]).toMatchObject({ status: 'available', distanceKm: 1.6, etaMinutes: 4, currentAssignment: null, members: [{ name: 'Nuwan Silva' }] })
      expect(response.body.teams[1].currentAssignment).toMatchObject({ id: id(world.bravoAssignment), zone: { name: 'Central Zone' } })
    })
  })

  describe('allocation (main flow)', () => {
    const allocate = () => as(world.manager).post('/api/patrol/assignments', { zoneId: id(world.east), teamId: id(world.alpha), notes: 'Sweep the river crossing.' })

    it('allocates a team, records the decision and notifies the rangers', async () => {
      const response = await allocate()

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        team: { id: id(world.alpha), name: 'Team Alpha' },
        zone: { id: id(world.east), name: 'East Zone' },
        assignment: { allocationType: 'allocation', status: 'active', priority: 'high', assignedBy: id(world.manager) }
      })
      await expect(teamStatus(world.alpha)).resolves.toBe('on-patrol')

      const assignments = await as(world.manager).get(`/api/patrol/assignments?parkId=${id(world.park)}`)
      const decisions = await as(world.manager).get(`/api/patrol/decisions?parkId=${id(world.park)}`)
      const notifications = await as(world.nuwan).get('/api/notifications/me')

      expect(assignments.body.assignments).toHaveLength(2)
      expect(decisions.body.decisions).toHaveLength(1)
      expect(decisions.body.decisions[0]).toMatchObject({
        type: 'allocate',
        zone: { name: 'East Zone' },
        team: { name: 'Team Alpha' },
        decidedBy: { name: 'Sampath Herath' },
        notes: 'Sweep the river crossing.'
      })
      expect(notifications.body).toMatchObject({ unreadCount: 1, notifications: [{ title: 'New patrol assignment: East Zone', link: '/my-assignment' }] })
    })

    it('shows the assignment to the ranger, who acknowledges it', async () => {
      const { body } = await allocate()

      const mine = await as(world.nuwan).get('/api/patrol/my-assignment')
      const acknowledged = await as(world.nuwan).patch(`/api/patrol/assignments/${body.assignment.id}/acknowledge`)
      const again = await as(world.nuwan).patch(`/api/patrol/assignments/${body.assignment.id}/acknowledge`)

      expect(mine.status).toBe(200)
      expect(mine.body).toMatchObject({
        team: { name: 'Team Alpha', status: 'on-patrol' },
        assignment: { id: body.assignment.id, zone: { name: 'East Zone', riskLevel: 'high' }, assignedBy: { name: 'Sampath Herath' }, notes: 'Sweep the river crossing.' }
      })
      expect(acknowledged.status).toBe(200)
      expect(acknowledged.body.assignment.acknowledgedBy).toBe(id(world.nuwan))
      expect(again.body.assignment.acknowledgedAt).toBe(acknowledged.body.assignment.acknowledgedAt)
    })

    it('lets only a member of the assigned team acknowledge', async () => {
      const { body } = await allocate()

      const response = await as(world.isuru).patch(`/api/patrol/assignments/${body.assignment.id}/acknowledge`)

      expect(response.status).toBe(403)
      expect(response.body.code).toBe('NOT_TEAM_MEMBER')
    })

    it('refuses to allocate a team twice', async () => {
      await allocate()

      const response = await allocate()

      expect(response.status).toBe(409)
      expect(response.body).toMatchObject({ code: 'TEAM_NOT_AVAILABLE', details: { status: 'on-patrol', canReassign: true } })
      await expect(db.models.PatrolAssignment.countDocuments({ team: world.alpha._id })).resolves.toBe(1)
    })
  })

  describe('reassignment (A3)', () => {
    const reason = 'Poaching alert in the east needs a team.'

    it('moves a team to a higher-priority zone and records the patrol it left', async () => {
      const response = await as(world.manager).post('/api/patrol/assignments/reassign', { zoneId: id(world.east), teamId: id(world.bravo), reason })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        assignment: { allocationType: 'reassignment', reason, previousAssignment: id(world.bravoAssignment) },
        vacatedZone: { id: id(world.central), name: 'Central Zone' }
      })
      await expect(db.models.PatrolAssignment.findById(world.bravoAssignment._id).lean()).resolves.toMatchObject({ status: 'superseded' })
      await expect(db.models.PatrolRecord.find({ zone: world.central._id }).lean()).resolves.toHaveLength(1)
      await expect(teamStatus(world.bravo)).resolves.toBe('on-patrol')

      const decisions = await as(world.manager).get(`/api/patrol/decisions?parkId=${id(world.park)}`)
      expect(decisions.body.decisions[0]).toMatchObject({ type: 'reassign', fromZone: { name: 'Central Zone' }, zone: { name: 'East Zone' }, notes: reason })
    })

    it('needs an override to move a team to a lower-priority zone', async () => {
      await as(world.manager).post('/api/patrol/assignments', { zoneId: id(world.east), teamId: id(world.alpha) })
      const body = { zoneId: id(world.central), teamId: id(world.alpha), reason }

      const refused = await as(world.manager).post('/api/patrol/assignments/reassign', body)
      const overridden = await as(world.manager).post('/api/patrol/assignments/reassign', { ...body, override: true })

      expect(refused.status).toBe(409)
      expect(refused.body).toMatchObject({ code: 'PRIORITY_DOWNGRADE', details: { fromZone: 'East Zone' } })
      expect(overridden.status).toBe(201)
      expect(overridden.body.vacatedZone.name).toBe('East Zone')
    })
  })

  describe('completing a patrol', () => {
    it('records the patrol, frees the team and refuses a second completion', async () => {
      const path = `/api/patrol/assignments/${id(world.bravoAssignment)}/complete`

      const response = await as(world.manager).patch(path)
      const again = await as(world.manager).patch(path)

      expect(response.status).toBe(200)
      expect(response.body.assignment).toMatchObject({ id: id(world.bravoAssignment), status: 'completed' })
      await expect(teamStatus(world.bravo)).resolves.toBe('available')
      await expect(db.models.PatrolRecord.countDocuments({ assignment: world.bravoAssignment._id })).resolves.toBe(1)
      expect(again.status).toBe(409)
      expect(again.body.code).toBe('ASSIGNMENT_NOT_ACTIVE')
    })
  })

  describe('emergency dispatch (A4)', () => {
    it('recommends the nearest team and dispatches it to the alert', async () => {
      const recommendation = await as(world.manager).get(`/api/patrol/emergency-dispatches/recommendations?alertId=${id(world.alert)}`)
      const response = await as(world.manager).post('/api/patrol/emergency-dispatches', { alertId: id(world.alert), notes: 'Approach from the north.' })

      expect(recommendation.status).toBe(200)
      expect(recommendation.body).toMatchObject({ mode: 'available', recommended: { team: { name: 'Team Alpha' }, distanceKm: 1.6, etaMinutes: 4 } })
      expect(recommendation.body.divertible.map((candidate) => candidate.team.name)).toEqual(['Team Bravo'])

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        diverted: false,
        team: { name: 'Team Alpha' },
        alert: { id: id(world.alert), title: 'Possible Poaching Activity' },
        assignment: { allocationType: 'emergency', priority: 'critical', alert: id(world.alert) },
        dispatch: { distanceKm: 1.6, etaMinutes: 4, dispatchedBy: id(world.manager) }
      })
      await expect(teamStatus(world.alpha)).resolves.toBe('responding')
      await expect(db.models.Alert.findById(world.alert._id).lean()).resolves.toMatchObject({ status: 'dispatched' })
      await expect(db.models.EmergencyDispatch.countDocuments()).resolves.toBe(1)
    })

    it('resolves the alert when the emergency patrol is completed', async () => {
      const { body } = await as(world.manager).post('/api/patrol/emergency-dispatches', { alertId: id(world.alert) })

      const second = await as(world.manager).post('/api/patrol/emergency-dispatches', { alertId: id(world.alert) })
      const completed = await as(world.manager).patch(`/api/patrol/assignments/${body.assignment.id}/complete`)

      expect(second.status).toBe(409)
      expect(second.body.code).toBe('ALERT_ALREADY_HANDLED')
      expect(completed.status).toBe(200)
      await expect(db.models.Alert.findById(world.alert._id).lean()).resolves.toMatchObject({ status: 'resolved' })
      await expect(teamStatus(world.alpha)).resolves.toBe('available')
    })

    it('diverts a team from its patrol when the manager chooses it', async () => {
      const response = await as(world.manager).post('/api/patrol/emergency-dispatches', { alertId: id(world.alert), teamId: id(world.bravo) })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({ diverted: true, dispatch: { divertedFromAssignment: id(world.bravoAssignment) } })
      await expect(teamStatus(world.bravo)).resolves.toBe('responding')
      await expect(db.models.PatrolAssignment.countDocuments({ team: world.bravo._id, status: 'active' })).resolves.toBe(1)
    })

    it('refuses an alert that is not high or critical', async () => {
      await db.models.Alert.updateOne({ _id: world.alert._id }, { severity: 'medium' })

      const response = await as(world.manager).get(`/api/patrol/emergency-dispatches/recommendations?alertId=${id(world.alert)}`)

      expect(response.status).toBe(422)
      expect(response.body.code).toBe('ALERT_NOT_ELIGIBLE')
    })
  })

  describe('data integrity', () => {
    it('never stores two active assignments for one team', async () => {
      const duplicate = container.repositories.patrolRepository.createAssignment({
        park: world.park._id,
        zone: world.east._id,
        team: world.bravo._id,
        allocationType: 'allocation',
        assignedBy: world.manager._id,
        assignedAt: new Date()
      })

      await expect(duplicate).rejects.toMatchObject({ code: 11000 })
    })

    it('leaves the previous state unchanged when an update fails part-way (E3)', async () => {
      const failing = createAllocationService({
        transactionRunner: createTransactionRunner(db.connection),
        ...container.repositories,
        ...container.services,
        notificationService: { notifyUsers: vi.fn().mockRejectedValue(new Error('notification store unavailable')) }
      })

      const attempt = failing.allocate({ zoneId: id(world.east), teamId: id(world.alpha) }, { id: id(world.manager) })

      await expect(attempt).rejects.toThrow('notification store unavailable')
      await expect(teamStatus(world.alpha)).resolves.toBe('available')
      await expect(db.models.PatrolAssignment.countDocuments({ team: world.alpha._id })).resolves.toBe(0)
      await expect(db.models.AllocationDecision.countDocuments()).resolves.toBe(0)
    })
  })
})
