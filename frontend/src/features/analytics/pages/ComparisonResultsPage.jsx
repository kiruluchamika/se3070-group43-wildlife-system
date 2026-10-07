import { useMemo, useReducer } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { WorkflowStepper } from '../components/WorkflowStepper'
import { ComparativeOverview } from '../components/ComparativeOverview'
import { calculateComparison } from '../lib/compareParks'
import { initialReportState, reportPreparationReducer } from '../lib/reportPreparation'
import { ReportPreparationPage } from './ReportPreparationPage'
import { ReportPreviewPage } from './ReportPreviewPage'

export function ComparisonResultsPage({ dataset, onBack, onRetry, ParkResults, sourceDraft }) {
  const result = useMemo(() => calculateComparison(dataset), [dataset])
  const [report, dispatch] = useReducer(reportPreparationReducer, initialReportState)
  const failed = result.parks.some((park) => park.status === 'error')
  if (report.step === 'preview') return <ReportPreviewPage handoff={report.handoff} sourceDraft={sourceDraft} requestId={report.requestId} onBack={() => dispatch({ type: 'preparation' })} />
  if (report.step !== 'results') return <ReportPreparationPage state={report} dispatch={dispatch} result={result} dataset={dataset} />
  return <>
    <PageHeader eyebrow="UC02" title="Analysis Results" description="Independent park analyses for comparison."
      actions={<Button variant="secondary" onClick={onBack}>Back to Filters</Button>} />
    <WorkflowStepper current="results" />
    <div className="grid gap-8">{dataset.datasets.map((data) => <section key={data.park.id} aria-label={`Analysis for ${data.park.name}`} className="min-w-0 border-t border-line pt-5">
      <h2 className="mb-4 text-xl font-bold text-fg">{data.park.name}</h2>
      <ParkResults dataset={data} onBack={onBack} onRetry={onRetry} embedded />
    </section>)}</div>
    {failed ? <Card className="mt-6"><ErrorState message="A park analysis could not be calculated. Retry before preparing the comparison report." onRetry={onRetry} /></Card> : <ComparativeOverview parks={result.parks} />}
    <div className="mt-6 flex justify-end border-t border-line pt-5"><Button disabled={failed} onClick={() => dispatch({ type: 'findings' })}>Continue to Report</Button></div>
  </>
}
