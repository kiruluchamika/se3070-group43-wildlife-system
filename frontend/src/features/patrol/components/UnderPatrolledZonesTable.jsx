import { Check, ShieldCheck, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { ProgressBar } from '../../../components/ui/Animated'
import { Card } from '../../../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { RiskBadge } from '../../../components/ui/StatusBadges'
import { cn } from '../../../lib/cn'
import { formatHoursAgo } from '../../../lib/format'
import { CoverageStatusBadge } from './CoverageStatusBadge'

function SelectButton({ selected, onClick, zoneName }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Select ${zoneName}`}
      className={cn(
        'inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-3 text-xs font-bold transition',
        selected ? 'bg-brand-500 text-white shadow-glow' : 'border border-brand-400/40 text-brand-600 hover:bg-brand-500/10 dark:text-brand-300',
      )}
    >
      {selected && <Check className="size-3.5" aria-hidden="true" />}
      {selected ? 'Selected' : 'Select'}
    </motion.button>
  )
}

/**
 * Under-Patrolled Zones table (main flow step 4). "All zones" lets the manager
 * pick any high-priority area; A1 shows that coverage is satisfactory.
 */
export function UnderPatrolledZonesTable({ zones, loading, error, onRetry, selectedZoneId, onSelectZone, className }) {
  const [view, setView] = useState('attention')
  const underPatrolled = zones.filter((assessment) => assessment.status === 'under-patrolled')
  const rows = view === 'attention' ? underPatrolled : zones

  const tabs = [
    { key: 'attention', label: `Needs attention (${underPatrolled.length})` },
    { key: 'all', label: `All zones (${zones.length})` },
  ]

  return (
    <Card
      title="Under-Patrolled Zones"
      icon={TriangleAlert}
      className={className}
      bodyClassName="p-0"
      actions={
        <div className="flex rounded-lg bg-surface-2 p-0.5" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => setView(tab.key)}
              className={cn('relative cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition', view === tab.key ? 'text-fg' : 'text-subtle hover:text-fg')}
            >
              {view === tab.key && <motion.span layoutId="zone-tab" className="absolute inset-0 rounded-md bg-elevated shadow-sm" />}
              <span className="relative">{tab.label}</span>
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="grid gap-2 p-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-12" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Patrol data unavailable" message={`${error.message} Resource allocation is disabled until patrol data can be loaded.`} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          tone="green"
          title="Current patrol coverage is satisfactory"
          description="No zones are under-patrolled right now. Continue monitoring, or open “All zones” to reinforce a specific area."
        />
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-surface-2/70 text-[11px] font-bold tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-5 py-3">Zone</th>
                <th className="px-3 py-3">Risk level</th>
                <th className="px-3 py-3">Coverage</th>
                <th className="px-3 py-3">Last patrolled</th>
                <th className="px-3 py-3">Recommended action</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <motion.tbody initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
              {rows.map((assessment) => {
                const selected = assessment.zone.id === selectedZoneId
                return (
                  <motion.tr
                    key={assessment.zone.id}
                    variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                    className={cn('border-t border-line transition-colors', selected ? 'bg-brand-500/8' : 'hover:bg-elevated/50')}
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-fg">{assessment.zone.name}</p>
                      {view === 'all' ? (
                        <CoverageStatusBadge status={assessment.status} />
                      ) : (
                        <p className="text-xs text-subtle">{assessment.reasons.join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge level={assessment.effectiveRisk} />
                    </td>
                    <td className="w-36 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={assessment.coveragePercent} label={`${assessment.zone.name} coverage`} />
                        <span className="w-9 text-xs font-semibold text-muted tabular-nums">{assessment.coveragePercent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{formatHoursAgo(assessment.hoursSinceLastPatrol)}</td>
                    <td className="px-3 py-3 text-muted">{assessment.recommendedAction}</td>
                    <td className="px-5 py-3 text-right">
                      <SelectButton selected={selected} zoneName={assessment.zone.name} onClick={() => onSelectZone(assessment.zone.id)} />
                    </td>
                  </motion.tr>
                )
              })}
            </motion.tbody>
          </table>

          {/* Mobile cards */}
          <ul className="grid gap-2 p-3 md:hidden">
            {rows.map((assessment) => (
              <li key={assessment.zone.id} className="rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-fg">{assessment.zone.name}</p>
                    <p className="text-xs text-muted">
                      {formatHoursAgo(assessment.hoursSinceLastPatrol)} · {assessment.recommendedAction}
                    </p>
                  </div>
                  <RiskBadge level={assessment.effectiveRisk} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={assessment.coveragePercent} label={`${assessment.zone.name} coverage`} />
                  <SelectButton selected={assessment.zone.id === selectedZoneId} zoneName={assessment.zone.name} onClick={() => onSelectZone(assessment.zone.id)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
