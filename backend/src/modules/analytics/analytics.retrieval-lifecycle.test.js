const { React, installHeadlessHost, mountProbe, deferred } = require('../../test-support/react-headless-root')
const transport = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../../../frontend/src/lib/api.js', () => ({
  api: { get: transport.get }, toQuery: (filters) => `?${new URLSearchParams(filters)}`,
}))
let useAnalysisRetrieval, makeContainer, mounted
beforeAll(async () => {
  ;({ useAnalysisRetrieval } = await import('../../../../frontend/src/features/analytics/hooks/useAnalysisRetrieval.js'))
})
beforeEach(async () => {
  transport.get.mockReset()
  makeContainer = installHeadlessHost()
  mounted = await mountProbe(() => useAnalysisRetrieval(), makeContainer)
})
afterEach(async () => { await mounted.unmount(); vi.unstubAllGlobals() })
const filters = { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-07' }
const dataset = (name) => ({ park: { name }, freshness: { requiresConfirmation: false } })

it.each(['resolve', 'reject'])('ignores a superseded request that later %ss while preserving the newer result', async (outcome) => {
  const old = deferred(), next = deferred()
  transport.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
  let oldRequest, nextRequest
  await React.act(async () => { oldRequest = mounted.current.retrieve(filters) })
  const oldSignal = transport.get.mock.calls[0][1].signal
  await React.act(async () => { nextRequest = mounted.current.retrieve({ ...filters, parkId: 'new-park' }) })
  expect(oldSignal.aborted).toBe(true)
  expect(transport.get.mock.calls[1][1].signal.aborted).toBe(false)
  await React.act(async () => { next.resolve(dataset('New park')); await nextRequest })
  const renders = mounted.renders
  await React.act(async () => {
    if (outcome === 'resolve') old.resolve(dataset('Old park'))
    else old.reject(new Error('late old request failure'))
    await oldRequest
  })
  expect(mounted.renders).toBe(renders)
  expect(mounted.current).toMatchObject({ phase: 'ready', dataset: dataset('New park'), error: null })
})

it.each(['resolve', 'reject'])('runs real unmount cleanup and ignores a request that later %ss', async (outcome) => {
  const pending = deferred()
  transport.get.mockReturnValueOnce(pending.promise)
  let request
  await React.act(async () => { request = mounted.current.retrieve(filters) })
  const signal = transport.get.mock.calls[0][1].signal
  expect(signal.aborted).toBe(false)
  await mounted.unmount()
  expect(signal.aborted).toBe(true)
  const renders = mounted.renders
  await React.act(async () => {
    if (outcome === 'resolve') pending.resolve(dataset('Late result'))
    else pending.reject(new Error('late failure after unmount'))
    await request
  })
  expect(mounted.renders).toBe(renders)
})

it('keeps cancelled filters empty when an abort-insensitive transport later resolves', async () => {
  const pending = deferred()
  transport.get.mockReturnValueOnce(pending.promise)
  let request
  await React.act(async () => { request = mounted.current.retrieve(filters) })
  await React.act(async () => { mounted.current.reset() })
  expect(transport.get.mock.calls[0][1].signal.aborted).toBe(true)
  await React.act(async () => { pending.resolve(dataset('Cancelled')); await request })
  expect(mounted.current).toMatchObject({ phase: 'filters', dataset: null, error: null })
})
