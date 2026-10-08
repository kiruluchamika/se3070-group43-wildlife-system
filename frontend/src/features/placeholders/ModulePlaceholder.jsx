import { Hammer } from 'lucide-react'
import { motion } from 'motion/react'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { MODULE_OWNERS } from '../../lib/navigation'

/**
 * Stand-in for screens another member is still building. The owner replaces
 * the route element in App.jsx and sets `ready: true` in lib/navigation.js.
 */
export default function ModulePlaceholder({ item }) {
  const owner = MODULE_OWNERS[item.useCase]
  const Icon = item.icon

  return (
    <>
      <PageHeader eyebrow={`${item.useCase} · ${owner?.title ?? ''}`} title={item.label} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="panel relative overflow-hidden px-6 py-14 text-center"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />
        <motion.span
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
          className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-brand-500/15 text-brand-500 dark:text-brand-300"
        >
          <Icon className="size-8" aria-hidden="true" />
        </motion.span>
        <h2 className="relative mt-5 text-xl font-bold text-fg">This module is being built</h2>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-muted">
          {owner?.title} is implemented by <strong className="text-fg">{owner?.name}</strong>. It will appear here once it is merged into
          the shared application.
        </p>
        <div className="relative mt-5 flex justify-center">
          <Badge tone="amber" icon={Hammer}>
            In development
          </Badge>
        </div>
      </motion.div>
    </>
  )
}
