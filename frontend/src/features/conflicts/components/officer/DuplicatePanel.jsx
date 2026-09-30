import { Copy, Link2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../../components/ui/Button'
import { Skeleton } from '../../../../components/ui/Feedback'
import { Modal } from '../../../../components/ui/Modal'
import { useApiQuery } from '../../../../hooks/useApiQuery'
import { formatDistance, formatRelativeTime } from '../../../../lib/format'
import { conflictApi, conflictPaths } from '../../api/conflictApi'
import { useAction } from '../../hooks/useAction'
import { TYPE_LABELS } from '../../lib/conflict'
import { ConflictStatusBadge } from '../ConflictBadges'
import { InlineError } from '../InlineError'

/**
 * A4: open reports from the same park within 12 hours and 2 km (or the same
 * village). Linking closes this report under the primary one, so the existing
 * response covers it and no second team is sent.
 */
export function DuplicatePanel({ report, now, onChanged }) {
  const { data, loading } = useApiQuery(conflictPaths.duplicates(report.id))
  const [confirming, setConfirming] = useState(null)
  const { run, saving, error } = useAction(() => {
    setConfirming(null)
    onChanged()
  })
  const candidates = data?.candidates ?? []

  if (loading) return <Skeleton className="h-16" />
  if (!candidates.length) return <p className="text-sm text-muted">No similar open reports nearby in the last 12 hours.</p>

  return (
    <>
      <ul className="grid gap-2">
        {candidates.map(({ report: candidate, match }) => (
          <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                <span className="font-mono">{candidate.reference}</span> <ConflictStatusBadge status={candidate.status} />
              </p>
              <p className="text-xs text-muted">
                {TYPE_LABELS[candidate.conflictType]} · {candidate.village} · {formatRelativeTime(candidate.occurredAt, now)} ·{' '}
                {match.rule === 'distance' ? `${formatDistance(match.distanceKm)} away` : 'same village'}
              </p>
            </div>
            <Button size="sm" variant="secondary" icon={Link2} onClick={() => setConfirming(candidate)}>
              Link as duplicate
            </Button>
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(confirming)}
        onClose={saving ? undefined : () => setConfirming(null)}
        icon={Copy}
        tone="warning"
        title="Link as a duplicate?"
        description={`${report.reference} will be closed and linked to ${confirming?.reference}. No separate team is sent; the villager is told the existing response covers their report.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              icon={Link2}
              loading={saving}
              onClick={() => run(() => conflictApi.linkDuplicate(report.id, { primaryReportId: confirming.id }), `${report.reference} linked to ${confirming.reference}`)}
            >
              Link reports
            </Button>
          </>
        }
      >
        <InlineError error={error} />
      </Modal>
    </>
  )
}
