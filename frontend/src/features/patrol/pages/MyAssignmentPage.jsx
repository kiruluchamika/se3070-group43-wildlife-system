import 'leaflet/dist/leaflet.css'
import { CheckCircle2, ClipboardList, Clock, MapPinned, Siren, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { MapContainer, Polygon, TileLayer } from 'react-leaflet'
import { toast } from 'sonner'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { RiskBadge, TeamStatusBadge } from '../../../components/ui/StatusBadges'
import { useTheme } from '../../../context/theme-context'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { formatRelativeTime, humanize } from '../../../lib/format'
import { patrolApi, patrolPaths } from '../api/patrolApi'
import { boundsOf, toLatLngs } from '../lib/mapIcons'

function ZoneMiniMap({ zone }) {
  const { theme } = useTheme()
  const bounds = boundsOf([{ zone }])

  return (
    <div className="relative isolate h-56 overflow-hidden rounded-2xl border border-line">
      <MapContainer bounds={bounds} boundsOptions={{ padding: [16, 16] }} zoomControl={false} scrollWheelZoom={false} className="size-full">
        <TileLayer url={`https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`} attribution="&copy; OpenStreetMap &copy; CARTO" />
        <Polygon positions={toLatLngs(zone.boundary)} pathOptions={{ color: '#2dd4bf', weight: 3, fillOpacity: 0.25 }} />
      </MapContainer>
    </div>
  )
}

/**
 * Ranger view (UC04 supporting actor). Mobile-first: the ranger sees the team's
 * assignment and acknowledges it, which closes Group 41's missing feedback loop.
 */
export default function MyAssignmentPage() {
  const now = useNow()
  const { data, loading, error, reload } = useApiQuery(patrolPaths.myAssignment(), { refreshMs: 30000 })
  const [acknowledging, setAcknowledging] = useState(false)
  const assignment = data?.assignment
  const emergency = assignment?.allocationType === 'emergency'

  async function acknowledge() {
    setAcknowledging(true)
    try {
      await patrolApi.acknowledgeAssignment(assignment.id)
      toast.success('Assignment acknowledged. Stay safe out there!')
      reload()
    } catch (acknowledgeError) {
      toast.error(acknowledgeError.message)
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="UC04 · Ranger" title="My Assignment" description="Your team's current patrol deployment." />

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-72" />
        </div>
      ) : error ? (
        <div className="panel">
          <ErrorState title="Assignment unavailable" message={error.message} onRetry={reload} />
        </div>
      ) : !data.team ? (
        <div className="panel">
          <EmptyState icon={UserRound} title="You are not in a ranger team" description="Ask your park manager to add you to a team." />
        </div>
      ) : (
        <div className="grid gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Your team</p>
              <p className="text-lg font-bold text-fg">{data.team.name}</p>
              <p className="text-xs text-muted">{data.team.members?.map((member) => member.name).join(' · ')}</p>
            </div>
            <TeamStatusBadge status={data.team.status} />
          </motion.div>

          {!assignment ? (
            <div className="panel">
              <EmptyState icon={ClipboardList} title="No active assignment" description="Your team is not deployed right now. New assignments appear here and in your notifications." />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="panel overflow-hidden">
              {emergency && (
                <div className="flex items-center gap-2 bg-linear-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold tracking-wide text-white uppercase">
                  <Siren className="size-5 animate-pulse" aria-hidden="true" /> Emergency dispatch — respond immediately
                </div>
              )}
              <div className="grid gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-subtle uppercase">{humanize(assignment.allocationType)}</p>
                    <h2 className="flex items-center gap-2 text-2xl font-extrabold text-fg">
                      <MapPinned className="size-6 text-brand-500 dark:text-brand-300" aria-hidden="true" />
                      {assignment.zone?.name}
                    </h2>
                    {assignment.zone?.description && <p className="mt-1 text-sm text-muted">{assignment.zone.description}</p>}
                  </div>
                  <RiskBadge level={assignment.zone?.riskLevel} />
                </div>

                {assignment.zone?.boundary && <ZoneMiniMap zone={assignment.zone} />}

                {assignment.alert && (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3">
                    <p className="font-semibold text-red-700 dark:text-red-200">{assignment.alert.title}</p>
                    <p className="mt-1 text-sm text-red-700/80 dark:text-red-200/80">{assignment.alert.message}</p>
                  </div>
                )}

                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface-2/70 p-3">
                    <dt className="text-xs text-subtle">Assigned by</dt>
                    <dd className="font-semibold text-fg">{assignment.assignedBy?.name}</dd>
                  </div>
                  <div className="rounded-xl bg-surface-2/70 p-3">
                    <dt className="flex items-center gap-1 text-xs text-subtle">
                      <Clock className="size-3" aria-hidden="true" /> Assigned
                    </dt>
                    <dd className="font-semibold text-fg">{formatRelativeTime(assignment.assignedAt, now)}</dd>
                  </div>
                </dl>

                {(assignment.notes || assignment.reason) && (
                  <p className="rounded-xl border border-line bg-surface-2/50 p-3 text-sm text-muted">
                    <span className="font-semibold text-fg">Instructions: </span>
                    {assignment.reason || assignment.notes}
                  </p>
                )}

                {assignment.acknowledgedAt ? (
                  <Badge tone="green" icon={CheckCircle2} className="justify-center py-2 text-sm">
                    Acknowledged {formatRelativeTime(assignment.acknowledgedAt, now)}
                  </Badge>
                ) : (
                  <Button size="lg" variant={emergency ? 'danger' : 'primary'} icon={CheckCircle2} loading={acknowledging} onClick={acknowledge} className="w-full">
                    Acknowledge &amp; start patrol
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
