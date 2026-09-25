import { BellOff } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { cn } from '../../../lib/cn'
import { patrolApi, patrolPaths } from '../api/patrolApi'
import { AlertItem } from '../components/ActiveAlertsPanel'
import { EmergencyDispatchDialog } from '../components/EmergencyDispatchDialog'
import { PatrolToolbar } from '../components/PatrolToolbar'
import { useSelectedPark } from '../hooks/useSelectedPark'

const STATUS_FILTERS = [
  { key: 'open', label: 'Unresolved' },
  { key: 'active', label: 'New' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]
const SEVERITIES = ['critical', 'high', 'medium', 'low']

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition',
        active ? 'border-brand-400/60 bg-brand-500/15 text-brand-700 dark:text-brand-200' : 'border-line text-muted hover:border-line-strong hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

/** UC04 "View Active Alerts" as a full page with filtering, acknowledgement and dispatch. */
export default function AlertsPage() {
  const now = useNow()
  const { parks, parkId, selectPark } = useSelectedPark()
  const [status, setStatus] = useState('open')
  const [severities, setSeverities] = useState([])
  const [dispatchAlert, setDispatchAlert] = useState(null)
  const alerts = useApiQuery(parkId ? patrolPaths.alerts(parkId, status) : null, { refreshMs: 30000 })

  const list = (alerts.data?.alerts ?? []).filter((alert) => severities.length === 0 || severities.includes(alert.severity))
  const toggleSeverity = (severity) =>
    setSeverities((current) => (current.includes(severity) ? current.filter((entry) => entry !== severity) : [...current, severity]))

  async function acknowledge(alert) {
    try {
      await patrolApi.acknowledgeAlert(alert.id)
      toast.success(`${alert.title} acknowledged`)
      alerts.reload()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="UC04 · Park Manager"
        title="Alerts"
        description="Alerts from ranger incidents, GPS collars and camera traps. Acknowledge them, or dispatch a team to high and critical alerts."
        actions={<PatrolToolbar parks={parks} parkId={parkId} onParkChange={selectPark} updatedAt={alerts.updatedAt} refreshing={alerts.refreshing} onRefresh={alerts.reload} now={now} />}
      />

      <div className="panel mb-6 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <FilterChip key={filter.key} active={status === filter.key} onClick={() => setStatus(filter.key)}>
              {filter.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SEVERITIES.map((severity) => (
            <FilterChip key={severity} active={severities.includes(severity)} onClick={() => toggleSeverity(severity)}>
              {severity}
            </FilterChip>
          ))}
        </div>
      </div>

      {alerts.loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-36" />
          ))}
        </div>
      ) : alerts.error ? (
        <div className="panel">
          <ErrorState title="Alerts unavailable" message={alerts.error.message} onRetry={alerts.reload} />
        </div>
      ) : list.length === 0 ? (
        <div className="panel">
          <EmptyState icon={BellOff} tone="green" title="No alerts match these filters" description="There are currently no alerts in this category." />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {list.map((alert) => (
              <AlertItem key={alert.id} alert={alert} now={now} detailed onDispatch={setDispatchAlert} onAcknowledge={acknowledge} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <EmergencyDispatchDialog key={dispatchAlert?.id} alert={dispatchAlert} onClose={() => setDispatchAlert(null)} onDispatched={() => alerts.reload()} />
    </>
  )
}
