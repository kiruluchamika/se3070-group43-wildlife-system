vi.mock('../../../../frontend/src/lib/storage.js', () => ({ sessionStore: { getToken: () => 'test-token' } }))
let api, onUnauthorized
beforeAll(async () => {
  ;({ api, onUnauthorized } = await import('../../../../frontend/src/lib/api.js'))
})
afterEach(() => vi.unstubAllGlobals())

it('requests the PDF with existing bearer authentication and reads a Blob', async () => {
  const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
  const fetch = vi.fn(async () => new Response(pdf))
  vi.stubGlobal('fetch', fetch)
  const result = await api.get('/reports/report/export', { responseType: 'blob' })
  expect(result.type).toBe('application/pdf')
  expect(await result.text()).toBe('%PDF-1.7')
  expect(fetch).toHaveBeenCalledWith('/api/reports/report/export', expect.objectContaining({
    method: 'GET', headers: { Accept: 'application/pdf', Authorization: 'Bearer test-token' },
  }))
})

it('retains JSON error handling and session-expiry notifications for PDF requests', async () => {
  const expired = vi.fn()
  const unsubscribe = onUnauthorized(expired)
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Session expired', code: 'SESSION_EXPIRED' }, { status: 401 })))
  try {
    await expect(api.get('/reports/report/export', { responseType: 'blob' })).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' })
    expect(expired).toHaveBeenCalledOnce()
  } finally { unsubscribe() }
})

it('preserves ordinary JSON requests', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ reports: [] })))
  await expect(api.get('/reports')).resolves.toEqual({ reports: [] })
})
