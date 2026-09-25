import { useEffect, useState } from 'react'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'ranger' })
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('wildlife-token')
    if (!token) return

    fetch(`${apiBaseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result) => setUser(result.user))
      .catch(() => localStorage.removeItem('wildlife-token'))
  }, [])

  async function submitForm(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const endpoint = mode === 'login' ? 'login' : 'register'
      const response = await fetch(`${apiBaseUrl}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message)

      localStorage.setItem('wildlife-token', result.token)
      setUser(result.user)
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    localStorage.removeItem('wildlife-token')
    setUser(null)
    setForm({ name: '', email: '', password: '', role: 'ranger' })
  }

  if (user) {
    return (
      <main className="dashboard-shell">
        <nav className="topbar"><span className="brand-mark">W</span><strong>Wildlife field system</strong><button className="quiet-button" onClick={signOut}>Sign out</button></nav>
        <section className="dashboard-content">
          <p className="eyebrow">USER MANAGEMENT / ACTIVE SESSION</p>
          <h1>Welcome, {user.name.split(' ')[0]}.</h1>
          <p className="lead">Your account is ready for the wildlife conservation workspace.</p>
          <div className="profile-panel">
            <div><span className="label">Account name</span><strong>{user.name}</strong></div>
            <div><span className="label">Email address</span><strong>{user.email}</strong></div>
            <div><span className="label">Assigned role</span><strong className="role-pill">{user.role}</strong></div>
          </div>
          <p className="coming-soon">Other modules will appear here as the team integrates them.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <section className="intro-panel"><span className="brand-mark">W</span><p className="eyebrow">SE3070 / GROUP 43</p><h1>Protecting wild places, one report at a time.</h1><p>Shared tools for the people who watch over Sri Lanka's wildlife.</p></section>
      <section className="auth-panel"><div className="auth-heading"><p className="eyebrow">USER MANAGEMENT</p><h2>{mode === 'login' ? 'Sign in to continue' : 'Create your field account'}</h2><p>{mode === 'login' ? 'Use your registered account to access the workspace.' : 'Start with an account for your assigned team role.'}</p></div>
        <form onSubmit={submitForm}>
          {mode === 'register' && <label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
          <label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {mode === 'register' && <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="ranger">Ranger</option><option value="villager">Villager</option><option value="liaison-officer">Liaison officer</option><option value="park-manager">Park manager</option><option value="data-analyst">Data analyst</option></select></label>}
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" disabled={loading}>{loading ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="switch-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}</button>
      </section>
    </main>
  )
}

export default App
