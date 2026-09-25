import { CheckCircle2, Clock, Flag, MapPin, Siren, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { Modal } from '../../../components/ui/Modal'
import { PageHeader } from '../../../components/ui/PageHeader'
import { TeamStatusBadge } from '../../../components/ui/StatusBadges'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { formatRelativeTime, humanize, initialsOf } from '../../../lib/format'
import { riseIn, stagger } from '../../../lib/motion'
import { patrolApi, patrolPaths } from '../api/patrolApi'
import { PatrolToolbar } from '../components/PatrolToolbar'
import { useSelectedPark } from '../hooks/useSelectedPark'

function TeamCard({ team, now, onComplete }) {
  const assignment = team.currentAssignment

  return (
    <motion.article variants={riseIn} whileHover={{ y: -3 }} className="panel flex flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-brand-500/25 to-accent-500/10 text-lg font-extrabold text-brand-600 dark:text-brand-300">
            {team.name.replace('Team ', '').charAt(0)}
          </span>
          <div>
            <h2 className="font-bold text-fg">{team.name}</h2>
            <p className="flex items-center gap-1 text-xs text-muted">
              <MapPin className="size-3" aria-hidden="true" /> {team.baseLocationName}
            </p>
          </div>
        </div>
        <TeamStatusBadge status={team.status} />
      </header>

      {assignment ? (
        <div className="rounded-xl border border-line bg-surface-2/60 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            {assignment.allocationType === 'emergency' ? <Siren className="size-4 text-red-400" aria-hidden="true" /> : <Flag className="size-4 text-brand-400" aria-hidden="true" />}
            {humanize(assignment.allocationType)} · {assignment.zone?.name}
          </p>
          {assignment.alert?.title && <p className="mt-1 text-xs text-red-500 dark:text-red-300">Responding to: {assignment.alert.title}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Clock className="size-3" aria-hidden="true" /> since {formatRelativeTime(assignment.assignedAt, now)}
            </span>
            {assignment.acknowledgedAt ? (
              <Badge tone="green" icon={CheckCircle2}>
                Acknowledged
              </Badge>
            ) : (
              <Badge tone="amber" pulse>
                Awaiting acknowledgement
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">No active assignment.</p>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Members ({team.members?.length ?? 0})</p>
        <ul className="flex flex-wrap gap-2">
          {(team.members ?? []).map((member) => (
            <li key={member.id} className="flex items-center gap-2 rounded-full bg-elevated py-1 pr-3 pl-1 text-xs font-medium text-fg">
              <span className="grid size-6 place-items-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-700 dark:text-brand-200">{initialsOf(member.name)}</span>
              {member.name}
            </li>
          ))}
        </ul>
      </div>

      {assignment && (
        <Button variant="secondary" size="sm" icon={CheckCircle2} onClick={() => onComplete(team)} className="mt-auto self-start">
          Mark patrol complete
        </Button>
      )}
    </motion.article>
  )
}

/** Ranger team overview. Completing a patrol records it (so coverage updates) and frees the team. */
export default function RangerTeamsPage() {
  const now = useNow()
  const { parks, parkId, selectPark } = useSelectedPark()
  const teams = useApiQuery(parkId ? patrolPaths.teams(parkId) : null, { refreshMs: 30000 })
  const [completing, setCompleting] = useState(null)
  const [saving, setSaving] = useState(false)

  async function completePatrol() {
    setSaving(true)
    try {
      await patrolApi.complete(completing.currentAssignment.id)
      toast.success(`${completing.name} is available again. The patrol was recorded.`)
      setCompleting(null)
      teams.reload()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="UC04 · Park Manager"
        title="Ranger Teams"
        description="Team availability, current deployments and acknowledgement status."
        actions={<PatrolToolbar parks={parks} parkId={parkId} onParkChange={selectPark} updatedAt={teams.updatedAt} refreshing={teams.refreshing} onRefresh={teams.reload} now={now} />}
      />

      {teams.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-72" />
          ))}
        </div>
      ) : teams.error ? (
        <div className="panel">
          <ErrorState title="Teams unavailable" message={teams.error.message} onRetry={teams.reload} />
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.data.teams.map((team) => (
            <TeamCard key={team.id} team={team} now={now} onComplete={setCompleting} />
          ))}
        </motion.div>
      )}

      <Modal
        open={Boolean(completing)}
        onClose={saving ? undefined : () => setCompleting(null)}
        icon={Users}
        title={`Complete ${completing?.name ?? ''}'s patrol?`}
        description={`The patrol in ${completing?.currentAssignment?.zone?.name ?? 'the zone'} will be recorded for coverage, and the team will become available.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={completePatrol} loading={saving} icon={CheckCircle2}>
              Complete patrol
            </Button>
          </>
        }
      />
    </>
  )
}
