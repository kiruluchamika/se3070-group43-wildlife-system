import { motion } from 'motion/react'
import { LogoMark } from '../ui/Logo'

export function FullScreenLoader({ label = 'Preparing your workspace…' }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <div className="flex flex-col items-center gap-5">
        <span className="relative grid place-items-center">
          <span className="absolute size-16 animate-pulse-ring rounded-2xl bg-brand-400/40" />
          <motion.span animate={{ rotate: [0, 6, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}>
            <LogoMark className="size-14" />
          </motion.span>
        </span>
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50dvh] place-items-center" role="status">
      <span className="size-10 animate-spin rounded-full border-2 border-brand-400/25 border-t-brand-400" aria-label="Loading page" />
    </div>
  )
}
