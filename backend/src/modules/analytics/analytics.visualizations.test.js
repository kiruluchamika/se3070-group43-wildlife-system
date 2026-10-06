let calculateStatistics, calculateVisualizations, polygonPositions
beforeAll(async () => {
  ;({ calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js'))
  ;({ calculateVisualizations, polygonPositions } = await import('../../../../frontend/src/features/analytics/lib/calculateVisualizations.js'))
})

const HOUR = 3600000
function fixture() {
  return {
    filters: { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-07', species: '', incidentType: '' },
    park: { id: 'park', name: 'Yala', coveragePolicy: { windowDays: 7 } },
    period: { from: '2026-09-30T18:30:00Z', until: '2026-10-07T18:30:00Z', timeZone: 'Asia/Colombo' },
    retrievedAt: '2026-10-08T00:00:00Z',
    zones: [{ id: 'north', name: 'North', targetWeeklyPatrolHours: 14 }, { id: 'south', name: 'South', targetWeeklyPatrolHours: 7 }],
    records: { alerts: [], conflicts: [], patrolRecords: [] }
  }
}
const alert = (id, overrides = {}) => ({ id, createdAt: '2026-10-01T00:00:00Z', zone: 'north', ...overrides })
const patrol = (id, overrides = {}) => ({ id, zone: 'north', startTime: '2026-10-01T00:00:00Z', endTime: '2026-10-01T07:00:00Z', ...overrides })
const analyze = (input) => calculateVisualizations(calculateStatistics(input), input)

describe('Stage 4 trends', () => {
  it('groups separate sources into local calendar days and fills zero days', () => {
    const input = fixture()
    input.records.alerts = [alert('a1', { createdAt: '2026-10-01T18:29:59Z' }), alert('a2', { createdAt: '2026-10-01T18:30:00Z' })]
    input.records.conflicts = [{ id: 'c1', occurredAt: '2026-10-01T18:30:00Z', createdAt: '2026-10-05T00:00:00Z' }]
    input.records.patrolRecords = [patrol('p1')]
    const { trends } = analyze(input)
    expect(trends.buckets).toHaveLength(7)
    expect(trends.buckets[0]).toMatchObject({ key: '2026-10-01', alerts: 1, conflicts: 0 })
    expect(trends.buckets[1]).toMatchObject({ key: '2026-10-02', alerts: 1, conflicts: 1 })
    expect(trends.buckets[2]).toMatchObject({ alerts: 0, conflicts: 0 })
    expect(trends.buckets.flatMap((bucket) => bucket.references)).toHaveLength(3)
  })
  it('uses months beyond 62 days and respects the exclusive end', () => {
    const input = fixture()
    input.period.until = '2027-01-01T18:30:00Z'
    input.records.alerts = [alert('a1'), alert('a2', { createdAt: input.period.until })]
    const { trends } = analyze(input)
    expect(trends.unit).toBe('month')
    expect(trends.buckets.map((bucket) => bucket.key)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01'])
    expect(trends.buckets.reduce((sum, bucket) => sum + bucket.alerts, 0)).toBe(1)
  })
  it('deduplicates source IDs and changes with filtered input', () => {
    const input = fixture()
    input.records.alerts = [alert('a1'), alert('a1'), alert('a2')]
    expect(analyze(input).trends.buckets[0].alerts).toBe(2)
    input.filters.incidentType = 'snare'
    input.records.alerts = [alert('a2')]
    expect(analyze(input).trends.buckets[0].alerts).toBe(1)
  })
  it('does not count patrol-only data and handles invalid event dates', () => {
    const input = fixture()
    input.records.patrolRecords = [patrol('p1')]
    input.records.alerts = [alert('a1', { createdAt: 'bad' })]
    expect(analyze(input).trends).toMatchObject({ status: 'empty', omitted: 1 })
  })
  it('bounds long-range chart work with a safe section error', () => {
    const input = fixture()
    input.period.until = '2300-01-01T00:00:00Z'
    expect(analyze(input).trends.status).toBe('error')
  })
})

describe('Stage 4 hotspots', () => {
  it.each([[2, false], [3, true], [4, true]])('applies exactly >=3 to %i events', (count, qualifies) => {
    const input = fixture()
    input.records.alerts = Array.from({ length: count }, (_, i) => alert(`a${i}`))
    const { hotspots, supportingCategories } = analyze(input)
    expect(hotspots.threshold).toBe(3)
    expect(hotspots.hotspots).toHaveLength(qualifies ? 1 : 0)
    if (qualifies) expect(hotspots.hotspots[0].count).toBe(count)
    expect(supportingCategories.includes('hotspots')).toBe(qualifies)
    expect(supportingCategories).toContain('trends')
  })
  it('does not count duplicate IDs, patrols or unzoned conflicts', () => {
    const input = fixture()
    input.records.alerts = [alert('a1'), alert('a1'), alert('a2')]
    input.records.patrolRecords = [patrol('p1')]
    input.records.conflicts = [{ id: 'c1', occurredAt: '2026-10-01T00:00:00Z' }]
    expect(analyze(input).hotspots).toMatchObject({ status: 'empty', unzoned: 1 })
  })
  it('does not manufacture zones, and rejects out-of-period events', () => {
    const input = fixture()
    input.records.alerts = [alert('a1', { zone: null }), alert('a2', { zone: 'unknown' }), alert('a3', { createdAt: input.period.until })]
    expect(analyze(input).hotspots).toMatchObject({ status: 'empty', unzoned: 2, represented: [] })
  })
  it('filter changes can remove a hotspot and its supporting category', () => {
    const input = fixture()
    input.records.alerts = [alert('a1'), alert('a2'), alert('a3')]
    expect(analyze(input).hotspots.status).toBe('ready')
    input.records.alerts = [alert('a1')]
    expect(analyze(input).hotspots.status).toBe('empty')
    expect(analyze(input).supportingCategories).not.toContain('hotspots')
  })
})

describe('Stage 4 patrol effort coverage', () => {
  it('matches UC04 hours/target semantics for an entire policy window', () => {
    const input = fixture()
    input.records.patrolRecords = [patrol('p1')]
    const { patrolHoursInWindow } = require('../patrol/coverage.service')
    const expected = patrolHoursInWindow(input.records.patrolRecords, new Date(input.period.from), new Date(input.period.until))
    const { coverage } = analyze(input)
    expect(coverage.zones[0]).toMatchObject({ hours: expected, targetHours: 14, percent: 50 })
    expect(coverage.zones[1].percent).toBe(0)
  })
  it('prorates targets to the selected period and clips crossing patrols', () => {
    const input = fixture()
    input.period.until = '2026-10-01T18:30:00Z'
    input.records.patrolRecords = [patrol('p1', { startTime: '2026-09-30T17:30:00Z', endTime: '2026-09-30T19:30:00Z' })]
    expect(analyze(input).coverage.zones[0]).toMatchObject({ hours: 1, targetHours: 2, percent: 50 })
  })
  it('caps ongoing patrols and targets at retrieval time, not future dates', () => {
    const input = fixture()
    input.retrievedAt = '2026-10-01T18:30:00Z'
    input.records.patrolRecords = [patrol('p1', { startTime: '2026-10-01T17:30:00Z', endTime: null })]
    expect(analyze(input).coverage.zones[0]).toMatchObject({ hours: 1, targetHours: 2, percent: 50 })
  })
  it('uses the park policy window and caps percentages at 100', () => {
    const input = fixture()
    input.park.coveragePolicy.windowDays = 14
    input.records.patrolRecords = [patrol('p1')]
    expect(analyze(input).coverage.zones[0]).toMatchObject({ targetHours: 7, percent: 100 })
  })
  it('remains independent of event filters and deduplicates patrol IDs', () => {
    const input = fixture()
    input.records.patrolRecords = [patrol('p1'), patrol('p1')]
    const before = analyze(input).coverage
    input.records.alerts = [alert('a1')]
    input.filters.incidentType = 'fire'
    expect(analyze(input).coverage).toEqual(before)
    expect(before.zones[0].hours).toBe(7)
    expect(calculateStatistics(input).statistics.totalEventRecords).toBe(1)
  })
  it('handles empty patrols and malformed dates/zones without crashing', () => {
    const input = fixture()
    expect(analyze(input).coverage.status).toBe('empty')
    input.records.patrolRecords = [patrol('p1', { startTime: 'bad' }), patrol('p2', { zone: 'unknown' }), patrol('p3', { endTime: '2020-01-01' })]
    expect(analyze(input).coverage).toMatchObject({ status: 'empty', omitted: 3 })
  })
  it('shows unavailable rather than fabricated percentages for invalid targets', () => {
    const input = fixture()
    input.zones[0].targetWeeklyPatrolHours = 0
    input.records.patrolRecords = [patrol('p1')]
    expect(analyze(input).coverage.zones[0].percent).toBeNull()
  })
  it('treats a future-only period as empty', () => {
    const input = fixture()
    input.retrievedAt = new Date(new Date(input.period.from).getTime() - HOUR).toISOString()
    input.records.patrolRecords = [patrol('p1')]
    expect(analyze(input).coverage).toMatchObject({ status: 'empty', elapsedDays: 0 })
  })
})

describe('Stage 4 geometry and section isolation', () => {
  it('uses valid stored GeoJSON and rejects fabricated/malformed positions', () => {
    const boundary = { type: 'Polygon', coordinates: [[[81, 6], [82, 6], [82, 7], [81, 6]]] }
    expect(polygonPositions(boundary)[0][0]).toEqual([6, 81])
    expect(polygonPositions(null)).toBeNull()
    expect(polygonPositions({ type: 'Polygon', coordinates: [[[999, 6], [81, 7]]] })).toBeNull()
  })
  it('keeps valid trend/hotspot results if patrol policy is malformed', () => {
    const input = fixture()
    input.records.alerts = [alert('a1')]
    input.park.coveragePolicy.windowDays = -1
    expect(analyze(input)).toMatchObject({ trends: { status: 'ready' }, hotspots: { status: 'empty' }, coverage: { status: 'error' } })
  })
})
