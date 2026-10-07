import { useId } from 'react'

/** Small SVG chart; no additional chart dependency or network request. */
export function TrendChart({ trend }) {
  const titleId = useId()
  const width = 720
  const height = 260
  const left = 45
  const bottom = 220
  const max = Math.max(1, ...trend.buckets.flatMap((bucket) => [bucket.alerts, bucket.conflicts]))
  const x = (index) => left + (trend.buckets.length === 1 ? 320 : index / (trend.buckets.length - 1) * 650)
  const y = (count) => bottom - count / max * 195
  const ticks = [...new Set([0, Math.ceil(max / 2), max])]
  return (
    <>
      <p className="mb-4 text-sm text-muted">{trend.unit === 'day' ? 'Daily' : 'Monthly'} records in Sri Lanka time using the selected event-time basis. Patrols are excluded.</p>
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted">
        <span>Alerts — solid teal line, circles</span><span>Conflicts — dashed cyan line, squares</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px] text-muted" role="img" aria-labelledby={titleId}>
          <title id={titleId}>Alert and conflict record trends. Exact values are available in the trend values table below.</title>
          {ticks.map((tick) => <g key={tick}>
            <line x1={left} x2="695" y1={y(tick)} y2={y(tick)} stroke="var(--color-line-strong)" />
            <text x="34" y={y(tick) + 4} textAnchor="end" fill="currentColor" fontSize="11">{tick}</text>
          </g>)}
          {['alerts', 'conflicts'].map((source) => <g key={source}>
            <polyline points={trend.buckets.map((bucket, index) => `${x(index)},${y(bucket[source])}`).join(' ')}
              fill="none" stroke={`var(--color-${source === 'alerts' ? 'brand' : 'accent'}-400)`} strokeWidth="2.5" strokeDasharray={source === 'conflicts' ? '6 4' : undefined} />
            {trend.buckets.map((bucket, index) => source === 'alerts'
              ? <circle key={bucket.key} cx={x(index)} cy={y(bucket[source])} r="3" fill="var(--color-brand-400)"><title>{bucket.key}: {bucket[source]} alerts</title></circle>
              : <rect key={bucket.key} x={x(index) - 3} y={y(bucket[source]) - 3} width="6" height="6" fill="var(--color-accent-400)"><title>{bucket.key}: {bucket[source]} conflicts</title></rect>)}
          </g>)}
          {trend.buckets.map((bucket, index) => (index === 0 || index === trend.buckets.length - 1 || index % Math.ceil(trend.buckets.length / 5) === 0) &&
            <text key={bucket.key} x={x(index)} y="245" textAnchor={index === 0 ? 'start' : index === trend.buckets.length - 1 ? 'end' : 'middle'} fill="currentColor" fontSize="10">{bucket.key}</text>)}
        </svg>
      </div>
      <details className="mt-3 text-sm text-muted">
        <summary className="cursor-pointer font-semibold">Trend values</summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Record counts for each {trend.unit}; not unique incidents</caption>
            <thead><tr><th className="p-2">Period</th><th className="p-2">Alerts</th><th className="p-2">Conflicts</th></tr></thead>
            <tbody>{trend.buckets.map((bucket) => <tr key={bucket.key} className="border-t border-line"><th className="p-2 font-normal">{bucket.key}</th><td className="p-2">{bucket.alerts}</td><td className="p-2">{bucket.conflicts}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  )
}
