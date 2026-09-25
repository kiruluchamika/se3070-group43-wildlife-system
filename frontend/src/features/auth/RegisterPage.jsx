import { ArrowRight, Info } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useAuth } from '../../context/auth-context'

const INITIAL_FORM = { name: '', email: '', phone: '', password: '' }

/** Public registration creates Villager accounts only; staff accounts are issued by the park. */
export default function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    try {
      const user = await register({ ...form, phone: form.phone || undefined })
      toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}!`)
    } catch (error) {
      const fieldErrors = Object.fromEntries((error.details ?? []).map((detail) => [detail.field, detail.message]))
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: error.message })
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-fg">Create a villager account</h2>
      <p className="mt-1 text-sm text-muted">Report elephant sightings and crop damage near your village.</p>

      <p className="mt-4 flex gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-200">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        Rangers, managers, liaison officers and analysts receive their accounts from the Department of Wildlife Conservation.
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
        <Field label="Full name" required error={errors.name}>
          {(props) => <Input {...props} autoComplete="name" value={form.name} onChange={update('name')} placeholder="Sunil Bandara" />}
        </Field>
        <Field label="Email address" required error={errors.email}>
          {(props) => <Input {...props} type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@example.com" />}
        </Field>
        <Field label="Phone number" hint="Optional — lets a liaison officer call you back." error={errors.phone}>
          {(props) => <Input {...props} type="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} placeholder="+94 71 555 0101" />}
        </Field>
        <Field label="Password" required hint="At least 8 characters." error={errors.password}>
          {(props) => <Input {...props} type="password" autoComplete="new-password" value={form.password} onChange={update('password')} />}
        </Field>

        {errors.form && (
          <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {errors.form}
          </p>
        )}

        <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
          Create account <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
          Sign in
        </Link>
      </p>
    </div>
  )
}
