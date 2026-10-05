import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api, onUnauthorized } from '../lib/api'
import { sessionStore } from '../lib/storage'
import { AuthContext } from './auth-context'

function initialState() {
  const token = sessionStore.getToken()
  const cachedUser = sessionStore.getUser()
  if (token && cachedUser) return { status: 'authenticated', user: cachedUser, sessionSource: 'cache' }
  return { status: token ? 'loading' : 'anonymous', user: null, sessionSource: null }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState)

  const logout = useCallback(() => {
    sessionStore.clear()
    setState({ status: 'anonymous', user: null, sessionSource: null })
  }, [])

  // A cached public profile lets an already signed-in ranger reopen the PWA
  // offline. It only controls the UI; every server route still verifies the
  // JWT and role. Revalidate on first load and whenever connectivity returns.
  useEffect(() => {
    if (!sessionStore.getToken()) return undefined
    let active = true
    let controller
    let verifying = false

    const verifySession = async () => {
      if (!active || verifying || !sessionStore.getToken()) return
      verifying = true
      controller?.abort()
      controller = new AbortController()
      try {
        const { user } = await api.get('/auth/me', { signal: controller.signal })
        if (!active) return
        sessionStore.setUser(user)
        setState({ status: 'authenticated', user, sessionSource: 'server' })
      } catch (error) {
        if (!active || error.name === 'AbortError') return

        // Only an authoritative authentication failure removes the session.
        // Network/server failures retain the last safe public user profile.
        if (error.status === 401 || error.code === 'SESSION_EXPIRED' || error.code === 'USER_NOT_FOUND') {
          logout()
          return
        }

        const cachedUser = sessionStore.getUser()
        setState(
          cachedUser
            ? { status: 'authenticated', user: cachedUser, sessionSource: 'cache' }
            : { status: 'anonymous', user: null, sessionSource: null },
        )
      } finally {
        verifying = false
      }
    }

    verifySession()
    window.addEventListener('online', verifySession)
    return () => {
      active = false
      controller?.abort()
      window.removeEventListener('online', verifySession)
    }
  }, [logout])

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
    sessionStore.setUser(user)
    setState({ status: 'authenticated', user, sessionSource: 'server' })
    return user
  }, [])

  const login = useCallback((credentials) => api.post('/auth/login', credentials).then(startSession), [startSession])
  const register = useCallback((details) => api.post('/auth/register', details).then(startSession), [startSession])

  const value = useMemo(() => ({ ...state, login, register, logout }), [state, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
