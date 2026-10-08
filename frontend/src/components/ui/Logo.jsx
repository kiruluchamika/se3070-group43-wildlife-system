import { cn } from '../../lib/cn'

/** WildGuard mark: a shield holding a leaf. */
export function LogoMark({ className }) {
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-400 to-accent-500 text-white shadow-glow',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.5 4.5 5.5v6c0 4.8 3.2 8.6 7.5 10 4.3-1.4 7.5-5.2 7.5-10v-6z" />
        <path d="M8.5 14.5c0-3.5 2.6-6 7-6.2-.2 4.4-2.7 7-6.2 7" />
        <path d="M8.5 15.5 12 12" />
      </svg>
    </span>
  )
}

export function Logo({ subtitle = 'Smart Wildlife Conservation', className }) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      <span className="min-w-0 leading-tight">
        <span className="block text-lg font-extrabold tracking-tight text-fg">WildGuard</span>
        <span className="block truncate text-[11px] font-medium text-subtle">{subtitle}</span>
      </span>
    </span>
  )
}
