const { connectTestDatabase, hasTestDatabase } = require('../test-support/memory-db')
const { seedAnalyticsSamples } = require('./analytics-sample.seed')
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
    const first = await seedAnalyticsSamples({ models: db.models, now })
    expect(first).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-07', alerts: 8, incidents: 2, patrolRecords: 6 })
    const snapshot = async () => Promise.all([Alert, PatrolRecord, WildlifeIncident, RangerTeam].map((Model) => Model.find().sort({ _id: 1 }).lean()))
    const stored = await snapshot()
    expect(await seedAnalyticsSamples({ models: db.models, now: new Date('2026-11-08') })).toEqual(first)
    expect(await snapshot()).toEqual(stored)
    expect(await Alert.findById(existing._id).lean()).toEqual(before)
    expect(await Alert.countDocuments({ simulated: true, status: 'resolved' })).toBe(8)

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
})
