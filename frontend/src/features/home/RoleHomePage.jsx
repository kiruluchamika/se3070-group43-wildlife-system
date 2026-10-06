import { ArrowUpRight, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../context/auth-context'
import { useNow } from '../../hooks/useNow'
import { riseIn, stagger } from '../../lib/motion'
import { MODULE_OWNERS, navItemsFor, ROLE_LABELS, ROLES } from '../../lib/navigation'

const ROLE_INTRO = {
  [ROLES.PARK_MANAGER]: 'Monitor patrol coverage, respond to alerts and deploy ranger teams where they are needed most.',
  [ROLES.RANGER]: 'Check your patrol assignment, report incidents from the field and respond to conflict tasks.',
  [ROLES.LIAISON_OFFICER]: 'Validate community conflict reports and coordinate ranger responses with villages.',
  [ROLES.DATA_ANALYST]: 'Analyse conservation data, identify hotspots and prepare reports for stakeholders.',
  [ROLES.VILLAGER]: 'Report elephant sightings, crop damage or immediate danger near your village.',
}

function greetingFor(timestamp) {
  const hour = new Date(timestamp).getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const ANALYST_CARDS = {
  '/analytics': {
    description: 'Select filters for conservation analysis. Results, patterns and hotspots are coming next.',
    action: 'Start Analysis',
    status: 'Filters available',
    tone: 'brand',
  },
  '/reports': {
    description: 'Your future workspace for generated reports, editable drafts and finalized reports to share or export.',
    action: 'View Reports',
    status: 'Coming soon',
    tone: 'amber',
  },
}

export default function RoleHomePage() {
  const { user } = useAuth()
  const now = useNow(60000)
  const modules = navItemsFor(user.role).filter((item) => item.path !== '/')

  return (
    <div>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="panel relative overflow-hidden p-6 sm:p-10"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 animate-aurora rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 animate-aurora rounded-full bg-accent-500/15 blur-3xl [animation-delay:-6s]" aria-hidden="true" />
        <Badge tone="brand" icon={Sparkles} className="relative">
          {ROLE_LABELS[user.role]}
        </Badge>
        <h1 className="relative mt-4 text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          {greetingFor(now)}, <span className="text-gradient">{user.name.split(' ')[0]}</span>
        </h1>
        <p className="relative mt-2 max-w-2xl text-muted">{ROLE_INTRO[user.role]}</p>
      </motion.section>

      <h2 className="mt-8 mb-4 text-sm font-bold tracking-wide text-muted uppercase">Your workspace</h2>
      <motion.ul variants={stagger} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((item) => {
          const owner = MODULE_OWNERS[item.useCase]
          const analystCard = user.role === ROLES.DATA_ANALYST ? ANALYST_CARDS[item.path] : null
          return (
            <motion.li key={item.path} variants={riseIn} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <Link
                to={item.path}
                className="panel group flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-glow focus-visible:shadow-glow"
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-brand-500/25 to-accent-500/10 text-brand-600 dark:text-brand-300">
                    <item.icon className="size-6" aria-hidden="true" />
                  </span>
                  <ArrowUpRight className="size-5 text-subtle transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-400" />
                </div>
                <div>
                  <p className="font-bold text-fg">{item.label}</p>
                  <p className="mt-1 text-sm text-muted">{analystCard?.description ?? owner?.title}</p>
                </div>
                {analystCard && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-300">
                    {analystCard.action}<ArrowUpRight className="size-4" aria-hidden="true" />
                  </span>
                )}
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-subtle">
                    {item.useCase} · {owner?.name}
                  </span>
                  {analystCard ? <Badge tone={analystCard.tone}>{analystCard.status}</Badge> : item.ready ? <Badge tone="green">Live</Badge> : <Badge tone="amber">In development</Badge>}
                </div>
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>
    </div>
  )
}
