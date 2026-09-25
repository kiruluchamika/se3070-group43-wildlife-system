import { ArrowLeft, ShieldX } from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/auth-context'
import { ROLE_LABELS } from '../../lib/navigation'

/** UC04 exception flow E4: an unauthorised user tries to open a restricted function. */
export function ForbiddenPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel flex max-w-md flex-col items-center gap-4 px-8 py-10 text-center"
      >
        <motion.span
          initial={{ rotate: -12, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          className="grid size-16 place-items-center rounded-2xl bg-red-500/12 text-red-500 dark:text-red-300"
        >
          <ShieldX className="size-8" aria-hidden="true" />
        </motion.span>
        <div>
          <h1 className="text-xl font-extrabold text-fg">Access denied</h1>
          <p className="mt-2 text-sm text-muted">
            Your role ({ROLE_LABELS[user?.role] ?? 'unknown'}) does not have permission to use this function. Contact your park
            administrator if you believe this is a mistake.
          </p>
        </div>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/')}>
          Back to my dashboard
        </Button>
      </motion.div>
    </div>
  )
}
