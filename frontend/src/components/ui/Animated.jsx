import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { cn } from '../../lib/cn'

/** Counts up to `value` whenever it changes. */
export function AnimatedNumber({ value = 0, suffix = '', className }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => `${Math.round(latest)}${suffix}`)

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [count, value])

  return <motion.span className={cn('tabular-nums', className)}>{rounded}</motion.span>
}

const toneFor = (value) => (value >= 75 ? 'from-emerald-400 to-brand-400' : value >= 50 ? 'from-amber-400 to-yellow-300' : 'from-red-500 to-orange-400')

/** Horizontal bar that grows to `value` percent; colour follows the coverage level. */
export function ProgressBar({ value = 0, className, label }) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-elevated', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        className={cn('h-full rounded-full bg-linear-to-r', toneFor(clamped))}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

/** Circle and tick drawn in sequence; used for success confirmations. */
export function SuccessCheck({ className }) {
  return (
    <motion.svg viewBox="0 0 52 52" className={cn('size-20', className)} initial="hidden" animate="visible" aria-hidden="true">
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } } }}
      />
      <motion.path
        d="M15 27 l7 7 l15 -16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1, transition: { delay: 0.45, duration: 0.4, ease: 'easeOut' } } }}
      />
    </motion.svg>
  )
}
