import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

/** Accessible dialog with a blurred backdrop, spring entrance and Escape to close. */
export function Modal({ open, onClose, title, description, icon: Icon, tone = 'brand', size = 'md', children, footer, dismissible = true }) {
  const titleId = useId()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && dismissible) onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    const frame = requestAnimationFrame(() => panelRef.current?.focus())

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(frame)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose, dismissible])

  const iconTone = {
    brand: 'bg-brand-500/15 text-brand-500 dark:text-brand-300',
    danger: 'bg-red-500/15 text-red-500 dark:text-red-300',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  }[tone]

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={cn('panel relative max-h-[90dvh] w-full overflow-y-auto bg-canvas/95 outline-none', SIZES[size])}
          >
            <div className="flex items-start gap-4 px-6 pt-6">
              {Icon && (
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', iconTone)}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-lg font-bold text-fg">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-8 cursor-pointer place-items-center rounded-lg text-subtle transition hover:bg-elevated hover:text-fg"
                  aria-label="Close dialog"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
