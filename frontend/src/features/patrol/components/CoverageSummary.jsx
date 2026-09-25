import { Gauge, MapPinned, ShieldAlert, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { AnimatedNumber, ProgressBar } from '../../../components/ui/Animated'
import { Skeleton } from '../../../components/ui/Feedback'
import { cn } from '../../../lib/cn'
import { riseIn, stagger } from '../../../lib/motion'

function StatCard({ icon: Icon, label, value, suffix, hint, tone, children }) {
  const tones = {
    brand: 'from-brand-500/25 to-accent-500/10 text-brand-600 dark:text-brand-300',
    red: 'from-red-500/25 to-orange-500/10 text-red-600 dark:text-red-300',
    amber: 'from-amber-500/25 to-yellow-500/10 text-amber-600 dark:text-amber-300',
    green: 'from-emerald-500/25 to-brand-500/10 text-emerald-600 dark:text-emerald-300',
  }

  return (
    <motion.div variants={riseIn} whileHover={{ y: -3 }} className="panel relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
          <p className="mt-1.5 text-3xl font-extrabold text-fg">
            <AnimatedNumber value={value} suffix={suffix} />
          </p>
        </div>
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br', tones[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      {children ?? <p className="mt-2 text-xs text-subtle">{hint}</p>}
    </motion.div>
  )
}

/** KPI strip above the map (an enhancement to Group 41's wireframe). */
export function CoverageSummary({ summary, loading }) {
  if (loading || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-[118px] rounded-[1.25rem]" />
        ))}
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Gauge} label="Park coverage" value={summary.overallCoverage} suffix="%" tone="brand">
        <ProgressBar value={summary.overallCoverage} className="mt-3" label="Overall patrol coverage" />
      </StatCard>
      <StatCard
        icon={MapPinned}
        label="Under-patrolled zones"
        value={summary.underPatrolledZones}
        hint={`${summary.coveredZones} of ${summary.zoneCount} zones have a team deployed`}
        tone={summary.underPatrolledZones ? 'red' : 'green'}
      />
      <StatCard
        icon={ShieldAlert}
        label="Active alerts"
        value={summary.activeAlerts}
        hint={summary.criticalAlerts ? `${summary.criticalAlerts} critical — dispatch may be required` : 'No critical alerts'}
        tone={summary.criticalAlerts ? 'red' : 'amber'}
      />
      <StatCard
        icon={Users}
        label="Available teams"
        value={summary.availableTeams}
        hint={`${summary.totalTeams} ranger teams in this park`}
        tone={summary.availableTeams ? 'green' : 'amber'}
      />
    </motion.div>
  )
}
