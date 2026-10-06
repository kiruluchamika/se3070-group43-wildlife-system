import { useEffect, useRef } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field, Input, Textarea } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { ReportAnalysisSummary } from '../components/ReportAnalysisSummary'
import { REPORT_LIMITS } from '../lib/reportPreparation'

export function ReportPreparationPage({ state, dispatch, result, analysis, dataset }) {
  const findingsStep = state.step === 'findings'
  const heading = findingsStep ? 'Findings & Recommendations' : 'Report Preparation'
  const panel = useRef(null)
  useEffect(() => { panel.current?.focus() }, [state.step])
  function submit(event) {
    event.preventDefault()
    dispatch(findingsStep ? { type: 'prepare' } : { type: 'generate', result, analysis, dataset, requestId: crypto.randomUUID() })
  }
  return <section ref={panel} tabIndex={-1} aria-label={heading} className="min-w-0 outline-none">
    <PageHeader eyebrow="UC02 · Data Analyst" title={heading}
      description={findingsStep ? 'Record your observations and proposed actions based on this analysis.' : 'Review the report information before generating it.'}
      actions={<Button variant="secondary" onClick={() => dispatch({ type: findingsStep ? 'back' : 'findings' })}>{findingsStep ? 'Back to Analysis' : 'Back to Findings'}</Button>} />
    <ReportAnalysisSummary result={result} analysis={analysis} />
    <Card title={findingsStep ? 'Your observations' : 'Report information'} className="mt-6">
      <p className="mb-5 text-sm text-muted">Your entries are kept while moving between these steps. Leaving Analysis or refreshing the page clears this unsaved work.</p>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {!findingsStep && <Field label="Report title" required error={state.errors.title}>{(props) => <Input {...props} name="title" required maxLength={REPORT_LIMITS.title} value={state.title}
          onChange={(event) => dispatch({ type: 'edit', field: 'title', value: event.target.value })} />}</Field>}
        {['findings', 'recommendations'].map((field) => <Field key={field} label={field === 'findings' ? 'Findings' : 'Recommendations'} error={state.errors[field]}
          hint={`Optional · ${state[field].length}/${REPORT_LIMITS[field]} characters. Enter your own analysis.`}>{(props) => <Textarea {...props} name={field} rows={6} maxLength={REPORT_LIMITS[field]} value={state[field]}
            onChange={(event) => dispatch({ type: 'edit', field, value: event.target.value })} />}</Field>)}
        {Object.values(state.errors).some(Boolean) && <p role="alert" className="text-sm text-red-500 dark:text-red-300">Please correct the highlighted fields before continuing.</p>}
        {!findingsStep && <p className="text-xs text-muted">Generate a preview, then choose whether to save it as Draft or Finalized. Generating alone does not save a report.</p>}
        <div className="flex flex-wrap justify-end border-t border-line pt-5">
          <Button type="submit" className="h-auto min-h-10 whitespace-normal py-2">{findingsStep ? 'Continue to Report Preparation' : 'Generate Report'}</Button>
        </div>
      </form>
    </Card>
  </section>
}
