import { Bell, BellRing, CheckCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useNow } from '../../hooks/useNow'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatRelativeTime } from '../../lib/format'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const now = useNow()
  const { data, reload } = useApiQuery('/notifications/me', { refreshMs: 45000 })
  const notifications = data?.notifications ?? []
  const unread = data?.unreadCount ?? 0

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function openNotification(notification) {
    setOpen(false)
    if (!notification.readAt) await api.patch(`/notifications/${notification.id}/read`).catch(() => null)
    reload()
    if (notification.link) navigate(notification.link)
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all').catch(() => null)
    reload()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 cursor-pointer place-items-center rounded-xl border border-line bg-surface-2/70 text-muted transition hover:text-fg"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        {unread ? <BellRing className="size-[18px] text-brand-500 dark:text-brand-300" /> : <Bell className="size-[18px]" />}
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-canvas"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="panel absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden bg-canvas/95"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-bold text-fg">Notifications</p>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
                  <CheckCheck className="size-3.5" /> Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You're all caught up.</li>}
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={cn(
                      'flex w-full cursor-pointer gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-elevated/70',
                      !notification.readAt && 'bg-brand-500/5',
                    )}
                  >
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', notification.readAt ? 'bg-transparent' : 'bg-brand-400')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg">{notification.title}</span>
                      {notification.message && <span className="mt-0.5 block text-xs text-muted">{notification.message}</span>}
                      <span className="mt-1 block text-[11px] text-subtle">{formatRelativeTime(notification.createdAt, now)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
