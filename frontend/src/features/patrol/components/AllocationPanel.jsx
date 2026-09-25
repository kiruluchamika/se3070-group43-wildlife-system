import { ArrowRightLeft, Info, Send, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field, Input, Select } from '../../../components/ui/Field'
import { humanize } from '../../../lib/format'
import { ALLOCATION_MODE, allocationModeFor, reassignImpact, teamAvailability } from '../lib/allocation'

/**
 * Allocate / Reassign Rangers bar from the wireframe (main flow steps 7–9).
 * It switches to reassignment mode (A3) when an on-patrol team is chosen,
 * warns when no team is free (E2) and is disabled when patrol data failed to load (E1).
 */
export function AllocationPanel({ zones, teams, selectedZoneId, selectedTeamId, onZoneChange, onTeamChange, notes, onNotesChange, reason, onReasonChange, onConfirm, disabled }) {
  const team = teams.find((entry) => entry.id === selectedTeamId) ?? null
  const mode = allocationModeFor(team)
  const impact = mode === ALLOCATION_MODE.REASSIGN ? reassignImpact(team, selectedZoneId, zones) : null
  const availability = teamAvailability(teams)
  const sameZone = impact && impact.fromZone?.id === selectedZoneId
  const canConfirm =
    !disabled && selectedZoneId && team && mode !== ALLOCATION_MODE.UNAVAILABLE && !sameZone && (mode !== ALLOCATION_MODE.REASSIGN || reason.trim().length >= 5)

  const groups = [
    { label: 'Available — allocate', teams: teams.filter((entry) => allocationModeFor(entry) === ALLOCATION_MODE.ALLOCATE) },
    { label: 'On patrol — reassign', teams: teams.filter((entry) => allocationModeFor(entry) === ALLOCATION_MODE.REASSIGN) },
    { label: 'Unavailable', teams: teams.filter((entry) => allocationModeFor(entry) === ALLOCATION_MODE.UNAVAILABLE), disabled: true },
  ].filter((group) => group.teams.length)

  return (
    <Card
      title="Allocate / Reassign Rangers"
      icon={UserPlus}
      actions={
        mode && (
          <AnimatePresence mode="wait">
            <motion.span key={mode} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {mode === ALLOCATION_MODE.REASSIGN ? (
                <Badge tone="amber" icon={ArrowRightLeft}>
                  Reassignment
                </Badge>
              ) : mode === ALLOCATION_MODE.ALLOCATE ? (
                <Badge tone="green" icon={UserPlus}>
                  New allocation
                </Badge>
              ) : null}
            </motion.span>
          </AnimatePresence>
        )
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (canConfirm) onConfirm({ mode, team, impact })
        }}
        className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end"
      >
        <Field label="Selected zone" required>
          {(props) => (
            <Select {...props} value={selectedZoneId ?? ''} onChange={(event) => onZoneChange(event.target.value || null)} disabled={disabled}>
              <option value="">Choose a zone…</option>
              {zones.map((assessment) => (
                <option key={assessment.zone.id} value={assessment.zone.id}>
                  {assessment.zone.name} — {humanize(assessment.effectiveRisk)} risk{assessment.status === 'under-patrolled' ? ' · under-patrolled' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Select ranger team" required>
          {(props) => (
            <Select {...props} value={selectedTeamId ?? ''} onChange={(event) => onTeamChange(event.target.value || null)} disabled={disabled}>
              <option value="">Choose a team…</option>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.teams.map((entry) => (
                    <option key={entry.id} value={entry.id} disabled={group.disabled}>
                      {entry.name}
                      {entry.currentAssignment?.zone?.name ? ` (in ${entry.currentAssignment.zone.name})` : ''}
                      {group.disabled ? ` — ${humanize(entry.status)}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>

        <Field label={mode === ALLOCATION_MODE.REASSIGN ? 'Reason for reassignment' : 'Additional notes (optional)'} required={mode === ALLOCATION_MODE.REASSIGN}>
          {(props) =>
            mode === ALLOCATION_MODE.REASSIGN ? (
              <Input {...props} value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Why move this team? (min. 5 characters)" disabled={disabled} />
            ) : (
              <Input {...props} value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Type here…" disabled={disabled} maxLength={500} />
            )
          }
        </Field>

        <Button type="submit" size="lg" icon={Send} disabled={!canConfirm} className="w-full lg:w-auto">
          Confirm Assignment
        </Button>
      </form>

      <AnimatePresence>
        {(impact || availability.none || availability.available === 0 || sameZone) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 grid gap-2">
              {availability.none ? (
                <Notice tone="red">No ranger teams are available or can be reassigned. Arrange cover by radio, or wait for a team to finish its patrol.</Notice>
              ) : (
                availability.available === 0 && (
                  <Notice tone="amber">
                    No unassigned ranger team is available. Choose a team that is on patrol in a lower-priority zone to reassign it.
                  </Notice>
                )
              )}
              {sameZone && <Notice tone="amber">{team.name} is already patrolling this zone.</Notice>}
              {impact && !sameZone && (
                <Notice tone={impact.isPriorityDowngrade ? 'red' : 'sky'}>
                  {team.name} will leave <strong>{impact.fromZone?.name}</strong> ({humanize(impact.fromRisk ?? 'unknown')} risk)
                  {impact.leavesZoneUncovered ? ', leaving it with no assigned team.' : '.'}
                  {impact.isPriorityDowngrade && ' That zone currently ranks equal to or higher than the selected zone — you will be asked to confirm an override.'}
                </Notice>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function Notice({ tone, children }) {
  const tones = {
    red: 'border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-200',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    sky: 'border-sky-400/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  }
  return (
    <p className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${tones[tone]}`}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
