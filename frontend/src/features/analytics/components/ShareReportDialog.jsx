import { useRef, useState } from 'react'
import { api } from '../../../lib/api'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback'

export function ShareReportDialog({ report, onClose, onShared }) {
  const query = useApiQuery(`/reports/${report.id}/recipients`)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const managers = query.data?.managers ?? []
  async function share() {
    if (inFlight.current) return
    if (!selected.length) { setError('Select at least one Park Manager.'); return }
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const response = await api.post(`/reports/${report.id}/share`, { recipients: selected })
      onShared(`Report shared successfully with ${response.sharedCount} Park Manager${response.sharedCount === 1 ? '' : 's'}.`)
    } catch {
      setError('Unable to share the report. Check the selected recipients and retry. Your selection has been kept.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }
  return <Modal open title="Share Report" description={report.title} onClose={onClose} dismissible={!saving}
    footer={<><Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button loading={saving} disabled={query.loading || Boolean(query.error) || !managers.length} onClick={share}>Share Report</Button></>}>
    {query.loading ? <Skeleton className="h-32" /> : query.error ? <ErrorState message="Unable to load eligible Park Managers. Please retry." onRetry={query.reload} />
      : !managers.length ? <EmptyState title="No eligible Park Managers are available for this report." /> :
        <fieldset disabled={saving} className="min-w-0"><legend className="mb-3 text-sm font-semibold text-fg">Park Manager(s)</legend>
          <div className="grid max-h-64 gap-3 overflow-y-auto">{managers.map((manager) => <label key={manager.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-teal-500" checked={selected.includes(manager.id)} onChange={(event) => {
              setSelected((current) => event.target.checked ? [...current, manager.id] : current.filter((id) => id !== manager.id))
              setError(null)
            }} /><span className="break-words">{manager.name}</span>
          </label>)}</div>
          <p className="mt-3 text-xs text-muted" role="status">{selected.length} Park Managers selected</p>
        </fieldset>}
    {error && <p role="alert" className="mt-4 text-sm text-red-500 dark:text-red-300">{error}</p>}
  </Modal>
}
