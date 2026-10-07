import { WorkflowStepper } from '../components/WorkflowStepper'
import { BarChart3, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { Field, Input, Select } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { humanize } from '../../../lib/format'
import AnalysisResultsPage from './AnalysisResultsPage'
import { FreshnessDialog } from '../components/FreshnessDialog'
import { useAnalysisRetrieval } from '../hooks/useAnalysisRetrieval'
import { analysisDateErrors, sriLankaToday } from '../lib/analysisDates'

// Empty species/type values mean no restriction, including legacy records.
const INITIAL_FILTERS = { parkId: '', startDate: '', endDate: '', species: '', incidentType: '' }

export default function AnalysisPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const draftId = params.get('draftId')
  const draftQuery = useApiQuery(draftId ? `/reports/${encodeURIComponent(draftId)}/reanalysis` : null)
  if (draftId && draftQuery.loading) return <Skeleton className="h-64" />
  if (draftId && draftQuery.error) return <Card><ErrorState title="Unable to restore Draft filters"
    message={draftQuery.error.status >= 500 ? 'Please try again. The original Draft has not changed.' : draftQuery.error.message} onRetry={draftQuery.reload} />
    <Button variant="secondary" onClick={() => navigate('/reports')}>Back to Reports</Button></Card>
  if (draftId && !draftQuery.data?.draft) return null
  return <AnalysisFiltersPage key={draftId || 'new'} initialFilters={draftQuery.data?.draft.filters} sourceDraft={draftQuery.data?.draft}
    onCancelReanalysis={() => navigate(`/reports?reportId=${encodeURIComponent(draftId)}`)} />
}

