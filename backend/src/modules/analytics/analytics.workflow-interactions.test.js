// Real React state/effects in a null-output root; inspect returned elements to
// invoke UI callbacks. Focus targets are explicit node doubles, not DOM tests.
const { React, installHeadlessHost, mountProbe } = require('../../test-support/react-headless-root')
const { comparisonFixture } = require('../../test-support/comparison-fixture')
const harness = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), params: null,
  setParams: vi.fn(), queryCalls: [], parks: null, reports: null, recipients: null, user: { role: 'data-analyst' } }))
vi.mock('../../../../frontend/src/lib/api.js', async (importOriginal) => ({
  ...await importOriginal(), api: { get: harness.get, post: harness.post },
}))
vi.mock('../../../../frontend/node_modules/react-router/dist/development/index.js', () => ({
  useNavigate: () => harness.navigate, useSearchParams: () => [harness.params, harness.setParams],
}))
vi.mock('../../../../frontend/node_modules/react-router/dist/production/index.js', () => ({
  useNavigate: () => harness.navigate, useSearchParams: () => [harness.params, harness.setParams],
}))
vi.mock('../../../../frontend/src/hooks/useApiQuery.js', () => ({ useApiQuery(url, options) {
  harness.queryCalls.push({ url, options })
  return url === '/analytics/options' ? harness.parks : url?.endsWith('/recipients') ? harness.recipients : harness.reports
} }))
vi.mock('../../../../frontend/src/context/auth-context.js', () => ({ useAuth: () => ({ user: harness.user }) }))
let Results, Comparison, Preparation, Preview, AnalysisFilters, Reports, Share, Actions, reducer, initial, calculateStatistics, calculateVisualizations
let makeContainer, roots
beforeAll(async () => {
  ;({ default: Results } = await import('../../../../frontend/src/features/analytics/pages/AnalysisResultsPage.jsx'))
  ;({ ComparisonResultsPage: Comparison } = await import('../../../../frontend/src/features/analytics/pages/ComparisonResultsPage.jsx'))
  ;({ ReportPreparationPage: Preparation } = await import('../../../../frontend/src/features/analytics/pages/ReportPreparationPage.jsx'))
  ;({ ReportPreviewPage: Preview } = await import('../../../../frontend/src/features/analytics/pages/ReportPreviewPage.jsx'))
  ;({ AnalysisFiltersPage: AnalysisFilters } = await import('../../../../frontend/src/features/analytics/pages/AnalysisPage.jsx'))
  ;({ default: Reports } = await import('../../../../frontend/src/features/analytics/pages/ReportsPage.jsx'))
  ;({ ShareReportDialog: Share } = await import('../../../../frontend/src/features/analytics/components/ShareReportDialog.jsx'))
  ;({ FinalizedReportActions: Actions } = await import('../../../../frontend/src/features/analytics/components/FinalizedReportActions.jsx'))
  ;({ reportPreparationReducer: reducer, initialReportState: initial } = await import('../../../../frontend/src/features/analytics/lib/reportPreparation.js'))
  ;({ calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js'))
  ;({ calculateVisualizations } = await import('../../../../frontend/src/features/analytics/lib/calculateVisualizations.js'))
})
beforeEach(() => {
  makeContainer = installHeadlessHost()
  roots = []
  for (const mock of [harness.get, harness.post, harness.navigate, harness.setParams]) mock.mockReset()
  harness.params = new URLSearchParams()
  harness.queryCalls = []
  harness.user = { role: 'data-analyst' }
  harness.parks = { data: { parks: comparisonFixture().datasets.map((data) => data.park), species: [], incidentTypes: ['fire'] } }
  harness.reports = { data: { reports: [] } }
  harness.recipients = { data: { managers: [{ id: 'one', name: 'First Manager' }, { id: 'two', name: 'Second Manager' }] } }
})
afterEach(async () => { for (const root of roots) await root.unmount(); vi.unstubAllGlobals() })
async function mount(probe) {
  const view = await mountProbe(probe, makeContainer)
  roots.push(view)
  return view
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of [node.props?.children, node.props?.actions, node.props?.action, node.props?.footer].flat(Infinity)) {
    const match = find(child, predicate)
    if (match) return match
  }
}
const button = (tree, text) => find(tree, (node) => node.props?.children === text && typeof node.props?.onClick === 'function')
const field = (tree, label) => find(tree, (node) => node.props?.label === label).props.children({ id: label })
const act = (callback) => React.act(async () => { await callback() })
function analysis() {
  const dataset = comparisonFixture().datasets[0]
  const result = calculateStatistics(dataset)
  return { dataset, result, analysis: calculateVisualizations(result, dataset) }
}

it('opens/closes Supporting Records and navigates Results through report steps without retrieving again', async () => {
  const { dataset } = analysis()
  const view = await mount(() => Results({ dataset, onBack: vi.fn(), onRetry: vi.fn() }))
  await act(() => button(view.current, 'View Supporting Records').props.onClick())
  const modal = find(view.current, (node) => node.props?.state?.open)
  expect(modal.props.dataset).toBe(dataset)
  await act(() => modal.props.onClose())
  expect(find(view.current, (node) => node.props?.state?.open)).toBeUndefined()
  await act(() => button(view.current, 'Continue to Report').props.onClick())
  expect(view.current.type).toBe(Preparation)
  expect(view.current.props.state.step).toBe('findings')
  await act(() => view.current.props.dispatch({ type: 'prepare' }))
  await act(() => view.current.props.dispatch({ type: 'edit', field: 'title', value: 'Retained analysis' }))
  await act(() => view.current.props.dispatch({ type: 'generate', ...analysis(), requestId: 'preview-id' }))
  expect(view.current.type).toBe(Preview)
  await act(() => view.current.props.onBack())
  expect(view.current.type).toBe(Preparation)
  expect(view.current.props.state.title).toBe('Retained analysis')
  expect(harness.get).not.toHaveBeenCalled()
  expect(harness.post).not.toHaveBeenCalled()
})

it('wires comparison report navigation and returns from Preview with both park sections retained', async () => {
  const dataset = comparisonFixture()
  const view = await mount(() => Comparison({ dataset, ParkResults: Results, onBack: vi.fn(), onRetry: vi.fn() }))
  await act(() => button(view.current, 'Continue to Report').props.onClick())
  expect(view.current.type).toBe(Preparation)
  expect(view.current.props.result.parks).toHaveLength(2)
  await act(() => view.current.props.dispatch({ type: 'prepare' }))
  await act(() => view.current.props.dispatch({ type: 'edit', field: 'title', value: 'Both parks' }))
  await act(() => view.current.props.dispatch({ type: 'generate', result: view.current.props.result, dataset, requestId: 'comparison-preview' }))
  expect(view.current.type).toBe(Preview)
  expect(view.current.props.handoff.parks.map((park) => park.context.park.name)).toEqual(['First Park', 'Second Park'])
  await act(() => view.current.props.onBack())
  expect(view.current.type).toBe(Preparation)
  expect(view.current.props.state.title).toBe('Both parks')
  expect(harness.post).not.toHaveBeenCalled()
})

it('submits preparation through the real reducer, exposes title errors and focuses on step changes', async () => {
  const props = analysis()
  const focus = vi.fn()
  const view = await mount(() => {
    const [state, dispatch] = React.useReducer(reducer, { ...initial, step: 'findings' })
    const tree = Preparation({ ...props, state, dispatch })
    tree.props.ref.current = { focus }
    return { tree, state }
  })
  expect(focus).toHaveBeenCalledOnce()
  await act(() => field(view.current.tree, 'Findings').props.onChange({ target: { value: 'Recorded evidence' } }))
  await act(() => field(view.current.tree, 'Recommendations').props.onChange({ target: { value: 'Review source records' } }))
  await act(() => find(view.current.tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} }))
  expect(view.current.state.step).toBe('preparation')
  expect(focus).toHaveBeenCalledTimes(2)
  await act(() => find(view.current.tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} }))
  expect(view.current.state.errors.title).toBe('Enter a report title.')
  expect(view.current.state.handoff).toBeNull()
  expect(find(view.current.tree, (node) => node.props?.role === 'alert')).toBeDefined()
  await act(() => field(view.current.tree, 'Report title').props.onChange({ target: { value: 'Reviewed evidence' } }))
  await act(() => button(view.current.tree, 'Back to Findings').props.onClick())
  expect(view.current.state).toMatchObject({ step: 'findings', title: 'Reviewed evidence', findings: 'Recorded evidence' })
  await act(() => find(view.current.tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} }))
  await act(() => find(view.current.tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} }))
  expect(view.current.state.handoff).toMatchObject({ title: 'Reviewed evidence', findings: 'Recorded evidence', recommendations: 'Review source records' })
  expect(view.current.state.requestId).toMatch(/^[0-9a-f-]{36}$/)
  expect(harness.post).not.toHaveBeenCalled()
})

