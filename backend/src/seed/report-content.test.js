const { sampleReportContent } = require('./report-content')
const { comparisonFixture } = require('../test-support/comparison-fixture')
let calculateComparison
beforeAll(async () => { ({ calculateComparison } = await import('../../../frontend/src/features/analytics/lib/compareParks.js')) })
it('creates meaningful single-park narrative from recorded events, hotspots and patrol effort without changing the snapshot', () => {
  const snapshot = calculateComparison(comparisonFixture()).parks[0]
  const before = structuredClone(snapshot)
  const content = sampleReportContent(snapshot)
  expect(content.title).toContain('First Park Conservation Review: 2026-10-01 to 2026-10-07')
  expect(content.findings).toContain('3 alert records and 0 conflict records')
  expect(content.findings).toContain('North (3 alert events)')
  expect(content.findings).toContain('North: 1 hour')
  expect(content.recommendations).toContain('schedule field checks in North')
  expect(snapshot).toEqual(before)
})
it('retains independent comparison sections and gives honest findings for an empty park', () => {
  const data = comparisonFixture()
  data.datasets[1].records = { alerts: [], conflicts: [], patrolRecords: [] }
  const snapshot = calculateComparison(data)
  const content = sampleReportContent(snapshot)
  expect(content.title).toContain('First Park and Second Park Conservation Comparison')
  expect(content.findings).toContain('No matching event records were available')
  expect(content.findings).toContain('does not establish that wildlife activity')
  expect(content.recommendations).toContain('Check field-device synchronization')
  expect(content.recommendations).toContain('Second Park')
  for (const [field, value] of Object.entries(content)) {
    expect(value.trim().length).toBeGreaterThan(30)
    expect(value.length).toBeLessThanOrEqual(field === 'title' ? 200 : 5000)
    expect(value).not.toMatch(/demo|simulated|audit|sample/i)
  }
})
