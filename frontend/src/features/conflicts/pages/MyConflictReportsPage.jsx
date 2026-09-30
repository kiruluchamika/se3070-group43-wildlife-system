import { ArrowLeft, Check, FilePlus2, HelpCircle, Inbox, Link2, MessageSquareReply, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { Field, Input, Textarea } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { cn } from '../../../lib/cn'
import { formatDateTime, formatRelativeTime } from '../../../lib/format'
import { conflictApi, conflictPaths } from '../api/conflictApi'
import { ConflictStatusBadge } from '../components/ConflictBadges'
import { EvidenceGallery, HistoryTimeline, ReportFacts } from '../components/ReportDetails'
import { useSelectedParam } from '../hooks/useSelectedParam'
import { FIELD_OUTCOME_LABELS, TYPE_LABELS, VILLAGER_STEP_OF, VILLAGER_STEPS } from '../lib/conflict'
import { captureLocation } from '../lib/device'

function StatusStepper({ status }) {
  const current = VILLAGER_STEP_OF[status] ?? 0
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Report progress">
      {VILLAGER_STEPS.map((label, index) => {
        const done = index < current || (index === current && index === VILLAGER_STEPS.length - 1)
        const active = index === current
        return (
          <li key={label} className="flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full text-xs font-bold ring-2',
                done ? 'bg-brand-500 text-white ring-brand-500' : active ? 'bg-brand-500/15 text-brand-600 ring-brand-400 dark:text-brand-200' : 'bg-elevated text-subtle ring-line',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn('text-[11px] leading-tight', active ? 'font-semibold text-fg' : 'text-subtle')}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** A3: the villager answers the officer's question and can add a landmark or GPS. */
function InformationReply({ report, onSaved }) {
  const [response, setResponse] = useState('')
  const [landmark, setLandmark] = useState(report.landmark ?? '')
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function locate() {
    setLocationError(null)
    try {
      setLocation(await captureLocation())
    } catch (captureError) {
      setLocationError(captureError.message)
    }
  }

  async function send(event) {
    event.preventDefault()
    if (response.trim().length < 5) {
      setError('Write a reply of at least 5 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await conflictApi.provideInformation(report.id, {
        response: response.trim(),
        landmark: landmark.trim() || undefined,
        location: location ?? undefined,
      })
      toast.success('Thank you. The officer has your reply.')
      onSaved()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={send} className="grid gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
      <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
        <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>The officer asks:</strong> {report.informationRequest?.message}
        </span>
      </p>
      <Field label="Your reply" required error={error}>
        {(props) => <Textarea {...props} value={response} onChange={(event) => setResponse(event.target.value)} maxLength={1000} />}
      </Field>
      <Field label="Landmark">
        {(props) => <Input {...props} value={landmark} onChange={(event) => setLandmark(event.target.value)} placeholder="e.g. Next to the temple" />}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={locate}>
          {location ? `GPS added (±${location.accuracyMeters} m)` : 'Add my GPS location'}
        </Button>
        <Button type="submit" icon={MessageSquareReply} loading={saving}>
          Send reply
        </Button>
      </div>
      {locationError && <p className="text-xs text-red-500 dark:text-red-300">{locationError}</p>}
    </form>
  )
}

function ReportDetail({ reportId, now, onBack, onChanged }) {
  const { data, loading, error, reload } = useApiQuery(conflictPaths.report(reportId), { refreshMs: 30000 })

  if (loading) return <Skeleton className="h-96" />
  if (error) return <ErrorState title="Report unavailable" message={error.message} onRetry={reload} />

  const { report, tasks } = data
  const activeTask = tasks.find((task) => ['assigned', 'acknowledged'].includes(task.status))
  const lastCompleted = tasks.find((task) => task.status === 'completed')

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="lg:hidden">
          All reports
        </Button>
        <p className="font-mono text-sm font-bold text-brand-700 dark:text-brand-300">{report.reference}</p>
        <ConflictStatusBadge status={report.status} />
      </div>

      <StatusStepper status={report.status} />

      {report.status === 'pending-information' && (
        <InformationReply
          report={report}
          onSaved={() => {
            reload()
            onChanged()
          }}
        />
      )}
      {report.status === 'duplicate' && report.duplicateOf && (
        <p className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted">
          <Link2 className="size-4" aria-hidden="true" /> Linked to {report.duplicateOf.reference}, which already covers this event.
        </p>
      )}
      {report.status === 'invalid' && report.validation?.notes && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
          <strong className="text-fg">Reason:</strong> {report.validation.notes}
        </p>
      )}
      {activeTask && (
        <p className="flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3 text-sm text-violet-800 dark:text-violet-200">
          <Users className="size-4" aria-hidden="true" /> {activeTask.team?.name} is responding
          {activeTask.acknowledgedAt ? ` (confirmed ${formatRelativeTime(activeTask.acknowledgedAt, now)})` : ''}.
        </p>
      )}
      {report.outcome?.result && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          <p className="font-semibold">Outcome: {FIELD_OUTCOME_LABELS[report.outcome.fieldOutcome] ?? report.outcome.result}</p>
          {report.outcome.notes && <p className="mt-1">{report.outcome.notes}</p>}
          {report.outcome.followUpAt && <p className="mt-1">Rangers will check the area again on {formatDateTime(report.outcome.followUpAt)}.</p>}
        </div>
      )}
      {!report.outcome?.result && lastCompleted && (
        <p className="text-sm text-muted">Field result: {FIELD_OUTCOME_LABELS[lastCompleted.completion?.outcome]}</p>
      )}

      <ReportFacts report={report} now={now} />
      <EvidenceGallery evidence={report.evidence} />
      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">History</h3>
        <HistoryTimeline history={report.history} />
      </div>
    </div>
  )
}

/** Villager view of their own reports, with progress and the A3 information reply. */
export default function MyConflictReportsPage() {
  const now = useNow()
  const navigate = useNavigate()
  const [selected, select] = useSelectedParam('report')
  const reports = useApiQuery(conflictPaths.mine(), { refreshMs: 30000 })
  const list = reports.data?.reports ?? []

  return (
    <>
      <PageHeader
        eyebrow="UC01 · Villager"
        title="My conflict reports"
        description="Follow each report from verification to the final outcome."
        actions={
          <Button icon={FilePlus2} onClick={() => navigate('/conflicts/report')}>
            New report
          </Button>
        }
      />

      {reports.loading ? (
        <Skeleton className="h-64" />
      ) : reports.error ? (
        <div className="panel">
          <ErrorState title="Reports unavailable" message={reports.error.message} onRetry={reports.reload} />
        </div>
      ) : list.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Inbox} title="No reports yet" description="Reports you send about elephants near your village appear here." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ul className={cn('grid content-start gap-2', selected && 'hidden lg:grid')}>
            {list.map((report) => (
              <li key={report.id}>
                <motion.button
                  type="button"
                  layout
                  onClick={() => select(report.id)}
                  className={cn(
                    'panel w-full cursor-pointer p-4 text-left transition hover:shadow-glow',
                    selected === report.id && 'ring-2 ring-brand-400',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-fg">{TYPE_LABELS[report.conflictType]}</p>
                    <ConflictStatusBadge status={report.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">{report.village}</p>
                  <p className="mt-1 font-mono text-[11px] text-subtle">
                    {report.reference} · {formatRelativeTime(report.createdAt, now)}
                  </p>
                </motion.button>
              </li>
            ))}
          </ul>
          <div className={cn(!selected && 'hidden lg:block')}>
            {selected ? (
              <Card>
                <ReportDetail key={selected} reportId={selected} now={now} onBack={() => select(null)} onChanged={reports.reload} />
              </Card>
            ) : (
              <div className="panel">
                <EmptyState icon={Inbox} title="Select a report" description="Choose a report to see its progress and history." />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
