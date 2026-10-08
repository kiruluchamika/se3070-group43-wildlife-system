import { AlertTriangle, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export function Skeleton({ className }) {
  return <div className={cn('skeleton rounded-xl', className)} aria-hidden="true" />
}

/** Friendly "nothing here" state (for example, UC04 A2: no active alerts). */
export function EmptyState({ icon: Icon, title, description, tone = 'brand', action, className }) {
  const toneClass = {
    brand: 'bg-brand-500/12 text-brand-500 dark:text-brand-300',
    green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
  }[tone]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('flex flex-col items-center justify-center gap-3 px-4 py-8 text-center', className)}
    >
      {Icon && (
        <span className={cn('grid size-12 place-items-center rounded-2xl', toneClass)}>
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <div>
        <p className="font-semibold text-fg">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </motion.div>
  )
}

/** Failure state with a retry action (for example, UC04 E1: patrol data unavailable). */
export function ErrorState({ title = 'Something went wrong', message, onRetry, className }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 px-4 py-8 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-red-500/12 text-red-500 dark:text-red-300">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-fg">{title}</p>
        {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
