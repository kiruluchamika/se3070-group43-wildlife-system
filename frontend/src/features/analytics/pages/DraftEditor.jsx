import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../../lib/api'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Field, Input, Textarea } from '../../../components/ui/Field'
import { ReportAnalysisSummary } from '../components/ReportAnalysisSummary'
import { REPORT_LIMITS, validateReport } from '../lib/reportPreparation'

export function DraftEditor({ report }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(report)
  const [fields, setFields] = useState({ title: report.title, findings: report.findings, recommendations: report.recommendations })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const finalizeRequest = useRef(null)
  const dirty = Object.keys(fields).some((key) => fields[key] !== saved[key])
  function change(field, value) {
    finalizeRequest.current = null
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
    setSuccess(false)
  }
  async function save(event, finalize = false) {
    event.preventDefault()
    if (inFlight.current) return
    const invalid = validateReport(fields, true)
    setErrors(invalid)
    if (Object.keys(invalid).length) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      if (finalize) {
        finalizeRequest.current ??= crypto.randomUUID()
        const response = await api.post('/reports', { ...fields, snapshot: saved.snapshot, status: 'finalized',
          requestId: finalizeRequest.current, replaceDraft: { id: report.id, revision: saved.revision ?? 0 } })
        navigate(`/reports?reportId=${encodeURIComponent(response.report.id)}&saved=1`, { replace: true })
        return
      }
      const response = await api.patch(`/reports/${report.id}`, { ...fields, revision: saved.revision ?? 0 })
      setSaved(response.report)
      finalizeRequest.current = null
      setSuccess(true)
    } catch (failure) {
      setError(failure.status >= 500 ? 'Unable to save changes. Your entries are kept; please retry.' : failure.message || 'Unable to save changes. Please retry.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }
  return <div className="grid min-w-0 gap-6">
    <Card title="Edit Draft">
      <p className="mb-5 text-sm text-muted">Edit the report text below. Save Changes keeps it as Draft. Save as Finalized replaces this Draft with a finalized report, preserving its analysis.</p>
      <form onSubmit={save} noValidate className="grid gap-5">
        <fieldset disabled={saving} className="grid min-w-0 gap-5">
          <Field label="Report title" required error={errors.title}>{(props) => <Input {...props} name="title" required maxLength={REPORT_LIMITS.title} value={fields.title} onChange={(event) => change('title', event.target.value)} />}</Field>
          {['findings', 'recommendations'].map((field) => <Field key={field} label={field === 'findings' ? 'Findings' : 'Recommendations'} error={errors[field]}
            hint={`Optional · ${fields[field].length}/${REPORT_LIMITS[field]} characters`}>{(props) => <Textarea {...props} name={field} rows={6} maxLength={REPORT_LIMITS[field]} value={fields[field]} onChange={(event) => change(field, event.target.value)} />}</Field>)}
        </fieldset>
        {Object.values(errors).some(Boolean) && <p role="alert" className="text-sm text-red-500 dark:text-red-300">Please correct the highlighted fields.</p>}
        {error && <p role="alert" className="text-sm text-red-500 dark:text-red-300">{error}</p>}
        {success && <p role="status" className="text-sm text-fg">Changes saved. Status: Draft.</p>}
        {dirty && <p className="text-xs text-muted">You have unsaved changes. Save Changes before re-analyzing to keep your edits. Leaving this page discards unsaved text.</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <Button type="submit" loading={saving}>Save Changes</Button>
          <Button type="button" disabled={saving} onClick={(event) => save(event, true)}>Save as Finalized</Button>
        </div>
      </form>
    </Card>
    <section aria-label="Original Analysis" className="min-w-0">
      <h2 className="mb-3 text-lg font-bold text-fg">Original Analysis</h2>
      <ReportAnalysisSummary result={saved.snapshot} analysis={saved.snapshot.analysis} />
    </section>
    <Card title="Re-analyze">
      <p className="mb-4 text-sm text-muted">Start the normal Analysis flow with this Draft’s original filters. You can keep or change them. New findings and recommendations start empty. A successful save replaces this Draft; cancelling or a failed save keeps it unchanged.</p>
      <Button variant="secondary" disabled={saving || dirty} onClick={() => navigate(`/analytics?draftId=${encodeURIComponent(report.id)}`)}>Re-analyze</Button>
    </Card>
  </div>
}
