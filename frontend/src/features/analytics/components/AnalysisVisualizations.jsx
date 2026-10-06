import { lazy, Suspense } from 'react'
import { Activity, MapPinned, Shield } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { ProgressBar } from '../../../components/ui/Animated'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { TrendChart } from './TrendChart'

const HotspotMap = lazy(() => import('./HotspotMap'))
const hours = (value) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 })

export function AnalysisVisualizations({ analysis, onRetry }) {
  const { trends, hotspots, coverage } = analysis
  return (
    <div className="mt-6 grid min-w-0 gap-6">
      <Card title="Incident Trends" icon={Activity}>
        {trends.status === 'error' ? <ErrorState message={trends.message} onRetry={onRetry} />
          : trends.status === 'empty' ? <EmptyState title="No trend data available for the selected period." />
            : <TrendChart trend={trends} />}
        {trends.omitted > 0 && <p className="mt-3 text-xs text-muted">{trends.omitted} records omitted because their timestamps are unavailable or invalid.</p>}
      </Card>
      <Card title="Hotspots" icon={MapPinned}>
        <p className="mb-4 text-sm text-muted">A zone is a hotspot at ≥3 event records in the selected period. Current zone-based results use alert events, including simulated alerts; conflicts have no zone reference. These are not verified unique wildlife incidents.</p>
        {hotspots.status === 'error' ? <ErrorState message={hotspots.message} onRetry={onRetry} /> : <>
          {hotspots.status === 'empty' ? <EmptyState title="No hotspots identified for the selected analysis period." /> :
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{hotspots.hotspots.map((row) => <li key={row.zone.id} className="rounded-xl border border-line-strong bg-surface-2 p-4">
              <p className="font-bold text-fg">{row.zone.name}</p><p className="my-2 text-sm text-muted">{row.count} alert events</p><Badge tone="red">Hotspot · ≥3 events</Badge>
            </li>)}</ul>}
          <p className="mt-3 text-xs text-subtle">{hotspots.unzoned} event records have no usable zone; {hotspots.omitted} have invalid timestamps. Neither is assigned a fabricated zone.</p>
          {hotspots.represented.length > 0 && <Suspense fallback={<Skeleton className="mt-4 h-80" />}><HotspotMap represented={hotspots.represented} /></Suspense>}
        </>}
      </Card>
      <Card title="Patrol Coverage" icon={Shield}>
        <p className="mb-4 text-sm text-muted">Patrol effort against the zone target, not geographic area or a completion rate. Incident type and species do not restrict patrol context.</p>
        {coverage.status === 'error' ? <ErrorState message={coverage.message} onRetry={onRetry} /> : <>
          <p className="mb-4 text-xs text-subtle">Coverage = patrol hours ÷ prorated target hours × 100, capped at 100%. Targets use the park’s {coverage.windowDays}-day policy window and {hours(coverage.elapsedDays)} elapsed analysis days. Ongoing patrols stop at retrieval time; future time is excluded.</p>
          {coverage.status === 'empty' ? <EmptyState title="No patrol records available for the selected period." description="No usable patrol intervals overlap the elapsed period. Coverage is not inferred from alerts or conflicts." /> :
            <ul className="grid gap-5 sm:grid-cols-2">{coverage.zones.map((row) => <li key={row.zone.id} className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><p className="font-semibold text-fg">{row.zone.name}</p><span className="text-sm font-bold text-fg">{row.percent === null ? 'Not available' : `${row.percent}%`}</span></div>
              {row.percent !== null && <ProgressBar value={row.percent} label={`${row.zone.name} patrol effort coverage`} />}
              <p className="mt-2 text-xs text-muted">{hours(row.hours)} patrol hours · {row.targetHours === null ? 'Valid target unavailable' : `${hours(row.targetHours)} target hours`}</p>
            </li>)}</ul>}
          {coverage.omitted > 0 && <p className="mt-3 text-xs text-muted">{coverage.omitted} patrol records omitted due to invalid times or unknown zones.</p>}
          <p className="mt-3 text-xs text-subtle">Uses the current configured zone targets. Historical target changes are not recorded. Available pending-sync patrols are included if you chose to continue.</p>
        </>}
      </Card>
    </div>
  )
}
