import { useCallback, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { ShareReportDialog } from './ShareReportDialog'
import { printFinalizedReport } from '../lib/exportReport'

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
      await printFinalizedReport(report.id)
      setMessage('The print dialog was opened. Choose Save as PDF to export; cancelling leaves the report unchanged.')
    } catch {
      setError('Unable to open the report export. Allow pop-ups for WildGuard, check your connection, and retry.')
    } finally { inFlight.current = false; setExporting(false) }
  }
  return <div className="mt-6 border-t border-line pt-5">
    <div className="flex flex-wrap gap-3">{canShare && <Button variant="secondary" onClick={() => { setMessage(null); setSharing(true) }}>Share</Button>}
      <Button loading={exporting} onClick={exportReport}>Export</Button></div>
    <p className="mt-3 text-xs text-muted">Export opens a print-ready copy. Select Save as PDF in your browser’s print dialog.</p>
    {message && <p role="status" className="mt-3 text-sm text-fg">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-500 dark:text-red-300">{error}</p>}
    {sharing && <ShareReportDialog report={report} onClose={close} onShared={(value) => { setMessage(value); setSharing(false) }} />}
  </div>
}
