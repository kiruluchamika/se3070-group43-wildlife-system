import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { ShareReportDialog } from './ShareReportDialog'
import { downloadFinalizedReport } from '../lib/exportReport'

export function FinalizedReportActions({ report, canShare }) {
  const [sharing, setSharing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)
  const close = useCallback(() => setSharing(false), [])
  if (report.status !== 'finalized') return null
  async function exportReport() {
    if (inFlight.current) return
    inFlight.current = true
    setExporting(true)
    setMessage(null)
    setError(null)
    try {
      await downloadFinalizedReport(report.id)
      setMessage('PDF download started.')
    } catch {
      setError('Unable to download the report PDF. Check your connection and retry.')
    } finally { inFlight.current = false; setExporting(false) }
  }
  return <div className="mt-6 border-t border-line pt-5">
    <div className="flex flex-wrap gap-3">{canShare && <Button variant="secondary" onClick={() => { setMessage(null); setSharing(true) }}>Share</Button>}
      <Button loading={exporting} onClick={exportReport}>Export PDF</Button></div>
    <p className="mt-3 text-xs text-muted">Export downloads a PDF copy of this finalized report.</p>
    {message && <p role="status" className="mt-3 text-sm text-fg">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-500 dark:text-red-300">{error}</p>}
    {sharing && <ShareReportDialog report={report} onClose={close} onShared={(value) => { setMessage(value); setSharing(false); toast.success('Report shared successfully.') }} />}
  </div>
}
