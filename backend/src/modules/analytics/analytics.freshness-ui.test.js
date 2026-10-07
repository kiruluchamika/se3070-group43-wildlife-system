// Exercise the actual page and retrieval callbacks with a minimal hook-state
// harness. This checks transition wiring, not browser effects or dialog layout.
const harness = vi.hoisted(() => ({ slots: [], cursor: 0, get: vi.fn(), parks: [] }))
vi.mock('../../../../frontend/node_modules/react/index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual,
    useState(initial) {
      const index = harness.cursor++
      if (!(index in harness.slots)) harness.slots[index] = initial
      return [harness.slots[index], (value) => {
        harness.slots[index] = typeof value === 'function' ? value(harness.slots[index]) : value
      }]
    },
    useRef(initial) {
      const index = harness.cursor++
      if (!(index in harness.slots)) harness.slots[index] = { current: initial }
      return harness.slots[index]
    },
    useCallback: (callback) => callback,
    useEffect: () => {},
  }
})
vi.mock('../../../../frontend/src/lib/api.js', () => ({ api: { get: harness.get }, toQuery: (filters) => `?${new URLSearchParams(filters)}` }))
vi.mock('../../../../frontend/src/hooks/useApiQuery.js', () => ({ useApiQuery: () => ({ data: { parks: harness.parks, species: [{ id: 'test species', label: 'test species' }] } }) }))

