const h = vi.hoisted(() => ({ slots: [], cursor: 0, post: vi.fn(), patch: vi.fn(), role: 'administrator', query: {}, calls: [] }))
vi.mock('../../../../frontend/node_modules/react/index.js', async (original) => ({
  ...await original(),
  useState(initial) {
    const i = h.cursor++
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial
    return [h.slots[i], (value) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value }]
  },
  useRef(initial) { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i] },
}))
vi.mock('../../../../frontend/src/lib/api.js', () => ({ api: { post: h.post, patch: h.patch } }))
vi.mock('../../../../frontend/src/context/auth-context.js', () => ({ useAuth: () => ({ user: { id: 'admin', role: h.role } }) }))
vi.mock('../../../../frontend/src/hooks/useApiQuery.js', () => ({ useApiQuery: (path, options) => { h.calls.push([path, options]); return path === '/parks' ? { data: { parks: [] } } : h.query } }))
vi.mock('../../../../frontend/node_modules/react-router/dist/development/index.js', () => ({ useSearchParams: () => [new URLSearchParams(), vi.fn()] }))
vi.mock('../../../../frontend/node_modules/react-router/dist/production/index.js', () => ({ useSearchParams: () => [new URLSearchParams(), vi.fn()] }))
let Editor, Status, Page, navItemsFor
beforeAll(async () => {
  vi.stubGlobal('React', await import('../../../../frontend/node_modules/react/index.js'))
  ;({ UserEditor: Editor, UserStatusDialog: Status } = await import('../../../../frontend/src/features/users/UserDialogs.jsx'))
  ;({ default: Page } = await import('../../../../frontend/src/features/users/UsersPage.jsx'))
  ;({ navItemsFor } = await import('../../../../frontend/src/lib/navigation.js'))
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => { h.slots = []; h.cursor = 0; h.calls = []; h.role = 'administrator'; h.query = { data: { users: [], hasMore: false }, reload: vi.fn() }; h.post.mockReset(); h.patch.mockReset() })
const user = { id: 'other', name: 'Test user', email: 'test@example.com', role: 'ranger', park: null, isActive: true }
function render(Component, props) { h.cursor = 0; return Component(props) }
function find(node, test) {
  if (!node || typeof node !== 'object') return undefined
  if (test(node)) return node
  for (const child of [node.props?.children, node.props?.footer, node.props?.actions].flat(Infinity)) {
    const result = find(child, test)
    if (result) return result
  }
}
const button = (tree, label) => find(tree, (node) => node.props?.children === label)
it('exposes navigation only to administrators and prevents unauthorized queries', () => {
  expect(navItemsFor('administrator').some((item) => item.path === '/users')).toBe(true)
  for (const role of ['villager', 'ranger', 'data-analyst', 'park-manager', 'liaison-officer']) {
    expect(navItemsFor(role).some((item) => item.path === '/users')).toBe(false)
    h.role = role; h.calls = []
    expect(render(Page).type.name).toBe('ForbiddenPage')
    expect(h.calls.every(([, options]) => options.enabled === false)).toBe(true)
  }
})
it('renders loading, failure, empty and populated states with active status', () => {
  h.query = { loading: true }
  expect(find(render(Page), (node) => node.type?.name === 'Skeleton')).toBeDefined()
  h.query = { error: new Error('private error'), reload: vi.fn() }
  expect(find(render(Page), (node) => node.props?.message === 'Unable to load users.')).toBeDefined()
  h.query = { data: { users: [], hasMore: false } }
  expect(find(render(Page), (node) => node.props?.title === 'No users on this page.')).toBeDefined()
  h.query = { data: { users: [user], hasMore: true } }
  expect(button(render(Page), 'Active')).toBeDefined()
  expect(button(render(Page), 'Next').props.disabled).toBe(false)
})
it('requires confirmation and supports cancellation without a status request', async () => {
  const close = vi.fn(), saved = vi.fn()
  const props = { user, onClose: close, onSaved: saved }
  const tree = render(Status, props)
  expect(h.patch).not.toHaveBeenCalled()
  button(tree, 'Cancel').props.onClick()
  expect(close).toHaveBeenCalledOnce()
  expect(h.patch).not.toHaveBeenCalled()
  h.patch.mockResolvedValueOnce({ user: { ...user, isActive: false } })
  await button(tree, 'Deactivate').props.onClick()
  expect(h.patch).toHaveBeenCalledWith('/users/other/status', { isActive: false })
  expect(saved).toHaveBeenCalledOnce()
})
it('prevents duplicate activation requests and preserves the dialog on failure', async () => {
  let reject
  h.patch.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail }))
  const props = { user: { ...user, isActive: false }, onClose: vi.fn(), onSaved: vi.fn() }
  const confirm = button(render(Status, props), 'Activate').props.onClick
  const pending = confirm(); await confirm()
  expect(h.patch).toHaveBeenCalledTimes(1)
  expect(render(Status, props).props.dismissible).toBe(false)
  reject(new Error('private database failure')); await pending
  expect(props.onSaved).not.toHaveBeenCalled()
  expect(button(render(Status, props), 'Unable to save the user. Please retry.')).toBeDefined()
})
it.each([false, true])('uses the correct create/edit contract; editing=%s', async (editing) => {
  const props = { user: editing ? user : undefined, parks: [], currentUserId: 'admin', onClose: vi.fn(), onSaved: vi.fn() }
  render(Editor, props)
  h.slots[0] = { name: ' Test user ', email: user.email, phone: '', park: '', role: 'ranger', password: 'long-password' }
  const form = find(render(Editor, props), (node) => node.type === 'form')
  await form.props.onSubmit({ preventDefault() {} })
  const expected = { name: 'Test user', email: user.email, phone: '', park: null, role: 'ranger' }
  if (editing) { expect(h.patch).toHaveBeenCalledWith('/users/other', expected); expect(h.post).not.toHaveBeenCalled() }
  else expect(h.post).toHaveBeenCalledWith('/users', { ...expected, password: 'long-password' })
  expect(props.onSaved).toHaveBeenCalledOnce()
})
it('keeps form values and shows server field validation on failure', async () => {
  const props = { user, parks: [], onClose: vi.fn(), onSaved: vi.fn() }
  render(Editor, props)
  h.patch.mockRejectedValueOnce({ status: 400, message: 'Invalid email', details: [{ field: 'email', message: 'Enter a valid email' }] })
  await find(render(Editor, props), (node) => node.type === 'form').props.onSubmit({ preventDefault() {} })
  expect(h.slots[0].email).toBe(user.email)
  expect(find(render(Editor, props), (node) => node.props?.label === 'Email').props.error).toBe('Enter a valid email')
  expect(props.onSaved).not.toHaveBeenCalled()
})

