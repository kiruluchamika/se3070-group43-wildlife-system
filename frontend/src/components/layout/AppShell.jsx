import { AnimatePresence, motion } from 'motion/react'
import { Suspense, useState } from 'react'
import { useLocation, useOutlet } from 'react-router'
import { pageTransition } from '../../lib/motion'
import { PageLoader } from './FullScreenLoader'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <div className="min-h-dvh lg:pl-72">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-line bg-surface/60 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[900] bg-slate-950/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-[901] w-72 max-w-[85vw] border-r border-line bg-canvas lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <Topbar onOpenMenu={() => setMenuOpen(true)} />

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} {...pageTransition}>
            <Suspense fallback={<PageLoader />}>{outlet}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="flex flex-col gap-1 px-4 pb-6 text-xs text-subtle sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <span>© 2026 WildGuard Conservation System · SE3070 Group 43</span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400" /> System status: Operational
        </span>
      </footer>
    </div>
  )
}
