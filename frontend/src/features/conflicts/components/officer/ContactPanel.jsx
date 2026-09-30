import { PhoneCall, PhoneOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../../../components/ui/Field'
import { formatDateTime, humanize } from '../../../../lib/format'
import { conflictApi } from '../../api/conflictApi'
import { useAction } from '../../hooks/useAction'
import { ALTERNATIVE_CONTACT_METHODS, CONTACT_STATUS_LABELS } from '../../lib/conflict'
import { InlineError } from '../InlineError'

/**
 * E2/E3: every attempt to reach the villager. When in-app and SMS both fail,
 * the officer retries or records how the community was reached instead.
 */
export function ContactPanel({ report, onChanged }) {
  const [method, setMethod] = useState('village-officer')
  const [contactedPerson, setContactedPerson] = useState('')
  const [notes, setNotes] = useState('')
  const retry = useAction(onChanged)
  const record = useAction(() => {
    setNotes('')
    setContactedPerson('')
    onChanged()
  })
  const failed = report.contactStatus === 'failed'
  const attempts = [...(report.contactAttempts ?? [])].reverse()

  return (
    <div className="grid gap-4">
      {failed && (
        <div className="grid gap-3 rounded-2xl border border-red-400/30 bg-red-500/8 p-4">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <PhoneOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            The villager could not be reached in the app or by SMS. Retry, or contact the community another way and record it.
          </p>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={retry.saving}
              onClick={() => retry.run(() => conflictApi.retryContact(report.id), ({ reached }) => (reached ? 'The villager was reached' : 'Contact failed again'))}
            >
              Retry contact
            </Button>
          </div>
          <InlineError error={retry.error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contacted through">
              {(props) => (
                <Select {...props} value={method} onChange={(event) => setMethod(event.target.value)}>
                  {ALTERNATIVE_CONTACT_METHODS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Person contacted">
              {(props) => <Input {...props} value={contactedPerson} onChange={(event) => setContactedPerson(event.target.value)} maxLength={80} />}
            </Field>
          </div>
          <Field label="What was communicated" required>
            {(props) => <Textarea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={300} className="min-h-16" />}
          </Field>
          <div className="flex justify-end">
            <Button
              icon={PhoneCall}
              loading={record.saving}
              disabled={notes.trim().length < 3}
              onClick={() =>
                record.run(
                  () => conflictApi.recordAlternativeContact(report.id, { method, contactedPerson: contactedPerson.trim() || undefined, notes: notes.trim() }),
                  'Alternative contact recorded',
                )
              }
            >
              Record alternative contact
            </Button>
          </div>
          <InlineError error={record.error} />
        </div>
      )}

      {attempts.length === 0 ? (
        <p className="text-sm text-muted">No contact attempts yet.</p>
      ) : (
        <ul className="grid gap-1.5 text-xs">
          {attempts.map((attempt, index) => (
            <li key={`${attempt.at}-${index}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-2/60 px-3 py-2">
              <span className="text-fg">
                {humanize(attempt.purpose ?? 'contact')} · {attempt.channel === 'alternative' ? humanize(attempt.method ?? 'alternative') : attempt.channel}
                {attempt.detail ? <span className="text-muted"> — {attempt.detail}</span> : null}
              </span>
              <span className={attempt.status === 'failed' ? 'font-semibold text-red-500 dark:text-red-300' : 'text-muted'}>
                {CONTACT_STATUS_LABELS[attempt.status] ?? attempt.status} · {formatDateTime(attempt.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
