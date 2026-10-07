import { WorkflowStepper } from '../components/WorkflowStepper'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../../lib/api'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { PageHeader } from '../../../components/ui/PageHeader'
import { ReportContent } from '../components/ReportContent'
import { reportSaveBody, reportSnapshot } from '../lib/reportSnapshot'

export function ReportPreviewPage({ handoff, requestId, onBack, sourceDraft }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)
  const panel = useRef(null)
  useEffect(() => { panel.current?.focus() }, [])
  const report = useMemo(() => ({ ...handoff, snapshot: reportSnapshot(handoff) }), [handoff])
  async function save(status) {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(status)
    setError(null)
    try {
      const body = reportSaveBody(handoff, requestId, status, sourceDraft)
      const result = await api.post('/reports', body)
      navigate(`/reports?reportId=${encodeURIComponent(result.report.id)}&saved=1`, { replace: true })
    } catch (failure) {
      setError(failure.status >= 500 ? 'Unable to save the report. Your preview is kept; retry the same save action.' : failure.message || 'Unable to save the report. Please try again.')
    } finally {
      inFlight.current = false
      setSaving(null)
    }
  }
  return <section ref={panel} tabIndex={-1} aria-label="Report Preview" className="min-w-0 outline-none">
    <PageHeader eyebrow="UC02 · Data Analyst" title="Report Preview" description="Review the generated content before choosing how to save it."
      actions={<Button variant="secondary" disabled={Boolean(saving)} onClick={onBack}>Back to Preparation</Button>} />
    <WorkflowStepper current="preview" />
    <div className="mb-5 flex flex-wrap items-center gap-3"><Badge tone="sky">Preview</Badge><p className="text-sm text-muted">Not saved or finalized.</p></div>
    <ReportContent report={report} />
    {error && <p role="alert" className="mt-5 text-sm text-red-500 dark:text-red-300">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
      <Button variant="secondary" disabled={Boolean(saving)} loading={saving === 'draft'} onClick={() => save('draft')}>Save as Draft</Button>
      <Button disabled={Boolean(saving)} loading={saving === 'finalized'} onClick={() => save('finalized')}>Save as Finalized</Button>
    </div>
  </section>
}