export function AnalysisFiltersPage({ initialFilters, sourceDraft, onCancelReanalysis } = {}) {
  const parksQuery = useApiQuery('/analytics/options')
  const parks = parksQuery.data?.parks ?? []
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS, ...initialFilters })
  const [dateErrors, setDateErrors] = useState({})
  const today = sriLankaToday()
  const retrieval = useAnalysisRetrieval()
  const busy = retrieval.phase === 'retrieving'

  function changeFilter(key) {
    return (event) => {
      const next = { ...filters, [key]: event.target.value }
      setFilters(next)
      setDateErrors(key === 'startDate' || key === 'endDate'
        ? Object.fromEntries(Object.entries(analysisDateErrors(next)).filter(([field]) => next[field] || field === key)) : {})
      retrieval.reset()
    }
  }

  function togglePark(id) {
    setFilters((current) => ({ ...current, parkIds: current.parkIds.includes(id) ? current.parkIds.filter((park) => park !== id) : [...current.parkIds, id] }))
    setDateErrors({})
    retrieval.reset()
  }

  function selectedFilters() {
    if (!filters.parkIds) return { ...filters }
    const { parkIds, ...common } = filters
    delete common.parkId
    return parkIds.length === 1 ? { ...common, parkId: parkIds[0] } : { ...common, parkIds }
  }

  function prepareAnalysis(event) {
    event.preventDefault()
    const errors = analysisDateErrors(filters)
    setDateErrors(errors)
    if (Object.keys(errors).length) return
    if (filters.parkIds) {
      if (!filters.parkIds.length || filters.parkIds.length > 20 || filters.parkIds.some((id) => !parks.some((park) => park.id === id))) return
      retrieval.retrieve(selectedFilters())
    } else {
      if (!parks.some((park) => park.id === filters.parkId)) return
      retrieval.retrieve({ ...filters })
    }
  }

  if (retrieval.phase === 'ready') {
    return <AnalysisResultsPage dataset={retrieval.dataset} sourceDraft={sourceDraft} onBack={retrieval.reset}
      onRetry={() => retrieval.retrieve({ ...(retrieval.dataset?.filters ?? filters) })} />
  }

  return (
    <>
      <PageHeader
        eyebrow="UC02 · Data Analyst"
        title="Conservation Data Analysis"
        description="Choose a park and date range to prepare your conservation data analysis."
        actions={<Badge tone="brand">Data retrieval</Badge>}
      />
      <WorkflowStepper current="filters" />
      {sourceDraft && <Card title="Previous report filters" className="mb-6">
        <p className="break-words text-sm text-muted">These are the filters used for “{sourceDraft.title}”. Keep or change them below. Re-analysis follows the normal freshness and results flow; the original Draft remains unchanged until a replacement is saved successfully.</p>
        <Button className="mt-4" variant="secondary" onClick={onCancelReanalysis}>Cancel re-analysis</Button>
      </Card>}
      <Card title="Analysis filters" icon={SlidersHorizontal}>
        <p className="mb-6 text-sm text-muted">
          Dates use Sri Lanka time. Incidents use observedAt, conflicts use occurredAt, and patrols use startTime. Camera/collar and unlinked alerts use createdAt because no separate event timestamp is stored. Known synchronization status is checked before continuing.
        </p>
        {parksQuery.loading ? (
          <div role="status" className="mb-5">
            <span className="sr-only">Loading parks</span>
            <Skeleton className="h-11" />
          </div>
        ) : parksQuery.error ? (
          <ErrorState title="Parks unavailable" message={parksQuery.error.message} onRetry={parksQuery.reload} />
        ) : parks.length === 0 ? (
          <EmptyState title="No parks available" description="A park is needed to prepare an analysis. Try refreshing the park list."
            action={<Button variant="secondary" onClick={parksQuery.reload}>Refresh parks</Button>} />
        ) : null}

        <form onSubmit={prepareAnalysis}>
          <fieldset disabled={busy || retrieval.phase === 'warning'} className="min-w-0" inert={retrieval.phase === 'warning' ? true : undefined}>
          <div className="grid gap-5 sm:grid-cols-2">
            {(parks.length > 1 || filters.parkIds) && <label className="flex items-center gap-3 text-sm text-fg sm:col-span-2">
              <input type="checkbox" checked={Boolean(filters.parkIds)} onChange={(event) => {
                setFilters((current) => {
                  const { parkIds, ...single } = current
                  return event.target.checked ? { ...single, parkIds: single.parkId ? [single.parkId] : [] } : { ...single, parkId: parkIds?.[0] ?? single.parkId }
                })
                retrieval.reset()
                setDateErrors({})
              }} /> Compare multiple parks
            </label>}
            {filters.parkIds ? <fieldset className="sm:col-span-2">
              <legend className="mb-3 text-sm font-semibold text-fg">Select parks</legend>
              <div className="grid gap-3 sm:grid-cols-2">{parks.map((park) => <label key={park.id} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm text-fg">
                <input type="checkbox" checked={filters.parkIds.includes(park.id)} onChange={() => togglePark(park.id)}
                  disabled={!filters.parkIds.includes(park.id) && filters.parkIds.length >= 20} />{park.name}
              </label>)}</div>
              {!filters.parkIds.length && <p className="mt-2 text-xs text-muted">Select at least one park.</p>}
            </fieldset> : <Field label="Park" required className="sm:col-span-2">
              {(props) => (
                <Select {...props} name="parkId" required value={filters.parkId} onChange={changeFilter('parkId')}
                  disabled={parksQuery.loading || Boolean(parksQuery.error) || !parks.length}>
                  <option value="">Select a park</option>
                  {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
                </Select>
              )}
            </Field>}
            <fieldset className="grid min-w-0 gap-5 sm:col-span-2 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Date range</legend>
              <Field label="Start date" required error={dateErrors.startDate}>
                {(props) => <Input {...props} name="startDate" type="date" required max={today} value={filters.startDate} onChange={changeFilter('startDate')}
                  onInvalid={(event) => { event.preventDefault(); setDateErrors(analysisDateErrors(filters)) }} />}
              </Field>
              <Field label="End date" required error={dateErrors.endDate}>
                {(props) => <Input {...props} name="endDate" type="date" required max={today} value={filters.endDate} onChange={changeFilter('endDate')}
                  onInvalid={(event) => { event.preventDefault(); setDateErrors(analysisDateErrors(filters)) }} />}
              </Field>
            </fieldset>
            <Field label="Species" hint="Filters recorded species on alerts. All species includes unspecified records; patrol coverage is unchanged.">
              {(props) => <Select {...props} name="species" value={filters.species} onChange={changeFilter('species')} disabled={!parksQuery.data}><option value="">All species</option>
                {filters.species && !(parksQuery.data?.species ?? []).some((item) => item.id === filters.species) && <option value={filters.species}>{filters.species}</option>}
                {(parksQuery.data?.species ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </Select>}
            </Field>
            <Field label="Incident type" hint="Filters alerts and conflicts. Patrol records remain available as coverage context.">
              {(props) => <Select {...props} name="incidentType" value={filters.incidentType} onChange={changeFilter('incidentType')} disabled={!parksQuery.data}>
                <option value="">All incident types</option>
                {(parksQuery.data?.incidentTypes ?? []).map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </Select>}
            </Field>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-subtle">Retrieve available records, check synchronization information and view core statistics.</p>
            <Button type="submit" icon={BarChart3} loading={busy} disabled={parksQuery.loading || Boolean(parksQuery.error) || !parks.length}>Analyze Data</Button>
          </div>
          </fieldset>
          {busy && <p role="status" className="mt-5 text-sm text-muted">Retrieving conservation data…</p>}
          {retrieval.error && <ErrorState title="Unable to retrieve conservation data"
            message={retrieval.error.status >= 500 ? 'Please try again. Your selected filters have been kept.' : retrieval.error.message}
            onRetry={() => retrieval.retrieve(selectedFilters())} />}
        </form>
      </Card>
      <FreshnessDialog open={retrieval.phase === 'warning'} freshness={retrieval.dataset?.freshness}
        onContinue={retrieval.continueAnalysis} onCancel={retrieval.reset} />
    </>
  )
}
