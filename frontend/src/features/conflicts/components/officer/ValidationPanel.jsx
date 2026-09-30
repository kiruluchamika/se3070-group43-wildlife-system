import { CheckCircle2, HelpCircle, MapPinOff, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../../components/ui/Button'
import { Field, Select, Textarea } from '../../../../components/ui/Field'
import { conflictApi } from '../../api/conflictApi'
import { useAction } from '../../hooks/useAction'
import { PRIORITIES, PRIORITY_ROUTE } from '../../lib/conflict'
import { InlineError } from '../InlineError'

/**
 * Main flow step 2: verify the report and set its priority, mark it invalid,
 * or ask the villager for more information (A3).
 */
export function ValidationPanel({ report, onChanged }) {
  const [priority, setPriority] = useState(report.suggestedPriority ?? 'medium')
  const [notes, setNotes] = useState('')
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState(report.locationAdequate ? 'validate' : 'request')
  const { run, saving, error } = useAction(onChanged)
  const awaitingReply = report.status === 'pending-information'

  const validate = (decision) =>
    run(
      () => conflictApi.validate(report.id, { decision, priority: decision === 'valid' ? priority : undefined, notes: notes.trim() || undefined }),
      decision === 'valid' ? `${report.reference} verified as ${priority} priority` : `${report.reference} marked invalid`,
    )
  const requestInformation = () =>
    run(() => conflictApi.requestInformation(report.id, { message: question.trim() }), 'The villager has been asked for more information')

  return (
    <div className="grid gap-4">
      {!report.locationAdequate && (
        <p className="flex gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <MapPinOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          The location is too vague for rangers to find (no GPS and no clear landmark). Ask the villager for more information before verifying.
        </p>
      )}
      {awaitingReply && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
          Waiting for the villager to answer: “{report.informationRequest?.message}”
        </p>
      )}
      {report.informationRequest?.response && (
        <p className="rounded-xl border border-brand-400/30 bg-brand-500/10 p-3 text-sm text-fg">
          <strong>Villager replied:</strong> {report.informationRequest.response}
        </p>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Verification action">
        <Button size="sm" variant={mode === 'validate' ? 'primary' : 'secondary'} onClick={() => setMode('validate')} role="tab" aria-selected={mode === 'validate'}>
          Verify
        </Button>
        {!awaitingReply && (
          <Button size="sm" variant={mode === 'request' ? 'primary' : 'secondary'} onClick={() => setMode('request')} role="tab" aria-selected={mode === 'request'}>
            Request information
          </Button>
        )}
      </div>

      {mode === 'validate' || awaitingReply ? (
        <div className="grid gap-3">
          <Field label="Priority" hint={PRIORITY_ROUTE[priority]}>
            {(props) => (
              <Select {...props} value={priority} onChange={(event) => setPriority(event.target.value)}>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                    {value === report.suggestedPriority ? ' (suggested)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Notes" hint="Required when marking a report invalid; the villager sees the reason.">
            {(props) => <Textarea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="min-h-20" />}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" icon={XCircle} disabled={saving || notes.trim().length === 0} onClick={() => validate('invalid')}>
              Mark invalid
            </Button>
            <Button icon={CheckCircle2} loading={saving} disabled={!report.locationAdequate} onClick={() => validate('valid')}>
              Mark valid
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <Field label="Question for the villager" hint="Sent in the app, or by SMS if the app cannot reach them.">
            {(props) => (
              <Textarea
                {...props}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                placeholder="Which landmark is closest? Can you share your GPS location?"
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button icon={HelpCircle} loading={saving} disabled={question.trim().length < 5} onClick={requestInformation}>
              Send request
            </Button>
          </div>
        </div>
      )}
      <InlineError error={error} />
    </div>
  )
}
