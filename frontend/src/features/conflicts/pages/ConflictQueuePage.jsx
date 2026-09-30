import { ArrowLeft, ClipboardList, Copy, History, Inbox, MessageSquareWarning, PhoneCall, Radio, RefreshCw, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { cn } from '../../../lib/cn'
import { formatRelativeTime } from '../../../lib/format'
import { listItem } from '../../../lib/motion'
import { conflictPaths } from '../api/conflictApi'
import { ConflictStatusBadge, ContactFailedBadge, DangerBadge, PriorityBadge, TaskStatusBadge } from '../components/ConflictBadges'
import { ActionList, EvidenceGallery, HistoryTimeline, ReportFacts } from '../components/ReportDetails'
import { ContactPanel } from '../components/officer/ContactPanel'
import { DeploymentPanel } from '../components/officer/DeploymentPanel'
import { DuplicatePanel } from '../components/officer/DuplicatePanel'
import { ReviewPanel } from '../components/officer/ReviewPanel'
import { ValidationPanel } from '../components/officer/ValidationPanel'
import { useSelectedParam } from '../hooks/useSelectedParam'
import { DEPLOYABLE_STATUSES, QUEUE_VIEWS, TYPE_LABELS } from '../lib/conflict'

const QUEUE_REFRESH_MS = 30000

function QueueItem({ report, active, now, onSelect }) {
  return (
    <motion.li layout variants={listItem} initial="initial" animate="animate" exit="exit">
      <button
        type="button"
        onClick={() => onSelect(report.id)}
        className={cn(
          'w-full cursor-pointer border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-elevated/60',
          active && 'bg-brand-500/10',
          report.immediateDanger && !['resolved', 'invalid', 'duplicate'].includes(report.status) && 'border-l-4 border-l-red-500',
        )}
        aria-current={active ? 'true' : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-semibold text-fg">
            {TYPE_LABELS[report.conflictType]} · {report.village}
          </p>
          <span className="shrink-0 text-[11px] text-subtle">{formatRelativeTime(report.createdAt, now)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ConflictStatusBadge status={report.status} />
          <PriorityBadge priority={report.priority ?? report.suggestedPriority} suggested={!report.priority} />
          {report.immediateDanger && <DangerBadge />}
          {report.contactStatus === 'failed' && <ContactFailedBadge />}
        </div>
        <p className="mt-1 font-mono text-[11px] text-subtle">{report.reference}</p>
      </button>
    </motion.li>
  )
}

function Section({ title, icon, children, className }) {
  return (
    <Card title={title} icon={icon} className={className}>
      {children}
    </Card>
  )
}

/** The selected report with the actions its status allows. */
function ReportWorkspace({ reportId, now, onBack, onChanged }) {
  const { data, loading, error, reload } = useApiQuery(conflictPaths.report(reportId), { refreshMs: QUEUE_REFRESH_MS })
  const changed = () => {
    reload()
    onChanged()
  }

  if (loading) return <Skeleton className="h-[32rem]" />
  if (error) {
    return (
      <div className="panel">
        <ErrorState title="Report unavailable" message={error.message} onRetry={reload} />
      </div>
    )
  }

  const { report, tasks, actions, suggestedReview } = data
  const status = report.status
  const openTask = tasks.find((task) => ['awaiting-approval', 'assigned', 'acknowledged'].includes(task.status))
  const completedTask = tasks.find((task) => task.status === 'completed')
  const actionsOf = (task) => actions.filter((action) => action.task === task?.id)

  return (
    <div className="grid gap-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" icon={ArrowLeft} onClick={onBack} className="lg:hidden" aria-label="Back to the queue" />
          <div className="min-w-0">
            <p className="font-mono text-xs text-subtle">{report.reference}</p>
            <h2 className="truncate text-lg font-extrabold text-fg">
              {TYPE_LABELS[report.conflictType]} · {report.village}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ConflictStatusBadge status={status} />
          <PriorityBadge priority={report.priority ?? report.suggestedPriority} suggested={!report.priority} />
          {report.immediateDanger && <DangerBadge />}
        </div>
      </div>

      <Section title="Report" icon={MessageSquareWarning}>
        <div className="grid gap-4">
          <ReportFacts report={report} now={now} />
          <EvidenceGallery evidence={report.evidence} />
          {report.linkedReports?.length > 0 && (
            <p className="text-xs text-muted">Linked duplicates: {report.linkedReports.map((linked) => linked.reference).join(', ')}</p>
          )}
        </div>
      </Section>

      {['submitted', 'pending-information'].includes(status) && (
        <>
          <Section title="Verify and prioritise" icon={ClipboardList}>
            <ValidationPanel key={`${report.id}-${status}`} report={report} onChanged={changed} />
          </Section>
          <Section title="Possible duplicates" icon={Copy}>
            <DuplicatePanel report={report} now={now} onChanged={changed} />
          </Section>
        </>
      )}

      {DEPLOYABLE_STATUSES.includes(status) && (
        <Section title="Deploy a response team" icon={Users}>
          {status === 'escalated' && report.escalation && (
            <p className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-200">
              Escalated: {report.escalation.reason}. The park manager has an alert on the patrol dashboard. Deploy a team here once one is free.
            </p>
          )}
          {status === 'monitoring' && report.outcome?.followUpAt && (
            <p className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              Monitoring: next check due {formatRelativeTime(report.outcome.followUpAt, now)}. Send a team again if the elephant returns.
            </p>
          )}
          <DeploymentPanel key={report.id} report={report} onChanged={changed} />
        </Section>
      )}

      {openTask && (
        <Section title="Response in progress" icon={Radio}>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-fg">
                {openTask.team?.name} {openTask.dispatchType === 'emergency' && <Badge tone="red">Emergency</Badge>}
              </p>
              <TaskStatusBadge status={openTask.status} />
            </div>
            {openTask.status === 'awaiting-approval' && <p className="text-sm text-muted">Waiting for the park manager to approve this deployment.</p>}
            {openTask.acknowledgedAt && <p className="text-sm text-muted">Acknowledged {formatRelativeTime(openTask.acknowledgedAt, now)}.</p>}
            <ActionList actions={actionsOf(openTask)} />
          </div>
        </Section>
      )}

      {status === 'response-completed' && (
        <Section title="Review the response" icon={ClipboardList}>
          <ReviewPanel report={report} task={completedTask} actions={actionsOf(completedTask)} suggestedReview={suggestedReview} onChanged={changed} />
        </Section>
      )}

      <Section title="Community contact" icon={PhoneCall}>
        <ContactPanel report={report} onChanged={changed} />
      </Section>

      <Section title="History" icon={History}>
        <HistoryTimeline history={report.history} />
      </Section>
    </div>
  )
}

/**
 * UC01 officer workspace: the conflict queue (main flow step 2 onwards). The
 * selected report is kept in the URL so notification links open it directly.
 */
export default function ConflictQueuePage() {
  const now = useNow()
  const [view, setView] = useState('new')
  const [selected, select] = useSelectedParam('report')
  const queue = useApiQuery(conflictPaths.queue(undefined, view), { refreshMs: QUEUE_REFRESH_MS })
  const reports = queue.data?.reports ?? []
  const counts = queue.data?.counts ?? {}

  return (
    <>
      <PageHeader
        eyebrow="UC01 · Community Liaison Officer"
        title="Conflict queue"
        description="Verify villagers' reports, send ranger teams and review each response."
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={queue.refreshing} onClick={queue.reload}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className={cn('panel flex min-h-0 flex-col overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)]', selected && 'hidden lg:flex')}>
          <div className="flex flex-wrap gap-1.5 border-b border-line p-3" role="tablist" aria-label="Queue views">
            {QUEUE_VIEWS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={view === tab.key}
                onClick={() => setView(tab.key)}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  view === tab.key ? 'border-brand-400/60 bg-brand-500/15 text-brand-700 dark:text-brand-200' : 'border-line text-muted hover:text-fg',
                )}
              >
                {tab.label}
                {counts[tab.key] > 0 && <span className="rounded-full bg-elevated px-1.5 text-[10px] text-fg">{counts[tab.key]}</span>}
              </button>
            ))}
          </div>

          {queue.loading ? (
            <div className="grid gap-2 p-3">
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-20" />
              ))}
            </div>
          ) : queue.error ? (
            <ErrorState title="Queue unavailable" message={queue.error.message} onRetry={queue.reload} />
          ) : reports.length === 0 ? (
            <EmptyState icon={Inbox} tone="green" title="Nothing here" description="No reports in this view." />
          ) : (
            <ul className="min-h-0 overflow-y-auto">
              <AnimatePresence initial={false}>
                {reports.map((report) => (
                  <QueueItem key={report.id} report={report} active={report.id === selected} now={now} onSelect={select} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <div className={cn('min-w-0', !selected && 'hidden lg:block')}>
          {selected ? (
            <ReportWorkspace key={selected} reportId={selected} now={now} onBack={() => select(null)} onChanged={queue.reload} />
          ) : (
            <div className="panel">
              <EmptyState icon={MessageSquareWarning} title="Select a report" description="Choose a report from the queue to verify it, deploy a team or review the response." />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
