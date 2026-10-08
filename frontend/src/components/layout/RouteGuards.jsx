import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../context/auth-context'
import { ForbiddenPage } from '../../features/errors/ForbiddenPage'
import { FullScreenLoader } from './FullScreenLoader'

/** Signed-in users only; everyone else goes to /login and returns afterwards. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Login and register pages redirect away once a session exists. */
export function PublicOnlyRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status === 'authenticated') return <Navigate to={location.state?.from || '/'} replace />
  return <Outlet />
}

/** UC04 E4: users without a permitted role see the access-denied page. */
export function RoleRoute({ roles, children }) {
  const { user } = useAuth()
  if (!roles.includes(user?.role)) return <ForbiddenPage />
  return children ?? <Outlet />
}
