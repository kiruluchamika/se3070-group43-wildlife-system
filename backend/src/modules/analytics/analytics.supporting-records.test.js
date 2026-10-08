let calculateStatistics, calculateVisualizations, indexSupportingRecords, selectSupportingRecords, supportingCategories, supportingReducer, initialSupportingState, EMPTY_MESSAGES
let React, renderToStaticMarkup, AnalysisResultsPage
vi.mock('../../../../frontend/src/features/analytics/components/AnalysisVisualizations.jsx', () => ({ AnalysisVisualizations: () => null }))
beforeAll(async () => {
  React = await import('../../../../frontend/node_modules/react/index.js')
  vi.stubGlobal('React', React)
  ;({ renderToStaticMarkup } = await import('../../../../frontend/node_modules/react-dom/server.node.js'))
  ;({ default: AnalysisResultsPage } = await import('../../../../frontend/src/features/analytics/pages/AnalysisResultsPage.jsx'))
  ;({ calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js'))
  ;({ calculateVisualizations } = await import('../../../../frontend/src/features/analytics/lib/calculateVisualizations.js'))
  ;({ indexSupportingRecords, selectSupportingRecords, supportingCategories, supportingReducer, initialSupportingState, EMPTY_MESSAGES } = await import('../../../../frontend/src/features/analytics/lib/supportingRecords.js'))
})
afterAll(() => vi.unstubAllGlobals())

function fixture() {
  const at = '2026-10-01T00:00:00Z'
  return {
    filters: { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-07', species: '', incidentType: 'fire' },
    park: { id: 'park', name: 'Yala' },
    period: { from: '2026-09-30T18:30:00Z', until: '2026-10-07T18:30:00Z', timeZone: 'Asia/Colombo' },
    retrievedAt: '2026-10-08T00:00:00Z',
    zones: ['north', 'south', 'quiet'].map((id) => ({ id, name: id, targetWeeklyPatrolHours: 7 })),
    records: {
      alerts: ['north', 'south'].flatMap((zone) => [1, 2, 3].map((i) => ({ id: `${zone}${i}`, zone, createdAt: at, type: 'fire' }))),
      conflicts: [{ id: 'north1', occurredAt: at }],
      patrolRecords: ['north', 'south'].map((zone) => ({ id: zone, zone, startTime: at, endTime: '2026-10-01T01:00:00Z', syncStatus: 'pending' })),
    },
  }
}
function prepare(input = fixture()) {
  const result = calculateStatistics(input)
  const analysis = calculateVisualizations(result, input)
  const index = indexSupportingRecords(result)
  return { result, analysis, index, select: (category, zone) => selectSupportingRecords(index, analysis, category, zone) }
}

describe('Stage 5 retained supporting records', () => {
  it.each([true, false])('renders no persistent freshness section after confirmation=%s', (requiresConfirmation) => {
    const input = fixture()
    input.freshness = { requiresConfirmation }
    const html = renderToStaticMarkup(React.createElement(AnalysisResultsPage, { dataset: input }))
    expect(html).toContain('Analysis Results')
    expect(html).not.toMatch(/Data freshness|Last successful synchronization|You chose to continue with available records|No retrieved records are explicitly marked/i)
  })
  it.each([true, false])('renders an enabled common action with hotspots=%s', (hasHotspots) => {
    const input = fixture()
    if (!hasHotspots) input.records.alerts = input.records.alerts.slice(0, 2)
    const html = renderToStaticMarkup(React.createElement(AnalysisResultsPage, { dataset: input }))
    const button = html.match(/<button[^>]*>View Supporting Records<\/button>/)?.[0]
    expect(button).toBeDefined()
    expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/)
    expect(button).toContain('aria-haspopup="dialog"')
    const reportButton = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*?Continue to Report<\/button>/)?.[0]
    expect(reportButton).toBeDefined()
    expect(reportButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })
  it('shows all retained sources and preserves equal IDs across sources', () => {
    const { select } = prepare()
    expect(select('all').rows).toHaveLength(9)
    expect(select('all').rows.filter(({ record }) => record.id === 'north1')).toHaveLength(2)
  })
  it('uses exactly the trend references, excluding patrols and invalid event times', () => {
    const input = fixture()
    input.records.alerts.push({ id: 'invalid', createdAt: 'invalid' })
    const { select, analysis } = prepare(input)
    expect(select('trends').rows.map(({ source, record }) => ({ source, recordId: record.id })))
      .toEqual(analysis.trends.buckets.flatMap((bucket) => bucket.references))
    expect(select('trends').rows).toHaveLength(7)
    expect(select('all').rows).toHaveLength(10)
  })
  it('offers hotspots only for actual hotspot zones', () => {
    const { analysis, select } = prepare()
    expect(supportingCategories(analysis)).toEqual(['all', 'trends', 'hotspots', 'patrol-coverage'])
    expect(select('hotspots').zones.map((zone) => zone.id)).toEqual(['north', 'south'])
  })
  it('keeps other categories and records available without hotspots', () => {
    const input = fixture()
    input.records.alerts = input.records.alerts.slice(0, 2)
    const { analysis, select } = prepare(input)
    expect(supportingCategories(analysis)).toEqual(['all', 'trends', 'patrol-coverage'])
    expect(select('all').rows).toHaveLength(5)
    expect(select('trends').rows).toHaveLength(3)
  })
  it.each(['north', 'south'])('restricts hotspot references to %s', (zone) => {
    const { select } = prepare()
    expect(select('hotspots', zone).rows.map(({ record }) => record.id)).toEqual([1, 2, 3].map((i) => `${zone}${i}`))
  })
  it('uses only contributing patrol intervals, preserving real synchronization state', () => {
    const input = fixture()
    input.records.patrolRecords.push({ id: 'bad', zone: 'north', startTime: 'bad' })
    const { select } = prepare(input)
    expect(select('patrol-coverage').rows).toHaveLength(2)
    expect(select('patrol-coverage', 'south').rows).toEqual([{ source: 'patrolRecords', record: input.records.patrolRecords[1] }])
    expect(select('patrol-coverage', 'quiet').status).toBe('empty')
  })
  it('deduplicates within each source consistently with statistics', () => {
    const input = fixture()
    input.records.alerts.push({ ...input.records.alerts[0] })
    input.records.patrolRecords.push({ ...input.records.patrolRecords[0] })
    const { select, result } = prepare(input)
    expect(select('all').rows).toHaveLength(9)
    expect(select('trends').rows.length).toBe(result.statistics.totalEventRecords)
    expect(select('hotspots', 'north').rows).toHaveLength(3)
  })
  it('resolves only references found in the current analysis dataset', () => {
    const { index, analysis } = prepare()
    analysis.trends.buckets[0].references.push({ source: 'alerts', recordId: 'outside-context' })
    const rows = selectSupportingRecords(index, analysis, 'trends').rows
    expect(rows).toHaveLength(7)
    expect(rows.some(({ record }) => record.id === 'outside-context')).toBe(false)
  })
  it.each(['all', 'trends', 'hotspots', 'patrol-coverage'])('provides an empty state for %s', (category) => {
    const input = fixture()
    input.records = { alerts: [], conflicts: [], patrolRecords: [] }
    expect(prepare(input).select(category)).toMatchObject({ status: 'empty', rows: [] })
    expect(EMPTY_MESSAGES[category]).toMatch(/No /)
  })
  it('distinguishes failed calculations from empty results', () => {
    const { index, analysis } = prepare()
    analysis.trends = { status: 'error' }
    expect(selectSupportingRecords(index, analysis, 'trends').status).toBe('error')
    expect(selectSupportingRecords(index, analysis, 'all').status).toBe('ready')
  })
  it('opens at All Results, resets contextual selections, and closes without changing analysis', () => {
    const input = fixture()
    const { result, analysis, select } = prepare(input)
    const before = JSON.stringify({ input, result, analysis })
    let state = supportingReducer(initialSupportingState, { type: 'open' })
    expect(state).toEqual({ open: true, category: 'all', zoneId: '', page: 0 })
    state = supportingReducer(state, { type: 'category', value: 'hotspots' })
    state = supportingReducer(state, { type: 'zone', value: 'north' })
    state = supportingReducer(state, { type: 'page', value: 2 })
    select(state.category, state.zoneId)
    state = supportingReducer(state, { type: 'category', value: 'trends' })
    expect(state).toMatchObject({ zoneId: '', page: 0 })
    state = supportingReducer(state, { type: 'close' })
    expect(state.open).toBe(false)
    expect(supportingReducer(state, { type: 'open' }).category).toBe('all')
    expect(JSON.stringify({ input, result, analysis })).toBe(before)
  })
})
