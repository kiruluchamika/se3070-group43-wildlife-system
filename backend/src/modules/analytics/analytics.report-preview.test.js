// Test the actual preview's event callbacks with a hook harness. These are not
// DOM/focus tests; ReportContent is separately rendered through React DOM SSR.
const harness = vi.hoisted(() => ({ slots: [], cursor: 0, post: vi.fn(), navigate: vi.fn() }))
vi.mock('../../../../frontend/node_modules/react/index.js', async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = harness.cursor++
    if (!(index in harness.slots)) harness.slots[index] = initial
    return [harness.slots[index], (value) => { harness.slots[index] = value }]
  },
  useRef(initial) {
    const index = harness.cursor++
    if (!(index in harness.slots)) harness.slots[index] = { current: initial }
    return harness.slots[index]
  },
  useMemo: (work) => work(),
  useEffect: () => {},
}))
vi.mock('../../../../frontend/node_modules/react-router/dist/development/index.js', () => ({ useNavigate: () => harness.navigate }))
vi.mock('../../../../frontend/node_modules/react-router/dist/production/index.js', () => ({ useNavigate: () => harness.navigate }))
vi.mock('../../../../frontend/src/lib/api.js', () => ({ api: { post: harness.post } }))
let Preview, Content, React, renderToStaticMarkup, snapshot, saveBody
beforeAll(async () => {
  React = await import('../../../../frontend/node_modules/react/index.js')
  vi.stubGlobal('React', React)
  ;({ renderToStaticMarkup } = await import('../../../../frontend/node_modules/react-dom/server.node.js'))
  ;({ ReportPreviewPage: Preview } = await import('../../../../frontend/src/features/analytics/pages/ReportPreviewPage.jsx'))
  ;({ ReportContent: Content } = await import('../../../../frontend/src/features/analytics/components/ReportContent.jsx'))
  ;({ reportSnapshot: snapshot, reportSaveBody: saveBody } = await import('../../../../frontend/src/features/analytics/lib/reportSnapshot.js'))
})
beforeEach(() => { harness.slots = []; harness.post.mockReset(); harness.navigate.mockReset() })
afterAll(() => vi.unstubAllGlobals())
function handoff() {
  return {
    title: 'Yala <script>alert(1)</script>', findings: 'Observed records.\nSecond line.', recommendations: '<img src=x onerror=alert(1)>',
    context: { park: { id: 'park', name: 'Yala' }, filters: { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-07', incidentType: '', species: '' }, retrievedAt: '2026-10-08T00:00:00Z' },
    statistics: { totalEventRecords: 0, alertRecords: 0, conflictRecords: 0, representedZones: 0, patrolRecords: 0 },
    sources: { alerts: [], conflicts: [], patrolRecords: [] },
    analysis: {
      trends: { status: 'empty', unit: 'day', buckets: [], omitted: 0 },
      hotspots: { status: 'empty', threshold: 3, hotspots: [], omitted: 0, unzoned: 0 },
      coverage: { status: 'empty', zones: [], omitted: 0 },
    },
  }
}
function render(props = {}) {
  harness.cursor = 0
  return Preview({ handoff: handoff(), requestId: 'same-preview-id', onBack: () => {}, ...props })
}
function find(node, label) {
  if (!node || typeof node !== 'object') return undefined
  if (node.props?.children === label) return node
  for (const child of [node.props?.children, node.props?.actions].flat(Infinity)) {
    const found = find(child, label)
    if (found) return found
  }
}
it('shows Preview and both explicit save choices without saving on generation/render', () => {
  const tree = render()
  expect(find(tree, 'Preview')).toBeDefined()
  expect(find(tree, 'Save as Draft')).toBeDefined()
  expect(find(tree, 'Save as Finalized')).toBeDefined()
  expect(harness.post).not.toHaveBeenCalled()
})
it.each([['Save as Draft', 'draft'], ['Save as Finalized', 'finalized']])('%s submits the selected status and navigates to the saved report', async (label, status) => {
  harness.post.mockResolvedValueOnce({ report: { id: 'saved-id', status } })
  await find(render(), label).props.onClick()
  expect(harness.post).toHaveBeenCalledWith('/reports', expect.objectContaining({ requestId: 'same-preview-id', status, findings: handoff().findings, snapshot: snapshot(handoff()) }))
  expect(harness.navigate).toHaveBeenCalledWith('/reports?reportId=saved-id&saved=1', { replace: true })
})
it('blocks duplicate clicks while saving, including choosing the other status', async () => {
  let complete
  harness.post.mockReturnValueOnce(new Promise((resolve) => { complete = resolve }))
  const tree = render()
  const pending = find(tree, 'Save as Draft').props.onClick()
  await find(tree, 'Save as Finalized').props.onClick()
  expect(harness.post).toHaveBeenCalledTimes(1)
  expect(find(render(), 'Back to Preparation').props.disabled).toBe(true)
  complete({ report: { id: 'saved-id' } })
  await pending
})
it('retains preview after failure and retries with the same request ID', async () => {
  harness.post.mockRejectedValueOnce({ status: 500, message: 'private backend detail' })
  await find(render(), 'Save as Draft').props.onClick()
  expect(harness.navigate).not.toHaveBeenCalled()
  expect(harness.slots[1]).toContain('Your preview is kept')
  expect(harness.slots[1]).not.toContain('private')
  harness.post.mockResolvedValueOnce({ report: { id: 'saved-id' } })
  await find(render(), 'Save as Draft').props.onClick()
  expect(harness.post.mock.calls[0][1]).toEqual(harness.post.mock.calls[1][1])
})
it('Back invokes preparation navigation without a save or handoff mutation', () => {
  const data = handoff()
  const before = JSON.stringify(data)
  const onBack = vi.fn()
  find(render({ handoff: data, onBack }), 'Back to Preparation').props.onClick()
  expect(onBack).toHaveBeenCalledOnce()
  expect(harness.post).not.toHaveBeenCalled()
  expect(JSON.stringify(data)).toBe(before)
})
it('renders actual context and narrative as escaped text, not executable HTML', () => {
  const data = handoff()
  const html = renderToStaticMarkup(React.createElement(Content, { report: { ...data, snapshot: snapshot(data) } }))
  expect(html).toContain('Yala &lt;script&gt;alert(1)&lt;/script&gt;')
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  expect(html).not.toContain('<script>')
  expect(html).not.toContain('<img')
  expect(html).toContain('2026-10-01 to 2026-10-07')
  expect(html).toContain('Observed records.\nSecond line.')
  expect(html).toContain('Analysis summary')
  expect(html).toContain('No hotspots identified.')
})
it('refuses oversized save payloads without truncating report information', () => {
  const data = handoff()
  data.findings = 'x'.repeat(950001)
  expect(() => saveBody(data, 'id', 'draft')).toThrow('save size limit')
  expect(data.findings.length).toBe(950001)
})

it('retains species in preview snapshots and renders legacy reports as All species', () => {
  const data = handoff()
  data.context.filters.species = 'test species'
  expect(snapshot(data).context.filters.species).toBe('test species')
  const html = renderToStaticMarkup(React.createElement(Content, { report: { ...data, snapshot: snapshot(data) } }))
  expect(html).toContain('test species')
  delete data.context.filters.species
  const legacy = renderToStaticMarkup(React.createElement(Content, { report: { ...data, snapshot: snapshot(data) } }))
  expect(legacy).toContain('All species')
})

it('shows Preview progress while retaining the save actions', () => {
  const html = renderToStaticMarkup(render())
  expect(html.match(/, completed/g)).toHaveLength(4)
  expect(html.match(/aria-current="step"/g)).toHaveLength(1)
  expect(html).toContain('Save as Draft')
  expect(html).toContain('Save as Finalized')
})
