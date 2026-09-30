import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  CloudOff,
  CloudUpload,
  Crosshair,
  Inbox,
  ListPlus,
  RefreshCw,
  Siren,
  Trash2,
  UserRound,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { Field, Select, Textarea } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useAuth } from '../../../context/auth-context'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { cn } from '../../../lib/cn'
import { formatDateTime, formatRelativeTime } from '../../../lib/format'
import { conflictApi, conflictPaths } from '../api/conflictApi'
import { PriorityBadge, TaskStatusBadge } from '../components/ConflictBadges'
import { InlineError } from '../components/InlineError'
import { ActionList, ReportFacts } from '../components/ReportDetails'
import { useSelectedParam } from '../hooks/useSelectedParam'
import { FIELD_ACTION_LABELS, FIELD_ACTIONS, FIELD_OUTCOME_LABELS, FIELD_OUTCOMES, TYPE_LABELS, newClientId } from '../lib/conflict'
import { captureLocation } from '../lib/device'
import { cacheTasks, readCachedTasks } from '../offline/responseQueue'
import { useResponseQueue } from '../offline/useResponseQueue'

const OPEN = ['assigned', 'acknowledged']

/** Server tasks, falling back to the copy saved on this device when the server cannot be reached (E4). */
function useTasks(ownerId) {
  const live = useApiQuery(conflictPaths.myTasks(), { refreshMs: 30000 })
  const [cached, setCached] = useState(null)

  useEffect(() => {
    if (live.data) cacheTasks(ownerId, live.data)
  }, [live.data, ownerId])

  useEffect(() => {
    if (!live.error || live.data) return undefined
    let active = true
    readCachedTasks(ownerId).then((entry) => active && setCached(entry))
    return () => {
      active = false
    }
  }, [live.error, live.data, ownerId])

  const fromCache = !live.data && Boolean(cached)
  return { ...live, data: live.data ?? cached?.data, fromCache, cachedAt: cached?.savedAt }
}

function SyncBar({ queue, fromCache, cachedAt, now }) {
  const { online, pending, failed, syncing, sync, lastResult } = queue
  if (online && !pending.length && !failed.length && !fromCache) return null

  return (
    <div
      role="status"
      className={cn(
        'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 text-sm',
        online ? 'border-amber-400/40 bg-amber-500/10 text-amber-900 dark:text-amber-100' : 'border-slate-400/40 bg-slate-500/10 text-fg',
      )}
    >
      <span className="flex items-center gap-2">
        {online ? <CloudUpload className="size-4" aria-hidden="true" /> : <CloudOff className="size-4" aria-hidden="true" />}
        {!online && 'You are offline. Updates are saved on this device. '}
        {pending.length > 0 && `${pending.length} update${pending.length === 1 ? '' : 's'} waiting to sync. `}
        {failed.length > 0 && `${failed.length} update${failed.length === 1 ? ' was' : 's were'} rejected — see the task. `}
        {fromCache && `Showing tasks saved on this device ${formatRelativeTime(cachedAt, now)}.`}
        {lastResult?.stoppedBy && online && ` Last attempt: ${lastResult.stoppedBy.message}`}
      </span>
      {pending.length > 0 && (
        <Button size="sm" variant="secondary" icon={RefreshCw} loading={syncing} onClick={sync}>
          Sync now
        </Button>
      )}
    </div>
  )
}

