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

// Empty species/type values mean no restriction. Future option APIs can supply
// these controls without depending on UC03's eventual storage schema.
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
  const [filters, setFilters] = useState(initialFilters ? { ...initialFilters } : INITIAL_FILTERS)
  const [dateError, setDateError] = useState(null)
  const retrieval = useAnalysisRetrieval()
  const busy = retrieval.phase === 'retrieving'

  function changeFilter(key) {
    return (event) => {
      setFilters((current) => ({ ...current, [key]: event.target.value }))
      setDateError(null)
      retrieval.reset()
    }
  }

  function prepareAnalysis(event) {
    event.preventDefault()
    if (filters.startDate > filters.endDate) {
      setDateError('End date must be on or after the start date.')
      return
    }
    if (!parks.some((park) => park.id === filters.parkId)) return
    retrieval.retrieve({ ...filters })
  }

  if (retrieval.phase === 'ready') {
    return <AnalysisResultsPage dataset={retrieval.dataset} onBack={retrieval.reset}
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
      {sourceDraft && <Card title="Previous report filters" className="mb-6">
        <p className="break-words text-sm text-muted">These are the filters used for “{sourceDraft.title}”. Keep or change them below. Re-analysis follows the normal freshness and results flow; the original Draft remains unchanged.</p>
        <Button className="mt-4" variant="secondary" onClick={onCancelReanalysis}>Cancel re-analysis</Button>
      </Card>}
      <Card title="Analysis filters" icon={SlidersHorizontal}>
        <p className="mb-6 text-sm text-muted">
          Select the data to retrieve. We will check known synchronization status before continuing. Dates use Sri Lanka time.
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
            <Field label="Park" required className="sm:col-span-2">
              {(props) => (
                <Select {...props} name="parkId" required value={filters.parkId} onChange={changeFilter('parkId')}
                  disabled={parksQuery.loading || Boolean(parksQuery.error) || !parks.length}>
                  <option value="">Select a park</option>
                  {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
                </Select>
              )}
            </Field>
            <fieldset className="grid min-w-0 gap-5 sm:col-span-2 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Date range</legend>
              <Field label="Start date" required>
                {(props) => <Input {...props} name="startDate" type="date" required value={filters.startDate} onChange={changeFilter('startDate')} />}
              </Field>
              <Field label="End date" required error={dateError}>
                {(props) => <Input {...props} name="endDate" type="date" required value={filters.endDate} onChange={changeFilter('endDate')} />}
              </Field>
            </fieldset>
            <Field label="Species" hint="Species selection will be available when the data source is connected.">
              {(props) => <Select {...props} name="species" value={filters.species} disabled><option value="">All species</option></Select>}
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
            onRetry={() => retrieval.retrieve({ ...filters })} />}
        </form>
      </Card>
      <FreshnessDialog open={retrieval.phase === 'warning'} freshness={retrieval.dataset?.freshness}
        onContinue={retrieval.continueAnalysis} onCancel={retrieval.reset} />
    </>
  )
}
