import { Card } from '../../../components/ui/Card'
import { ReportAnalysisSummary } from './ReportAnalysisSummary'
import { TrendChart } from './TrendChart'

/** React text rendering deliberately escapes analyst-authored content. */
export function ReportContent({ report }) {
  const { snapshot, title, findings, recommendations } = report
  const { analysis } = snapshot
  return <article className="grid min-w-0 gap-6">
    <Card><h2 className="break-words text-2xl font-bold text-fg">{title}</h2>
      <p className="mt-2 text-xs text-muted">Analysis retrieved: {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(snapshot.context.retrievedAt))} · Sri Lanka time</p>
    </Card>
    <ReportAnalysisSummary result={snapshot} analysis={analysis} />
    <Card title="Trends">
      {analysis.trends.status === 'ready' ? <TrendChart trend={analysis.trends} /> : <p className="text-sm text-muted">{analysis.trends.status === 'error' ? 'Trend calculation unavailable.' : 'No trend records for this period.'}</p>}
      {analysis.trends.omitted > 0 && <p className="mt-3 text-xs text-muted">{analysis.trends.omitted} records omitted due to invalid timestamps.</p>}
    </Card>
    <Card title="Hotspot results">
      {analysis.hotspots.status === 'ready' ? <ul className="grid gap-3 text-sm sm:grid-cols-2">{analysis.hotspots.hotspots.map((row) => <li key={row.zone.id} className="break-words text-fg">{row.zone.name}: {row.count} alert events</li>)}</ul>
        : <p className="text-sm text-muted">{analysis.hotspots.status === 'error' ? 'Hotspot calculation unavailable.' : 'No hotspots identified.'}</p>}
      <p className="mt-3 text-xs text-muted">Hotspots use at least 3 zone-linked alerts, including simulated sources. Conflicts have no zone reference. These are not verified unique incidents.</p>
      {analysis.hotspots.status !== 'error' && <p className="mt-2 text-xs text-muted">{analysis.hotspots.unzoned} records without usable zones; {analysis.hotspots.omitted} invalid timestamps.</p>}
    </Card>
    {analysis.coverage.omitted > 0 && <p className="text-xs text-muted">Coverage excludes {analysis.coverage.omitted} patrol records with invalid times or unknown zones.</p>}
    <Card title="Findings"><p className="whitespace-pre-wrap break-words text-sm text-fg">{findings || 'No findings entered.'}</p></Card>
    <Card title="Recommendations"><p className="whitespace-pre-wrap break-words text-sm text-fg">{recommendations || 'No recommendations entered.'}</p></Card>
  </article>
}
