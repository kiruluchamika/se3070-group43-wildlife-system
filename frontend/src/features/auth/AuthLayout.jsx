import { Leaf, MapPinned, Radio, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { Outlet } from 'react-router'
import { Logo } from '../../components/ui/Logo'

const HIGHLIGHTS = [
  { icon: MapPinned, title: 'Patrol coverage', text: 'See which zones were patrolled recently and which are neglected.' },
  { icon: Radio, title: 'Rapid dispatch', text: 'Send the nearest ranger team to critical alerts in seconds.' },
  { icon: ShieldCheck, title: 'Works in the field', text: 'Built for rangers moving quickly with limited connectivity.' },
]

export function AuthLayout() {
  return (
    <div className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* Animated aurora background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 size-[36rem] animate-aurora rounded-full bg-brand-500/25 blur-[120px]" />
        <div className="absolute -right-32 -bottom-40 size-[32rem] animate-aurora rounded-full bg-accent-500/20 blur-[120px] [animation-delay:-8s]" />
        <div className="absolute top-1/3 left-1/3 size-72 animate-aurora rounded-full bg-emerald-500/10 blur-[100px] [animation-delay:-4s]" />
      </div>

      <section className="relative hidden flex-col justify-between p-12 lg:flex xl:p-16">
        <Logo subtitle="Department of Wildlife Conservation" />

        <div className="max-w-xl">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-xs font-semibold tracking-[0.24em] text-brand-600 uppercase dark:text-brand-300"
          >
            SE3070 · Group 43
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 text-5xl leading-[1.05] font-extrabold tracking-tight text-fg xl:text-6xl"
          >
            Protecting wild places, <span className="text-gradient">one patrol at a time.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-5 max-w-md text-base text-muted"
          >
            One platform for the rangers, managers, liaison officers and analysts who look after Sri Lanka's wildlife.
          </motion.p>

          <ul className="mt-10 grid gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }, index) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.12, type: 'spring', stiffness: 200, damping: 22 }}
                className="panel flex items-start gap-4 p-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-500 dark:text-brand-300">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-fg">{title}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 text-xs text-subtle">
          <Leaf className="size-3.5 animate-float text-brand-400" aria-hidden="true" /> Conserve today · A safer tomorrow
        </p>
      </section>

      <section className="relative flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          className="panel w-full max-w-md bg-surface/90 p-6 sm:p-8"
        >
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <Outlet />
        </motion.div>
      </section>
    </div>
  )
}
