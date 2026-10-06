// Callback and routing tests using the same lightweight hook harness as earlier
// UC02 stages. Browser focus and visual layout still require manual checks.
const harness = vi.hoisted(() => ({ slots: [], cursor: 0, patch: vi.fn(), navigate: vi.fn(), params: null, setParams: vi.fn(), query: null, getQuery: vi.fn(), role: 'data-analyst' }))
vi.mock('../../../../frontend/node_modules/react/index.js', async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = harness.cursor++
    if (!(index in harness.slots)) harness.slots[index] = initial
    return [harness.slots[index], (value) => { harness.slots[index] = typeof value === 'function' ? value(harness.slots[index]) : value }]
  },
  useRef(initial) {
    const index = harness.cursor++
    if (!(index in harness.slots)) harness.slots[index] = { current: initial }
    return harness.slots[index]
  },
}))
vi.mock('../../../../frontend/node_modules/react-router/dist/development/index.js', () => ({ useNavigate: () => harness.navigate, useSearchParams: () => [harness.params, harness.setParams] }))
vi.mock('../../../../frontend/node_modules/react-router/dist/production/index.js', () => ({ useNavigate: () => harness.navigate, useSearchParams: () => [harness.params, harness.setParams] }))
vi.mock('../../../../frontend/src/lib/api.js', () => ({ api: { patch: harness.patch } }))
vi.mock('../../../../frontend/src/hooks/useApiQuery.js', () => ({ useApiQuery: (...args) => { harness.getQuery(...args); return harness.query } }))
vi.mock('../../../../frontend/src/context/auth-context.js', () => ({ useAuth: () => ({ user: { role: harness.role } }) }))
let DraftEditor, ReportsPage, AnalysisPage, AnalysisFiltersPage, initialReportState
beforeAll(async () => {
  vi.stubGlobal('React', await import('../../../../frontend/node_modules/react/index.js'))
  ;({ DraftEditor } = await import('../../../../frontend/src/features/analytics/pages/DraftEditor.jsx'))
  ;({ default: ReportsPage } = await import('../../../../frontend/src/features/analytics/pages/ReportsPage.jsx'))
  ;({ default: AnalysisPage, AnalysisFiltersPage } = await import('../../../../frontend/src/features/analytics/pages/AnalysisPage.jsx'))
  ;({ initialReportState } = await import('../../../../frontend/src/features/analytics/lib/reportPreparation.js'))
})
beforeEach(() => {
  harness.role = 'data-analyst'
  harness.slots = []
  harness.params = new URLSearchParams()
  harness.query = { data: { reports: [] } }
  for (const mock of [harness.patch, harness.navigate, harness.setParams, harness.getQuery]) mock.mockReset()
})
afterAll(() => vi.unstubAllGlobals())
function report(status = 'draft') {
  return { id: 'draft-id', title: 'Original title', findings: 'Original finding', recommendations: 'Original recommendation', revision: 0, status,
    createdAt: '2026-10-08T00:00:00Z', snapshot: { context: { park: { id: 'park', name: 'Yala' }, filters: { parkId: 'park', startDate: '2026-09-01', endDate: '2026-09-30', incidentType: 'fire', species: '' } } } }
}
function editor(value = report()) { harness.cursor = 0; return DraftEditor({ report: value }) }
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of [node.props?.children, node.props?.actions].flat(Infinity)) {
    const match = find(child, predicate)
    if (match) return match
  }
}
const button = (node, text) => find(node, (entry) => entry.props?.children === text)
const field = (node, label) => find(node, (entry) => entry.props?.label === label).props.children({})
const submit = () => find(editor(), (node) => node.type === 'form').props.onSubmit({ preventDefault() {} })
it('offers Open Draft only on drafts and View report on finalized records', () => {
  harness.query = { data: { reports: [report(), { ...report('finalized'), id: 'final-id' }] } }
  const tree = ReportsPage()
  expect(button(tree, 'Draft')).toBeDefined()
  expect(button(tree, 'Finalized')).toBeDefined()
  button(tree, 'Open Draft').props.onClick()
  expect(harness.setParams).toHaveBeenCalledWith({ reportId: 'draft-id' })
  button(tree, 'View report').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({ reportId: 'final-id' })
})
it.each(['draft', 'finalized'])('opens %s with the appropriate editable/read-only view', (status) => {
  harness.params = new URLSearchParams('reportId=draft-id')
  harness.query = { data: { report: report(status) } }
  const tree = ReportsPage()
  expect(Boolean(find(tree, (node) => node.type === DraftEditor))).toBe(status === 'draft')
})
it('shows original analysis and edits all narrative fields with the existing limits', () => {
  const tree = editor()
  expect(find(tree, (node) => node.props?.['aria-label'] === 'Original Analysis')).toBeDefined()
  expect(field(tree, 'Report title').props.maxLength).toBe(200)
  expect(field(tree, 'Findings').props.maxLength).toBe(5000)
  expect(field(tree, 'Recommendations').props.maxLength).toBe(5000)
  for (const label of ['Report title', 'Findings', 'Recommendations']) field(editor(), label).props.onChange({ target: { value: `Updated ${label}` } })
  expect(field(editor(), 'Report title').props.value).toBe('Updated Report title')
  expect(field(editor(), 'Findings').props.value).toBe('Updated Findings')
  expect(field(editor(), 'Recommendations').props.value).toBe('Updated Recommendations')
  expect(button(editor(), 'Re-analyze').props.disabled).toBe(true)
})
it('saves only narrative fields and revision, then permits re-analysis', async () => {
  field(editor(), 'Report title').props.onChange({ target: { value: 'Updated title' } })
  harness.patch.mockResolvedValueOnce({ report: { ...report(), title: 'Updated title', revision: 1 } })
  await submit()
  expect(harness.patch).toHaveBeenCalledWith('/reports/draft-id', { title: 'Updated title', findings: 'Original finding', recommendations: 'Original recommendation', revision: 0 })
  expect(button(editor(), 'Changes saved. Status: Draft.')).toBeDefined()
  expect(button(editor(), 'Re-analyze').props.disabled).toBe(false)
})
it.each([['Report title', '  '], ['Report title', 'x'.repeat(201)], ['Findings', 'x'.repeat(5001)], ['Recommendations', 'x'.repeat(5001)]])('validates %s before saving', async (label, value) => {
  field(editor(), label).props.onChange({ target: { value } })
  await submit()
  expect(harness.patch).not.toHaveBeenCalled()
  expect(find(editor(), (node) => node.props?.label === label).props.error).toBeTruthy()
  expect(field(editor(), label).props.value).toBe(value)
})
it('keeps edited values after failure and supports a retry with the same revision', async () => {
  field(editor(), 'Findings').props.onChange({ target: { value: 'Keep this finding' } })
  harness.patch.mockRejectedValueOnce({ status: 500, message: 'private database error' })
  await submit()
  expect(field(editor(), 'Findings').props.value).toBe('Keep this finding')
  expect(harness.slots[3]).toBe('Unable to save changes. Your entries are kept; please retry.')
  harness.patch.mockResolvedValueOnce({ report: { ...report(), findings: 'Keep this finding', revision: 1 } })
  await submit()
  expect(harness.patch.mock.calls[0][1]).toEqual(harness.patch.mock.calls[1][1])
})
it('navigates Re-analyze with only the report ID and performs no draft write', () => {
  button(editor(), 'Re-analyze').props.onClick()
  expect(harness.navigate).toHaveBeenCalledWith('/analytics?draftId=draft-id')
  expect(harness.patch).not.toHaveBeenCalled()
})
it('loads authorized saved filters into the existing Analysis form with a cancel route', () => {
  const original = report()
  const draft = { id: original.id, title: original.title, filters: original.snapshot.context.filters }
  harness.params = new URLSearchParams('draftId=draft-id')
  harness.query = { data: { draft } }
  const tree = AnalysisPage()
  expect(harness.getQuery).toHaveBeenCalledWith('/reports/draft-id/reanalysis')
  expect(tree.type).toBe(AnalysisFiltersPage)
  expect(tree.props.initialFilters).toEqual(original.snapshot.context.filters)
  expect(tree.props).not.toHaveProperty('findings')
  expect(initialReportState).toMatchObject({ title: '', findings: '', recommendations: '' })
  tree.props.onCancelReanalysis()
  expect(harness.navigate).toHaveBeenCalledWith('/reports?reportId=draft-id')
  expect(harness.patch).not.toHaveBeenCalled()
})
it('does not enter analysis if restoration is denied, missing, or still loading', () => {
  harness.params = new URLSearchParams('draftId=final-id')
  for (const state of [{ error: { status: 409, message: 'Only Draft reports can be re-analyzed.' } }, { loading: true }]) {
    harness.query = state
    expect(AnalysisPage().type).not.toBe(AnalysisFiltersPage)
  }
})


