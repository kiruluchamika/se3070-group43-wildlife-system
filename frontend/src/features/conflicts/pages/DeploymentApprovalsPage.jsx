import { CheckCircle2, ClipboardCheck, RefreshCw, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { Field, Select, Textarea } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { PageHeader } from '../../../components/ui/PageHeader'
import { TeamStatusBadge } from '../../../components/ui/StatusBadges'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { toQuery } from '../../../lib/api'
import { formatRelativeTime } from '../../../lib/format'
import { riseIn, stagger } from '../../../lib/motion'
import { conflictApi, conflictPaths } from '../api/conflictApi'
import { DangerBadge, PriorityBadge } from '../components/ConflictBadges'
import { InlineError } from '../components/InlineError'
import { ReportFacts } from '../components/ReportDetails'
import { useAction } from '../hooks/useAction'
import { TYPE_LABELS } from '../lib/conflict'

/** Approve with the proposed team or another available one, or reject with a reason. */
function DecisionDialog({ decision, onClose, onDone }) {
  const task = decision?.task
  const approving = decision?.type === 'approve'
  const teams = useApiQuery(task && approving ? `/teams${toQuery({ parkId: task.park })}` : null)
  const [teamId, setTeamId] = useState(task?.team?.id ?? '')
  const [notes, setNotes] = useState('')
  const { run, saving, error } = useAction(onDone)
  const selectable = (teams.data?.teams ?? []).filter((team) => team.status === 'available' || team.id === task?.team?.id)

  if (!task) return <Modal open={false} onClose={onClose} title="" />

  const submit = () =>
    run(
      () =>
        conflictApi.decideApproval(task.id, {
          decision: decision.type,
          teamId: approving && teamId !== task.team?.id ? teamId : undefined,
          notes: notes.trim() || undefined,
        }),
      approving ? 'Deployment approved. The team has been notified.' : 'Deployment rejected. The officer has been notified.',
    )

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      icon={approving ? CheckCircle2 : XCircle}
      tone={approving ? 'brand' : 'warning'}
      title={approving ? `Approve deployment for ${task.report?.reference}?` : `Reject deployment for ${task.report?.reference}?`}
      description={
        approving
          ? 'The team is committed as responding at once, so patrol allocation cannot use it.'
          : 'The report returns to the liaison officer, who can propose another response or escalate.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            icon={ClipboardCheck}
            loading={saving}
            disabled={!approving && notes.trim().length < 5}
            onClick={submit}
          >
            {approving ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {approving && (
          <Field label="Ranger team" hint="Keep the proposed team or choose another available team.">
            {(props) => (
              <Select {...props} value={teamId} onChange={(event) => setTeamId(event.target.value)} disabled={teams.loading}>
                {selectable.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                    {team.id === task.team?.id ? ' (proposed)' : ''} — {team.status}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={approving ? 'Notes (optional)' : 'Reason'} required={!approving}>
          {(props) => <Textarea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="min-h-20" />}
        </Field>
        <InlineError error={error} />
      </div>
    </Modal>
  )
}

/**
 * UC01 park manager step: deployments that need approval because the report
 * is high priority or the officer asked for additional resources.
 */
export default function DeploymentApprovalsPage() {
  const now = useNow()
  const approvals = useApiQuery(conflictPaths.approvals(), { refreshMs: 30000 })
  const [decision, setDecision] = useState(null)
  const tasks = approvals.data?.tasks ?? []

  return (
    <>
      <PageHeader
        eyebrow="UC01 · Park Manager"
        title="Deployment approvals"
        description="High-priority conflict responses wait here for your approval. Critical emergencies are dispatched at once and appear under Alerts."
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={approvals.refreshing} onClick={approvals.reload}>
            Refresh
          </Button>
        }
      />

      {approvals.loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : approvals.error ? (
        <div className="panel">
          <ErrorState title="Approvals unavailable" message={approvals.error.message} onRetry={approvals.reload} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="panel">
          <EmptyState icon={CheckCircle2} tone="green" title="Nothing to approve" description="No conflict deployments are waiting for a decision." />
        </div>
      ) : (
        <motion.ul variants={stagger} initial="hidden" animate="visible" className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => (
            <motion.li key={task.id} variants={riseIn} className="panel flex flex-col gap-4 p-5">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-subtle">{task.report?.reference}</p>
                  <h2 className="text-lg font-bold text-fg">
                    {TYPE_LABELS[task.report?.conflictType]} · {task.report?.village}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <PriorityBadge priority={task.priority} />
                  {task.report?.immediateDanger && <DangerBadge />}
                </div>
              </header>
              {task.report && <ReportFacts report={task.report} now={now} />}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/60 p-3 text-sm">
                <span>
                  <span className="font-semibold text-fg">{task.team?.name}</span>
                  <span className="text-muted">
                    {' '}
                    proposed by {task.proposedBy?.name} {formatRelativeTime(task.createdAt, now)}
                  </span>
                </span>
                <TeamStatusBadge status={task.team?.status} />
              </div>
              {task.additionalResources && <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">The officer requested additional resources.</p>}
              {task.instructions && <p className="text-sm text-muted">Instructions: {task.instructions}</p>}
              <div className="mt-auto flex justify-end gap-2">
                <Button variant="secondary" icon={XCircle} onClick={() => setDecision({ type: 'reject', task })}>
                  Reject
                </Button>
                <Button icon={CheckCircle2} onClick={() => setDecision({ type: 'approve', task })}>
                  Approve
                </Button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <DecisionDialog
        key={decision ? `${decision.type}-${decision.task.id}` : 'none'}
        decision={decision}
        onClose={() => setDecision(null)}
        onDone={() => {
          setDecision(null)
          approvals.reload()
        }}
      />
    </>
  )
}
