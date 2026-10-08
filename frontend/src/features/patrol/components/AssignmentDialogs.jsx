import { ArrowRightLeft, ClipboardCheck, ShieldAlert, UserPlus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { SuccessCheck } from '../../../components/ui/Animated'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { RiskBadge, TeamStatusBadge } from '../../../components/ui/StatusBadges'
import { formatDistance, formatEta, formatHoursAgo } from '../../../lib/format'
import { patrolApi } from '../api/patrolApi'
import { ALLOCATION_MODE } from '../lib/allocation'

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-fg">{children}</dd>
    </div>
  )
}

/**
 * Review step before anything is saved (HCI: error prevention). Shows the
 * reassignment impact, handles the PRIORITY_DOWNGRADE override and reports
 * update failures without changing the previous assignment (E3).
 */
export function AssignmentConfirmDialog({ request, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [override, setOverride] = useState(false)

  if (!request) return <Modal open={false} onClose={onClose} title="" />
  const { mode, zone, team, impact, notes, reason } = request
  const reassigning = mode === ALLOCATION_MODE.REASSIGN
  const needsOverride = error?.code === 'PRIORITY_DOWNGRADE' || impact?.isPriorityDowngrade

  async function confirm() {
    setSaving(true)
    setError(null)
    try {
      const result = reassigning
        ? await patrolApi.reassign({ zoneId: zone.zone.id, teamId: team.id, reason, notes: notes || undefined, override: override || undefined })
        : await patrolApi.allocate({ zoneId: zone.zone.id, teamId: team.id, notes: notes || undefined })
      onSaved({ ...result, mode })
    } catch (saveError) {
      setError(saveError)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      icon={reassigning ? ArrowRightLeft : UserPlus}
      tone={reassigning ? 'warning' : 'brand'}
      title={reassigning ? 'Confirm team reassignment' : 'Confirm patrol assignment'}
      description="Review the deployment. The assigned team is notified as soon as you confirm."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={confirm} loading={saving} disabled={needsOverride && !override} icon={ClipboardCheck}>
            {reassigning ? 'Reassign team' : 'Assign team'}
          </Button>
        </>
      }
    >
      <dl>
        <Row label="Zone">{zone.zone.name}</Row>
        <Row label="Risk level">
          <RiskBadge level={zone.effectiveRisk} />
        </Row>
        <Row label="Coverage · last patrol">
          {zone.coveragePercent}% · {formatHoursAgo(zone.hoursSinceLastPatrol)}
        </Row>
        <Row label="Ranger team">
          <span className="inline-flex items-center gap-2">
            {team.name} <TeamStatusBadge status={team.status} />
          </span>
        </Row>
        {team.distanceKm !== null && team.distanceKm !== undefined && (
          <Row label="Distance · travel time">
            {formatDistance(team.distanceKm)} · {formatEta(team.etaMinutes)}
          </Row>
        )}
        {reassigning && <Row label="Reason">{reason}</Row>}
        {notes && !reassigning && <Row label="Notes">{notes}</Row>}
      </dl>

      {reassigning && impact && (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          {team.name} will stop patrolling <strong>{impact.fromZone?.name}</strong>
          {impact.leavesZoneUncovered ? ', which will then have no assigned team.' : '.'}
        </p>
      )}

      {needsOverride && (
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-200">
          <input type="checkbox" checked={override} onChange={(event) => setOverride(event.target.checked)} className="mt-0.5 size-4 accent-red-500" />
          <span>
            {impact?.fromZone?.name ?? 'The current zone'} ranks equal to or higher than {zone.zone.name}. I confirm this reassignment anyway.
          </span>
        </label>
      )}

      {error && error.code !== 'PRIORITY_DOWNGRADE' && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {error.message} No changes were saved — the previous patrol assignment remains unchanged.
          </span>
        </motion.p>
      )}
    </Modal>
  )
}

/** Storyboard frame 5: "Patrol Assignment Updated". */
export function SuccessDialog({ result, onClose }) {
  return (
    <Modal open={Boolean(result)} onClose={onClose} title="" size="sm" footer={<Button onClick={onClose}>OK</Button>}>
      {result && (
        <div className="flex flex-col items-center text-center">
          <SuccessCheck className="text-emerald-500 dark:text-emerald-400" />
          <h3 className="mt-3 text-xl font-extrabold text-fg">{result.title}</h3>
          <p className="mt-1 text-sm text-muted">{result.message}</p>
          <p className="mt-3 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">The team has been notified.</p>
        </div>
      )}
    </Modal>
  )
}