it.each([
  ['', true, true], ['draft', true, false], ['finalized', false, true], ['invalid', true, true],
])('filters report cards for status %s without changing the API', (status, draft, finalized) => {
  harness.params = new URLSearchParams({ status })
  harness.query = { data: { reports: [report(), { ...report('finalized'), id: 'final-id' }], hasMore: false } }
  const tree = ReportsPage()
  expect(Boolean(button(tree, 'Open Draft'))).toBe(draft)
  expect(Boolean(button(tree, 'View report'))).toBe(finalized)
  expect(harness.getQuery).toHaveBeenCalledWith('/reports?page=1', { enabled: true })
})

it('switches status views and resets pagination', () => {
  harness.params = new URLSearchParams('page=3&status=draft')
  const tree = ReportsPage()
  expect(button(tree, 'Drafts').props['aria-pressed']).toBe(true)
  button(tree, 'Finalized').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({ status: 'finalized' })
  button(tree, 'All').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({})
})

it('keeps pagination available on a page with no matching status', () => {
  harness.params = new URLSearchParams('status=draft&page=2')
  harness.query = { data: { reports: [report('finalized')], hasMore: true } }
  const tree = ReportsPage()
  expect(find(tree, (node) => node.props?.title === 'No draft reports on this page.')).toBeDefined()
  expect(button(tree, 'Next').props.disabled).toBe(false)
  button(tree, 'Next').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({ status: 'draft', page: '3' })
})

it('preserves status and page when opening a draft and returning to the list', () => {
  harness.params = new URLSearchParams('status=draft&page=2')
  harness.query = { data: { reports: [report()] } }
  button(ReportsPage(), 'Open Draft').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({ status: 'draft', page: '2', reportId: 'draft-id' })
  harness.params.set('reportId', 'draft-id')
  harness.query = { data: { report: report() } }
  button(ReportsPage(), 'Back to Reports').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({ status: 'draft', page: '2' })
})

