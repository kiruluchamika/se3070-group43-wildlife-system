const { ConflictError } = require('../../shared/errors/AppError')
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const text = (value) => `<p class="text">${escape(value)}</p>`
function table(headers, rows) {
  return `<table><thead><tr>${headers.map((label) => `<th>${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

/** Standalone, script-free printable document. Browser print supports PDF. */
function exportReport(report) {
  if (report.status !== 'finalized') throw new ConflictError('Only Finalized reports can be exported.', 'REPORT_NOT_FINALIZED')
  const { context, statistics, analysis } = report.snapshot
  const { trends, hotspots, coverage } = analysis
  const number = (value) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
  const body = [
    `<h1>${escape(report.title)}</h1>`, text('Status: Finalized'),
    table(['Analysis context', 'Value'], [
      ['Park', context.park.name], ['Period (Sri Lanka time)', `${context.filters.startDate} to ${context.filters.endDate}`],
      ['Incident type', context.filters.incidentType || 'All incident types'], ['Species', 'Not available from current sources'],
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(report.title)}</title><style>@page{size:A4;margin:18mm}body{font:12pt system-ui,sans-serif;color:#172334;max-width:900px;margin:24px auto;padding:16px;overflow-wrap:anywhere}h1{font-size:24pt}h2{font-size:16pt;break-after:avoid}table{border-collapse:collapse;width:100%;font-size:10pt;margin:16px 0;table-layout:fixed}th,td{border:1px solid #b7c1cc;padding:7px;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.text{white-space:pre-wrap}@media print{body{max-width:none;margin:0;padding:0}}</style></head><body>${body}</body></html>`
}
module.exports = { exportReport }
