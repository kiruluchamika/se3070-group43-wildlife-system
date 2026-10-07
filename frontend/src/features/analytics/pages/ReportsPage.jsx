import { WorkflowStepper } from '../components/WorkflowStepper'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../../context/auth-context'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { ReportContent } from '../components/ReportContent'
import { DraftEditor } from './DraftEditor'
import { FinalizedReportActions } from '../components/FinalizedReportActions'

export default function ReportsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const reportId = params.get('reportId')
  const page = Math.max(1, Math.min(100000, Math.floor(Number(params.get('page')) || 1)))
  const status = ['draft', 'finalized'].includes(params.get('status')) ? params.get('status') : 'all'
  const listParams = (nextPage = page) => ({ ...(status !== 'all' && { status }), ...(nextPage > 1 && { page: String(nextPage) }) })
  const analyst = user.role === 'data-analyst'
  const permitted = analyst || user.role === 'park-manager'
  const query = useApiQuery(reportId ? `/reports/${encodeURIComponent(reportId)}` : `/reports?page=${page}`, { enabled: permitted })
  const report = query.data?.report
  const reports = (query.data?.reports ?? []).filter((item) => status === 'all' || item.status === status)
  return <>
    <PageHeader eyebrow="UC02" title="Reports" description={analyst ? 'Your saved conservation analysis reports.' : 'Finalized conservation reports shared with you.'}
      actions={reportId && <Button variant="secondary" onClick={() => setParams(listParams())}>Back to Reports</Button>} />
    {permitted && !reportId && <div role="group" aria-label="Report status" className="mb-5 flex flex-wrap gap-2">
      {[['all', 'All'], ['draft', 'Drafts'], ['finalized', 'Finalized']].map(([value, label]) => <Button key={value}
        variant={status === value ? 'primary' : 'secondary'} aria-pressed={status === value}
        onClick={() => setParams(value === 'all' ? {} : { status: value })}>{label}</Button>)}
    </div>}
    {!permitted ? <Card><EmptyState title="Reports are not available for your role." /></Card>
      : query.loading ? <Skeleton className="h-64" />
        : query.error ? <Card><ErrorState message={query.error.status >= 500 ? 'Unable to load reports. Please try again.' : query.error.message} onRetry={query.reload} /></Card>
          : report ? <>
            {analyst && <WorkflowStepper current="saved" />}
            <div className="mb-5 flex flex-wrap items-center gap-3"><Badge tone={report.status === 'draft' ? 'amber' : 'green'}>{report.status === 'draft' ? 'Draft' : 'Finalized'}</Badge>
              {params.get('saved') === '1' && <p role="status" className="text-sm text-fg">{report.status === 'draft' ? 'Report saved as draft.' : 'Report finalized successfully.'}</p>}
              <p className="text-xs text-muted">Saved {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(report.createdAt))} · Sri Lanka time</p>
            </div>{report.status === 'draft' ? <DraftEditor key={report.id} report={report} /> : <><ReportContent report={report} /><FinalizedReportActions key={report.id} report={report} canShare={analyst} /></>}
          </> : <>
              {!reports.length && <Card><EmptyState
                title={status === 'all' ? (analyst ? 'No saved reports on this page.' : 'No shared reports on this page.') : `No ${status === 'draft' ? 'draft' : 'finalized'} reports on this page.`}
                description={page > 1 || query.data?.hasMore ? 'Use Previous or Next to browse other pages, or choose another status.' : analyst ? 'Generate a report from Analysis, then choose Save as Draft or Save as Finalized.' : 'Only finalized reports shared with you are available.'} /></Card>}
              <div className="grid gap-4">{reports.map((item) => <Card key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1"><h2 className="break-words font-semibold text-fg">{item.title}</h2><p className="mt-1 text-sm text-muted">{item.snapshot.parks ? item.snapshot.parks.map((park) => park.context.park.name).join(', ') : item.snapshot.context.park.name} · {item.snapshot.context.filters.startDate} to {item.snapshot.context.filters.endDate}</p></div>
                  <Badge tone={item.status === 'draft' ? 'amber' : 'green'}>{item.status === 'draft' ? 'Draft' : 'Finalized'}</Badge>
                  <Button variant="secondary" onClick={() => setParams({ ...listParams(), reportId: item.id })}>{item.status === 'draft' ? 'Open Draft' : 'View report'}</Button>
                </div>
              </Card>)}</div>
              <div className="mt-5 flex items-center justify-between gap-3"><Button variant="secondary" disabled={page === 1} onClick={() => setParams(listParams(page - 1))}>Previous</Button>
                <span className="text-sm text-muted">Page {page}</span><Button variant="secondary" disabled={!query.data?.hasMore} onClick={() => setParams(listParams(page + 1))}>Next</Button></div>
            </>}
  </>
}
