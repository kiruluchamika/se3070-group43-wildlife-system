const { connectTestDatabase, hasTestDatabase } = require('../test-support/memory-db')
const { seedAnalyticsSamples, sampleId } = require('./analytics-sample.seed')
const { createAnalyticsRepository } = require('../modules/analytics/analytics.repository')
const { serialize } = require('../shared/utils/serialize')
const { dateWindow } = require('../modules/analytics/analytics.schemas')

describe.skipIf(!hasTestDatabase)('additive UC02 development fixtures', () => {
  let db
  beforeAll(async () => { db = await connectTestDatabase('analytics-samples') })
  afterAll(async () => db?.disconnect())
  beforeEach(async () => db.clear())

  it('refuses missing prerequisites before writing anything', async () => {
    await expect(seedAnalyticsSamples({ models: db.models })).rejects.toThrow('YALA')
    expect(await db.models.Alert.countDocuments()).toBe(0)
    expect(await db.models.RangerTeam.countDocuments()).toBe(0)
  })

  it('demonstrates analytics and preserves every existing document on reruns', async () => {
    const { Park, Zone, User, Alert, PatrolRecord, WildlifeIncident, RangerTeam } = db.models
    const park = await Park.create({ code: 'YALA', name: 'Yala National Park' })
    const boundary = { type: 'Polygon', coordinates: [[[81.3, 6.3], [81.6, 6.3], [81.6, 6.6], [81.3, 6.6], [81.3, 6.3]]] }
    const zones = await Zone.create(['NORTH', 'EAST'].map((code) => ({ park: park._id, code, name: code, boundary, targetWeeklyPatrolHours: 21 })))
    await User.create({ name: 'Test ranger', email: 'sample-test@example.com', passwordHash: 'test', role: 'ranger', park: park._id })
    const existing = await Alert.create({ park: park._id, type: 'other', severity: 'low', title: 'Team-owned data', createdAt: new Date('2020-01-01') })
    const before = await Alert.findById(existing._id).lean()
    const now = new Date('2026-10-08T10:00:00Z')
    const secondPark = await Park.create({ code: 'SINHARAJA', name: 'Sinharaja Forest Reserve' })
    await Zone.create(['KUDAWA', 'CORE'].map((code) => ({ park: secondPark._id, code, name: code, boundary, targetWeeklyPatrolHours: 14 })))
    await User.create({ name: 'Second ranger', email: 'second@example.com', passwordHash: 'test', role: 'ranger', park: secondPark._id })
    const seeded = await seedAnalyticsSamples({ models: db.models, now })
    const first = seeded.parks[0]
    expect(seeded.parks[1]).toMatchObject({ parkId: String(secondPark._id), startDate: first.startDate, endDate: first.endDate, alerts: 6, incidents: 2, patrolRecords: 6 })
    expect(first).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-07', alerts: 8, incidents: 2, patrolRecords: 6 })
    const snapshot = async () => Promise.all([Alert, PatrolRecord, WildlifeIncident, RangerTeam].map((Model) => Model.find().sort({ _id: 1 }).lean()))
    const stored = await snapshot()
    expect(await seedAnalyticsSamples({ models: db.models, now: new Date('2026-11-08') })).toEqual(seeded)
    expect(await snapshot()).toEqual(stored)
    expect(await Alert.findById(existing._id).lean()).toEqual(before)
    expect(await Alert.countDocuments({ simulated: true, status: 'resolved' })).toBe(14)

    const filters = { parkId: String(park._id), startDate: first.startDate, endDate: first.endDate, species: '', incidentType: '' }
    const repository = createAnalyticsRepository(db.models)
    expect((await repository.speciesOptions([park._id])).map((item) => item.id).sort()).toEqual([...first.species].sort())
    const { calculateStatistics } = await import('../../../frontend/src/features/analytics/lib/calculateStatistics.js')
    const { calculateVisualizations } = await import('../../../frontend/src/features/analytics/lib/calculateVisualizations.js')
    for (const species of ['', ...first.species]) {
      const selected = { ...filters, species }
      const records = await repository.retrieve({ ...selected, ...dateWindow(selected) })
      const dataset = { filters: selected, park: serialize(park.toObject()), zones: serialize(zones.map((zone) => zone.toObject())),
        period: dateWindow(selected), retrievedAt: now.toISOString(), records: serialize(records) }
      const result = calculateStatistics(dataset)
      const visual = calculateVisualizations(result, dataset)
      expect(result.statistics.totalEventRecords).toBe(species ? 4 : 8)
      expect(visual.trends.buckets.filter((row) => row.alerts > 0).length).toBeGreaterThan(2)
      expect(visual.hotspots.hotspots).toHaveLength(species ? 1 : 2)
      expect(visual.hotspots.hotspots.every((row) => row.count === 4 && row.references.length === 4)).toBe(true)
      expect(visual.coverage.zones.map((row) => row.hours).sort((a, b) => a - b)).toEqual([9, 12])
      expect(visual.supportingCategories).toContain('hotspots')
      expect(result.sources.alerts.every((record) => record.simulated && record.title.includes('[SIMULATED SAMPLE]'))).toBe(true)
    }
  })
  it('extends older Yala dates into Sinharaja without changing the old sample and demonstrates AF2', async () => {
    const { Park, Zone, User, Alert } = db.models
    const parks = await Park.create([{ code: 'YALA', name: 'Yala' }, { code: 'SINHARAJA', name: 'Sinharaja' }])
    const boundary = { type: 'Polygon', coordinates: [[[80, 6], [82, 6], [82, 7], [80, 6]]] }
    for (const [i, park] of parks.entries()) {
      await Zone.create((i ? ['KUDAWA', 'CORE'] : ['NORTH', 'EAST']).map((code) => ({ park: park._id, code, name: code, boundary, targetWeeklyPatrolHours: 14 })))
      await User.create({ name: 'Existing ranger', email: `ranger-${i}@test.lk`, passwordHash: 'test', role: 'ranger', park: park._id })
    }
    const old = await Alert.create({ _id: sampleId(parks[0]._id, 'alert-0-0'), park: parks[0]._id,
      zone: (await Zone.findOne({ park: parks[0]._id, code: 'NORTH' }))._id,
      type: 'camera-trap', title: '[SIMULATED SAMPLE] Original sample', severity: 'low', species: 'sri lankan leopard',
      source: 'camera-trap', simulated: true, createdAt: new Date('2026-08-01T02:30:00Z') })
    const before = await Alert.findById(old._id).lean()
    const now = new Date('2026-10-08T00:00:00Z')
    const result = await seedAnalyticsSamples({ models: db.models, now })
    expect(result).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-07' })
    expect(await Alert.findById(old._id).lean()).toEqual(before)
    const datasets = []
    for (const park of parks) {
      const filters = { parkId: String(park._id), startDate: result.startDate, endDate: result.endDate, species: '', incidentType: '' }
      const records = await createAnalyticsRepository(db.models).retrieve({ ...filters, ...dateWindow(filters) })
      datasets.push(serialize({ filters, records, park: park.toObject(), zones: await Zone.find({ park: park._id }).lean(),
        period: dateWindow(filters), retrievedAt: now.toISOString() }))
    }
    const { calculateComparison } = await import('../../../frontend/src/features/analytics/lib/compareParks.js')
    const comparison = calculateComparison({ filters: { parkIds: parks.map((park) => String(park._id)), startDate: result.startDate, endDate: result.endDate, species: '', incidentType: '' }, datasets })
    expect(comparison.parks.map((park) => park.statistics.alertRecords)).toEqual([8, 6])
    expect(comparison.parks.map((park) => park.analysis.hotspots.hotspots.length)).toEqual([2, 2])
    expect(comparison.parks.every((park) => park.analysis.coverage.zones.every((zone) => zone.hours > 0))).toBe(true)
    expect(new Set(comparison.parks.flatMap((park) => park.sources.alerts.map((alert) => alert.id))).size).toBe(14)
  })
  it('checks second-park prerequisites before inserting first-park samples', async () => {
    const park = await db.models.Park.create({ code: 'YALA', name: 'Yala' })
    await db.models.Zone.create(['NORTH', 'EAST'].map((code) => ({ park: park._id, code, name: code, boundary: { type: 'Polygon', coordinates: [] } })))
    await db.models.User.create({ name: 'Ranger', email: 'ranger@test.lk', passwordHash: 'test', role: 'ranger', park: park._id })
    await expect(seedAnalyticsSamples({ models: db.models })).rejects.toThrow('SINHARAJA')
    expect(await db.models.Alert.countDocuments()).toBe(0)
    expect(await db.models.RangerTeam.countDocuments()).toBe(0)
  })

})
