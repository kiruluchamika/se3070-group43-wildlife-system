import { Card } from '../../../components/ui/Card'
import { humanize } from '../../../lib/format'
import { ComparativeOverview } from './ComparativeOverview'

const number = (value) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 })

export function ReportAnalysisSummary({ result, analysis }) {
  if (result.parks) return <div className="grid gap-6">{result.parks.map((park) => <section key={park.context.park.id} aria-label={`Summary for ${park.context.park.name}`}>
    <h2 className="mb-3 text-xl font-bold text-fg">{park.context.park.name}</h2>
    <ReportAnalysisSummary result={park} analysis={park.analysis} />
  </section>)}<ComparativeOverview parks={result.parks} /></div>
  const { context, statistics } = result
  const { trends, hotspots, coverage } = analysis
  return <Card title="Analysis summary">
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">Park</dt><dd className="font-semibold text-fg">{context.park.name}</dd></div>
      <div><dt className="text-muted">Analysis period</dt><dd className="font-semibold text-fg">{context.filters.startDate} to {context.filters.endDate} · Sri Lanka time</dd></div>
      <div><dt className="text-muted">Incident type</dt><dd className="font-semibold text-fg">{context.filters.incidentType ? humanize(context.filters.incidentType) : 'All incident types'}</dd></div>
      <div><dt className="text-muted">Species</dt><dd className="text-fg">{context.filters.species || 'All species'}</dd></div>
      <div><dt className="text-muted">Event records</dt><dd className="font-semibold text-fg">{number(statistics.totalEventRecords)} ({number(statistics.alertRecords)} alerts, {number(statistics.conflictRecords)} conflicts)</dd></div>
      <div><dt className="text-muted">Zones represented</dt><dd className="font-semibold text-fg">{number(statistics.representedZones)}</dd></div>
      <div><dt className="text-muted">Trends</dt><dd className="text-fg">{trends.status === 'error' ? 'Unavailable: calculation failed' : trends.status === 'empty' ? 'No trend records' : `${trends.buckets.length} ${trends.unit === 'day' ? 'daily' : 'monthly'} intervals; ${trends.buckets.reduce((sum, bucket) => sum + bucket.alerts + bucket.conflicts, 0)} contributing event records`}</dd></div>
      <div><dt className="text-muted">Hotspots</dt><dd className="text-fg">{hotspots.status === 'error' ? 'Unavailable: calculation failed' : `${hotspots.hotspots.length} zones with at least ${hotspots.threshold} alert events`}</dd></div>
    </dl>
    {context.dateBasis && <p className="mt-4 text-xs text-muted">{context.dateBasis}</p>}
    <p className="mt-4 text-xs text-muted">Event records are not unique wildlife incidents. Patrol records ({statistics.patrolRecords}) are separate context and are not restricted by incident type.</p>
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-fg">Patrol coverage by zone</h3>
      {coverage.status === 'error' ? <p className="mt-2 text-sm text-muted">Unavailable: calculation failed.</p>
        : coverage.status === 'empty' ? <p className="mt-2 text-sm text-muted">No contributing patrol intervals.</p>
          : <ul className="mt-2 grid max-h-56 gap-2 overflow-y-auto text-sm sm:grid-cols-2">{coverage.zones.map((row) => <li key={row.zone.id} className="break-words text-muted">{row.zone.name}: {number(row.hours)} hours / {row.targetHours === null ? 'target unavailable' : `${number(row.targetHours)} target hours`} · {row.percent === null ? 'Percentage unavailable' : `${row.percent}%`}</li>)}</ul>}
      <p className="mt-2 text-xs text-subtle">Coverage measures patrol effort against prorated targets, not area covered or completion. Full results and supporting records remain available through Back to Analysis.</p>
    </div>
  </Card>
}
