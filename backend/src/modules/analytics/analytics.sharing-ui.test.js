const harness = vi.hoisted(() => ({ slots: [], cursor: 0, get: vi.fn(), post: vi.fn(), success: vi.fn(), query: null }))
vi.mock('../../../../frontend/node_modules/sonner/dist/index.mjs', () => ({ toast: { success: harness.success } }))
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
  useCallback: (callback) => callback,
}))
vi.mock('../../../../frontend/src/lib/api.js', () => ({ api: { get: harness.get, post: harness.post } }))
vi.mock('../../../../frontend/src/hooks/useApiQuery.js', () => ({ useApiQuery: () => harness.query }))
let Dialog, Actions, printReport
beforeAll(async () => {
  vi.stubGlobal('React', await import('../../../../frontend/node_modules/react/index.js'))
  ;({ ShareReportDialog: Dialog } = await import('../../../../frontend/src/features/analytics/components/ShareReportDialog.jsx'))
  ;({ FinalizedReportActions: Actions } = await import('../../../../frontend/src/features/analytics/components/FinalizedReportActions.jsx'))
  ;({ downloadFinalizedReport: printReport } = await import('../../../../frontend/src/features/analytics/lib/exportReport.js'))
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  harness.slots = []
  harness.get.mockReset()
  harness.post.mockReset()
  harness.success.mockReset()
  harness.query = { data: { managers: [{ id: 'one', name: 'Manager One' }, { id: 'two', name: 'Manager Two' }] } }
})
const report = { id: 'report', title: 'Conservation report', status: 'finalized' }
function dialog(props = {}) { harness.cursor = 0; return Dialog({ report, onClose: vi.fn(), onShared: vi.fn(), ...props }) }
function actions(props = {}) { harness.cursor = 0; return Actions({ report, canShare: true, ...props }) }
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of [node.props?.children, node.props?.footer].flat(Infinity)) {
    const found = find(child, predicate)
    if (found) return found
  }
}
const button = (node, label) => find(node, (entry) => entry.props?.children === label)
function select(name) {
  const label = find(dialog(), (node) => node.type === 'label' && node.props.children[1].props.children === name)
  label.props.children[0].props.onChange({ target: { checked: true } })
}
it('shows finalized actions, hides both on Drafts, and prevents manager re-sharing', () => {
  expect(button(actions(), 'Share')).toBeDefined()
  expect(button(actions(), 'Export PDF')).toBeDefined()
  expect(actions({ report: { ...report, status: 'draft' } })).toBeNull()
  expect(button(actions({ canShare: false }), 'Share')).toBeUndefined()
})
it('opens the Share dialog without sharing and permits cancel', () => {
  button(actions(), 'Share').props.onClick()
  expect(find(actions(), (node) => node.type === Dialog)).toBeDefined()
  expect(harness.post).not.toHaveBeenCalled()
  harness.slots = []
  const close = vi.fn()
  button(dialog({ onClose: close }), 'Cancel').props.onClick()
  expect(close).toHaveBeenCalledOnce()
})
it('rejects zero recipients before requesting a share', async () => {
  await button(dialog(), 'Share Report').props.onClick()
  expect(harness.post).not.toHaveBeenCalled()
  expect(button(dialog(), 'Select at least one Park Manager.')).toBeDefined()
})
it('shows a success toast and retains inline feedback after the share dialog closes', () => {
  button(actions(), 'Share').props.onClick()
  expect(harness.success).not.toHaveBeenCalled()
  find(actions(), (node) => node.type === Dialog).props.onShared('Report shared successfully with 1 Park Manager.')
  expect(harness.success).toHaveBeenCalledExactlyOnceWith('Report shared successfully.')
  expect(find(actions(), (node) => node.type === Dialog)).toBeUndefined()
  expect(find(actions(), (node) => node.props?.role === 'status').props.children).toBe('Report shared successfully with 1 Park Manager.')
})
it.each([1, 2])('shares with %i selected managers only after confirmation', async (count) => {
  select('Manager One')
  if (count === 2) select('Manager Two')
  expect(harness.post).not.toHaveBeenCalled()
  const success = vi.fn()
  harness.post.mockResolvedValueOnce({ sharedCount: count })
  await button(dialog({ onShared: success }), 'Share Report').props.onClick()
  expect(harness.post).toHaveBeenCalledWith('/reports/report/share', { recipients: count === 1 ? ['one'] : ['one', 'two'] })
  expect(success).toHaveBeenCalledWith(`Report shared successfully with ${count} Park Manager${count === 1 ? '' : 's'}.`)
})
it('retains selections on failure and permits retry without raw errors', async () => {
  select('Manager One')
  const success = vi.fn()
  harness.post.mockRejectedValueOnce(new Error('private database message'))
  await button(dialog({ onShared: success }), 'Share Report').props.onClick()
  expect(harness.slots[0]).toEqual(['one'])
  expect(harness.slots[1]).toContain('Unable to share')
  expect(harness.slots[1]).not.toContain('private')
  expect(success).not.toHaveBeenCalled()
  harness.post.mockResolvedValueOnce({ sharedCount: 1 })
  await button(dialog({ onShared: success }), 'Share Report').props.onClick()
  expect(success).toHaveBeenCalledOnce()
})
it('blocks double clicks while confirmation is pending', async () => {
  select('Manager One')
  let complete
  harness.post.mockReturnValueOnce(new Promise((resolve) => { complete = resolve }))
  const confirm = button(dialog(), 'Share Report').props.onClick
  const pending = confirm()
  await confirm()
  expect(harness.post).toHaveBeenCalledTimes(1)
  expect(dialog().props.dismissible).toBe(false)
  complete({ sharedCount: 1 })
  await pending
})
it('disables sharing when there are no eligible recipients or loading fails', () => {
  for (const query of [{ data: { managers: [] } }, { error: new Error('private') }, { loading: true }]) {
    harness.query = query
    expect(button(dialog(), 'Share Report').props.disabled).toBe(true)
  }
})
function downloadBrowser() {
  const link = { click: vi.fn(), remove: vi.fn() }
  vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return link
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('downloads the authorized PDF and releases its temporary URL', async () => {
  vi.useFakeTimers()
  const link = downloadBrowser()
  const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
  harness.get.mockResolvedValueOnce(pdf)
  await printReport('report')
  expect(harness.get).toHaveBeenCalledWith('/reports/report/export', { responseType: 'blob' })
  expect(URL.createObjectURL).toHaveBeenCalledWith(pdf)
  expect(link.download).toBe('WildGuard-report-report.pdf')
  expect(link.href).toBe('blob:report')
  expect(link.click).toHaveBeenCalledOnce()
  expect(link.remove).toHaveBeenCalledOnce()
  vi.runAllTimers()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
  expect(harness.post).not.toHaveBeenCalled()
})
it('does not download denied or invalid responses and permits retry', async () => {
  vi.useFakeTimers()
  const link = downloadBrowser()
  harness.get.mockRejectedValueOnce(new Error('Access denied'))
  await expect(printReport('report')).rejects.toThrow('Access denied')
  harness.get.mockResolvedValueOnce(new Blob(['error'], { type: 'application/json' }))
  await expect(printReport('report')).rejects.toThrow('did not return a PDF')
  expect(link.click).not.toHaveBeenCalled()
  harness.get.mockResolvedValueOnce(new Blob(['%PDF-1.7'], { type: 'application/pdf' }))
  await printReport('report')
  expect(link.click).toHaveBeenCalledOnce()
  vi.runAllTimers()
})
it('reports export failure safely without claiming success', async () => {
  harness.get.mockRejectedValueOnce(new Error('private error'))
  await button(actions(), 'Export PDF').props.onClick()
  expect(harness.slots[3]).toContain('Unable to download the report PDF')
  expect(harness.slots[2]).toBeNull()
})

it('describes a downloadable PDF without browser print instructions', () => {
  expect(button(actions(), 'Export downloads a PDF copy of this finalized report.')).toBeDefined()
  expect(find(actions(), (node) => typeof node.props?.children === 'string' && node.props.children.includes('print dialog'))).toBeUndefined()
})
