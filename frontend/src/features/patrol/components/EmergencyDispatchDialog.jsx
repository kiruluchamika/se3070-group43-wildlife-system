import { ArrowRightLeft, CircleCheck, MapPin, Radio, Siren, Timer } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { SuccessCheck } from '../../../components/ui/Animated'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { Field, Input } from '../../../components/ui/Field'
import { Modal } from '../../../components/ui/Modal'
import { SeverityBadge, TeamStatusBadge } from '../../../components/ui/StatusBadges'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { cn } from '../../../lib/cn'
import { formatDistance, formatEta } from '../../../lib/format'
import { patrolApi, patrolPaths } from '../api/patrolApi'

function CandidateOption({ candidate, checked, onSelect, divert, recommended }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition',
        checked ? 'border-red-400/60 bg-red-500/10' : 'border-line bg-surface-2/60 hover:border-line-strong',
      )}
    >
      <input type="radio" name="dispatch-team" checked={checked} onChange={onSelect} className="size-4 accent-red-500" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-fg">{candidate.team.name}</span>
          <TeamStatusBadge status={candidate.team.status} />
          {recommended && <Badge tone="green">Recommended · nearest</Badge>}
          {divert && (
            <Badge tone="amber" icon={ArrowRightLeft}>
              Divert from {candidate.currentAssignment?.zone?.name}
            </Badge>
          )}
        </span>
        <span className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <MapPin className="size-3" aria-hidden="true" /> {formatDistance(candidate.distanceKm)}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="size-3" aria-hidden="true" /> {formatEta(candidate.etaMinutes)}
          </span>
        </span>
      </span>
    </label>
  )
}

/**
 * A4 Emergency Situation. The system recommends the nearest available team
 * and the manager can accept or override it. When no team is free, teams on
 * lower-priority patrols can be diverted.
 */
export function EmergencyDispatchDialog({ alert, onClose, onDispatched }) {
  const { data, loading, error, reload } = useApiQuery(alert ? patrolPaths.recommendations(alert.id) : null)
  const [chosenTeamId, setChosenTeamId] = useState(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [result, setResult] = useState(null)

  const teamId = chosenTeamId ?? data?.recommended?.team.id ?? null

  async function dispatch() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await patrolApi.dispatch({ alertId: alert.id, teamId: teamId ?? undefined, notes: notes || undefined })
      setResult(response)
      onDispatched?.(response)
    } catch (dispatchError) {
      setSubmitError(dispatchError)
    } finally {
      setSubmitting(false)
    }
  }

  const footer = result ? (
    <Button onClick={onClose} icon={CircleCheck}>
      Done
    </Button>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose} disabled={submitting}>
        Cancel
      </Button>
      <Button variant="danger" icon={Radio} onClick={dispatch} loading={submitting} disabled={!teamId || data?.mode === 'none'}>
        Dispatch team now
      </Button>
    </>
  )

  return (
    <Modal
      open={Boolean(alert)}
      onClose={submitting ? undefined : onClose}
      dismissible={!submitting}
      icon={Siren}
      tone="danger"
      size="lg"
      title="Emergency dispatch"
      description="Send a ranger team to this alert immediately. Routine approval is skipped under the emergency-response policy."
      footer={footer}
    >
      {alert && (
        <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-fg">{alert.title}</p>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {alert.zone?.name} · {alert.message}
          </p>
        </div>
      )}

      {result ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-2 text-center">
          <SuccessCheck className="text-emerald-500 dark:text-emerald-400" />
          <h3 className="mt-3 text-lg font-extrabold text-fg">{result.team.name} dispatched</h3>
          <p className="mt-1 text-sm text-muted">
            Estimated arrival {formatEta(result.dispatch.etaMinutes)}. The alert is now marked as dispatched and the team has been notified.
            {result.diverted && ' Its previous patrol was ended and recorded.'}
          </p>
        </motion.div>
      ) : loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : error ? (
        <ErrorState title="Cannot prepare the dispatch" message={error.message} onRetry={reload} />
      ) : data?.mode === 'none' ? (
        <ErrorState
          title="No ranger teams are available"
          message="No team is free, and none can be diverted from a routine patrol. Contact field teams by radio or telephone."
        />
      ) : (
        <div className="grid gap-4">
          {data?.available.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Available teams — nearest first</legend>
              {data.available.map((candidate, index) => (
                <CandidateOption key={candidate.team.id} candidate={candidate} checked={teamId === candidate.team.id} onSelect={() => setChosenTeamId(candidate.team.id)} recommended={index === 0} />
              ))}
            </fieldset>
          )}
          {data?.divertible.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">
                {data.mode === 'divert' ? 'No team is free — divert a team on patrol' : 'Or divert a team on patrol'}
              </legend>
              {data.divertible.map((candidate) => (
                <CandidateOption key={candidate.team.id} candidate={candidate} divert checked={teamId === candidate.team.id} onSelect={() => setChosenTeamId(candidate.team.id)} />
              ))}
            </fieldset>
          )}
          <Field label="Instructions for the team (optional)">
            {(props) => <Input {...props} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Approach from the northern track" maxLength={500} />}
          </Field>
          {submitError && (
            <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
              {submitError.message} Nothing was changed.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
