import { ClipboardCheck, RefreshCw, Send, ShieldAlert, Siren, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../../components/ui/Button'
import { ErrorState, Skeleton } from '../../../../components/ui/Feedback'
import { Field, Textarea } from '../../../../components/ui/Field'
import { Modal } from '../../../../components/ui/Modal'
import { TeamStatusBadge } from '../../../../components/ui/StatusBadges'
import { useApiQuery } from '../../../../hooks/useApiQuery'
import { cn } from '../../../../lib/cn'
import { formatDistance, formatEta } from '../../../../lib/format'
import { conflictApi, conflictPaths } from '../../api/conflictApi'
import { useAction } from '../../hooks/useAction'
import { PRIORITY_ROUTE } from '../../lib/conflict'
import { PriorityBadge } from '../ConflictBadges'
import { InlineError } from '../InlineError'

function EscalateForm({ report, onChanged, prompt }) {
  const [reason, setReason] = useState('')
  const { run, saving, error } = useAction(onChanged)

  return (
    <div className="grid gap-3 rounded-2xl border border-red-400/30 bg-red-500/8 p-4">
      <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {prompt}
      </p>
      <Field label="Reason for escalation">
        {(props) => (
          <Textarea {...props} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="min-h-20" placeholder="No team is free; the herd is moving towards the school." />
        )}
      </Field>
      <div className="flex justify-end">
        <Button
          variant="danger"
          icon={ShieldAlert}
          loading={saving}
          disabled={reason.trim().length < 5}
          onClick={() => run(() => conflictApi.escalate(report.id, { reason: reason.trim() }), 'Escalated to the park manager')}
        >
          Escalate to park manager
        </Button>
      </div>
      <InlineError error={error} />
    </div>
  )
}

/**
 * Main flow step 3: choose a team. The route follows the priority:
 * direct assignment (low/medium), park manager approval (high or extra
 * resources) or emergency dispatch (critical, A2). With no free team the
 * officer escalates (A5).
 */
export function DeploymentPanel({ report, onChanged }) {
  const teams = useApiQuery(conflictPaths.teams(report.id))
  const [teamId, setTeamId] = useState(null)
  const [instructions, setInstructions] = useState('')
  const [additionalResources, setAdditionalResources] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showEscalate, setShowEscalate] = useState(false)
  const { run, saving, error, clearError } = useAction(() => {
    setConfirming(false)
    onChanged()
  })

  if (teams.loading) return <Skeleton className="h-40" />
  if (teams.error) return <ErrorState title="Teams unavailable" message={teams.error.message} onRetry={teams.reload} />

  const { available, busy } = teams.data
  const critical = report.priority === 'critical'
  const needsApproval = !critical && (report.priority === 'high' || additionalResources)
  const chosen = available.find((team) => team.id === (teamId ?? teams.data.recommended?.id))

  async function deploy() {
    const result = await run(
      () => conflictApi.deploy(report.id, { teamId: chosen.id, instructions: instructions.trim() || undefined, additionalResources: additionalResources || undefined }),
      ({ route }) =>
        route === 'emergency' ? `${chosen.name} dispatched as an emergency` : route === 'approval' ? 'Sent to the park manager for approval' : `${chosen.name} assigned`,
    )
    if (!result) teams.reload()
  }

  return (
    <div className="grid gap-4">
      <p className={cn('flex items-start gap-2 rounded-xl p-3 text-sm', critical ? 'bg-red-600 font-semibold text-white' : 'bg-surface-2 text-muted')}>
        {critical ? <Siren className="mt-0.5 size-4 shrink-0 animate-pulse" aria-hidden="true" /> : <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
        <span>
          <PriorityBadge priority={report.priority} /> {needsApproval ? PRIORITY_ROUTE.high : PRIORITY_ROUTE[report.priority]}
        </span>
      </p>

      {available.length === 0 ? (
        <>
          <ul className="grid gap-2">
            {busy.map((team) => (
              <li key={team.id} className="flex items-center justify-between rounded-xl bg-surface-2/60 p-3 text-sm">
                {team.name} <TeamStatusBadge status={team.status} />
              </li>
            ))}
          </ul>
          <EscalateForm report={report} onChanged={onChanged} prompt="No ranger team in this park is available. Escalate so the park manager can divert a patrol or arrange other help (A5)." />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Available teams, nearest first</p>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={teams.reload}>
              Refresh
            </Button>
          </div>
          <div role="radiogroup" aria-label="Ranger team" className="grid gap-2">
            {available.map((team) => (
              <label
                key={team.id}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition',
                  chosen?.id === team.id ? 'border-brand-400 bg-brand-500/10' : 'border-line hover:border-brand-500/50',
                )}
              >
                <span className="flex items-center gap-3">
                  <input type="radio" name="team" checked={chosen?.id === team.id} onChange={() => setTeamId(team.id)} className="accent-brand-500" />
                  <span>
                    <span className="block text-sm font-semibold text-fg">
                      {team.name}
                      {team.id === teams.data.recommended?.id && <span className="ml-2 text-xs font-medium text-brand-600 dark:text-brand-300">Nearest</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {team.members?.length ?? 0} rangers · {team.baseLocationName}
                    </span>
                  </span>
                </span>
                <span className="text-right text-xs text-muted">
                  {formatDistance(team.distanceKm)}
                  <span className="block">{formatEta(team.etaMinutes)}</span>
                </span>
              </label>
            ))}
          </div>
          {busy.length > 0 && <p className="text-xs text-subtle">Busy: {busy.map((team) => `${team.name} (${team.status})`).join(', ')}</p>}

          <Field label="Instructions for the team">
            {(props) => <Textarea {...props} value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={500} className="min-h-20" />}
          </Field>
          {!critical && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={additionalResources} onChange={(event) => setAdditionalResources(event.target.checked)} className="size-4 accent-brand-500" />
              Request additional resources (needs park manager approval)
            </label>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" size="sm" icon={ShieldAlert} onClick={() => setShowEscalate((value) => !value)}>
              Escalate instead
            </Button>
            <Button
              variant={critical ? 'danger' : 'primary'}
              icon={critical ? Siren : needsApproval ? ClipboardCheck : Send}
              disabled={!chosen}
              onClick={() => {
                clearError()
                setConfirming(true)
              }}
            >
              {critical ? 'Emergency dispatch' : needsApproval ? 'Request approval' : 'Assign team'}
            </Button>
          </div>
          {showEscalate && <EscalateForm report={report} onChanged={onChanged} prompt="Escalate when this response needs more than one team can give." />}
        </>
      )}

      <Modal
        open={confirming}
        onClose={saving ? undefined : () => setConfirming(false)}
        dismissible={!saving}
        icon={critical ? Siren : Users}
        tone={critical ? 'danger' : 'brand'}
        title={critical ? 'Confirm emergency dispatch' : needsApproval ? 'Send for approval?' : 'Confirm team assignment'}
        description={
          critical
            ? `${chosen?.name} is sent at once and marked responding. The park manager sees the alert on the patrol dashboard.`
            : needsApproval
              ? `The park manager must approve before ${chosen?.name} is committed.`
              : `${chosen?.name} is marked responding and notified. Patrol management can no longer allocate it.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant={critical ? 'danger' : 'primary'} loading={saving} onClick={deploy} icon={ClipboardCheck}>
              Confirm
            </Button>
          </>
        }
      >
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Report</dt>
            <dd className="font-mono font-semibold text-fg">{report.reference}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Team</dt>
            <dd className="font-semibold text-fg">{chosen?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Distance · travel time</dt>
            <dd className="font-semibold text-fg">
              {formatDistance(chosen?.distanceKm)} · {formatEta(chosen?.etaMinutes)}
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <InlineError error={error} />
        </div>
      </Modal>
    </div>
  )
}
