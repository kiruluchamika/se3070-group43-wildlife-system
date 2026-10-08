import { ArrowRight, ArrowRightLeft, CheckCircle2, History, Siren, UserPlus } from 'lucide-react'
import { motion } from 'motion/react'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { cn } from '../../../lib/cn'
import { formatDateTime, formatRelativeTime } from '../../../lib/format'
import { patrolPaths } from '../api/patrolApi'
import { PatrolToolbar } from '../components/PatrolToolbar'
import { useSelectedPark } from '../hooks/useSelectedPark'

const DECISION_STYLE = {
  allocate: { icon: UserPlus, label: 'Allocated', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
  reassign: { icon: ArrowRightLeft, label: 'Reassigned', tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  emergency: { icon: Siren, label: 'Emergency dispatch', tone: 'bg-red-500/15 text-red-600 dark:text-red-300' },
  complete: { icon: CheckCircle2, label: 'Patrol completed', tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
}

/** Audit trail of resource allocation decisions ("recorded for future monitoring and analysis"). */
export default function AllocationHistoryPage() {
  const now = useNow()
  const { parks, parkId, selectPark } = useSelectedPark()
  const decisions = useApiQuery(parkId ? patrolPaths.decisions(parkId) : null)
  const list = decisions.data?.decisions ?? []

  return (
    <>
      <PageHeader
        eyebrow="UC04 · Park Manager"
        title="Allocation History"
        description="Every allocation, reassignment, emergency dispatch and completed patrol, with who decided it and when."
        actions={<PatrolToolbar parks={parks} parkId={parkId} onParkChange={selectPark} updatedAt={decisions.updatedAt} refreshing={decisions.refreshing} onRefresh={decisions.reload} now={now} />}
      />

      <div className="panel p-5 sm:p-6">
        {decisions.loading ? (
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-16" />
            ))}
          </div>
        ) : decisions.error ? (
          <ErrorState title="History unavailable" message={decisions.error.message} onRetry={decisions.reload} />
        ) : list.length === 0 ? (
          <EmptyState icon={History} title="No allocation decisions yet" description="Decisions appear here as soon as a team is allocated." />
        ) : (
          <ol className="relative ml-5 border-l border-line">
            {list.map((decision, index) => {
              const style = DECISION_STYLE[decision.type]
              return (
                <motion.li
                  key={decision.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.6) }}
                  className="relative pb-6 pl-8 last:pb-0"
                >
                  <span className={cn('absolute top-0 -left-5 grid size-10 place-items-center rounded-xl ring-4 ring-canvas', style.tone)}>
                    <style.icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-fg">
                      {style.label}: {decision.team?.name}
                    </p>
                    <p className="text-xs text-subtle" title={formatDateTime(decision.createdAt)}>
                      {formatRelativeTime(decision.createdAt, now)}
                    </p>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                    {decision.fromZone && (
                      <>
                        {decision.fromZone.name} <ArrowRight className="size-3.5" aria-hidden="true" />
                      </>
                    )}
                    {decision.zone?.name}
                    {decision.alert && <span className="text-red-500 dark:text-red-300">· {decision.alert.title}</span>}
                  </p>
                  {decision.notes && <p className="mt-1 text-sm text-subtle italic">“{decision.notes}”</p>}
                  <p className="mt-1 text-xs text-subtle">by {decision.decidedBy?.name}</p>
                </motion.li>
              )
            })}
          </ol>
        )}
      </div>
    </>
  )
}
