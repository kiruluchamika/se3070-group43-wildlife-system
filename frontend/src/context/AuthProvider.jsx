import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, onUnauthorized } from '../lib/api'
import { sessionStore } from '../lib/storage'
import { AuthContext } from './auth-context'

const initialStatus = () => (sessionStore.getToken() ? 'loading' : 'anonymous')

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({ status: initialStatus(), user: null }))

  const logout = useCallback(() => {
    sessionStore.clear()
    setState({ status: 'anonymous', user: null })
  }, [])

  // Restore the session from the stored token on first load.
  useEffect(() => {
    if (!sessionStore.getToken()) return undefined
    const controller = new AbortController()

    api
      .get('/auth/me', { signal: controller.signal })
      .then(({ user }) => setState({ status: 'authenticated', user }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        sessionStore.clear()
        setState({ status: 'anonymous', user: null })
      })

    return () => controller.abort()
  }, [])

  useEffect(
    () =>
      onUnauthorized(() => {
        logout()
        toast.error('Your session has expired. Please sign in again.')
      }),
    [logout],
  )

  const startSession = useCallback(({ token, user }) => {
    sessionStore.setToken(token)
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const login = useCallback((credentials) => api.post('/auth/login', credentials).then(startSession), [startSession])
  const register = useCallback((details) => api.post('/auth/register', details).then(startSession), [startSession])

  const value = useMemo(() => ({ ...state, login, register, logout }), [state, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
