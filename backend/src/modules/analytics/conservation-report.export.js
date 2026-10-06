const { chromium } = require('playwright')
const { ConflictError } = require('../../shared/errors/AppError')
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const text = (value) => `<p class="text">${escape(value)}</p>`
function table(headers, rows) {
  return `<table><thead><tr>${headers.map((label) => `<th>${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

/** Escaped, self-contained layout used only by the PDF renderer. */
function exportReport(report) {
  if (report.status !== 'finalized') throw new ConflictError('Only Finalized reports can be exported.', 'REPORT_NOT_FINALIZED')
  const { context, statistics, analysis } = report.snapshot
  const { trends, hotspots, coverage } = analysis
  const number = (value) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
  const body = [
    `<header><div class="brand">WILDGUARD</div><div class="system">WildGuard Conservation System</div><h1>${escape(report.title)}</h1><span class="status">Status: Finalized</span></header>`,
    table(['Analysis context', 'Value'], [
      ['Park', context.park.name], ['Period (Sri Lanka time)', `${context.filters.startDate} to ${context.filters.endDate}`],
      ['Incident type', context.filters.incidentType || 'All incident types'], ['Species', context.filters.species || 'All species'],
      ['Retrieved at (UTC)', context.retrievedAt], ['Finalized at (UTC)', new Date(report.finalizedAt).toISOString()],
    ]),
    '<h2>Statistics</h2>', table(['Measure', 'Records'], [
      ['Event records', statistics.totalEventRecords], ['Alert records', statistics.alertRecords], ['Conflict records', statistics.conflictRecords],
      ['Zones represented', statistics.representedZones], ['Patrol records (separate context)', statistics.patrolRecords],
    ]), text('Event records are not unique wildlife incidents. Patrols are excluded from event totals and are not restricted by incident type.'),
    '<h2>Trends</h2>', trends.status === 'error' ? text('Trend calculation unavailable.') :
      text(`${trends.unit === 'day' ? 'Daily' : 'Monthly'} counts in Sri Lanka time. Alerts use creation time; conflicts use occurrence time. ${trends.omitted} records omitted due to invalid timestamps.`) +
      (trends.status === 'empty' ? text('No trend records for this period.') : '') + table(['Period', 'Alerts', 'Conflicts'], trends.buckets.map((row) => [row.key, row.alerts, row.conflicts])),
    '<h2>Hotspots</h2>', text('At least 3 zone-linked alert events, including simulated sources; not verified unique incidents. Conflicts have no zone reference.'),
    hotspots.status === 'error' ? text('Hotspot calculation unavailable.') :
      (hotspots.hotspots.length ? table(['Zone', 'Alert events'], hotspots.hotspots.map((row) => [row.zone.name, row.count])) : text('No hotspots identified.')) + text(`${hotspots.unzoned} records without usable zones; ${hotspots.omitted} invalid timestamps.`),
    '<h2>Patrol coverage</h2>', text('Patrol effort against prorated targets, not area covered or completion.'),
    coverage.status === 'error' ? text('Coverage calculation unavailable.') :
      (coverage.status === 'empty' ? text('No contributing patrol intervals.') : '') + table(['Zone', 'Patrol hours', 'Target hours', 'Coverage'], coverage.zones.map((row) => [row.zone.name, number(row.hours), row.targetHours === null ? 'Unavailable' : number(row.targetHours), row.percent === null ? 'Unavailable' : `${row.percent}%`])) +
      text(`${coverage.omitted} patrol records omitted due to invalid times or unknown zones. Uses current configured targets at analysis time. Ongoing patrols end at retrieval time; future time is excluded.`),
    '<h2>Findings</h2>', text(report.findings || 'No findings entered.'),
    '<h2>Recommendations</h2>', text(report.recommendations || 'No recommendations entered.'),
  ].join('\n')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(report.title)}</title><style>@page{size:A4;margin:18mm 18mm 22mm}*{box-sizing:border-box}body{font:10pt Arial,"Nirmala UI",sans-serif;color:#20343b;margin:0;overflow-wrap:anywhere;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}header{border-top:5px solid #178b75;border-bottom:1px solid #cadbd7;padding:18px 0 20px;margin-bottom:22px}.brand{font-size:13pt;font-weight:700;letter-spacing:3px;color:#137963}.system{font-size:10pt;color:#536c73;margin-top:3px}h1{font-size:24pt;line-height:1.2;color:#102f36;margin:18px 0 12px}.status{display:inline-block;background:#e2f3eb;color:#146748;font-weight:700;padding:4px 10px;border-radius:4px}h2{font-size:15pt;color:#137963;margin:24px 0 10px;padding-bottom:6px;border-bottom:1px solid #cadbd7;break-after:avoid}table{border-collapse:collapse;width:100%;font-size:9pt;margin:12px 0 18px;table-layout:fixed}th,td{border-bottom:1px solid #dbe5e3;padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf2ef;color:#143e39}thead{display:table-header-group}tr{break-inside:avoid}tbody tr:nth-child(even){background:#f5f8f7}.text{white-space:pre-wrap;orphans:3;widows:3}header{break-inside:avoid}</style></head><body>${body}</body></html>`
}
/** No file writes or report mutations; each export closes its isolated renderer. */
async function generateReportPdf(report) {
  const html = exportReport(report) // Reject Drafts before starting Chromium.
  const browser = await chromium.launch({ headless: true, timeout: 30000 })
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, offline: true })
    await context.route('**/*', (route) => route.abort())
    const page = await context.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    return await page.pdf({
      format: 'A4', preferCSSPageSize: true, printBackground: true, tagged: true,
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 18mm;font:9px Arial;color:#536c73;display:flex;justify-content:space-between"><span>WildGuard Conservation System &middot; Finalized report</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    })
  } finally {
    await browser.close()
  }
}
module.exports = { exportReport, generateReportPdf }
