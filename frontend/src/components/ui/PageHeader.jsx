import { motion } from 'motion/react'

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 font-mono text-[11px] font-semibold tracking-[0.18em] text-brand-600 uppercase dark:text-brand-300">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  )
}
