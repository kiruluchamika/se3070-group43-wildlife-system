import { Check, MapPin, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { TeamStatusBadge } from '../../../components/ui/StatusBadges'
import { cn } from '../../../lib/cn'
import { formatDistance } from '../../../lib/format'
import { allocationModeFor, ALLOCATION_MODE } from '../lib/allocation'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'on-patrol', label: 'On patrol' },
]

/**
 * Ranger Teams panel. Group 41 titled it "Available Ranger Teams" but listed
 * teams on patrol too, so it is renamed and given status filters.
 */
export function RangerTeamsPanel({ teams, loading, error, onRetry, selectedTeamId, onSelectTeam, zoneSelected, className }) {
  const [filter, setFilter] = useState('all')
  const visible = filter === 'all' ? teams : teams.filter((team) => team.status === filter)

  return (
    <Card
      title="Ranger Teams"
      icon={Users}
      className={className}
      bodyClassName="p-3"
      actions={
        <div className="flex gap-1">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={cn(
                'cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                filter === option.key ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'text-subtle hover:text-fg',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Teams unavailable" message={error.message} onRetry={onRetry} />
      ) : (
        <ul className="grid gap-2">
          {visible.map((team) => {
            const mode = allocationModeFor(team)
            const selectable = mode !== ALLOCATION_MODE.UNAVAILABLE
            const selected = team.id === selectedTeamId

            return (
              <motion.li key={team.id} layout>
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={() => onSelectTeam(team.id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                    selected ? 'border-brand-400/60 bg-brand-500/10 shadow-glow' : 'border-line bg-surface-2/50 hover:border-line-strong',
                    selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-sm font-extrabold text-brand-600 dark:text-brand-300">
                    {selected ? <Check className="size-5" aria-hidden="true" /> : team.name.replace('Team ', '').charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-fg">{team.name}</span>
                      <TeamStatusBadge status={team.status} />
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      {team.currentAssignment?.zone?.name ?? team.baseLocationName}
                      {zoneSelected && team.distanceKm !== null && <span className="text-subtle"> · {formatDistance(team.distanceKm)} away</span>}
                    </span>
                  </span>
                </button>
              </motion.li>
            )
          })}
          {visible.length === 0 && <li className="py-6 text-center text-sm text-muted">No teams match this filter.</li>}
        </ul>
      )}
    </Card>
  )
}
