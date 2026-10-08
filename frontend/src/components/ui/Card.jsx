import { motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { riseIn } from '../../lib/motion'

export function Card({ title, icon: Icon, actions, children, className, bodyClassName, as = 'section', ...props }) {
  const Component = motion[as] ?? motion.section

  return (
    <Component variants={riseIn} className={cn('panel flex min-w-0 flex-col', className)} {...props}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="flex min-w-0 items-center gap-2.5 text-sm font-bold tracking-wide text-fg">
            {Icon && (
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-500 dark:text-brand-300">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            )}
            <span className="truncate">{title}</span>
          </h2>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 p-5', bodyClassName)}>{children}</div>
    </Component>
  )
}
