let reducer, initial, validateReport, calculateStatistics, calculateVisualizations, ReportPreparationPage, React, renderToStaticMarkup
beforeAll(async () => {
  ;({ reportPreparationReducer: reducer, initialReportState: initial, validateReport } = await import('../../../../frontend/src/features/analytics/lib/reportPreparation.js'))
  ;({ calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js'))
  ;({ calculateVisualizations } = await import('../../../../frontend/src/features/analytics/lib/calculateVisualizations.js'))
  ;({ ReportPreparationPage } = await import('../../../../frontend/src/features/analytics/pages/ReportPreparationPage.jsx'))
  React = await import('../../../../frontend/node_modules/react/index.js')
  vi.stubGlobal('React', React)
  ;({ renderToStaticMarkup } = await import('../../../../frontend/node_modules/react-dom/server.node.js'))
})
afterAll(() => vi.unstubAllGlobals())
function fixture() {
  const dataset = {
    filters: { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-07', species: '', incidentType: 'fire' },
    park: { id: 'park', name: 'Yala' },
    period: { from: '2026-09-30T18:30:00Z', until: '2026-10-07T18:30:00Z' },
    retrievedAt: '2026-10-08T00:00:00Z',
    zones: [{ id: 'north', name: 'North', targetWeeklyPatrolHours: 7 }],
    records: { alerts: [{ id: 'a1', zone: 'north', createdAt: '2026-10-01T00:00:00Z' }], conflicts: [], patrolRecords: [] },
  }
  const result = calculateStatistics(dataset)
  return { dataset, result, analysis: calculateVisualizations(result, dataset) }
}
const edit = (state, field, value) => reducer(state, { type: 'edit', field, value })
function prepared() {
  let state = reducer(initial, { type: 'findings' })
  state = edit(state, 'findings', 'One alert record.\nNot a verified unique incident.')
  state = edit(state, 'recommendations', 'Review the supporting alert.')
  state = reducer(state, { type: 'prepare' })
  return edit(state, 'title', 'Yala conservation analysis')
}
function render(state, props = fixture()) {
  return renderToStaticMarkup(React.createElement(ReportPreparationPage, { ...props, state, dispatch: () => {} }))
}
it('requires the explicit findings step before preparation or generation', () => {
  expect(reducer(initial, { type: 'prepare' })).toBe(initial)
  expect(reducer(initial, { type: 'generate' })).toBe(initial)
  expect(reducer(initial, { type: 'findings' }).step).toBe('findings')
})
it('preserves entered findings, recommendations and title through both back actions', () => {
  const state = prepared()
  expect(state.step).toBe('preparation')
  let back = reducer(state, { type: 'findings' })
  back = reducer(back, { type: 'back' })
  expect(back).toEqual({ ...state, step: 'results' })
  back = reducer(back, { type: 'findings' })
  expect(reducer(back, { type: 'prepare' })).toEqual(state)
})
it('leaves analyst observations optional and never invents them', () => {
  const state = reducer(reducer(initial, { type: 'findings' }), { type: 'prepare' })
  expect(state).toMatchObject({ step: 'preparation', findings: '', recommendations: '', errors: {} })
})
it('requires a nonblank title only for generation', () => {
  const state = edit(prepared(), 'title', '   ')
  expect(validateReport(state)).toEqual({})
  expect(reducer(state, { type: 'generate', ...fixture() })).toMatchObject({ handoff: null, errors: { title: 'Enter a report title.' } })
})
it.each(['findings', 'recommendations', 'title'])('validates %s length without discarding input', (field) => {
  const value = 'x'.repeat(field === 'title' ? 201 : 5001)
  const state = edit(prepared(), field, value)
  const next = reducer(state, { type: 'generate', ...fixture() })
  expect(next.errors[field]).toMatch(/characters or fewer/)
  expect(next[field]).toBe(value)
  expect(next.handoff).toBeNull()
})
it('creates only an isolated session handoff with all analysis context and references', () => {
  const props = fixture()
  const before = JSON.stringify(props)
  const state = reducer(prepared(), { type: 'generate', ...props })
  expect(state.step).toBe('preview')
  expect(state.handoff).toEqual({ title: state.title, findings: state.findings, recommendations: state.recommendations,
    context: props.result.context, statistics: props.result.statistics, sources: props.result.sources, dataset: props.dataset, analysis: props.analysis })
  expect(state.handoff.dataset).not.toBe(props.dataset)
  expect(state.handoff).not.toHaveProperty('status')
  expect(state.handoff).not.toHaveProperty('id')
  expect(JSON.stringify(props)).toBe(before)
})
it('invalidates the previous handoff when any report content changes', () => {
  const generated = reducer(prepared(), { type: 'generate', ...fixture() })
  for (const field of ['title', 'findings', 'recommendations']) expect(edit(generated, field, 'Changed').handoff).toBeNull()
})
it('renders findings with current context, optional inputs and explicit forward/back actions', () => {
  const html = render(reducer(prepared(), { type: 'findings' }))
  expect(html).toContain('Findings &amp; Recommendations')
  expect(html).toContain('Yala')
  expect(html).toContain('2026-10-01 to 2026-10-07')
  expect(html).toContain('One alert record.')
  expect(html).toContain('Review the supporting alert.')
  expect(html).toContain('Back to Analysis')
  expect(html).toContain('Continue to Report Preparation')
  expect(html).not.toContain('Generate Report')
})
it('renders preparation values, actual summaries and Generate without draft/finalize controls', () => {
  const html = render(prepared())
  expect(html).toContain('Report Preparation')
  expect(html).toContain('Yala conservation analysis')
  expect(html).toContain('1 (1 alerts, 0 conflicts)')
  expect(html).toContain('7 daily intervals; 1 contributing event records')
  expect(html).toContain('0 zones with at least 3 alert events')
  expect(html).toContain('No contributing patrol intervals.')
  expect(html).toContain('Generate Report')
  expect(html).not.toMatch(/Save as Draft|Save as Finalized|Data freshness/)
})
it('opens Preview after generation and returns to Preparation without losing content', () => {
  const original = prepared()
  const preview = reducer(original, { type: 'generate', ...fixture(), requestId: 'preview-request' })
  expect(preview.step).toBe('preview')
  expect(preview.requestId).toBe('preview-request')
  const back = reducer(preview, { type: 'preparation' })
  expect(back.step).toBe('preparation')
  for (const field of ['title', 'findings', 'recommendations']) expect(back[field]).toBe(original[field])
  expect(preview.handoff).not.toHaveProperty('status')
})
it('discloses failed analysis sections instead of manufacturing zero results', () => {
  const props = fixture()
  props.analysis = { trends: { status: 'error' }, hotspots: { status: 'error' }, coverage: { status: 'error' } }
  expect(render(prepared(), props).match(/Unavailable: calculation failed/g)).toHaveLength(3)
})
