const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')
const { createAnalyticsRepository } = require('./analytics.repository')

it('rejects oversized datasets instead of silently truncating analytics inputs', async () => {
  const query = {
    select() { return this }, sort() { return this }, limit() { return this },
    lean: async () => Array.from({ length: 5001 }, () => ({}))
  }
  const model = { find: () => query }
  const repository = createAnalyticsRepository({ Alert: model, ConflictReport: model, PatrolRecord: model })
  await expect(repository.retrieve({ parkId: '111111111111111111111111', from: new Date(), until: new Date() }))
    .rejects.toMatchObject({ code: 'ANALYTICS_RANGE_TOO_LARGE', status: 422 })
})

describe.skipIf(!hasTestDatabase)('UC02 MongoDB source retrieval', () => {
  let db
  beforeAll(async () => { db = await connectTestDatabase('analytics') })
  afterAll(async () => { await db?.disconnect() })
  beforeEach(async () => { await db.clear() })

  it('filters park/type/date boundaries, retains overlapping patrols and omits private fields', async () => {
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

})