it('focuses Preview once and shows the safe fallback when a failed save has no error message', async () => {
  const props = analysis()
  const handoff = { ...props.result, ...props, title: 'Preview evidence', findings: '', recommendations: '' }
  const focus = vi.fn()
  harness.post.mockRejectedValue({ status: 400 })
  const view = await mount(() => {
    const tree = Preview({ handoff, requestId: '4e94c09e-71b2-40db-92a4-7f86ee109fd2', onBack: vi.fn() })
    tree.props.ref.current = { focus }
    return tree
  })
  expect(focus).toHaveBeenCalledOnce()
  await act(() => button(view.current, 'Save as Draft').props.onClick())
  expect(find(view.current, (node) => node.props?.role === 'alert').props.children).toBe('Unable to save the report. Please try again.')
  expect(focus).toHaveBeenCalledOnce()
  expect(harness.navigate).not.toHaveBeenCalled()
})

it('uses the edited comparison selection on retry after a retrieval failure', async () => {
  const data = comparisonFixture()
  const view = await mount(() => AnalysisFilters({ initialFilters: data.datasets[0].filters }))
  const compareToggle = find(view.current, (node) => node.type === 'input' && node.props.type === 'checkbox')
  await act(() => compareToggle.props.onChange({ target: { checked: true } }))
  const second = find(view.current, (node) => node.type === 'label' && node.props?.children?.[1] === 'Second Park')
  await act(() => second.props.children[0].props.onChange())
  harness.get.mockRejectedValueOnce({ status: 503, message: 'private database details' })
  await act(() => find(view.current, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} }))
  const error = find(view.current, (node) => node.props?.title === 'Unable to retrieve conservation data')
  expect(error.props.message).not.toContain('private database')
  harness.get.mockResolvedValueOnce({ ...data, freshness: { requiresConfirmation: true } })
  await act(() => error.props.onRetry())
  expect(harness.get.mock.calls[1][0]).toContain(`parkIds=${data.filters.parkIds.join('%2C')}`)
  expect(harness.get.mock.calls[1][0]).not.toContain('parkId=')
  expect(find(view.current, (node) => node.props?.onContinue).props.open).toBe(true)
  const toggle = find(view.current, (node) => node.type === 'input' && node.props.type === 'checkbox')
  expect(toggle.props.checked).toBe(true)
})

