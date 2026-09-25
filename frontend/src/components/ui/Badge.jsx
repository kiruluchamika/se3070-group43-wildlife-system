import { cn } from '../../lib/cn'

const TONES = {
  neutral: 'bg-slate-500/12 text-slate-600 ring-slate-500/25 dark:text-slate-300',
  brand: 'bg-brand-500/12 text-brand-700 ring-brand-500/30 dark:text-brand-300',
  green: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  amber: 'bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  red: 'bg-red-500/12 text-red-700 ring-red-500/30 dark:text-red-300',
  sky: 'bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  violet: 'bg-violet-500/12 text-violet-700 ring-violet-500/30 dark:text-violet-300',
}

/** Status pill. Always pairs colour with an icon or text so meaning never relies on colour alone. */
export function Badge({ tone = 'neutral', icon: Icon, pulse = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  )
}
