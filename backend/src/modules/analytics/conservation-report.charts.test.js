const { statisticsChart, trendChart } = require('./conservation-report.charts')
const { exportReport, generateReportPdf } = require('./conservation-report.export')
const { comparisonFixture } = require('../../test-support/comparison-fixture')
let calculateComparison, reportSnapshot
beforeAll(async () => {
  ;({ calculateComparison } = await import('../../../../frontend/src/features/analytics/lib/compareParks.js'))
  ;({ reportSnapshot } = await import('../../../../frontend/src/features/analytics/lib/reportSnapshot.js'))
})
const report = snapshot => ({ title: 'Conservation review', findings: 'Recorded wildlife activity.', recommendations: 'Review supporting observations.',
  snapshot, status: 'finalized', finalizedAt: '2026-10-08T00:00:00Z' })

it('plots only saved alert/conflict counts and preserves source values and escaped names', () => {
  const stats = { alertRecords: 6, conflictRecords: 3, patrolRecords: 99, totalEventRecords: 9 }
  const before = structuredClone(stats)
  const html = statisticsChart(stats, '<Park & Forest>')
  expect(html).toContain('&lt;Park &amp; Forest&gt;')
  expect(html).toContain('data-series="alerts" data-value="6"')
  expect(html).toContain('data-series="conflicts" data-value="3"')
  expect(html).toContain('width="480"')
  expect(html).toContain('width="240"')
  expect(html).not.toContain('99')
  expect(stats).toEqual(before)
  expect(statisticsChart({ alertRecords: 0, conflictRecords: 0 }, 'Empty park')).toBe('')
})
it.each(['day', 'month'])('plots every saved %s bucket with the web chart scale and distinct print series', unit => {
  const trends = { status: 'ready', unit, buckets: [
    { key: '2026-10-01', alerts: 4, conflicts: 2 }, { key: '2026-10-02', alerts: 0, conflicts: 1 },
  ] }
  const before = structuredClone(trends)
  const html = trendChart(trends, 'Yala')
  expect(html).toContain('points="45,25 695,220"')
  expect(html).toContain('points="45,122.5 695,171.25"')
  expect(html).toContain('stroke-dasharray="6 4"')
  expect(html).toContain('2026-10-01: 4 alerts')
  expect(html).toContain(unit === 'day' ? 'Daily alert' : 'Monthly alert')
  expect(trends).toEqual(before)
})
it('keeps a single-period observation visible and retains all long-period points without aggregation', () => {
  const bucket = { key: '2026-10-01', alerts: 2, conflicts: 0 }
  const single = trendChart({ status: 'ready', unit: 'day', buckets: [bucket] }, 'Yala')
  expect(single).toContain('<circle cx="365" cy="25"')
  const long = trendChart({ status: 'ready', unit: 'day', buckets: Array.from({ length: 1200 }, () => bucket) }, 'Yala')
  const points = long.match(/<polyline points="([^"]+)"/)[1].split(' ')
  expect(points).toHaveLength(1200)
  expect(trendChart({ status: 'error' }, 'Yala')).toBe('')
  expect(trendChart({ status: 'empty', buckets: [] }, 'Yala')).toBe('')
})
it('spaces date labels for print without dropping any plotted periods', () => {
  const buckets = Array.from({ length: 10 }, (_, index) => ({ key: `2026-10-${String(index + 1).padStart(2, '0')}`, alerts: index, conflicts: 0 }))
  const html = trendChart({ status: 'ready', unit: 'day', buckets }, 'Yala')
  const labels = [...html.matchAll(/<text[^>]+y="245"[^>]*>([^<]+)<\/text>/g)].map(match => match[1])
  expect(labels).toEqual(['2026-10-01', '2026-10-04', '2026-10-07', '2026-10-10'])
  expect(html.match(/<polyline points="([^"]+)"/)[1].split(' ')).toHaveLength(10)
})
it('keeps each park chart inside its existing section and the comparison table after both sections', () => {
  const snapshot = reportSnapshot(calculateComparison(comparisonFixture()))
  const original = report(snapshot)
  const before = structuredClone(original)
  const html = exportReport(original)
  expect(html.match(/class="pdf-chart"/g)).toHaveLength(4)
  expect(html.indexOf('Event record composition — First Park')).toBeLessThan(html.indexOf('Daily alert and conflict trends — First Park'))
  expect(html.indexOf('Daily alert and conflict trends — First Park')).toBeLessThan(html.indexOf('Event record composition — Second Park'))
  expect(html.indexOf('Daily alert and conflict trends — Second Park')).toBeLessThan(html.indexOf('Comparative Overview'))
  expect(original).toEqual(before)
})
it('retains unavailable and empty feedback without manufacturing chart data', () => {
  const snapshot = reportSnapshot(calculateComparison(comparisonFixture())).parks[0]
  snapshot.statistics.alertRecords = 0
  snapshot.statistics.conflictRecords = 0
  snapshot.analysis.trends = { status: 'error' }
  const html = exportReport(report(snapshot))
  expect(html).not.toContain('class="pdf-chart"')
  expect(html).toContain('Trend calculation unavailable.')
  expect(html).toContain('Patrol records (separate context)')
})
it('renders chart captions, periods and exact values into a readable PDF without mutations', async () => {
  const original = report(reportSnapshot(calculateComparison(comparisonFixture())))
  const before = structuredClone(original)
  const bytes = await generateReportPdf(original)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
  const pdf = await loading.promise
  try {
    const pages = []
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index)
      const text = (await page.getTextContent()).items.map(item => item.str).join(' ')
      expect(text).toContain(`Page ${index} of ${pdf.numPages}`)
      pages.push(text)
    }
    const text = pages.join(' ')
    for (const park of ['First Park', 'Second Park']) {
      expect(text).toContain(`Event record composition — ${park}`)
      expect(text).toContain(`Daily alert and conflict trends — ${park}`)
    }
    expect(text).toContain('2026-10-01')
    expect(text).toContain('Comparative Overview')
    expect(original).toEqual(before)
  } finally { await loading.destroy() }
})
