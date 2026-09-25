import { BellOff, CheckCheck, Eye, FlaskConical, Radio, ShieldAlert, Siren } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { AlertStatusBadge, SeverityBadge } from '../../../components/ui/StatusBadges'
import { cn } from '../../../lib/cn'
import { formatRelativeTime, formatTime } from '../../../lib/format'
import { listItem } from '../../../lib/motion'
import { isDispatchable } from '../lib/allocation'

const SEVERITY_STYLE = {
  critical: 'bg-red-500/15 text-red-500 dark:text-red-300',
  high: 'bg-orange-500/15 text-orange-500 dark:text-orange-300',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  low: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
}

export function AlertItem({ alert, now, onView, onDispatch, onAcknowledge, detailed = false }) {
  const critical = alert.severity === 'critical' && alert.status !== 'dispatched'

  return (
    <motion.li
      layout
      {...listItem}
      className={cn('rounded-2xl border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-line-strong', critical && 'animate-glow border-red-400/40')}
    >
      <div className="flex items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', SEVERITY_STYLE[alert.severity])}>
          {alert.severity === 'critical' ? <Siren className="size-5" aria-hidden="true" /> : <ShieldAlert className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold text-fg">{alert.title}</p>
            {alert.status !== 'active' && <AlertStatusBadge status={alert.status} />}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {alert.zone?.name ?? 'Unknown zone'} · {formatTime(alert.createdAt)} ({formatRelativeTime(alert.createdAt, now)})
          </p>
          {detailed && alert.message && <p className="mt-2 text-sm text-muted">{alert.message}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={alert.severity} />
            {alert.simulated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300" title="Simulated sensor input">
                <FlaskConical className="size-3" aria-hidden="true" /> Simulated {alert.source === 'gps-collar' ? 'collar' : 'camera trap'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {onAcknowledge && alert.status === 'active' && (
          <Button variant="ghost" size="sm" icon={CheckCheck} onClick={() => onAcknowledge(alert)}>
            Acknowledge
          </Button>
        )}
        {onView && (
          <Button variant="secondary" size="sm" icon={Eye} onClick={() => onView(alert)}>
            View
          </Button>
        )}
        {onDispatch && isDispatchable(alert) && (
          <Button variant="danger" size="sm" icon={Radio} onClick={() => onDispatch(alert)}>
            Dispatch team
          </Button>
        )}
      </div>
    </motion.li>
  )
}

/** Active Alerts panel from the wireframe; A2 shows the "no active alerts" state. */
export function ActiveAlertsPanel({ alerts, loading, error, onRetry, now, onView, onDispatch, onAcknowledge, className }) {
  return (
    <Card
      title="Active Alerts"
      icon={ShieldAlert}
      className={className}
      bodyClassName="overflow-y-auto p-3"
      actions={
        <Link to="/patrol/alerts" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
          View all
        </Link>
      }
    >
      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Alerts unavailable" message={error.message} onRetry={onRetry} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={BellOff} tone="green" title="There are currently no active alerts" description="Continue monitoring patrol coverage." />
      ) : (
        <ul className="grid gap-2.5">
          <AnimatePresence initial={false}>
            {alerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} now={now} onView={onView} onDispatch={onDispatch} onAcknowledge={onAcknowledge} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}
