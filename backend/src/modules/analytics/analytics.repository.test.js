const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')
const { createAnalyticsRepository } = require('./analytics.repository')

it('rejects oversized datasets instead of silently truncating analytics inputs', async () => {
  const query = {
    select() { return this }, sort() { return this }, limit() { return this },
    lean() { return this }, exec: async () => Array.from({ length: 5001 }, () => ({}))
  }
  const model = { find: () => query, aggregate: () => query, base: require('mongoose'), collection: { name: 'wildlifeincidents' } }
  const repository = createAnalyticsRepository({ Alert: model, ConflictReport: model, PatrolRecord: model, WildlifeIncident: model })
  await expect(repository.retrieve({ parkId: '111111111111111111111111', from: new Date(), until: new Date() }))
    .rejects.toMatchObject({ code: 'ANALYTICS_RANGE_TOO_LARGE', status: 422 })
})

describe.skipIf(!hasTestDatabase)('UC02 MongoDB source retrieval', () => {
  let db
  beforeAll(async () => { db = await connectTestDatabase('analytics') })
  afterAll(async () => { await db?.disconnect() })
  beforeEach(async () => { await db.clear() })

  it('filters park/type/date boundaries, selects patrol starts and omits private fields', async () => {
    const { Park, Alert, ConflictReport, PatrolRecord } = db.models
    const [park, other] = await Park.create([{ code: 'YALA', name: 'Yala' }, { code: 'OTHER', name: 'Other' }])
    const from = new Date('2026-10-01T00:00:00Z')
    const until = new Date('2026-10-02T00:00:00Z')
    const alert = (overrides) => ({ park: park._id, type: 'snare', severity: 'high', title: 'Sample field alert', createdAt: from, ...overrides })
    await Alert.create([
      alert({}), alert({ park: other._id }), alert({ type: 'fire' }), alert({ createdAt: until }),
      alert({ createdAt: new Date(from.getTime() - 1) })
    ])
    await ConflictReport.create({ reference: 'TEST', park: park._id, reporter: park._id, conflictType: 'crop-damage',
      village: 'Village', occurredAt: from, description: 'Example damage', contactName: 'Private name', contactPhone: 'Private phone' })
    await PatrolRecord.create([
      { park: park._id, zone: park._id, team: park._id, startTime: new Date(from.getTime() - 3600000), endTime: new Date(from.getTime() + 3600000), syncStatus: 'pending' },
      { park: park._id, zone: park._id, team: park._id, startTime: from, endTime: new Date(until.getTime() + 3600000), syncStatus: 'pending' },
      { park: park._id, zone: park._id, team: park._id, startTime: new Date(from.getTime() - 3600000), endTime: from },
      { park: park._id, zone: park._id, team: park._id, startTime: until },
      { park: other._id, zone: other._id, team: other._id, startTime: from }
    ])
    const repository = createAnalyticsRepository(db.models)
    const selected = await repository.retrieve({ parkId: String(park._id), from, until, incidentType: 'snare' })
    expect(selected.alerts).toHaveLength(1)
    expect(selected.conflicts).toHaveLength(0)
    expect(selected.patrolRecords).toHaveLength(1)
    expect(selected.patrolRecords[0].syncStatus).toBe('pending')
    const all = await repository.retrieve({ parkId: String(park._id), from, until, incidentType: '' })
    expect(all.alerts).toHaveLength(2)
    expect(all.conflicts).toHaveLength(1)
    expect(all.conflicts[0]).not.toHaveProperty('contactPhone')
    expect(all.conflicts[0]).not.toHaveProperty('contactName')
    expect(all.conflicts[0]).not.toHaveProperty('reporter')
    // Verify real MongoDB filtering changes the exact Stage 3 calculation.
    const { calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js')
    const { serialize } = require('../../shared/utils/serialize')
    const context = { park: serialize(park.toObject()), zones: [], period: { from, until },
      filters: { parkId: String(park._id), startDate: '2026-10-01', endDate: '2026-10-01', species: '', incidentType: '' } }
    expect(calculateStatistics({ ...context, records: serialize(all) }).statistics.totalEventRecords).toBe(3)
    const filtered = calculateStatistics({ ...context, filters: { ...context.filters, incidentType: 'snare' }, records: serialize(selected) })
    expect(filtered.statistics.totalEventRecords).toBe(1)
    expect(filtered.context.filters.incidentType).toBe('snare')
  })
  it('filters species without changing patrol context and keeps unspecified legacy records in All', async () => {
    const { Park, Alert, WildlifeIncident, PatrolRecord } = db.models
    const park = await Park.create({ code: 'SPECIES', name: 'Species test park' })
    const other = await Park.create({ code: 'OTHER', name: 'Other park' })
    const from = new Date('2026-10-01T00:00:00Z'), until = new Date('2026-10-02T00:00:00Z')
    const incident = await WildlifeIncident.create({ clientId: 'species-test', payloadFingerprint: 'test', reference: 'SPECIES',
      park: park._id, ranger: park._id, type: 'snare', severity: 'high', description: 'Explicitly identified animal',
      species: ' Test  Species ', observedAt: from, deviceCreatedAt: from, receivedAt: from })
    expect(incident.species).toBe('test species')
    await WildlifeIncident.create({ clientId: 'other-test', payloadFingerprint: 'test', reference: 'OTHER',
      park: other._id, ranger: other._id, type: 'snare', severity: 'high', description: 'Another park animal',
      species: 'private species', observedAt: from, deviceCreatedAt: from, receivedAt: from })
    const base = { park: park._id, type: 'snare', severity: 'high', title: 'Species evidence', createdAt: from }
    await Alert.create([{ ...base, species: incident.species, source: 'ranger-incident', sourceRef: String(incident._id) }, base,
      { ...base, species: 'other species' }, { ...base, park: other._id, species: incident.species }])
    await PatrolRecord.create({ park: park._id, zone: park._id, team: park._id, startTime: from, syncStatus: 'pending' })
    const repository = createAnalyticsRepository(db.models)
    expect(await repository.speciesOptions([park._id])).toEqual([{ id: 'test species', label: 'test species' }])
    const selected = await repository.retrieve({ parkId: String(park._id), from, until, species: 'test species' })
    expect(selected.alerts).toHaveLength(1)
    expect(selected.alerts[0].species).toBe('test species')
    expect(selected.conflicts).toEqual([])
    expect(selected.patrolRecords).toHaveLength(1)
    const all = await repository.retrieve({ parkId: String(park._id), from, until })
    expect(all.alerts).toHaveLength(3)
    const missing = await repository.retrieve({ parkId: String(park._id), from, until, species: 'absent' })
    expect(missing.alerts).toEqual([])
    expect(missing.patrolRecords).toHaveLength(1)
  })

  it('uses incident observation time even after delayed sync, conflict occurrence and patrol start boundaries', async () => {
    const { Park, Zone, Alert, WildlifeIncident, ConflictReport, PatrolRecord } = db.models
    const park = await Park.create({ code: 'EVENTS', name: 'Event park' })
    const other = await Park.create({ code: 'OTHER', name: 'Other park' })
    const zone = await Zone.create({ park: park._id, code: 'NORTH', name: 'North', boundary: { type: 'Polygon', coordinates: [] } })
    const { dateWindow } = require('./analytics.schemas')
    const { DATE_BASIS } = require('./analytics.repository')
    const filters = { parkId: String(park._id), startDate: '2026-10-01', endDate: '2026-10-01', species: '', incidentType: '' }
    const { from, until } = dateWindow(filters)
    const after = new Date(until.getTime() + 86400000)
    for (const [i, observedAt] of [from, new Date(from.getTime() + 1), new Date(until.getTime() - 1), until, new Date(from.getTime() - 1)].entries()) {
      const incident = await WildlifeIncident.create({ clientId: `event-${i}`, reference: `EVENT-${i}`, payloadFingerprint: 'test',
        park: park._id, zone: zone._id, ranger: park._id, type: 'snare', severity: 'high', description: 'Delayed offline observation',
        observedAt, deviceCreatedAt: observedAt, receivedAt: after, recordedOffline: true })
      await Alert.create({ park: park._id, zone: zone._id, type: 'snare', title: 'Delayed incident', severity: 'high',
        source: 'ranger-incident', sourceRef: String(incident._id), createdAt: i < 3 ? after : from })
    }
    const foreign = await WildlifeIncident.create({ clientId: 'foreign', reference: 'FOREIGN', payloadFingerprint: 'test',
      park: other._id, ranger: other._id, type: 'snare', severity: 'high', description: 'Other park event', observedAt: from, deviceCreatedAt: from, receivedAt: after })
    await Alert.create({ park: park._id, type: 'snare', title: 'Bad cross-park reference', severity: 'high',
      source: 'ranger-incident', sourceRef: String(foreign._id), createdAt: after })
    await Alert.create({ park: park._id, type: 'camera-trap', title: 'Legacy camera event', severity: 'low', source: 'camera-trap', createdAt: from })
    for (const [i, occurredAt] of [from, until].entries()) await ConflictReport.create({ reference: `DATE-${i}`, park: park._id, reporter: park._id,
      conflictType: 'crop-damage', village: 'Village', occurredAt, createdAt: i ? from : after, description: 'Occurrence, not receipt', contactName: 'Private', contactPhone: '123' })
    for (const startTime of [new Date(from.getTime() - 1), from, new Date(until.getTime() - 1), until]) await PatrolRecord.create({
      park: park._id, zone: zone._id, team: park._id, startTime, endTime: after, syncStatus: 'synced',
    })
    const records = await createAnalyticsRepository(db.models).retrieve({ ...filters, from, until })
    expect(records.alerts).toHaveLength(4)
    expect(records.alerts.filter((alert) => alert.source === 'ranger-incident')).toHaveLength(3)
    expect(records.alerts.every((alert) => alert.eventAt >= from && alert.eventAt < until)).toBe(true)
    expect(records.alerts.some((alert) => alert.createdAt > until)).toBe(true)
    expect(records.conflicts).toHaveLength(1)
    expect(records.patrolRecords).toHaveLength(2)
    expect(records.patrolRecords.every((patrol) => patrol.startTime >= from && patrol.startTime < until)).toBe(true)
    const { serialize } = require('../../shared/utils/serialize')
    const { calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js')
    const { calculateVisualizations } = await import('../../../../frontend/src/features/analytics/lib/calculateVisualizations.js')
    const dataset = serialize({ filters, park: park.toObject(), zones: [zone.toObject()], records, dateBasis: DATE_BASIS,
      period: { from, until, timeZone: 'Asia/Colombo', endExclusive: true }, retrievedAt: after })
    const result = calculateStatistics(dataset)
    const analysis = calculateVisualizations(result, dataset)
    expect(analysis.trends.buckets).toMatchObject([{ key: '2026-10-01', alerts: 4, conflicts: 1 }])
    expect(analysis.hotspots.hotspots[0].count).toBe(3)
    expect(analysis.coverage.zones[0].references).toHaveLength(2)
    expect(result.context.dateBasis).toBe(DATE_BASIS)
    const { reportSaveBody } = await import('../../../../frontend/src/features/analytics/lib/reportSnapshot.js')
    const body = reportSaveBody({ ...result, analysis, title: 'Event time', findings: '', recommendations: '' }, require('node:crypto').randomUUID(), 'finalized')
    expect(require('./conservation-report.schemas').saveReportBody.parse(JSON.parse(JSON.stringify(body))).snapshot.context.dateBasis).toBe(DATE_BASIS)
    expect(require('./conservation-report.export').exportReport({ ...body, finalizedAt: after })).toContain(DATE_BASIS)
  })

})
