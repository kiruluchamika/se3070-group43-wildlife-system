import { LogOut } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router'
import { useAuth } from '../../context/auth-context'
import { cn } from '../../lib/cn'
import { initialsOf } from '../../lib/format'
import { navItemsFor, ROLE_LABELS } from '../../lib/navigation'
import { Logo } from '../ui/Logo'

export function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const items = navItemsFor(user.role)

  return (
    <nav className="flex h-full flex-col gap-6 p-4" aria-label="Main navigation">
      <div className="px-2 pt-2">
        <Logo />
      </div>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive ? 'text-fg' : 'text-muted hover:bg-elevated/60 hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-xl border border-brand-400/30 bg-linear-to-r from-brand-500/20 to-accent-500/5"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <item.icon
                    className={cn('relative size-[18px] transition-transform group-hover:scale-110', isActive && 'text-brand-500 dark:text-brand-300')}
                    aria-hidden="true"
                  />
                  <span className="relative truncate">{item.label}</span>
                  {!item.ready && (
                    <span className="relative ml-auto rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-subtle">{item.useCase}</span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-line bg-surface-2/70 p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500/30 to-accent-500/20 text-sm font-bold text-brand-700 dark:text-brand-200">
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
            <p className="truncate text-xs text-subtle">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-muted transition hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-300"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Logout
        </button>
      </div>
    </nav>
  )
}
