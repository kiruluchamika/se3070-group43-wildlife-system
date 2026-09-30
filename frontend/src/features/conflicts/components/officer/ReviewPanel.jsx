import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../../components/ui/Button'
import { Field, Input, Textarea } from '../../../../components/ui/Field'
import { cn } from '../../../../lib/cn'
import { conflictApi } from '../../api/conflictApi'
import { useAction } from '../../hooks/useAction'
import { FIELD_OUTCOME_LABELS, REVIEW_RESULTS, toLocalInput } from '../../lib/conflict'
import { ActionList } from '../ReportDetails'
import { InlineError } from '../InlineError'

const tomorrow = () => toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000))

/**
 * Main flow step 5: the officer reviews the ranger's response and closes it as
 * Resolved, puts the area under Monitoring (A6 suggests this when the
 * elephant was not found) or Escalates it.
 */
export function ReviewPanel({ report, task, actions, suggestedReview, onChanged }) {
  const [result, setResult] = useState(suggestedReview ?? 'resolved')
  const [notes, setNotes] = useState('')
  const [followUpAt, setFollowUpAt] = useState(tomorrow)
  const { run, saving, error } = useAction(onChanged)
  const invalid = (result === 'escalated' && notes.trim().length < 5) || (result === 'monitoring' && !followUpAt)

  const submit = () =>
    run(
      () =>
        conflictApi.review(report.id, {
          result,
          notes: notes.trim() || undefined,
          followUpAt: result === 'monitoring' ? new Date(followUpAt).toISOString() : undefined,
        }),
      `${report.reference} reviewed`,
    )

  return (
    <div className="grid gap-4">
      {task && (
        <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-sm">
          <p className="font-semibold text-fg">
            {task.team?.name}: {FIELD_OUTCOME_LABELS[task.completion?.outcome] ?? 'Completed'}
          </p>
          {task.completion?.notes && <p className="mt-1 text-muted">{task.completion.notes}</p>}
        </div>
      )}
      <ActionList actions={actions} />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Outcome</legend>
        {REVIEW_RESULTS.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
              result === option.value ? 'border-brand-400 bg-brand-500/10' : 'border-line hover:border-brand-500/50',
            )}
          >
            <input type="radio" name="review" value={option.value} checked={result === option.value} onChange={() => setResult(option.value)} className="mt-1 accent-brand-500" />
            <span>
              <span className="block text-sm font-semibold text-fg">
                {option.label}
                {option.value === suggestedReview && <span className="ml-2 text-xs font-medium text-brand-600 dark:text-brand-300">Suggested</span>}
              </span>
              <span className="text-xs text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {result === 'monitoring' && (
        <Field label="Next check" required>
          {(props) => <Input {...props} type="datetime-local" min={toLocalInput()} value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} />}
        </Field>
      )}
      <Field label={result === 'escalated' ? 'Reason for escalation' : 'Notes for the villager'} required={result === 'escalated'}>
        {(props) => <Textarea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} className="min-h-20" />}
      </Field>
      <div className="flex justify-end">
        <Button icon={ClipboardCheck} loading={saving} disabled={invalid} onClick={submit} variant={result === 'escalated' ? 'danger' : 'primary'}>
          Save outcome
        </Button>
      </div>
      <InlineError error={error} />
    </div>
  )
}
