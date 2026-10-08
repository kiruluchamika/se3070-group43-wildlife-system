const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

function figure(title, height, content) {
  return `<figure class="pdf-chart" style="margin:12px 0 18px;padding:10px;border:1px solid #dbe5e3;break-inside:avoid;page-break-inside:avoid"><figcaption style="font-size:10pt;font-weight:700;margin-bottom:8px">${escape(title)}</figcaption><svg xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto" viewBox="0 0 720 ${height}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title><desc>Calculated report values; exact counts are retained in the accompanying table.</desc>${content}</svg></figure>`
}

/** Plot stored counts only. Patrol records are separate context, not events. */
function statisticsChart(statistics, parkName) {
  const rows = [
    { source: 'alerts', label: 'Alert records', value: statistics.alertRecords, color: '#137963' },
    { source: 'conflicts', label: 'Conflict records', value: statistics.conflictRecords, color: '#236b91' },
  ]
  const max = Math.max(...rows.map(row => row.value))
  if (max === 0) return ''
  const content = rows.map((row, index) => {
    const y = 20 + index * 50
    return `<g data-series="${row.source}" data-value="${row.value}"><text x="10" y="${y + 21}" font-size="15" fill="#20343b">${row.label}</text><rect x="160" y="${y}" width="${row.value / max * 480}" height="30" rx="3" fill="${row.color}"/><text x="660" y="${y + 21}" font-size="15" fill="#20343b">${row.value}</text></g>`
  }).join('')
  return figure(`Event record composition — ${parkName}`, 125, content)
}

/** Reuse the web TrendChart's scales and series, with print-safe colors and
 * spaced date labels. No aggregation, recalculation or remote rendering. */
function trendChart(trends, parkName) {
  if (trends.status !== 'ready' || !trends.buckets.length) return ''
  const { buckets } = trends
  const max = Math.max(1, ...buckets.flatMap(bucket => [bucket.alerts, bucket.conflicts]))
  const x = index => 45 + (buckets.length === 1 ? 320 : index / (buckets.length - 1) * 650)
  const y = count => 220 - count / max * 195
  const ticks = [...new Set([0, Math.ceil(max / 2), max])]
  const grid = ticks.map(tick => `<line x1="45" x2="695" y1="${y(tick)}" y2="${y(tick)}" stroke="#dbe5e3"/><text x="34" y="${y(tick) + 4}" text-anchor="end" fill="#536c73" font-size="13">${tick}</text>`).join('')
  const series = ['alerts', 'conflicts'].map(source => {
    const color = source === 'alerts' ? '#137963' : '#236b91'
    const points = buckets.map((bucket, index) => `${x(index)},${y(bucket[source])}`).join(' ')
    const markers = buckets.length <= 60 ? buckets.map((bucket, index) => {
      const title = `<title>${escape(bucket.key)}: ${bucket[source]} ${source}</title>`
      return source === 'alerts'
        ? `<circle cx="${x(index)}" cy="${y(bucket[source])}" r="3" fill="${color}">${title}</circle>`
        : `<rect x="${x(index) - 3}" y="${y(bucket[source]) - 3}" width="6" height="6" fill="${color}">${title}</rect>`
    }).join('') : ''
    return `<g data-series="${source}"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"${source === 'conflicts' ? ' stroke-dasharray="6 4"' : ''}/>${markers}</g>`
  }).join('')
  const labelCount = Math.min(4, buckets.length)
  const labelIndices = new Set(Array.from({ length: labelCount }, (_, index) =>
    labelCount === 1 ? 0 : Math.round(index / (labelCount - 1) * (buckets.length - 1))))
  const labels = buckets.map((bucket, index) => labelIndices.has(index)
    ? `<text x="${x(index)}" y="245" text-anchor="${index === 0 ? 'start' : index === buckets.length - 1 ? 'end' : 'middle'}" fill="#536c73" font-size="13">${escape(bucket.key)}</text>` : '').join('')
  const legend = '<line x1="45" x2="75" y1="280" y2="280" stroke="#137963" stroke-width="2.5"/><circle cx="60" cy="280" r="3" fill="#137963"/><text x="85" y="285" font-size="13" fill="#20343b">Alerts</text><line x1="210" x2="240" y1="280" y2="280" stroke="#236b91" stroke-width="2.5" stroke-dasharray="6 4"/><rect x="222" y="277" width="6" height="6" fill="#236b91"/><text x="250" y="285" font-size="13" fill="#20343b">Conflicts</text><text x="695" y="285" text-anchor="end" font-size="13" fill="#536c73">Record counts · Sri Lanka time</text>'
  return figure(`${trends.unit === 'day' ? 'Daily' : 'Monthly'} alert and conflict trends — ${parkName}`, 305, grid + series + labels + legend)
}

module.exports = { escape, statisticsChart, trendChart }