function RecordActionForm({ task, queue, disabled }) {
  const [type, setType] = useState('arrived-on-site')
  const [note, setNote] = useState('')
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

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { sent } = await queue.save({
        taskId: task.id,
        kind: 'action',
        body: {
          clientUpdateId: newClientId(),
          type,
          note: note.trim() || undefined,
          location: location ?? undefined,
          recordedAt: new Date().toISOString(),
          recordedOffline: !navigator.onLine,
        },
      })
      toast.success(sent ? `${FIELD_ACTION_LABELS[type]} recorded` : `${FIELD_ACTION_LABELS[type]} saved on this device. It will sync when you are back online.`)
      setNote('')
      setLocation(null)
    } catch (saveError) {
      setError(saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3">
      <Field label="Action taken">
        {(props) => (
          <Select {...props} value={type} onChange={(event) => setType(event.target.value)}>
            {FIELD_ACTIONS.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Note">
        {(props) => <Textarea {...props} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="min-h-16" />}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="sm" icon={Crosshair} onClick={locate}>
          {location ? `GPS added (±${location.accuracyMeters} m)` : 'Add GPS'}
        </Button>
        <Button type="submit" icon={ListPlus} loading={saving} disabled={disabled}>
          Record action
        </Button>
      </div>
      {locationError && <p className="text-xs text-red-500 dark:text-red-300">{locationError}</p>}
      <InlineError error={error} unchanged={false} />
    </form>
  )
}

function CompleteDialog({ task, queue, open, onClose }) {
  const [outcome, setOutcome] = useState('elephant-driven-away')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function complete() {
    setSaving(true)
    setError(null)
    try {
      const { sent } = await queue.save({
        taskId: task.id,
        kind: 'complete',
        body: { clientUpdateId: newClientId(), outcome, notes: notes.trim() || undefined, completedAt: new Date().toISOString() },
      })
      toast.success(sent ? 'Response completed. The officer will review it.' : 'Completion saved on this device. It will sync when you are back online.')
      onClose()
    } catch (saveError) {
      setError(saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      icon={ClipboardCheck}
      title="Complete this response?"
      description="Your team becomes available again and the liaison officer reviews the outcome."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button icon={CheckCircle2} loading={saving} onClick={complete}>
            Complete response
          </Button>
        </>
      }
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Outcome</legend>
        {FIELD_OUTCOMES.map((option) => (
          <label
            key={option.value}
            className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm', outcome === option.value ? 'border-brand-400 bg-brand-500/10' : 'border-line')}
          >
            <input type="radio" name="outcome" checked={outcome === option.value} onChange={() => setOutcome(option.value)} className="accent-brand-500" />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="mt-3">
        <Field label="Notes">
          {(props) => <Textarea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} className="min-h-20" />}
        </Field>
      </div>
      <div className="mt-3">
        <InlineError error={error} unchanged={false} />
      </div>
    </Modal>
  )
}

function TaskDetail({ task, queue, now, onBack, onChanged }) {
  const [completing, setCompleting] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const report = task.report ?? {}
  const local = queue.items.filter((item) => item.taskId === task.id)
  const localComplete = local.find((item) => item.kind === 'complete' && item.status === 'pending')
  const open = OPEN.includes(task.status) && !localComplete
  const emergency = task.dispatchType === 'emergency'

  async function acknowledge() {
    setAcknowledging(true)
    try {
      await conflictApi.acknowledgeTask(task.id)
      toast.success('Task acknowledged')
      onChanged()
    } catch (error) {
      toast.error(`${error.message} Recording your first action also confirms the task.`)
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="justify-self-start lg:hidden">
        All tasks
      </Button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel overflow-hidden">
        {emergency && open && (
          <div className="flex items-center gap-2 bg-linear-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold tracking-wide text-white uppercase">
            <Siren className="size-5 animate-pulse" aria-hidden="true" /> Emergency — people may be in danger
          </div>
        )}
        <div className="grid gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs text-subtle">{report.reference}</p>
              <h2 className="text-xl font-extrabold text-fg">
                {TYPE_LABELS[report.conflictType]} · {report.village}
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <PriorityBadge priority={task.priority} />
              {localComplete ? <Badge tone="amber">Completed · waiting to sync</Badge> : <TaskStatusBadge status={task.status} />}
            </div>
          </div>
          <ReportFacts report={report} now={now} />
          {task.instructions && (
            <p className="rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-muted">
              <span className="font-semibold text-fg">Instructions: </span>
              {task.instructions}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-subtle">
            <UserRound className="size-3" aria-hidden="true" /> Assigned by {task.approval?.by?.name ?? task.proposedBy?.name} {formatRelativeTime(task.assignedAt, now)}
          </p>
          {task.status === 'assigned' && !localComplete && (
            <Button size="lg" variant={emergency ? 'danger' : 'primary'} icon={CheckCircle2} loading={acknowledging} onClick={acknowledge} disabled={!queue.online} className="w-full">
              Acknowledge task
            </Button>
          )}
          {task.status === 'completed' && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
              Completed {formatDateTime(task.completion?.completedAt)}: {FIELD_OUTCOME_LABELS[task.completion?.outcome]}
            </p>
          )}
        </div>
      </motion.div>

      {open && (
        <div className="panel grid gap-4 p-5">
          <h3 className="text-sm font-bold text-fg">Record a field action</h3>
          <RecordActionForm task={task} queue={queue} />
          <Button variant="secondary" icon={ClipboardCheck} onClick={() => setCompleting(true)}>
            Complete response
          </Button>
        </div>
      )}

      <div className="panel grid gap-3 p-5">
        <h3 className="text-sm font-bold text-fg">Field log</h3>
        {local.length > 0 && (
          <ul className="grid gap-2">
            {local.map((item) => (
              <li
                key={item.localId}
                className={cn('flex items-start justify-between gap-2 rounded-xl border p-3 text-sm', item.status === 'failed' ? 'border-red-400/40 bg-red-500/10' : 'border-amber-400/40 bg-amber-500/10')}
              >
                <span>
                  <span className="font-semibold text-fg">{item.kind === 'complete' ? `Complete: ${FIELD_OUTCOME_LABELS[item.body.outcome]}` : FIELD_ACTION_LABELS[item.body.type]}</span>
                  <span className="block text-xs text-muted">
                    {item.status === 'failed' ? `Rejected by the server: ${item.error}` : `Saved on this device ${formatRelativeTime(item.createdAt, now)} · waiting to sync`}
                  </span>
                </span>
                {item.status === 'failed' && (
                  <Button variant="ghost" size="icon" icon={Trash2} onClick={() => queue.discard(item.localId)} aria-label="Discard this update" />
                )}
              </li>
            ))}
          </ul>
        )}
        <ActionList actions={task.actions} />
      </div>

      <CompleteDialog key={String(completing)} task={task} queue={queue} open={completing} onClose={() => setCompleting(false)} />
    </div>
  )
}

function TaskButton({ task, active, now, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      className={cn('panel w-full cursor-pointer p-4 text-left transition hover:shadow-glow', active && 'ring-2 ring-brand-400')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-fg">
          {task.dispatchType === 'emergency' && <Siren className="mr-1 inline size-4 text-red-500" aria-hidden="true" />}
          {TYPE_LABELS[task.report?.conflictType]} · {task.report?.village}
        </p>
        <TaskStatusBadge status={task.status} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {task.report?.reference} · assigned {formatRelativeTime(task.assignedAt, now)}
      </p>
    </button>
  )
}

/**
 * UC01 main flow step 4 for rangers: receive, acknowledge and carry out
 * conflict response tasks. Works offline for tasks already received (E4).
 */
export default function ResponseTasksPage() {
  const { user } = useAuth()
  const now = useNow()
  const [selected, select] = useSelectedParam('task')
  const tasks = useTasks(user.id)
  const reload = tasks.reload
  const onSynced = useCallback(() => reload(), [reload])
  const queue = useResponseQueue(user.id, { onSynced })

  const list = tasks.data?.tasks ?? []
  const openTasks = list.filter((task) => OPEN.includes(task.status))
  const doneTasks = list.filter((task) => !OPEN.includes(task.status))
  const current = list.find((task) => task.id === selected)

  return (
    <>
      <PageHeader
        eyebrow="UC01 · Ranger"
        title="Conflict response tasks"
        description={tasks.data?.team ? `${tasks.data.team.name}: human–elephant conflict responses.` : 'Human–elephant conflict responses for your team.'}
      />

      <SyncBar queue={queue} fromCache={tasks.fromCache} cachedAt={tasks.cachedAt} now={now} />

      {tasks.loading && !tasks.data ? (
        <div className="grid gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : tasks.error && !tasks.data ? (
        <div className="panel">
          <ErrorState title="Tasks unavailable" message={`${tasks.error.message} No tasks are saved on this device yet.`} onRetry={tasks.reload} />
        </div>
      ) : !tasks.data.team ? (
        <div className="panel">
          <EmptyState icon={UserRound} title="You are not in a ranger team" description="Ask your park manager to add you to a team." />
        </div>
      ) : list.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Inbox} tone="green" title="No conflict tasks" description="New conflict responses for your team appear here and in your notifications." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className={cn('grid content-start gap-2', current && 'hidden lg:grid')}>
            {openTasks.map((task) => (
              <TaskButton key={task.id} task={task} active={selected === task.id} now={now} onSelect={select} />
            ))}
            {doneTasks.length > 0 && <p className="mt-2 text-xs font-semibold tracking-wide text-subtle uppercase">Completed</p>}
            {doneTasks.map((task) => (
              <TaskButton key={task.id} task={task} active={selected === task.id} now={now} onSelect={select} />
            ))}
          </div>
          <div className={cn(!current && 'hidden lg:block')}>
            {current ? (
              <TaskDetail key={current.id} task={current} queue={queue} now={now} onBack={() => select(null)} onChanged={tasks.reload} />
            ) : (
              <div className="panel">
                <EmptyState icon={Inbox} title="Select a task" description="Choose a task to acknowledge it and record your response." />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
