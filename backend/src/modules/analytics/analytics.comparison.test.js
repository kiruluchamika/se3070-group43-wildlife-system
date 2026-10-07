const request = require('supertest')
const { randomUUID } = require('node:crypto')
const { comparisonFixture, id } = require('../../test-support/comparison-fixture')
const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')
const { createContainer } = require('../../container')
const { createApp } = require('../../app')
const { loadConfig } = require('../../config/env')
const { createTransactionRunner } = require('../../config/database')
const { retrievalQuery } = require('./analytics.schemas')
const { saveReportBody } = require('./conservation-report.schemas')
let calculateComparison, reportSaveBody, indexSupportingRecords, selectSupportingRecords
beforeAll(async () => {
  ;({ calculateComparison } = await import('../../../../frontend/src/features/analytics/lib/compareParks.js'))
  ;({ reportSaveBody } = await import('../../../../frontend/src/features/analytics/lib/reportSnapshot.js'))
  ;({ indexSupportingRecords, selectSupportingRecords } = await import('../../../../frontend/src/features/analytics/lib/supportingRecords.js'))
})
function input(status = 'draft') {
  return reportSaveBody({ ...calculateComparison(comparisonFixture()), title: 'Two park comparison', findings: 'Distinct park findings', recommendations: 'Review each park independently' }, randomUUID(), status)
}
it('validates distinct permitted-format park IDs without accepting ambiguous or oversized selections', () => {
  const filters = comparisonFixture().filters
  expect(retrievalQuery.parse({ ...filters, parkIds: filters.parkIds.join(',') })).toEqual(filters)
  for (const parkIds of [[], [id(1)], [id(1), id(1)], [id(1), 'bad'], Array.from({ length: 21 }, (_, i) => id(i + 1))]) {
    expect(retrievalQuery.safeParse({ ...filters, parkIds }).success).toBe(false)
  }
  expect(retrievalQuery.safeParse({ ...filters, parkId: id(1) }).success).toBe(false)
})
it('calculates separate trends, hotspots, targets and supporting records without cross-park references', () => {
  const fixture = comparisonFixture()
  const before = structuredClone(fixture)
  const { parks } = calculateComparison(fixture)
  expect(parks.map((park) => park.statistics.totalEventRecords)).toEqual([3, 1])
  expect(parks.map((park) => park.analysis.hotspots.hotspots.length)).toEqual([1, 0])
  expect(parks.map((park) => park.analysis.coverage.zones[0].targetHours)).toEqual([7, 14])
  expect(parks.map((park) => park.analysis.coverage.zones[0].hours)).toEqual([1, 2])
  parks.forEach((park, i) => {
    const rows = selectSupportingRecords(indexSupportingRecords(park), park.analysis, 'trends').rows
    expect(rows).toHaveLength(i ? 1 : 3)
    expect(rows.every(({ record }) => record.park === fixture.filters.parkIds[i])).toBe(true)
  })
  expect(fixture).toEqual(before)
})
it('validates every snapshot section and rejects missing, duplicate, mismatched and cross-park references', () => {
  const body = input()
  expect(saveReportBody.parse(body)).toEqual(body)
  expect(body.snapshot).not.toHaveProperty('statistics')
  for (const mutate of [
    (s) => s.parks.pop(),
    (s) => { s.context.filters.parkIds.reverse() },
    (s) => { s.parks[1].context.filters.species = 'other' },
    (s) => { s.parks[1].statistics.totalEventRecords = 99 },
    (s) => { const ref = s.parks[1].sourceReferences[0]; const old = ref.recordId; ref.recordId = s.parks[0].sourceReferences[0].recordId; s.parks[1].analysis.trends.buckets.forEach((b) => b.references.forEach((r) => { if (r.recordId === old) r.recordId = ref.recordId })) },
  ]) {
    const copy = structuredClone(body)
    mutate(copy.snapshot)
    expect(saveReportBody.safeParse(copy).success).toBe(false)
  }
})

