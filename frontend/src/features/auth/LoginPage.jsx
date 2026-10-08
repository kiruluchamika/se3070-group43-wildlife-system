import { ArrowRight, Eye, EyeOff, FlaskConical, Lock, Mail } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useAuth } from '../../context/auth-context'

/** Seeded development accounts (see backend/src/seed). Not a production feature. */
const DEMO_ACCOUNTS = [
  { label: 'Park Manager', email: 'manager@wildguard.lk' },
  { label: 'Ranger', email: 'ranger@wildguard.lk' },
  { label: 'Liaison Officer', email: 'liaison@wildguard.lk' },
  { label: 'Data Analyst', email: 'analyst@wildguard.lk' },
  { label: 'Villager', email: 'villager@wildguard.lk' },
]
const DEMO_PASSWORD = 'WildGuard@2026'

export default function LoginPage() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function signIn(credentials) {
    setSubmitting(true)
    setError('')
    try {
      const user = await login(credentials)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
    } catch (loginError) {
      setError(loginError.message)
      setSubmitting(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    signIn(form)
  }

  function signInWithDemo(email) {
    setForm({ email, password: DEMO_PASSWORD })
    signIn({ email, password: DEMO_PASSWORD })
  }

  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-fg">Sign in to continue</h2>
      <p className="mt-1 text-sm text-muted">Use your registered WildGuard account.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Email address" required>
          {(props) => (
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
              <Input {...props} type="email" autoComplete="email" required value={form.email} onChange={update('email')} placeholder="you@wildguard.lk" className="pl-10" />
            </div>
          )}
        </Field>

        <Field label="Password" required>
          {(props) => (
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
              <Input
                {...props}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
                className="px-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-subtle hover:text-fg"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>

        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -3, 3, 0] }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
          Sign in <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <div className="mt-6 rounded-2xl border border-dashed border-amber-400/40 bg-amber-400/5 p-4">
        <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-amber-300">
          <FlaskConical className="size-3.5" aria-hidden="true" /> Role sign-in
        </p>
        <p className="mt-1 text-xs text-muted">Use a role shortcut or enter your registered account details above.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <motion.button
              key={account.email}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              disabled={submitting}
              onClick={() => signInWithDemo(account.email)}
              className="cursor-pointer rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-fg transition hover:border-brand-400/60 hover:text-brand-600 disabled:opacity-50 dark:hover:text-brand-300"
            >
              {account.label}
            </motion.button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Live near a park boundary?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
          Create a villager account
        </Link>
      </p>
    </div>
  )
}
