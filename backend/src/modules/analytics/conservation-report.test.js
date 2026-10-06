const request = require('supertest')
const { randomUUID } = require('node:crypto')
const { createApp } = require('../../app')
const { createAuthenticate } = require('../../shared/middleware/authenticate')
const { createTokenService } = require('../../shared/security/token-service')
const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')
const { createReportRouter } = require('./conservation-report.routes')
const { createReportService } = require('./conservation-report.service')
const { createReportRepository } = require('./conservation-report.repository')
const { saveReportBody } = require('./conservation-report.schemas')
const { createUserRepository } = require('../users/user.repository')
const { createNotificationRepository } = require('../notifications/notification.repository')
const { createNotificationService } = require('../notifications/notification.service')
const { createTransactionRunner } = require('../../config/database')

const parkId = '111111111111111111111111'
const author = '222222222222222222222222'
const otherAuthor = '333333333333333333333333'
let calculateStatistics, calculateVisualizations, reportSaveBody
beforeAll(async () => {
  ;({ calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js'))
  ;({ calculateVisualizations } = await import('../../../../frontend/src/features/analytics/lib/calculateVisualizations.js'))
  ;({ reportSaveBody } = await import('../../../../frontend/src/features/analytics/lib/reportSnapshot.js'))
})
function input(status = 'draft') {
  const zone = '444444444444444444444444'
  const dataset = {
    filters: { parkId, startDate: '2026-10-01', endDate: '2026-10-07', incidentType: '', species: '' },
    park: { id: parkId, name: 'Yala' },
    zones: [{ id: zone, name: 'North', targetWeeklyPatrolHours: 7 }],
    retrievedAt: '2026-10-08T00:00:00Z',
    period: { from: '2026-09-30T18:30:00Z', until: '2026-10-07T18:30:00Z', timeZone: 'Asia/Colombo', endExclusive: true },
    records: {
      alerts: [1, 2, 3].map((i) => ({ id: `${i}`.repeat(24), zone, createdAt: '2026-10-01T00:00:00Z' })),
      conflicts: [{ id: '555555555555555555555555', occurredAt: '2026-10-01T00:00:00Z' }],
      patrolRecords: [{ id: '666666666666666666666666', zone, startTime: '2026-10-01T00:00:00Z', endTime: '2026-10-01T01:00:00Z' }],
    },
  }
  const result = calculateStatistics(dataset)
  return reportSaveBody({ ...result, analysis: calculateVisualizations(result, dataset), title: 'Conservation review', findings: 'Three alerts, one conflict.', recommendations: 'Review source records.' }, randomUUID(), status)
}

describe('report snapshot contract', () => {
  it('accepts the actual Stage 6/7 snapshot and retains result references', () => {
    const body = input()
    expect(saveReportBody.parse(body)).toEqual(body)
    expect(body.snapshot.sourceReferences).toHaveLength(5)
    expect(body.snapshot.analysis.hotspots.hotspots[0].count).toBe(3)
    expect(body.snapshot).not.toHaveProperty('dataset')
  })
  it.each(['preview', '', 'published'])('rejects saving status %s', (status) => {
    const body = input()
    body.status = status
    expect(saveReportBody.safeParse(body).success).toBe(false)
  })
  it('rejects mismatched parks, dates, invented species and source totals', () => {
    const body = input()
    for (const mutate of [
      (copy) => { copy.snapshot.context.park.id = otherAuthor },
      (copy) => { copy.snapshot.context.filters.startDate = '2026-10-02' },
      (copy) => { copy.snapshot.context.filters.species = 'elephant' },
      (copy) => { copy.snapshot.statistics.totalEventRecords = 50 },
      (copy) => { copy.snapshot.analysis.trends.buckets[0].alerts = 50 },
      (copy) => { copy.snapshot.analysis.coverage.zones[0].references[0].source = 'alerts' },
    ]) {
      const copy = structuredClone(body)
      mutate(copy)
      expect(saveReportBody.safeParse(copy).success).toBe(false)
    }
  })
  it('rejects blank/oversized narrative fields and client-supplied ownership', () => {
    const body = input()
    for (const extra of [{ title: '   ' }, { title: 'x'.repeat(201) }, { findings: 'x'.repeat(5001) }, { recommendations: 'x'.repeat(5001) }, { author: otherAuthor }, { finalizedAt: new Date().toISOString() }]) {
      expect(saveReportBody.safeParse({ ...body, ...extra }).success).toBe(false)
    }
  })
  it('rejects duplicate references and unknown source IDs in results', () => {
    const body = input()
    body.snapshot.sourceReferences.push(body.snapshot.sourceReferences[0])
    expect(saveReportBody.safeParse(body).success).toBe(false)
    const other = input()
    other.snapshot.analysis.hotspots.hotspots[0].references[0].recordId = '999999999999999999999999'
    expect(saveReportBody.safeParse(other).success).toBe(false)
  })
})

describe.skipIf(!hasTestDatabase)('UC02 persisted draft/finalized reports', () => {
  let db, app, tokens, userRepository, parkRepository, notificationService
  const auth = (id = author, role = 'data-analyst') => `Bearer ${tokens.sign({ _id: id, role })}`
  const save = (body, token = auth()) => request(app).post('/api/reports').set('Authorization', token).send(body)
  beforeAll(async () => { db = await connectTestDatabase('conservation-reports') })
  afterAll(async () => { await db?.disconnect() })
  beforeEach(async () => {
    await db.clear()
    await db.models.Park.create({ _id: parkId, code: 'YALA', name: 'Yala' })
    userRepository = { ...createUserRepository(db.models.User), findById: vi.fn(async (id) =>
      await db.models.User.findById(id).lean() || { _id: id, role: 'data-analyst', park: parkId }) }
    parkRepository = { findParkById: (id) => db.models.Park.findById(id).lean() }
    notificationService = createNotificationService({ notificationRepository: createNotificationRepository(db.models.Notification) })
    const service = createReportService({ reportRepository: createReportRepository(db.models.ConservationReport), userRepository, parkRepository,
      notificationService, transactionRunner: createTransactionRunner(db.connection), clock: () => new Date('2026-10-09T00:00:00Z') })
    tokens = createTokenService({ secret: 'report-test-secret', expiresIn: '1h' })
    app = createApp({ config: { clientOrigins: [] }, logger: { error: vi.fn() }, routes: [
      { path: '/api/reports', router: createReportRouter({ reportService: service, authenticate: createAuthenticate({ tokenService: tokens }) }) },
    ] })
  })
  async function managers() {
    return db.models.User.create([
      { name: 'Local manager', email: 'local@test.lk', passwordHash: 'test', role: 'park-manager', park: parkId },
      { name: 'Global manager', email: 'global@test.lk', passwordHash: 'test', role: 'park-manager' },
      { name: 'Other park manager', email: 'other@test.lk', passwordHash: 'test', role: 'park-manager', park: otherAuthor },
      { name: 'Analyst', email: 'analyst@test.lk', passwordHash: 'test', role: 'data-analyst', park: parkId },
    ])
  }
  const share = (id, recipients, token = auth()) => request(app).post(`/api/reports/${id}/share`).set('Authorization', token).send({ recipients })
  it('lists only local and park-unassigned managers, without private user fields', async () => {
    const users = await managers()
    const report = (await save(input('finalized'))).body.report
    const response = await request(app).get(`/api/reports/${report.id}/recipients`).set('Authorization', auth())
    expect(response.status).toBe(200)
    expect(response.body.managers).toEqual(users.slice(0, 2).map((user) => ({ id: String(user._id), name: user.name })))
  })
  it('shares atomically with multiple managers, enabling only their read/export access', async () => {
    const users = await managers()
    const report = (await save(input('finalized'))).body.report
    const before = await db.models.ConservationReport.findById(report.id).lean()
    const ids = users.slice(0, 2).map((user) => String(user._id))
    expect((await share(report.id, ids)).body).toEqual({ sharedCount: 2, newlySharedCount: 2 })
    for (const id of ids) {
      const token = auth(id, 'park-manager')
      expect((await request(app).get(`/api/reports/${report.id}`).set('Authorization', token)).status).toBe(200)
      expect((await request(app).get(`/api/reports/${report.id}/export`).set('Authorization', token)).status).toBe(200)
      expect((await request(app).get('/api/reports').set('Authorization', token)).body.reports).toHaveLength(1)
      expect((await share(report.id, ids, token)).status).toBe(403)
    }
    expect((await request(app).get(`/api/reports/${report.id}`).set('Authorization', auth(String(users[2]._id), 'park-manager'))).status).toBe(404)
    const stored = await db.models.ConservationReport.findById(report.id).lean()
    expect({ ...stored, sharedWith: [] }).toEqual({ ...before, sharedWith: [] })
    const notifications = await db.models.Notification.find().lean()
    expect(notifications).toHaveLength(2)
    expect(notifications[0]).toMatchObject({ type: 'conservation-report', link: `/reports?reportId=${report.id}` })
  })
  it('deduplicates repeated recipients and concurrent share requests', async () => {
    const [manager] = await managers()
    const report = (await save(input('finalized'))).body.report
    const id = String(manager._id)
    const responses = await Promise.all([share(report.id, [id, id]), share(report.id, [id])])
    expect(responses.map((value) => value.status)).toEqual([200, 200])
    expect(await db.models.Notification.countDocuments()).toBe(1)
    expect((await db.models.ConservationReport.findById(report.id)).sharedWith).toHaveLength(1)
  })
  it('rolls back share access if notifications fail and permits a clean retry', async () => {
    const [manager] = await managers()
    const report = (await save(input('finalized'))).body.report
    const failure = vi.spyOn(notificationService, 'notifyUsers').mockRejectedValueOnce(new Error('private delivery details'))
    const response = await share(report.id, [String(manager._id)])
    expect(response.status).toBe(500)
    expect(JSON.stringify(response.body)).not.toContain('private delivery')
    expect((await db.models.ConservationReport.findById(report.id)).sharedWith).toHaveLength(0)
    failure.mockRestore()
    expect((await share(report.id, [String(manager._id)])).status).toBe(200)
    expect(await db.models.Notification.countDocuments()).toBe(1)
  })
  it('rejects empty, wrong-park, non-manager and unauthorized-owner shares', async () => {
    const users = await managers()
    const report = (await save(input('finalized'))).body.report
    expect((await share(report.id, [])).status).toBe(400)
    for (const user of users.slice(2)) expect((await share(report.id, [String(user._id)])).status).toBe(403)
    expect((await share(report.id, [String(users[0]._id)], auth(otherAuthor))).status).toBe(404)
    expect(await db.models.Notification.countDocuments()).toBe(0)
  })
  it('denies all Draft sharing/export and returns an empty eligible list when none exist', async () => {
    const draft = (await save(input())).body.report
    for (const action of ['recipients', 'export']) expect((await request(app).get(`/api/reports/${draft.id}/${action}`).set('Authorization', auth())).status).toBe(409)
    expect((await share(draft.id, [otherAuthor])).status).toBe(409)
    const finalized = (await save(input('finalized'))).body.report
    expect((await request(app).get(`/api/reports/${finalized.id}/recipients`).set('Authorization', auth())).body.managers).toEqual([])
  })
  it('rechecks a shared manager’s current role and park on read/export', async () => {
    const [manager] = await managers()
    const report = (await save(input('finalized'))).body.report
    await share(report.id, [String(manager._id)])
    await db.models.User.updateOne({ _id: manager._id }, { $set: { park: otherAuthor } })
    expect((await request(app).get(`/api/reports/${report.id}/export`).set('Authorization', auth(String(manager._id), 'park-manager'))).status).toBe(404)
    await db.models.User.updateOne({ _id: manager._id }, { $set: { role: 'ranger', park: parkId } })
    expect((await request(app).get(`/api/reports/${report.id}`).set('Authorization', auth(String(manager._id), 'park-manager'))).status).toBe(403)
  })
  it('exports complete escaped finalized content without modifying the stored report', async () => {
    const body = input('finalized')
    body.title = '<script>alert(1)</script> Conservation'
    body.findings = 'Unicode: සිංහල\nMultiple lines <img src=x>'
    const report = (await save(body)).body.report
    const before = await db.models.ConservationReport.findById(report.id).lean()
    const response = await request(app).get(`/api/reports/${report.id}/export`).set('Authorization', auth())
    expect(response.status).toBe(200)
    const { html } = response.body
    for (const content of ['Status: Finalized', 'Yala', '2026-10-01 to 2026-10-07', 'Statistics', 'Trends', 'Hotspots', 'Patrol coverage', 'North', 'Recommendations', body.recommendations, 'සිංහල', '&lt;script&gt;']) expect(html).toContain(content)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('sharedWith')
    expect(await db.models.ConservationReport.findById(report.id).lean()).toEqual(before)
    expect((await request(app).get(`/api/reports/${report.id}/export`).set('Authorization', auth(otherAuthor))).status).toBe(404)
  })
  it.each(['draft', 'finalized'])('persists %s with server ownership, timestamps and the exact analysis snapshot', async (status) => {
    const body = input(status)
    expect(await db.models.ConservationReport.countDocuments()).toBe(0)
    const response = await save(body)
    expect(response.status).toBe(201)
    expect(response.body.report).toMatchObject({ author, park: parkId, status, snapshot: body.snapshot, title: body.title, findings: body.findings, recommendations: body.recommendations })
    expect(response.body.report.createdAt).toBeTruthy()
    expect(response.body.report.finalizedAt).toBe(status === 'draft' ? null : '2026-10-09T00:00:00.000Z')
    expect(response.body.report).not.toHaveProperty('contentHash')
    const stored = await db.models.ConservationReport.findById(response.body.report.id).lean()
    expect(stored.status).toBe(status)
    expect(stored.snapshot).toEqual(body.snapshot)
    const detail = await request(app).get(`/api/reports/${response.body.report.id}`).set('Authorization', auth())
    expect(detail.status).toBe(200)
    expect(detail.body.report.snapshot).toEqual(body.snapshot)
    expect(detail.headers['cache-control']).toBe('no-store')
  })
  it('retries the same save safely, including concurrent requests', async () => {
    const body = input()
    const results = await Promise.all([save(body), save(body), save(body)])
    expect(results.map((response) => response.status)).toEqual([201, 201, 201])
    expect(new Set(results.map((response) => response.body.report.id)).size).toBe(1)
    expect(await db.models.ConservationReport.countDocuments()).toBe(1)
  })
  it('does not change a saved Draft to Finalized through a retry', async () => {
    const body = input()
    await save(body)
    expect((await save({ ...body, status: 'finalized' })).status).toBe(409)
    expect((await db.models.ConservationReport.findOne()).status).toBe('draft')
  })
  it('restricts list and detail to the current owner, and rejects status changes on edit', async () => {
    const saved = (await save(input())).body.report
    const anotherList = await request(app).get('/api/reports').set('Authorization', auth(otherAuthor))
    expect(anotherList.body.reports).toEqual([])
    expect((await request(app).get(`/api/reports/${saved.id}`).set('Authorization', auth(otherAuthor))).status).toBe(404)
    expect((await request(app).patch(`/api/reports/${saved.id}`).set('Authorization', auth()).send({ status: 'finalized' })).status).toBe(400)
    const own = await request(app).get('/api/reports').set('Authorization', auth())
    expect(own.body.reports[0]).toMatchObject({ id: saved.id, status: 'draft' })
    expect(own.body.reports[0].snapshot).not.toHaveProperty('analysis')
  })
  it('requires authentication and rejects non-analysts including managers', async () => {
    expect((await request(app).post('/api/reports').send(input())).status).toBe(401)
    for (const role of ['park-manager', 'ranger', 'villager']) expect((await save(input(), auth(author, role))).status).toBe(403)
    expect(await db.models.ConservationReport.countDocuments()).toBe(0)
  })
  it('rechecks database role, deleted accounts and assigned park', async () => {
    userRepository.findById.mockResolvedValueOnce({ role: 'ranger' })
    expect((await save(input())).status).toBe(403)
    userRepository.findById.mockResolvedValueOnce(null)
    expect((await save(input())).status).toBe(401)
    userRepository.findById.mockResolvedValueOnce({ role: 'data-analyst', park: otherAuthor })
    expect((await save(input())).status).toBe(403)
    expect(await db.models.ConservationReport.countDocuments()).toBe(0)
  })
  it('does not save invalid snapshots and supports safe database failure responses', async () => {
    const body = input()
    body.snapshot.statistics.totalEventRecords = 999
    expect((await save(body)).status).toBe(400)
    userRepository.findById.mockRejectedValueOnce(new Error('private database error'))
    const failed = await save(input())
    expect(failed.status).toBe(500)
    expect(JSON.stringify(failed.body)).not.toContain('private database')
    expect(await db.models.ConservationReport.countDocuments()).toBe(0)
  })
  it('edits only draft text, preserving status, source snapshot and identity', async () => {
    const original = (await save(input())).body.report
    const edits = { title: 'Updated title', findings: 'New observations', recommendations: 'New recommendation', revision: 0 }
    const response = await request(app).patch(`/api/reports/${original.id}`).set('Authorization', auth()).send(edits)
    expect(response.status).toBe(200)
    expect(response.body.report).toMatchObject({ id: original.id, status: 'draft', title: edits.title, findings: edits.findings, recommendations: edits.recommendations, revision: 1, finalizedAt: null })
    expect(response.body.report.snapshot).toEqual(original.snapshot)
    expect(response.body.report.createdAt).toBe(original.createdAt)
    const reopened = await request(app).get(`/api/reports/${original.id}`).set('Authorization', auth())
    expect(reopened.body.report.title).toBe(edits.title)
    expect(await db.models.ConservationReport.countDocuments()).toBe(1)
  })
  it('supports legacy drafts without a revision and safe retries of a lost edit response', async () => {
    const original = (await save(input())).body.report
    await db.models.ConservationReport.collection.updateOne({ _id: new db.models.ConservationReport.base.Types.ObjectId(original.id) }, { $unset: { revision: '' } })
    const edits = { title: 'Retry title', findings: '', recommendations: '', revision: 0 }
    for (let i = 0; i < 2; i++) {
      const response = await request(app).patch(`/api/reports/${original.id}`).set('Authorization', auth()).send(edits)
      expect(response.status).toBe(200)
      expect(response.body.report.revision).toBe(1)
    }
  })
  it('rejects stale or concurrent edits instead of silently overwriting newer text', async () => {
    const original = (await save(input())).body.report
    const edit = (title) => request(app).patch(`/api/reports/${original.id}`).set('Authorization', auth()).send({ title, findings: '', recommendations: '', revision: 0 })
    const responses = await Promise.all([edit('A'), edit('B')])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    const stored = await db.models.ConservationReport.findById(original.id).lean()
    expect(stored.title).toBe(responses.find((response) => response.status === 200).body.report.title)
    expect(stored.revision).toBe(1)
  })
  it('enforces title/narrative limits and rejects editable filters/status/snapshot', async () => {
    const original = (await save(input())).body.report
    const edits = { title: 'Valid', findings: '', recommendations: '', revision: 0 }
    for (const extra of [{ title: ' ' }, { title: 'x'.repeat(201) }, { findings: 'x'.repeat(5001) }, { recommendations: 'x'.repeat(5001) }, { status: 'finalized' }, { snapshot: original.snapshot }, { revision: -1 }, { author: otherAuthor }]) {
      expect((await request(app).patch(`/api/reports/${original.id}`).set('Authorization', auth()).send({ ...edits, ...extra })).status).toBe(400)
    }
    expect((await db.models.ConservationReport.findById(original.id)).title).toBe(original.title)
  })
  it('makes finalized reports read-only, including re-analysis', async () => {
    const original = (await save(input('finalized'))).body.report
    expect((await request(app).patch(`/api/reports/${original.id}`).set('Authorization', auth()).send({ title: 'Changed', findings: '', recommendations: '', revision: 0 })).status).toBe(409)
    expect((await request(app).get(`/api/reports/${original.id}/reanalysis`).set('Authorization', auth())).status).toBe(409)
    expect((await db.models.ConservationReport.findById(original.id)).title).toBe(original.title)
  })
  it('enforces current account, owner and park checks for edit and filter restoration', async () => {
    const original = (await save(input())).body.report
    const edit = (token) => request(app).patch(`/api/reports/${original.id}`).set('Authorization', token).send({ title: 'Changed', findings: '', recommendations: '', revision: 0 })
    const restore = (token) => request(app).get(`/api/reports/${original.id}/reanalysis`).set('Authorization', token)
    for (const call of [edit, restore]) {
      expect((await call(auth(otherAuthor))).status).toBe(404)
      expect((await call(auth(author, 'park-manager'))).status).toBe(403)
      userRepository.findById.mockResolvedValueOnce({ role: 'data-analyst', park: otherAuthor })
      expect((await call(auth())).status).toBe(404)
      userRepository.findById.mockResolvedValueOnce(null)
      expect((await call(auth())).status).toBe(401)
      userRepository.findById.mockResolvedValueOnce({ role: 'ranger' })
      expect((await call(auth())).status).toBe(403)
    }
  })
  it('restores only saved filters, and a new result creates a separate report without changing the old Draft', async () => {
    const original = (await save(input())).body.report
    const before = await db.models.ConservationReport.findById(original.id).lean()
    const restored = await request(app).get(`/api/reports/${original.id}/reanalysis`).set('Authorization', auth())
    expect(restored.status).toBe(200)
    expect(restored.body.draft).toEqual({ id: original.id, title: original.title, filters: original.snapshot.context.filters })
    // Restoring, changing local filters, or cancelling never issues an update.
    restored.body.draft.filters.startDate = '2026-10-02'
    expect(await db.models.ConservationReport.findById(original.id).lean()).toEqual(before)
    const next = (await save(input('finalized'))).body.report
    expect(next.id).not.toBe(original.id)
    expect(next.status).toBe('finalized')
    expect(await db.models.ConservationReport.findById(original.id).lean()).toEqual(before)
    expect(await db.models.ConservationReport.countDocuments()).toBe(2)
  })
})
