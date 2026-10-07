// Exercise the exact frontend pure calculation using the existing Vitest setup.
let calculateStatistics
beforeAll(async () => {
  ;({ calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js'))
})

function dataset() {
  return {
    filters: { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-05', species: '', incidentType: '' },
    park: { id: 'park', name: 'Yala' },
    period: { timeZone: 'Asia/Colombo', from: '2026-09-30T18:30:00Z', until: '2026-10-05T18:30:00Z' },
    retrievedAt: '2026-10-06T00:00:00Z',
    freshness: { requiresConfirmation: false, status: 'unknown' },
    zones: [{ id: 'north' }, { id: 'south' }, { id: 'unused' }],
    records: {
      alerts: [{ id: 'a1', zone: 'north', source: 'camera-trap', simulated: true }, { id: 'a2', zone: 'north', source: 'conflict-report', sourceRef: 'c1' }],
      conflicts: [{ id: 'c1', status: 'validated' }],
      patrolRecords: [{ id: 'p1', zone: 'south' }]
    }
  }
}

describe('Stage 3 source-aware statistics', () => {
  it('counts event records as alerts plus conflicts, excluding patrols', () => {
    expect(calculateStatistics(dataset()).statistics).toEqual({ totalEventRecords: 3, alertRecords: 2, conflictRecords: 1, representedZones: 2, patrolRecords: 1 })
  })
  it('retains linked sources separately instead of claiming a unique incident total', () => {
    const result = calculateStatistics(dataset())
    expect(result.sources.alerts[1].sourceRef).toBe(result.sources.conflicts[0].id)
    expect(result.statistics).not.toHaveProperty('uniqueIncidents')
    expect(result.statistics.totalEventRecords).toBe(3)
  })
  it('counts a zone once and excludes unknown, missing, and unused zone references', () => {
    const input = dataset()
    input.records.alerts.push({ id: 'a3', zone: { id: 'north' } }, { id: 'a4', zone: 'unknown' }, { id: 'a5' })
    const result = calculateStatistics(input)
    expect(result.statistics.representedZones).toBe(2)
    expect(result.representedZoneIds).toEqual(['north', 'south'])
  })
  it('counts identical IDs in different sources separately and repeated IDs within a source once', () => {
    const input = dataset()
    input.records.alerts.push({ ...input.records.alerts[0] })
    input.records.conflicts = [{ id: 'a1' }]
    expect(calculateStatistics(input).statistics.totalEventRecords).toBe(3)
  })
  it('does not remove invalid/duplicate conflict statuses from the already-filtered inventory', () => {
    const input = dataset()
    input.records.conflicts.push({ id: 'invalid', status: 'invalid' }, { id: 'duplicate', status: 'duplicate', duplicateOf: 'c1' })
    expect(calculateStatistics(input).statistics.conflictRecords).toBe(3)
  })
  it('keeps the selected filters associated with the response, without modifying the input', () => {
    const input = dataset()
    const before = JSON.stringify(input)
    const result = calculateStatistics(input)
    expect(result.context.filters).toEqual(input.filters)
    expect(result.context.filters).not.toBe(input.filters)
    expect(result.context.period).toEqual(input.period)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('reflects changed filtered datasets without carrying previous statistics forward', () => {
    const initial = dataset()
    const next = dataset()
    next.filters.incidentType = 'snare'
    next.records.alerts = [next.records.alerts[0]]
    next.records.conflicts = []
    expect(calculateStatistics(initial).statistics.totalEventRecords).toBe(3)
    const result = calculateStatistics(next)
    expect(result.statistics.totalEventRecords).toBe(1)
    expect(result.context.filters.incidentType).toBe('snare')
  })
  it('marks empty sources as empty even when reference zones exist', () => {
    const input = dataset()
    input.records = { alerts: [], conflicts: [], patrolRecords: [] }
    expect(calculateStatistics(input)).toMatchObject({ status: 'empty', statistics: { totalEventRecords: 0, representedZones: 0 } })
  })
  it('handles patrol-only context without inventing incidents', () => {
    const input = dataset()
    input.records.alerts = []
    input.records.conflicts = []
    expect(calculateStatistics(input)).toMatchObject({ status: 'ready', statistics: { totalEventRecords: 0, patrolRecords: 1, representedZones: 1 } })
  })
  it.each([null, undefined, {}, { records: null }])('handles malformed payload %j without throwing', (input) => {
    expect(calculateStatistics(input)).toEqual({ status: 'error', message: 'Unable to generate analysis results. Please try again.' })
  })
  it.each([null, {}, [null], ['bad'], [{ id: null }]])('fails safely instead of showing partial counts for source %j', (value) => {
    const input = dataset()
    input.records.alerts = value
    expect(calculateStatistics(input).status).toBe('error')
  })
  it('preserves the freshness decision and does not reclassify old timestamps', () => {
    const input = dataset()
    input.freshness = { requiresConfirmation: true, affectedSources: [{ lastSuccessfulSyncAt: null }] }
    expect(calculateStatistics(input).freshness).toEqual(input.freshness)
  })
})

it('retains species context without changing statistics formulas and tolerates legacy absence', () => {
  const input = dataset()
  input.filters.species = 'test species'
  const result = calculateStatistics(input)
  expect(result.context.filters.species).toBe('test species')
  expect(result.statistics.totalEventRecords).toBe(3)
  delete input.filters.species
  expect(calculateStatistics(input).status).not.toBe('error')
})
