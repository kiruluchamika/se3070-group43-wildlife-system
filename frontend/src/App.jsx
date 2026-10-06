import { MotionConfig } from 'motion/react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { FullScreenLoader } from './components/layout/FullScreenLoader'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './components/layout/RouteGuards'
import { AuthProvider } from './context/AuthProvider'
import { useTheme } from './context/theme-context'
import { ThemeProvider } from './context/ThemeProvider'
import { AuthLayout } from './features/auth/AuthLayout'
import { NAV_ITEMS } from './lib/navigation'

const LoginPage = lazy(() => import('./features/auth/LoginPage'))
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'))
const RoleHomePage = lazy(() => import('./features/home/RoleHomePage'))
const ModulePlaceholder = lazy(() => import('./features/placeholders/ModulePlaceholder'))
const NotFoundPage = lazy(() => import('./features/errors/NotFoundPage'))

/**
 * Screens that are finished, keyed by path. Every other NAV_ITEMS entry shows
 * the module placeholder until its owner adds the page here.
 */
const PAGES = {
  '/analytics': lazy(() => import('./features/analytics/pages/AnalysisPage')),
  '/reports': lazy(() => import('./features/analytics/pages/ReportsPage')),
  // UC04 — Monitor Patrol Coverage and Allocate Resources (HETTIGE K.C.)
  '/patrol': lazy(() => import('./features/patrol/pages/PatrolDashboardPage')),
  '/patrol/alerts': lazy(() => import('./features/patrol/pages/AlertsPage')),
  '/patrol/teams': lazy(() => import('./features/patrol/pages/RangerTeamsPage')),
  '/patrol/history': lazy(() => import('./features/patrol/pages/AllocationHistoryPage')),
  '/my-assignment': lazy(() => import('./features/patrol/pages/MyAssignmentPage')),

  // UC01 — Respond to Human–Elephant Conflict (WITTAHACHCHI D.K.G)
  '/conflicts/report': lazy(() => import('./features/conflicts/pages/ReportConflictPage')),
  '/conflicts/mine': lazy(() => import('./features/conflicts/pages/MyConflictReportsPage')),
  '/conflicts': lazy(() => import('./features/conflicts/pages/ConflictQueuePage')),
  '/conflicts/approvals': lazy(() => import('./features/conflicts/pages/DeploymentApprovalsPage')),
  '/response-tasks': lazy(() => import('./features/conflicts/pages/ResponseTasksPage')),
}

function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="top-right" richColors closeButton />
}

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<FullScreenLoader />}>
              <Routes>
                <Route element={<PublicOnlyRoute />}>
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                  </Route>
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route index element={<RoleHomePage />} />
                    {NAV_ITEMS.filter((item) => item.path !== '/').map((item) => {
                      const Page = PAGES[item.path]
                      return (
                        <Route
                          key={item.path}
                          path={item.path}
                          element={<RoleRoute roles={item.roles}>{Page ? <Page /> : <ModulePlaceholder item={item} />}</RoleRoute>}
                        />
                      )
                    })}
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
          <ThemedToaster />
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
