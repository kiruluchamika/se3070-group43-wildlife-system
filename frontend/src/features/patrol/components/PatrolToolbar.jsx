import { RefreshCw, Trees } from 'lucide-react'
import { motion } from 'motion/react'
import { Select } from '../../../components/ui/Field'
import { formatRelativeTime } from '../../../lib/format'

/** Park selector plus the "last updated" indicator and manual refresh (real-time freshness). */
export function PatrolToolbar({ parks, parkId, onParkChange, updatedAt, refreshing, onRefresh, now }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52">
        <Trees className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-brand-500 dark:text-brand-300" aria-hidden="true" />
        <Select aria-label="Select park" value={parkId ?? ''} onChange={(event) => onParkChange(event.target.value)} className="pl-10 font-semibold">
          {parks.map((park) => (
            <option key={park.id} value={park.id}>
              {park.name}
            </option>
          ))}
        </Select>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3.5 text-xs font-semibold text-muted transition hover:text-fg"
        title="Refresh now (updates automatically every 30 seconds)"
      >
        <motion.span animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={refreshing ? { repeat: Infinity, duration: 0.9, ease: 'linear' } : { duration: 0 }}>
          <RefreshCw className="size-4" aria-hidden="true" />
        </motion.span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          {updatedAt ? `Updated ${formatRelativeTime(updatedAt, now)}` : 'Loading…'}
        </span>
      </button>
    </div>
  )
}
