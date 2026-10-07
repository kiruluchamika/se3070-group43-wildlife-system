import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { api } from '../../lib/api'
import { ROLE_LABELS } from '../../lib/navigation'

const messageFor = (error) => error.status && error.status < 500 ? error.message : 'Unable to save the user. Please retry.'

export function UserEditor({ user, parks, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', role: user?.role ?? 'villager', park: user?.park ?? '', password: '' }))
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }))
  async function save(event) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(null); setFields({})
    try {
      const { password, ...values } = form
      const body = { ...values, name: values.name.trim(), email: values.email.trim(), park: values.park || null }
      if (user) await api.patch(`/users/${encodeURIComponent(user.id)}`, body)
      else await api.post('/users', { ...body, password })
      onSaved(user ? 'User updated.' : 'User created.')
    } catch (failure) {
      setError(messageFor(failure))
      setFields(Object.fromEntries((failure.details ?? []).map((item) => [item.field, item.message])))
    } finally { inFlight.current = false; setBusy(false) }
  }
  return <Modal open onClose={onClose} dismissible={!busy} title={user ? 'Edit User' : 'Create User'} size="lg">
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" required error={fields.name}>{(props) => <Input {...props} required minLength={2} maxLength={80} value={form.name} onChange={set('name')} disabled={busy} />}</Field>
      <Field label="Email" required error={fields.email}>{(props) => <Input {...props} required type="email" value={form.email} onChange={set('email')} disabled={busy} />}</Field>
      <Field label="Role" required error={fields.role}>{(props) => <Select {...props} value={form.role} onChange={set('role')} disabled={busy || user?.id === currentUserId || Boolean(user?.team)}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}</Field>
      <Field label="Park" error={fields.park}>{(props) => <Select {...props} value={form.park} onChange={set('park')} disabled={busy || Boolean(user?.team)}><option value="">No assigned park</option>{parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}</Select>}</Field>
      <Field label="Phone" error={fields.phone}>{(props) => <Input {...props} maxLength={20} value={form.phone} onChange={set('phone')} disabled={busy} />}</Field>
      {!user && <Field label="Initial password" required error={fields.password} hint="8–128 characters. Share securely with the account holder.">{(props) => <Input {...props} type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.password} onChange={set('password')} disabled={busy} />}</Field>}
      {user?.team && <p className="text-xs text-muted sm:col-span-2">Role and park are retained because this user belongs to a ranger team.</p>}
      {error && <p role="alert" className="text-sm text-red-500 dark:text-red-300 sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4 sm:col-span-2"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{user ? 'Save Changes' : 'Create User'}</Button></div>
    </form>
  </Modal>
}

export function UserStatusDialog({ user, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)
  const active = user.isActive !== false
  const action = active ? 'Deactivate' : 'Activate'
  async function confirm() {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(null)
    try {
      await api.patch(`/users/${encodeURIComponent(user.id)}/status`, { isActive: !active })
      onSaved(active ? 'User deactivated. Existing sessions are disabled.' : 'User activated. They can sign in again.')
    } catch (failure) { setError(messageFor(failure)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <Modal open onClose={onClose} dismissible={!busy} title={`${action} User`} tone={active ? 'danger' : 'brand'}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant={active ? 'danger' : 'primary'} loading={busy} onClick={confirm}>{action}</Button></>}>
    <p className="break-words text-sm text-fg">{action} {user.name} ({user.email})?</p>
    <p className="mt-2 text-sm text-muted">{active ? 'This account will be deactivated and will no longer be able to access the system, including from existing sessions. Their records will be retained.' : 'This restores sign-in access. Previously revoked sessions remain invalid.'}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-500 dark:text-red-300">{error}</p>}
  </Modal>
}
