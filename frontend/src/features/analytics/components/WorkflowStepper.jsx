import { Check } from 'lucide-react'
import { cn } from '../../../lib/cn'

const STAGES = [
  ['filters', 'Filters'],
  ['results', 'Analysis Results'],
  ['findings', 'Findings & Recommendations'],
  ['preparation', 'Report Preparation'],
  ['preview', 'Preview'],
  ['saved', 'Saved Report'],
]

/** Visual progress only: existing page actions remain the navigation controls. */
export function WorkflowStepper({ current }) {
  const active = STAGES.findIndex(([stage]) => stage === current)
  if (active < 0) return null
  return <ol aria-label="Analysis report progress" className="mb-6 grid min-w-0 grid-cols-2 gap-3 rounded-2xl border border-line bg-surface-2 p-4 sm:grid-cols-3 xl:grid-cols-6">
    {STAGES.map(([stage, label], index) => {
      const completed = index < active
      const selected = index === active
      return <li key={stage} aria-current={selected ? 'step' : undefined} className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-2',
          completed ? 'bg-brand-500 text-white ring-brand-500' : selected
            ? 'bg-brand-500/15 text-brand-700 ring-brand-400 dark:text-brand-200'
            : 'bg-elevated text-subtle ring-line')}>
          {completed ? <Check className="size-4" /> : index + 1}
        </span>
        <span className={cn('min-w-0 break-words text-xs leading-relaxed font-semibold', selected ? 'text-fg' : completed ? 'text-brand-700 dark:text-brand-200' : 'text-subtle')}>
          {label}<span className="sr-only">{completed ? ', completed' : selected ? ', current stage' : ', upcoming'}</span>
        </span>
      </li>
    })}
  </ol>
}
