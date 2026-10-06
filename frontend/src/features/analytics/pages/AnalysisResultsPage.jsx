import { BarChart3, FileText, MapPinned, MessageSquareWarning, ShieldAlert } from 'lucide-react'
import { useCallback, useMemo, useReducer } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { humanize } from '../../../lib/format'
import { calculateStatistics } from '../lib/calculateStatistics'
import { AnalysisVisualizations } from '../components/AnalysisVisualizations'
import { SupportingRecordsModal } from '../components/SupportingRecordsModal'
import { calculateVisualizations } from '../lib/calculateVisualizations'
import { initialSupportingState, supportingReducer } from '../lib/supportingRecords'
import { initialReportState, reportPreparationReducer } from '../lib/reportPreparation'
import { ReportPreparationPage } from './ReportPreparationPage'
import { ReportPreviewPage } from './ReportPreviewPage'

function Fact({ label, children }) {
  return <div><dt className="text-xs font-semibold tracking-wide text-subtle uppercase">{label}</dt>
    <dd className="mt-1 text-sm font-semibold text-fg">{children}</dd></div>
}

export default function AnalysisResultsPage({ dataset, onBack, onRetry }) {
  const result = useMemo(() => calculateStatistics(dataset), [dataset])
  const analysis = useMemo(() => calculateVisualizations(result, dataset), [result, dataset])
  const [supporting, dispatch] = useReducer(supportingReducer, initialSupportingState)
  const [report, reportDispatch] = useReducer(reportPreparationReducer, initialReportState)
  const closeSupporting = useCallback(() => dispatch({ type: 'close' }), [])
  const header = <PageHeader eyebrow="UC02 · Data Analyst" title="Analysis Results"
    description="Statistics from the available records matching your selected filters."
    actions={<Button variant="secondary" onClick={onBack}>Back to Filters</Button>} />

  if (result.status === 'error') {
    return <>{header}<Card><ErrorState title="Analysis unavailable" message={result.message} onRetry={onRetry} /></Card></>
  }

  if (report.step === 'preview') {
    return <ReportPreviewPage handoff={report.handoff} requestId={report.requestId} onBack={() => reportDispatch({ type: 'preparation' })} />
  }
  if (report.step !== 'results') {
    return <ReportPreparationPage state={report} dispatch={reportDispatch} result={result} analysis={analysis} dataset={dataset} />
  }

  const { context, statistics } = result
  const metrics = [
    { label: 'Event records', value: statistics.totalEventRecords, icon: BarChart3, hint: 'Alert records + conflict records; not unique incidents.' },
    { label: 'Alert records', value: statistics.alertRecords, icon: ShieldAlert, hint: 'All retrieved alert statuses, including simulated sources.' },
    { label: 'Conflict records', value: statistics.conflictRecords, icon: MessageSquareWarning, hint: 'All retrieved conflict statuses, including invalid or duplicate reports.' },
    { label: 'Zones represented', value: statistics.representedZones, icon: MapPinned, hint: 'Known zones referenced by retrieved alerts or patrols.' }
  ]

  return (
    <>
      {header}
      <Card title="Selected filters">
        <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Park">{context.park.name}</Fact>
          <Fact label="Analysis period">{context.filters.startDate} to {context.filters.endDate}<span className="mt-1 block text-xs font-normal text-muted">Inclusive dates · Sri Lanka time</span></Fact>
          <Fact label="Species">{context.filters.species || 'All species'}</Fact>
          <Fact label="Incident type">{context.filters.incidentType ? humanize(context.filters.incidentType) : 'All incident types'}</Fact>
        </dl>
      </Card>

      {result.status === 'empty' ? (
        <Card className="mt-6"><EmptyState icon={BarChart3} title="No conservation data was found for the selected filters."
          description="Choose another park or date range to try again."
          action={<Button variant="secondary" onClick={onBack}>Back to Filters</Button>} /></Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, icon, hint }) => (
              <Card key={label} title={label} icon={icon}>
                <p className="text-3xl font-extrabold text-fg tabular-nums">{value.toLocaleString('en-GB')}</p>
                <p className="mt-2 text-xs text-muted">{hint}</p>
              </Card>
            ))}
          </div>
          <Card title="About these statistics" className="mt-6">
            {statistics.totalEventRecords === 0 && <p className="mb-3 text-sm font-semibold text-fg">No matching alerts or conflicts were found. Only patrol context is available.</p>}
            <p className="text-sm text-muted">Alerts and conflicts may describe the same real-world event. Their combined record count is not a count of unique wildlife incidents. UC03 wildlife incidents are not connected.</p>
            <p className="mt-3 text-sm text-muted">{statistics.patrolRecords.toLocaleString('en-GB')} patrol records are retained separately for coverage analysis and excluded from event totals. Incident type does not filter this patrol context.</p>
            <p className="mt-3 text-sm text-muted">Conflict records have no zone reference. Missing or unrecognized zone references are excluded from the zone count; park zones without matching records are not counted.</p>
            <p className="mt-3 text-xs text-subtle">Alerts are selected by creation time, conflicts by occurrence time, and patrols by overlap with the analysis period.</p>
          </Card>
        </>
      )}

      <AnalysisVisualizations analysis={analysis} onRetry={onRetry} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => dispatch({ type: 'open' })} aria-haspopup="dialog">View Supporting Records</Button>
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Record findings and recommendations before preparing your report.</p>
        <Button icon={FileText} onClick={() => reportDispatch({ type: 'findings' })}>Continue to Report</Button>
      </div>
      {supporting.open && <SupportingRecordsModal result={result} dataset={dataset} analysis={analysis}
        state={supporting} dispatch={dispatch} onClose={closeSupporting} />}
    </>
  )
}
