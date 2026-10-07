const { retrievalQuery, singleParkQuery } = require('./analytics.schemas')
let analysisDateErrors, sriLankaToday
beforeAll(async () => {
  ;({ analysisDateErrors, sriLankaToday } = await import('../../../../frontend/src/features/analytics/lib/analysisDates.js'))
})
afterEach(() => vi.restoreAllMocks())
const today = '2026-10-08'
const single = { parkId: '111111111111111111111111', startDate: '2026-09-30', endDate: '2026-10-06' }
const multiple = { parkIds: [single.parkId, '222222222222222222222222'], startDate: single.startDate, endDate: single.endDate }

it('uses the Sri Lanka calendar day across the UTC midnight boundary', () => {
  expect(sriLankaToday(new Date('2026-10-07T18:29:59Z'))).toBe('2026-10-07')
  expect(sriLankaToday(new Date('2026-10-07T18:30:00Z'))).toBe(today)
})
it.each([single, multiple])('validates past/current dates and rejects either future date in retrieval %j', (base) => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-07T18:30:00Z').getTime())
  for (const dates of [{ startDate: '2026-09-30', endDate: '2026-10-06' }, { startDate: today, endDate: today }]) {
    expect(retrievalQuery.safeParse({ ...base, ...dates }).success).toBe(true)
    expect(analysisDateErrors(dates, today)).toEqual({})
  }
  for (const field of ['startDate', 'endDate']) {
    const dates = { startDate: today, endDate: today, [field]: '2026-10-09' }
    const parsed = retrievalQuery.safeParse({ ...base, ...dates })
    expect(parsed.success).toBe(false)
    expect(parsed.error.issues.some(issue => issue.path[0] === field && issue.message.includes('future'))).toBe(true)
    expect(analysisDateErrors(dates, today)[field]).toContain('cannot be in the future')
  }
})
it.each([
  { startDate: '2026-10-06', endDate: '2026-10-05' },
  { startDate: '2026-02-30', endDate: today },
  { startDate: today, endDate: '2026-13-01' },
  { startDate: '', endDate: today },
])('rejects invalid calendar dates and reversed ranges in the UI and request %j', (dates) => {
  expect(retrievalQuery.safeParse({ ...single, ...dates }).success).toBe(false)
  expect(Object.keys(analysisDateErrors(dates, today)).length).toBeGreaterThan(0)
})
it('evaluates the limit at request time while preserving stored snapshot validation', () => {
  const value = { ...single, startDate: today, endDate: today }
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-07T18:29:59Z').getTime())
  expect(retrievalQuery.safeParse(value).success).toBe(false)
  Date.now.mockReturnValue(new Date('2026-10-07T18:30:00Z').getTime())
  expect(retrievalQuery.safeParse(value).success).toBe(true)
  expect(singleParkQuery.safeParse({ ...single, endDate: '2099-01-01' }).success).toBe(true)
})
