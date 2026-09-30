const request = require('supertest')
const { createApp } = require('../../app')
const { createTransactionRunner } = require('../../config/database')
const { loadConfig } = require('../../config/env')
const { createContainer, createRepositories } = require('../../container')
const { createSmsGateway } = require('../notifications/sms-gateway')
const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')

const HOUR = 60 * 60 * 1000
const square = (lng, lat) => ({ type: 'Polygon', coordinates: [[[lng, lat], [lng + 0.1, lat], [lng + 0.1, lat + 0.1], [lng, lat + 0.1], [lng, lat]]] })
const TINY_JPEG = `data:image/jpeg;base64,${'A'.repeat(200)}`

/**
 * UC01 through HTTP against an in-memory MongoDB replica set: real routes,
 * validation, repositories and multi-document transactions.
 */
describe.skipIf(!hasTestDatabase)('UC01 conflict response API (in-memory MongoDB)', () => {
  let db
  let app
  let world

  beforeAll(async () => {
    db = await connectTestDatabase('conflicts')
    const config = loadConfig({ JWT_SECRET: 'test-secret' })
    const container = createContainer({
      config,
      repositories: createRepositories(db.models),
      transactionRunner: createTransactionRunner(db.connection),
      smsGateway: createSmsGateway({ logger: {} })
    })
    app = createApp({ config, routes: container.routes, logger: { error: vi.fn() } })
    world = { tokenService: container.tokenService }
  })

  afterAll(async () => {
    await db?.disconnect()
  })

  beforeEach(async () => {
    await db.clear()
    const { Park, Zone, RangerTeam, User } = db.models
    const [park, otherPark] = await Park.create([
      { code: 'YALA', name: 'Yala National Park' },
      { code: 'SINHARAJA', name: 'Sinharaja Forest Reserve' }
    ])
    await Zone.create({ park: park._id, code: 'WEST', name: 'West Sector', boundary: square(81.26, 6.38) })
    const person = (name, role, extra = {}) => ({ name, role, email: `${name.split(' ')[0].toLowerCase()}@example.com`, passwordHash: 'x', ...extra })
    const [villager, otherVillager, officer, outsideOfficer, manager, ranger] = await User.create([
      person('Sunil Bandara', 'villager', { phone: '+94 71 555 0101' }),
      person('Kamala Perera', 'villager'),
      person('Dilani Gunasekara', 'liaison-officer', { park: park._id }),
      person('Ruwan Silva', 'liaison-officer', { park: otherPark._id }),
      person('Sampath Herath', 'park-manager', { park: park._id }),
      person('Nuwan Silva', 'ranger', { park: park._id })
    ])
    const [alpha, bravo] = await RangerTeam.create([
      { park: park._id, code: 'ALPHA', name: 'Team Alpha', status: 'available', members: [ranger._id], lastKnownLocation: { lat: 6.45, lng: 81.31 } },
      { park: park._id, code: 'BRAVO', name: 'Team Bravo', status: 'on-patrol', members: [] }
    ])
    const token = (user) => `Bearer ${world.tokenService.sign(user)}`
    Object.assign(world, { park, otherPark, villager, otherVillager, officer, outsideOfficer, manager, ranger, alpha, bravo, token })
  })

  const as = (user) => ({
    get: (path) => request(app).get(path).set('Authorization', world.token(user)),
    post: (path, body) => request(app).post(path).set('Authorization', world.token(user)).send(body),
    patch: (path, body) => request(app).patch(path).set('Authorization', world.token(user)).send(body ?? {})
  })

  const submission = (overrides = {}) => ({
    parkId: String(world.park._id),
    conflictType: 'crop-damage',
    village: 'Kataragama',
    landmark: 'Near the old tank',
    occurredAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    description: 'A tusker broke the fence and ate the paddy.',
    contactName: 'Sunil Bandara',
    contactPhone: '+94 71 555 0101',
    location: { lat: 6.44, lng: 81.32 },
    damage: { cropType: 'Paddy', affectedAreaAcres: 0.5 },
    ...overrides
  })

  async function submitAndValidate(priority, overrides) {
    const submitted = await as(world.villager).post('/api/conflicts', submission(overrides))
    const id = submitted.body.report.id
    await as(world.officer).patch(`/api/conflicts/${id}/validation`, { decision: 'valid', priority })
    return id
  }

  it('runs the main flow from villager report to resolved outcome', async () => {
    // Step 1: the villager reports the conflict with a photo.
    const submitted = await as(world.villager).post('/api/conflicts', submission({ evidence: [{ caption: 'Fence', dataUrl: TINY_JPEG }] }))
    expect(submitted.status).toBe(201)
    expect(submitted.body.report).toMatchObject({ status: 'submitted', suggestedPriority: 'medium', reference: expect.stringMatching(/^HEC-/) })
    const id = submitted.body.report.id

    // Step 2: the officer sees it in the queue (photos left out of lists) and validates it.
    const queue = await as(world.officer).get('/api/conflicts?view=new')
    expect(queue.status).toBe(200)
    expect(queue.body.counts.new).toBe(1)
    expect(queue.body.reports[0].evidence[0]).not.toHaveProperty('dataUrl')
    const validated = await as(world.officer).patch(`/api/conflicts/${id}/validation`, { decision: 'valid', priority: 'medium' })
    expect(validated.body.report.status).toBe('validated')

    // Step 3: the officer picks the nearest available team and assigns it.
    const teams = await as(world.officer).get(`/api/conflicts/${id}/teams`)
    expect(teams.body.recommended.name).toBe('Team Alpha')
    const deployed = await as(world.officer).post(`/api/conflicts/${id}/deployments`, { teamId: String(world.alpha._id), instructions: 'Approach from the bund' })
    expect(deployed.status).toBe(201)
    expect(deployed.body.route).toBe('direct')
    expect((await db.models.RangerTeam.findById(world.alpha._id)).status).toBe('responding')

    // Step 4: the ranger records actions (one retried after a lost response) and completes the task.
    const mine = await as(world.ranger).get('/api/response-tasks/mine')
    const taskId = mine.body.tasks[0].id
    expect(mine.body.tasks[0].report.reference).toBe(submitted.body.report.reference)
    const action = { clientUpdateId: 'c0ffee00-1111-4222-8333-444455556666', type: 'drive-away', recordedAt: new Date().toISOString(), recordedOffline: true }
    expect((await as(world.ranger).post(`/api/response-tasks/${taskId}/actions`, action)).status).toBe(201)
    const retried = await as(world.ranger).post(`/api/response-tasks/${taskId}/actions`, action)
    expect(retried.status).toBe(200)
    expect(retried.body.duplicate).toBe(true)
    expect(await db.models.ResponseAction.countDocuments()).toBe(1)
    const completed = await as(world.ranger).patch(`/api/response-tasks/${taskId}/complete`, {
      clientUpdateId: 'done-0001-abcd',
      outcome: 'elephant-driven-away',
      completedAt: new Date().toISOString()
    })
    expect(completed.body.task.status).toBe('completed')
    expect((await db.models.RangerTeam.findById(world.alpha._id)).status).toBe('available')

    // Step 5: the officer reviews and resolves; the villager sees the outcome and the history.
    const reviewed = await as(world.officer).patch(`/api/conflicts/${id}/review`, { result: 'resolved', notes: 'Fence repaired' })
    expect(reviewed.body.report.status).toBe('resolved')
    const detail = await as(world.villager).get(`/api/conflicts/${id}`)
    expect(detail.body.report).toMatchObject({ status: 'resolved', outcome: { result: 'resolved', fieldOutcome: 'elephant-driven-away' } })
    expect(detail.body.report.evidence[0].dataUrl).toBe(TINY_JPEG)
    expect(detail.body.report.history.map((entry) => entry.action)).toEqual(['submitted', 'validated', 'team-assigned', 'response-completed', 'reviewed-resolved'])
    expect(detail.body.actions).toHaveLength(1)
    expect(detail.body.report).not.toHaveProperty('contactAttempts')
    expect(await db.models.Notification.countDocuments({ recipient: world.villager._id })).toBeGreaterThanOrEqual(4)
  })

  it('dispatches a critical report as an emergency and resolves its alert on completion (A2)', async () => {
    const id = await submitAndValidate('critical', { conflictType: 'human-threat', immediateDanger: true, damage: undefined })

    const deployed = await as(world.officer).post(`/api/conflicts/${id}/deployments`, { teamId: String(world.alpha._id) })

    expect(deployed.body.route).toBe('emergency')
    const alert = await db.models.Alert.findById(deployed.body.task.alert)
    expect(alert).toMatchObject({ status: 'dispatched', severity: 'critical', source: 'conflict-report' })
    expect(alert.zone).toBeDefined()

    await as(world.ranger).patch(`/api/response-tasks/${deployed.body.task.id}/complete`, {
      clientUpdateId: 'done-0002-abcd',
      outcome: 'situation-contained',
      completedAt: new Date().toISOString()
    })
    expect((await db.models.Alert.findById(alert._id)).status).toBe('resolved')
  })

  it('routes a high-priority deployment through park manager approval', async () => {
    const id = await submitAndValidate('high')
    const proposed = await as(world.officer).post(`/api/conflicts/${id}/deployments`, { teamId: String(world.alpha._id) })
    expect(proposed.body.route).toBe('approval')

    const approvals = await as(world.manager).get('/api/response-tasks/approvals')
    expect(approvals.body.tasks).toHaveLength(1)
    expect(approvals.body.tasks[0].team.name).toBe('Team Alpha')

    const approved = await as(world.manager).patch(`/api/response-tasks/${proposed.body.task.id}/approval`, { decision: 'approve' })
    expect(approved.status).toBe(200)
    expect(approved.body.task).toMatchObject({ status: 'assigned', approval: { decision: 'approved' } })
    expect((await db.models.ConflictReport.findById(id)).status).toBe('response-assigned')
  })

  it('rolls back the team commitment when saving the task fails inside the transaction', async () => {
    const id = await submitAndValidate('medium')
    // An inconsistent open task makes the task insert fail after the team was already committed.
    await db.models.ResponseTask.create({ report: id, park: world.park._id, team: world.bravo._id, status: 'assigned', priority: 'medium', proposedBy: world.officer._id })

    const response = await as(world.officer).post(`/api/conflicts/${id}/deployments`, { teamId: String(world.alpha._id) })

    expect(response.status).toBe(409)
    expect(response.body.code).toBe('TASK_EXISTS')
    expect((await db.models.RangerTeam.findById(world.alpha._id)).status).toBe('available')
    expect((await db.models.ConflictReport.findById(id)).status).toBe('validated')
  })

  it('suggests and links a duplicate report without creating a second task (A4)', async () => {
    const primary = await submitAndValidate('medium')
    const duplicate = (await as(world.otherVillager).post('/api/conflicts', submission({ contactName: 'Kamala Perera', location: { lat: 6.441, lng: 81.321 } }))).body.report.id

    const candidates = await as(world.officer).get(`/api/conflicts/${duplicate}/duplicates`)
    expect(candidates.body.candidates.map((entry) => entry.report.id)).toEqual([primary])

    const linked = await as(world.officer).patch(`/api/conflicts/${duplicate}/duplicate`, { primaryReportId: primary })
    expect(linked.body.report).toMatchObject({ status: 'duplicate', duplicateOf: primary })
    const primaryDetail = await as(world.officer).get(`/api/conflicts/${primary}`)
    expect(primaryDetail.body.report.linkedReports.map((report) => report.id)).toEqual([duplicate])
  })

  it('asks for more information and accepts the villager’s reply (A3)', async () => {
    const id = (await as(world.villager).post('/api/conflicts', submission({ landmark: undefined, location: undefined }))).body.report.id

    const refused = await as(world.officer).patch(`/api/conflicts/${id}/validation`, { decision: 'valid', priority: 'low' })
    expect(refused.status).toBe(422)
    await as(world.officer).patch(`/api/conflicts/${id}/information-request`, { message: 'Which landmark is closest?' })

    const replied = await as(world.villager).patch(`/api/conflicts/${id}/information`, { response: 'Behind the school', landmark: 'Kataragama school' })
    expect(replied.body.report).toMatchObject({ status: 'submitted', locationAdequate: true })
  })

  it('escalates with an alert the park manager sees in UC04 (A5)', async () => {
    const id = await submitAndValidate('medium')

    await as(world.officer).patch(`/api/conflicts/${id}/escalation`, { reason: 'No team is free tonight' })

    const alerts = await as(world.manager).get(`/api/alerts?parkId=${world.park._id}`)
    expect(alerts.body.alerts[0]).toMatchObject({ source: 'conflict-report', status: 'active', title: 'Escalated conflict: Crop damage at Kataragama' })
  })

  it('records contact attempts and an alternative contact (E2)', async () => {
    const id = (await as(world.villager).post('/api/conflicts', submission())).body.report.id

    const retry = await as(world.officer).post(`/api/conflicts/${id}/contact-retry`)
    expect(retry.body.reached).toBe(true)
    const recorded = await as(world.officer).post(`/api/conflicts/${id}/alternative-contact`, { method: 'village-officer', notes: 'Called the Grama Niladhari' })
    expect(recorded.body.report.contactAttempts.map((attempt) => attempt.purpose)).toEqual(['acknowledgement', 'retry', 'alternative-contact'])
  })

  describe('access control and validation', () => {
    it('requires a signed-in user', async () => {
      expect((await request(app).get('/api/conflicts/mine')).status).toBe(401)
    })

    it.each([
      ['a villager opening the officer queue', 'villager', 'get', '/api/conflicts'],
      ['an officer submitting as a villager', 'officer', 'post', '/api/conflicts'],
      ['a ranger approving deployments', 'ranger', 'get', '/api/response-tasks/approvals'],
      ['a manager recording ranger actions', 'manager', 'get', '/api/response-tasks/mine']
    ])('denies %s', async (label, role, method, path) => {
      const response = await as(world[role])[method](path, {})

      expect(response.status).toBe(403)
      expect(response.body.code).toBe('ACCESS_DENIED')
    })

    it('keeps officers to their assigned park and villagers to their own reports', async () => {
      const id = (await as(world.villager).post('/api/conflicts', submission())).body.report.id

      expect((await as(world.outsideOfficer).get(`/api/conflicts/${id}`)).body.code).toBe('OUTSIDE_ASSIGNED_PARK')
      expect((await as(world.otherVillager).get(`/api/conflicts/${id}`)).body.code).toBe('NOT_REPORT_OWNER')
      expect((await as(world.ranger).get(`/api/conflicts/${id}`)).status).toBe(403)
    })

    it('requires damage details for crop damage (A1) and reports each invalid field', async () => {
      const response = await as(world.villager).post('/api/conflicts', submission({ damage: undefined, contactPhone: 'abc', description: 'short' }))

      expect(response.status).toBe(400)
      expect(response.body.details.map((detail) => detail.field)).toEqual(expect.arrayContaining(['description', 'contactPhone', 'damage.cropType']))
    })

    it('requires a priority for a valid report and a reason for rejecting a deployment', async () => {
      const id = (await as(world.villager).post('/api/conflicts', submission())).body.report.id

      const noPriority = await as(world.officer).patch(`/api/conflicts/${id}/validation`, { decision: 'valid' })
      const noReason = await as(world.manager).patch(`/api/response-tasks/${id}/approval`, { decision: 'reject' })

      expect(noPriority.body.details[0]).toEqual({ field: 'priority', message: 'Set a priority for a valid report.' })
      expect(noReason.body.details[0].field).toBe('notes')
    })

    it('rejects photos that are not images or are too large', async () => {
      const response = await as(world.villager).post('/api/conflicts', submission({ evidence: [{ dataUrl: 'data:text/html;base64,AAAA' }] }))

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Photos must be JPEG, PNG or WebP images.')
    })
  })
})