let AnalysisPage, AnalysisResultsPage, FreshnessDialog
beforeAll(async () => {
  vi.stubGlobal('React', await import('../../../../frontend/node_modules/react/index.js'))
  ;({ AnalysisFiltersPage: AnalysisPage } = await import('../../../../frontend/src/features/analytics/pages/AnalysisPage.jsx'))
  ;({ default: AnalysisResultsPage } = await import('../../../../frontend/src/features/analytics/pages/AnalysisResultsPage.jsx'))
  ;({ FreshnessDialog } = await import('../../../../frontend/src/features/analytics/components/FreshnessDialog.jsx'))
})
afterAll(() => vi.unstubAllGlobals())
const filters = { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-07', species: '', incidentType: 'fire' }
beforeEach(() => {
  harness.parks = [{ id: 'park', name: 'Yala' }]
  harness.slots = [{ ...filters }]
  harness.get.mockReset()
})
function render(props) {
  harness.cursor = 0
  return AnalysisPage(props)
}
function find(node, type) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === type) return node
  const children = node.props?.children
  for (const child of [children].flat(Infinity)) {
    const match = find(child, type)
    if (match) return match
  }
}
async function retrieve(requiresConfirmation) {
  const dataset = { filters: { ...filters }, freshness: { requiresConfirmation } }
  harness.get.mockResolvedValueOnce(dataset)
  find(render(), 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  return dataset
}
it('blocks reversed dates and unavailable park selections before retrieval', () => {
  harness.slots[0] = { ...filters, endDate: '2026-09-30' }
  find(render(), 'form').props.onSubmit({ preventDefault() {} })
  expect(harness.get).not.toHaveBeenCalled()
  expect(harness.slots[1]).toBe('End date must be on or after the start date.')
  harness.slots[0] = { ...filters, parkId: 'removed-park' }
  find(render(), 'form').props.onSubmit({ preventDefault() {} })
  expect(harness.get).not.toHaveBeenCalled()
})

it('restores all comparison parks and retains them through freshness Cancel and a failed retrieval retry', async () => {
  harness.parks.push({ id: 'second', name: 'Second Park' })
  const selected = { ...filters, parkId: '', parkIds: ['park', 'second'], species: 'test species' }
  const props = { initialFilters: selected, sourceDraft: { id: 'draft', title: 'Comparison' } }
  harness.slots[0] = selected
  const dataset = { filters: selected, datasets: [], freshness: { requiresConfirmation: true } }
  harness.get.mockResolvedValueOnce(dataset)
  find(render(props), 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  const url = new URL(harness.get.mock.calls[0][0], 'https://test.invalid')
  expect(url.searchParams.get('parkIds')).toBe('park,second')
  expect(url.searchParams.has('parkId')).toBe(false)
  find(render(props), FreshnessDialog).props.onCancel()
  expect(harness.slots[0]).toEqual(selected)
  harness.get.mockRejectedValueOnce({ status: 500 })
  find(render(props), 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  const { ErrorState } = await import('../../../../frontend/src/components/ui/Feedback.jsx')
  harness.get.mockResolvedValueOnce(dataset)
  await find(render(props), ErrorState).props.onRetry()
  expect(harness.get.mock.calls[2][0]).toBe(harness.get.mock.calls[0][0])
})

it('allows changing restored comparison selections back to the existing single-park request', async () => {
  harness.parks.push({ id: 'second', name: 'Second Park' })
  harness.slots[0] = { ...filters, parkIds: ['park', 'second'] }
  const checkboxes = []
  function collect(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'input' && node.props.type === 'checkbox') checkboxes.push(node)
    for (const child of [node.props?.children].flat(Infinity)) collect(child)
  }
  collect(render())
  expect(checkboxes).toHaveLength(3)
  expect(checkboxes.every((checkbox) => checkbox.props.checked)).toBe(true)
  checkboxes[2].props.onChange()
  expect(harness.slots[0].parkIds).toEqual(['park'])
  harness.get.mockResolvedValueOnce({ filters, freshness: { requiresConfirmation: true } })
  find(render(), 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  const url = new URL(harness.get.mock.calls[0][0], 'https://test.invalid')
  expect(url.searchParams.get('parkId')).toBe('park')
  expect(url.searchParams.has('parkIds')).toBe(false)
})

it('keeps species and dates after a retrieval failure and retries without exposing server details', async () => {
  const selected = { ...filters, species: 'test species' }
  harness.slots[0] = selected
  harness.get.mockRejectedValueOnce({ status: 500, message: 'private database detail' })
  find(render(), 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  const { ErrorState } = await import('../../../../frontend/src/components/ui/Feedback.jsx')
  const error = find(render(), ErrorState)
  expect(error.props.message).toBe('Please try again. Your selected filters have been kept.')
  expect(harness.slots[0]).toEqual(selected)
  const dataset = { filters: selected, freshness: { requiresConfirmation: false } }
  harness.get.mockResolvedValueOnce(dataset)
  await error.props.onRetry()
  expect(harness.get).toHaveBeenCalledTimes(2)
  expect(harness.get.mock.calls[1][0]).toBe(harness.get.mock.calls[0][0])
  expect(render().props.dataset).toBe(dataset)
})

it('proceeds directly to Results without a freshness dialog for current data', async () => {
  const dataset = await retrieve(false)
  const page = render()
  expect(page.type).toBe(AnalysisResultsPage)
  expect(page.props.dataset).toBe(dataset)
  expect(find(page, FreshnessDialog)).toBeUndefined()
})
it('holds pending-sync data before Results and Continue closes the dialog', async () => {
  const dataset = await retrieve(true)
  const page = render()
  expect(find(page, AnalysisResultsPage)).toBeUndefined()
  const dialog = find(page, FreshnessDialog)
  expect(dialog.props.open).toBe(true)
  expect(dialog.props.freshness).toBe(dataset.freshness)
  dialog.props.onContinue()
  const results = render()
  expect(results.type).toBe(AnalysisResultsPage)
  expect(results.props.dataset).toBe(dataset)
  expect(find(results, FreshnessDialog)).toBeUndefined()
})
it('Cancel closes the dialog, clears pending retrieval, and preserves selected filters', async () => {
  await retrieve(true)
  find(render(), FreshnessDialog).props.onCancel()
  const page = render()
  expect(find(page, AnalysisResultsPage)).toBeUndefined()
  expect(find(page, 'form')).toBeDefined()
  expect(find(page, FreshnessDialog).props.open).toBe(false)
  expect(harness.slots[0]).toEqual(filters)
  expect(harness.slots[2]).toEqual({ phase: 'filters', dataset: null, error: null })
})

it.each([false, true])('restored filters use normal retrieval and freshness requiresConfirmation=%s', async (pending) => {
  harness.slots = []
  const original = { ...filters, startDate: '2026-09-01', endDate: '2026-09-30' }
  const props = { initialFilters: original, sourceDraft: { id: 'draft', title: 'September' } }
  const page = render(props)
  expect(harness.slots[0]).toEqual(original)
  expect(harness.get).not.toHaveBeenCalled()
  // Find the existing Start date Field and use its real input callback.
  function field(node, label) {
    if (!node || typeof node !== 'object') return undefined
    if (node.props?.label === label) return node
    for (const child of [node.props?.children].flat(Infinity)) {
      const match = field(child, label)
      if (match) return match
    }
  }
  field(page, 'Start date').props.children({}).props.onChange({ target: { value: '2026-09-02' } })
  expect(original.startDate).toBe('2026-09-01')
  const dataset = { filters: { ...original, startDate: '2026-09-02' }, freshness: { requiresConfirmation: pending } }
  harness.get.mockResolvedValueOnce(dataset)
  find(render(props), 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  expect(harness.get.mock.calls[0][0]).toContain('startDate=2026-09-02')
  if (pending) {
    const dialog = find(render(props), FreshnessDialog)
    expect(dialog.props.open).toBe(true)
    expect(find(render(props), AnalysisResultsPage)).toBeUndefined()
    dialog.props.onContinue()
  }
  expect(render(props).type).toBe(AnalysisResultsPage)
  expect(render(props).props.dataset).toBe(dataset)
})
it('freshness Cancel during re-analysis returns to editable restored filters without changing the draft', async () => {
  harness.slots = []
  const original = { ...filters }
  const props = { initialFilters: original, sourceDraft: { id: 'draft', title: 'Previous report' } }
  harness.get.mockResolvedValueOnce({ filters: original, freshness: { requiresConfirmation: true } })
  find(render(props), 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  find(render(props), FreshnessDialog).props.onCancel()
  expect(find(render(props), 'form')).toBeDefined()
  expect(harness.slots[0]).toEqual(original)
  expect(harness.slots[2].dataset).toBeNull()
})

it('enables species and keeps it through retrieval and freshness cancellation', async () => {
  function field(node) {
    if (!node || typeof node !== 'object') return undefined
    if (node.props?.label === 'Species') return node
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = field(child)
      if (result) return result
    }
  }
  const select = field(render()).props.children({})
  expect(select.props.disabled).toBe(false)
  select.props.onChange({ target: { value: 'test species' } })
  await retrieve(true)
  expect(harness.get.mock.calls[0][0]).toContain('species=test+species')
  find(render(), FreshnessDialog).props.onCancel()
  expect(field(render()).props.children({}).props.value).toBe('test species')
})

it('shows Filters progress during filtering and pending freshness', async () => {
  const { WorkflowStepper } = await import('../../../../frontend/src/features/analytics/components/WorkflowStepper.jsx')
  expect(find(render(), WorkflowStepper).props.current).toBe('filters')
  await retrieve(true)
  expect(find(render(), WorkflowStepper).props.current).toBe('filters')
})
