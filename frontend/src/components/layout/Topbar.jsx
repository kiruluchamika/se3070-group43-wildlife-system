import { CalendarDays, Menu, Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTheme } from '../../context/theme-context'
import { useNow } from '../../hooks/useNow'
import { formatLongDate } from '../../lib/format'
import { NotificationBell } from './NotificationBell'

export function Topbar({ onOpenMenu }) {
  const { theme, toggleTheme } = useTheme()
  const now = useNow(60000)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line text-muted lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        <p className="hidden font-mono text-[11px] font-semibold tracking-[0.2em] text-brand-600 uppercase md:block dark:text-brand-300">
          Protect wildlife • Preserve our future
        </p>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-3 py-2 text-xs font-semibold text-muted sm:flex">
            <CalendarDays className="size-4 text-brand-500 dark:text-brand-300" aria-hidden="true" />
            Today, {formatLongDate(now)}
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid size-10 cursor-pointer place-items-center overflow-hidden rounded-xl border border-line bg-surface-2/70 text-muted transition hover:text-fg"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.25 }}
              >
                {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
