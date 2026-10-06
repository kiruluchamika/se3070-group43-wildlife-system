const harness = vi.hoisted(() => ({ slots: [], cursor: 0, get: vi.fn(), post: vi.fn(), query: null }))
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
  ;({ printFinalizedReport: printReport } = await import('../../../../frontend/src/features/analytics/lib/exportReport.js'))
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  harness.slots = []
  harness.get.mockReset()
  harness.post.mockReset()
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
  expect(button(actions(), 'Export')).toBeDefined()
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
function popup() {
  return { document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), fonts: { ready: Promise.resolve() } }, focus: vi.fn(), print: vi.fn(), close: vi.fn(), closed: false }
}
it('exports only the server-authorized document through the browser print dialog', async () => {
  const window = popup()
  harness.get.mockResolvedValueOnce({ html: '<html><body>Finalized report</body></html>' })
  await printReport('report', () => window)
  expect(harness.get).toHaveBeenCalledWith('/reports/report/export')
  expect(window.document.write).toHaveBeenCalledWith('<html><body>Finalized report</body></html>')
  expect(window.print).toHaveBeenCalledOnce()
  expect(window.opener).toBeNull()
  expect(harness.post).not.toHaveBeenCalled()
})
it('handles blocked popups and failed export without printing, then allows retry', async () => {
  await expect(printReport('report', () => null)).rejects.toThrow('Allow pop-ups')
  expect(harness.get).not.toHaveBeenCalled()
  const failed = popup()
  harness.get.mockRejectedValueOnce(new Error('Export failed'))
  await expect(printReport('report', () => failed)).rejects.toThrow('Export failed')
  expect(failed.print).not.toHaveBeenCalled()
  expect(failed.close).toHaveBeenCalledOnce()
  const retry = popup()
  harness.get.mockResolvedValueOnce({ html: '<html>Finalized report</html>' })
  await printReport('report', () => retry)
  expect(retry.print).toHaveBeenCalledOnce()
})
it('reports export failure safely and never claims a PDF was saved', async () => {
  vi.stubGlobal('window', { open: () => null })
  await button(actions(), 'Export').props.onClick()
  expect(harness.slots[3]).toContain('Unable to open the report export')
  expect(harness.slots[2]).toBeNull()
})
