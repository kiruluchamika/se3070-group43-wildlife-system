import { ShieldAlert } from 'lucide-react'
import { motion } from 'motion/react'

/** Error next to the action that failed. States that nothing was saved, so the user knows the old state stands. */
export function InlineError({ error, unchanged = true }) {
  if (!error) return null
  return (
    <motion.p
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {error.message}
        {unchanged && error.status !== 400 ? ' No changes were saved.' : ''}
      </span>
    </motion.p>
  )
}