it.each(['startDate', 'endDate'])('caps the %s picker and blocks a restored future selection with field feedback', async (name) => {
  const filters = { ...comparisonFixture().datasets[0].filters, [name]: '2999-01-01' }
  const view = await mount(() => AnalysisFilters({ initialFilters: filters }))
  const label = name === 'startDate' ? 'Start date' : 'End date'
  const input = field(view.current, label)
  expect(input.props.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  const preventDefault = vi.fn()
  await act(() => input.props.onInvalid({ preventDefault }))
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(find(view.current, node => node.props?.label === label).props.error).toContain('cannot be in the future')
  await act(() => find(view.current, node => node.type === 'form').props.onSubmit({ preventDefault() {} }))
  expect(harness.get).not.toHaveBeenCalled()
})

it('renders report access/loading/error feedback and invokes retry without leaking server details', async () => {
  harness.user = { role: 'ranger' }
  const view = await mount(() => Reports())
  expect(find(view.current, (node) => node.props?.title === 'Reports are not available for your role.')).toBeDefined()
  expect(harness.queryCalls.at(-1).options.enabled).toBe(false)
  harness.user = { role: 'data-analyst' }
  harness.reports = { loading: true }
  await view.rerender()
  expect(find(view.current, (node) => node.props?.className === 'h-64')).toBeDefined()
  const reload = vi.fn()
  harness.reports = { error: { status: 503, message: 'private server details' }, reload }
  await view.rerender()
  const error = find(view.current, (node) => node.props?.onRetry === reload)
  expect(error.props.message).toBe('Unable to load reports. Please try again.')
  error.props.onRetry()
  expect(reload).toHaveBeenCalledOnce()
  harness.reports.error = { status: 401, message: 'Session expired' }
  await view.rerender()
  expect(find(view.current, (node) => node.props?.onRetry === reload).props.message).toBe('Session expired')
})

it('preserves the selected report status when invoking Next and Previous on an empty page', async () => {
  harness.params = new URLSearchParams('status=finalized&page=2')
  harness.reports = { data: { reports: [], hasMore: true } }
  const view = await mount(() => Reports())
  button(view.current, 'Next').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({ status: 'finalized', page: '3' })
  button(view.current, 'Previous').props.onClick()
  expect(harness.setParams).toHaveBeenLastCalledWith({ status: 'finalized' })
})

it('removes deselected recipients and closes the parent Share dialog only after successful sharing', async () => {
  const report = { id: 'report', title: 'Finalized report', status: 'finalized' }
  const actions = await mount(() => Actions({ report, canShare: true }))
  await act(() => button(actions.current, 'Share').props.onClick())
  const dialog = find(actions.current, (node) => node.type === Share)
  const share = await mount(() => Share(dialog.props))
  const checkboxes = () => {
    const fieldset = find(share.current, (node) => node.type === 'fieldset')
    return fieldset.props.children[1].props.children.map((label) => label.props.children[0])
  }
  await act(() => checkboxes()[0].props.onChange({ target: { checked: true } }))
  await act(() => checkboxes()[1].props.onChange({ target: { checked: true } }))
  await act(() => checkboxes()[0].props.onChange({ target: { checked: false } }))
  expect(checkboxes().map((node) => node.props.checked)).toEqual([false, true])
  harness.post.mockResolvedValue({ sharedCount: 1 })
  await act(() => button(share.current, 'Share Report').props.onClick())
  expect(harness.post).toHaveBeenCalledWith('/reports/report/share', { recipients: ['two'] })
  expect(find(actions.current, (node) => node.type === Share)).toBeUndefined()
  expect(find(actions.current, (node) => node.props?.role === 'status').props.children).toBe('Report shared successfully with 1 Park Manager.')
  await act(() => button(actions.current, 'Share').props.onClick())
  await act(() => find(actions.current, (node) => node.type === Share).props.onClose())
  expect(find(actions.current, (node) => node.type === Share)).toBeUndefined()
})
