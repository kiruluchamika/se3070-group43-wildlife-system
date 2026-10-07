import { AlertTriangle } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'

export function FreshnessDialog({ open, freshness, onContinue, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title="Data may not be current" icon={AlertTriangle} tone="warning"
      description="Some retrieved field records are marked as pending synchronization. You can continue with the available data or return to your filters."
      footer={<><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={onContinue}>Continue Analysis</Button></>}>
      <ul className="grid gap-3">
        {(freshness?.affectedSources ?? []).map((source) => (
          <li key={`${source.source}:${source.recordId}`} className="rounded-xl border border-line bg-surface-2 p-3">
            <p className="break-words text-sm font-semibold text-fg">{source.label}</p>
            <p className="mt-1 text-sm text-muted">Last successful synchronization: {source.lastSuccessfulSyncAt
              ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(source.lastSuccessfulSyncAt))
              : 'Not recorded'}</p>
            <p className="mt-1 text-xs text-subtle">{source.reason}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-subtle">{freshness?.note}</p>
    </Modal>
  )
}