describe.skipIf(!hasTestDatabase)('AF2 authorized retrieval and complete report lifecycle', () => {
  let db, app, container, analyst, token
  beforeAll(async () => { db = await connectTestDatabase('park-comparison') })
  afterAll(async () => db?.disconnect())
  beforeEach(async () => {
    await db.clear()
    const config = loadConfig({ JWT_SECRET: 'comparison-test' })
    container = createContainer({ config, transactionRunner: createTransactionRunner(db.connection) })
    app = createApp({ config, routes: container.routes, logger: { error: vi.fn() } })
    await db.models.Park.create([{ _id: id(1), code: 'FIRST', name: 'First Park' }, { _id: id(2), code: 'SECOND', name: 'Second Park' }])
    analyst = await db.models.User.create({ name: 'Analyst', email: 'analyst@test.lk', passwordHash: 'unused', role: 'data-analyst' })
    token = `Bearer ${container.tokenService.sign(analyst)}`
    const fixture = comparisonFixture()
    for (const data of fixture.datasets) {
      const zone = data.zones[0]
      await db.models.Zone.create({ _id: zone.id, park: data.park.id, code: 'ZONE', name: zone.name, targetWeeklyPatrolHours: zone.targetWeeklyPatrolHours, boundary: { type: 'Polygon', coordinates: [[[81, 6], [82, 6], [82, 7], [81, 6]]] } })
      await db.models.Alert.create(data.records.alerts.map(({ id: recordId, ...record }) => ({ ...record, _id: recordId, type: 'snare', title: 'Test record', severity: 'low' })))
      await db.models.PatrolRecord.create(data.records.patrolRecords.map(({ id: recordId, ...record }) => ({ ...record, _id: recordId, team: id(500) })))
    }
  })
  const save = (body) => request(app).post('/api/reports').set('Authorization', token).send(body)
  it('retrieves isolated datasets and combines only park-labelled freshness metadata', async () => {
    const filters = comparisonFixture().filters
    const response = await request(app).get('/api/analytics').query({ ...filters, parkIds: filters.parkIds.join(',') }).set('Authorization', token)
    expect(response.status).toBe(200)
    expect(response.body).not.toHaveProperty('records')
    expect(response.body.datasets.map((data) => data.records.alerts.length)).toEqual([3, 1])
    expect(response.body.freshness.requiresConfirmation).toBe(true)
    expect(response.body.freshness.affectedSources[0]).toMatchObject({ parkId: id(2), label: expect.stringContaining('Second Park') })
    const body = reportSaveBody({ ...calculateComparison(response.body), title: 'Retrieved comparison', findings: '', recommendations: '' }, randomUUID(), 'draft')
    expect((await save(body)).status).toBe(201)
  })
  it('denies unauthorized parks and roles, and fails missing parks without a partial response', async () => {
    const filters = comparisonFixture().filters
    const get = (parkIds) => request(app).get('/api/analytics').query({ ...filters, parkIds: parkIds.join(',') }).set('Authorization', token)
    expect((await request(app).get('/api/analytics').query({ ...filters, parkIds: filters.parkIds.join(',') })).status).toBe(401)
    expect((await get([id(1), id(999)])).status).toBe(404)
    await db.models.User.updateOne({ _id: analyst.id }, { park: id(1) })
    expect((await get(filters.parkIds)).status).toBe(403)
    expect((await save(input())).status).toBe(403)
    await db.models.User.updateOne({ _id: analyst.id }, { role: 'park-manager' })
    expect((await get(filters.parkIds)).status).toBe(403)
  })
  it('saves one immutable snapshot, edits only narrative and restores all parks and atomically replaces the draft after re-analysis', async () => {
    const body = input()
    const created = await save(body)
    expect(created.status).toBe(201)
    const report = created.body.report
    expect(report.parks).toEqual([id(1), id(2)])
    expect(report.snapshot).toEqual(body.snapshot)
    expect((await save(body)).body.report.id).toBe(report.id)
    expect(await db.models.ConservationReport.countDocuments()).toBe(1)
    const edited = await request(app).patch(`/api/reports/${report.id}`).set('Authorization', token).send({ title: 'Edited comparison', findings: 'New findings', recommendations: '', revision: 0 })
    expect(edited.status).toBe(200)
    expect(edited.body.report.snapshot).toEqual(body.snapshot)
    const restored = await request(app).get(`/api/reports/${report.id}/reanalysis`).set('Authorization', token)
    expect(restored.body.draft.filters).toEqual(body.snapshot.context.filters)
    const list = await request(app).get('/api/reports').set('Authorization', token)
    expect(list.body.reports[0].snapshot.parks.map((park) => park.context.park.name)).toEqual(['First Park', 'Second Park'])
    expect(restored.body.draft.revision).toBe(1)
    expect((await request(app).get(`/api/reports/${report.id}/export`).set('Authorization', token)).status).toBe(409)
    const replacement = { ...input('finalized'), replaceDraft: { id: report.id, revision: restored.body.draft.revision } }
    const saved = await save(replacement)
    expect(saved.status).toBe(201)
    expect(saved.body.report.parks).toEqual([id(1), id(2)])
    expect(saved.body.report.snapshot).toEqual(replacement.snapshot)
    expect((await save(replacement)).body.report.id).toBe(saved.body.report.id)
    expect(await db.models.ConservationReport.countDocuments()).toBe(1)
    expect(await db.models.ConservationReport.findById(report.id)).toBeNull()
  })
  it('requires permission for every park on sharing and after current assignments change', async () => {
    const [local, global] = await db.models.User.create([
      { name: 'Local manager', email: 'local@test.lk', passwordHash: 'x', role: 'park-manager', park: id(1) },
      { name: 'Global manager', email: 'global@test.lk', passwordHash: 'x', role: 'park-manager' },
    ])
    const finalized = (await save(input('finalized'))).body.report
    const draft = (await save(input())).body.report
    const recipients = await request(app).get(`/api/reports/${finalized.id}/recipients`).set('Authorization', token)
    expect(recipients.body.managers.map((user) => user.id)).toEqual([global.id])
    const share = (recipients) => request(app).post(`/api/reports/${finalized.id}/share`).set('Authorization', token).send({ recipients })
    expect((await share([local.id])).status).toBe(403)
    expect((await share([global.id])).status).toBe(200)
    const managerToken = `Bearer ${container.tokenService.sign(global)}`
    expect((await request(app).get(`/api/reports/${finalized.id}`).set('Authorization', managerToken)).status).toBe(200)
    await db.models.User.updateOne({ _id: global.id }, { park: id(1) })
    await db.models.User.updateOne({ _id: analyst.id }, { park: id(1) })
    for (const auth of [token, managerToken]) {
      expect((await request(app).get('/api/reports').set('Authorization', auth)).body.reports).toEqual([])
      for (const suffix of ['', '/export']) expect((await request(app).get(`/api/reports/${finalized.id}${suffix}`).set('Authorization', auth)).status).toBe(404)
    }
    expect((await request(app).get(`/api/reports/${draft.id}/reanalysis`).set('Authorization', token)).status).toBe(404)
    expect((await request(app).patch(`/api/reports/${draft.id}`).set('Authorization', token).send({ title: 'Denied', findings: '', recommendations: '', revision: 0 })).status).toBe(404)
  })
  it('checks all original parks even when replacement filters switch to a permitted single park', async () => {
    const original = (await save(input())).body.report
    await db.models.User.updateOne({ _id: analyst.id }, { park: id(1) })
    const body = input('finalized')
    body.snapshot = body.snapshot.parks[0]
    body.replaceDraft = { id: original.id, revision: 0 }
    expect((await save(body)).status).toBe(404)
    expect(await db.models.ConservationReport.countDocuments()).toBe(1)
    expect(await db.models.ConservationReport.findById(original.id)).not.toBeNull()
  })
  it('downloads a real comparison PDF with both park sections and overview without changing the report', async () => {
    const body = input('finalized')
    body.findings = 'Comparison evidence. '.repeat(220) + 'END-FINDINGS'
    body.recommendations = 'Review both parks. '.repeat(220) + 'END-RECOMMENDATIONS'
    const report = (await save(body)).body.report
    const before = await db.models.ConservationReport.findById(report.id).lean()
    const response = await request(app).get(`/api/reports/${report.id}/export`).set('Authorization', token)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('application/pdf')
    expect(response.body.subarray(0, 5).toString()).toBe('%PDF-')
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loading = getDocument({ data: new Uint8Array(response.body), useSystemFonts: true })
    const pdf = await loading.promise
    try {
      const pages = []
      for (let i = 1; i <= pdf.numPages; i++) pages.push((await (await pdf.getPage(i)).getTextContent()).items.map((item) => item.str).join(' '))
      const text = pages.join(' ')
      for (const value of ['First Park', 'Second Park', 'Comparative Overview', 'test species', 'END-FINDINGS', 'END-RECOMMENDATIONS']) expect(text).toContain(value)
      expect(text.indexOf('First Park')).toBeLessThan(text.indexOf('Second Park'))
      expect(text.indexOf('Second Park')).toBeLessThan(text.indexOf('Comparative Overview'))
      expect(pdf.numPages).toBeGreaterThan(1)
    } finally { await loading.destroy() }
    expect(await db.models.ConservationReport.findById(report.id).lean()).toEqual(before)
  })
})
