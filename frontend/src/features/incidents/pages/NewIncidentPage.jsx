import { Camera, Check, ChevronLeft, ChevronRight, Crosshair, ImagePlus, MapPin, Send, ShieldCheck, Trash2, WifiOff } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useAuth } from '../../../context/auth-context'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { cn } from '../../../lib/cn'
import { formatDateTime, humanize } from '../../../lib/format'
import { captureLocation, preparePhoto } from '../lib/device'
import { DEFAULT_SEVERITY, INCIDENT_TYPES, newClientId, SEVERITIES, toLocalInput, TYPE_LABELS } from '../lib/incident'
import { useIncidentQueue } from '../offline/useIncidentQueue'

const STEPS = ['Incident', 'Evidence', 'Review']

function initialForm(user) {
  return {
    parkId: user?.park ?? '',
    type: '',
    severity: '',
    observedAt: toLocalInput(),
    description: '',
    locationNote: '',
  }
}

function Stepper({ current }) {
  return (
    <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Report progress">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-2',
              index < current
                ? 'bg-brand-500 text-white ring-brand-500'
                : index === current
                  ? 'bg-brand-500/15 text-brand-700 ring-brand-400 dark:text-brand-200'
                  : 'bg-elevated text-subtle ring-line',
            )}
            aria-current={index === current ? 'step' : undefined}
          >
            {index < current ? <Check className="size-4" aria-hidden="true" /> : index + 1}
          </span>
          <span className={cn('hidden text-sm font-semibold sm:block', index === current ? 'text-fg' : 'text-subtle')}>{label}</span>
          {index < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

function validateStep(step, form, location) {
  const errors = {}
  if (step === 0) {
    if (!form.parkId) errors.parkId = 'Choose the park where this happened.'
    if (!form.type) errors.type = 'Choose what you found.'
    if (!form.observedAt) errors.observedAt = 'Enter when you observed it.'
    else if (new Date(form.observedAt).getTime() > Date.now() + 5 * 60 * 1000) errors.observedAt = 'The observation time cannot be in the future.'
    if (form.description.trim().length < 10) errors.description = 'Describe what you observed in at least 10 characters.'
  }
  if (step === 1 && !location && !form.locationNote.trim()) errors.locationNote = 'Capture GPS or describe where the evidence is.'
  return errors
}

export default function NewIncidentPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const parks = useApiQuery('/parks')
  const queue = useIncidentQueue(user.id)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => initialForm(user))
  const [errors, setErrors] = useState({})
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locating, setLocating] = useState(false)
  const [photos, setPhotos] = useState([])
  const [photoError, setPhotoError] = useState(null)
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const parkList = parks.data?.parks ?? []
  const parkId = form.parkId || parkList[0]?.id || ''
  const set = (field) => (event) => {
    const value = event.target.value
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'type' ? { severity: DEFAULT_SEVERITY[value] ?? 'low' } : {}),
    }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function next(event) {
    event.preventDefault()
    const found = validateStep(step, { ...form, parkId }, location)
    setErrors(found)
    if (Object.keys(found).length === 0) {
      setStep((current) => Math.min(2, current + 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function locate() {
    setLocating(true)
    setLocationError(null)
    try {
      setLocation(await captureLocation())
      setErrors((current) => ({ ...current, locationNote: undefined }))
    } catch (error) {
      setLocationError(error.message)
    } finally {
      setLocating(false)
    }
  }

  async function addPhotos(event) {
    const files = [...event.target.files].slice(0, 3 - photos.length)
    event.target.value = ''
    if (!files.length) return
    setProcessingPhotos(true)
    setPhotoError(null)
    const results = await Promise.allSettled(files.map(preparePhoto))
    setPhotos((current) => [...current, ...results.filter((result) => result.status === 'fulfilled').map((result) => result.value)].slice(0, 3))
    const failed = results.find((result) => result.status === 'rejected')
    if (failed) setPhotoError(failed.reason.message)
    setProcessingPhotos(false)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    const payload = {
      clientId: newClientId(),
      parkId,
      type: form.type,
      severity: form.severity,
      description: form.description.trim(),
      observedAt: new Date(form.observedAt).toISOString(),
      deviceCreatedAt: new Date().toISOString(),
      location: location ?? undefined,
      locationNote: form.locationNote.trim() || undefined,
      recordedOffline: !navigator.onLine,
      photos,
    }
    try {
      const result = await queue.save(payload)
      toast.success(result.sent ? 'Report received by WildGuard.' : 'Report saved safely on this device.')
      navigate('/incidents/pending')
    } catch (error) {
      setSaveError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="UC03 · Ranger field report"
        title="Report wildlife evidence"
        description="Save the facts now—even without a signal. WildGuard will send the report when a connection is available."
        actions={
          <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold', queue.online ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/12 text-amber-700 dark:text-amber-300')}>
            {queue.online ? <ShieldCheck className="size-4" /> : <WifiOff className="size-4" />}
            {queue.online ? 'Online' : 'Offline · local save ready'}
          </span>
        }
      />

      <Card bodyClassName="p-4 sm:p-6">
        <Stepper current={step} />

        <form onSubmit={next}>
          {step === 0 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Park" required error={errors.parkId}>
                  {(props) => (
                    <Select {...props} value={parkId} onChange={set('parkId')} disabled={parks.loading}>
                      <option value="">Choose a park</option>
                      {parkList.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Observed at" required error={errors.observedAt}>
                  {(props) => <Input {...props} type="datetime-local" value={form.observedAt} onChange={set('observedAt')} />}
                </Field>
              </div>

              <Field label="What did you find?" required error={errors.type}>
                {(props) => (
                  <div {...props} role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                    {INCIDENT_TYPES.map((type) => (
                      <label key={type.value} className={cn('cursor-pointer rounded-xl border p-3 transition', form.type === type.value ? 'border-brand-400 bg-brand-500/10' : 'border-line bg-surface-2 hover:border-line-strong')}>
                        <input type="radio" name="type" value={type.value} checked={form.type === type.value} onChange={set('type')} className="sr-only" />
                        <span className="block text-sm font-semibold text-fg">{type.label}</span>
                        <span className="mt-0.5 block text-xs text-muted">{type.hint}</span>
                      </label>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Urgency" required>
                {(props) => (
                  <Select {...props} value={form.severity} onChange={set('severity')} disabled={!form.type}>
                    <option value="">Choose an incident type first</option>
                    {SEVERITIES.map((severity) => <option key={severity.value} value={severity.value}>{severity.label} — {severity.hint}</option>)}
                  </Select>
                )}
              </Field>

              <Field label="What did you observe?" required error={errors.description} hint="Include quantities, direction of travel, nearby landmarks and immediate hazards.">
                {(props) => <Textarea {...props} value={form.description} onChange={set('description')} maxLength={1000} placeholder="Describe the evidence clearly for the response team…" />}
              </Field>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="grid gap-5">
              <div className="rounded-2xl border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-fg"><MapPin className="size-4 text-brand-500" /> Incident location</p>
                    <p className="mt-1 text-xs text-muted">GPS helps teams find the evidence quickly.</p>
                  </div>
                  <Button variant="secondary" icon={Crosshair} loading={locating} onClick={locate}>
                    {location ? 'Update GPS' : 'Use my location'}
                  </Button>
                </div>
                {location && <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 font-mono text-xs text-emerald-800 dark:text-emerald-200">{location.lat}, {location.lng} · accuracy ±{location.accuracyMeters} m</p>}
                {locationError && <p role="alert" className="mt-3 text-xs text-red-500 dark:text-red-300">{locationError}</p>}
              </div>

              <Field label="Location description" error={errors.locationNote} hint="Required when GPS is unavailable.">
                {(props) => <Input {...props} value={form.locationNote} onChange={set('locationNote')} maxLength={200} placeholder="e.g. 200 m north of water point 3" />}
              </Field>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">Photo evidence</p>
                    <p className="mt-1 text-xs text-subtle">Optional · up to 3 photos · compressed before saving</p>
                  </div>
                  <label className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm font-semibold text-fg hover:bg-elevated', (photos.length >= 3 || processingPhotos) && 'pointer-events-none opacity-50')}>
                    <ImagePlus className="size-4" /> {processingPhotos ? 'Preparing…' : 'Add photos'}
                    <input className="sr-only" type="file" accept="image/*" capture="environment" multiple onChange={addPhotos} disabled={photos.length >= 3 || processingPhotos} />
                  </label>
                </div>
                {photos.length > 0 && (
                  <ul className="mt-3 grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <li key={`${photo.caption}-${index}`} className="relative overflow-hidden rounded-xl border border-line bg-surface-2">
                        <img src={photo.dataUrl} alt={`Evidence ${index + 1}`} className="aspect-square w-full object-cover" />
                        <button type="button" aria-label={`Remove evidence photo ${index + 1}`} onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} className="absolute top-1.5 right-1.5 grid size-8 cursor-pointer place-items-center rounded-lg bg-black/65 text-white">
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {photoError && <p role="alert" className="mt-2 text-xs text-red-500 dark:text-red-300">{photoError}</p>}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="grid gap-4">
              <div className="rounded-2xl border border-brand-400/30 bg-brand-500/8 p-4">
                <p className="flex items-center gap-2 font-semibold text-fg"><ShieldCheck className="size-5 text-brand-500" /> Check before saving</p>
                <p className="mt-1 text-sm text-muted">The report is saved to this device first. You can safely retry if sending is interrupted.</p>
              </div>
              <dl className="grid gap-3 rounded-2xl border border-line bg-surface-2 p-4 sm:grid-cols-2">
                <div><dt className="text-xs text-subtle">Incident</dt><dd className="mt-0.5 font-semibold text-fg">{TYPE_LABELS[form.type]}</dd></div>
                <div><dt className="text-xs text-subtle">Urgency</dt><dd className="mt-0.5 font-semibold text-fg">{humanize(form.severity)}</dd></div>
                <div><dt className="text-xs text-subtle">Observed</dt><dd className="mt-0.5 text-sm text-fg">{formatDateTime(form.observedAt)}</dd></div>
                <div><dt className="text-xs text-subtle">Evidence</dt><dd className="mt-0.5 text-sm text-fg">{photos.length} photo{photos.length === 1 ? '' : 's'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-subtle">Location</dt><dd className="mt-0.5 text-sm text-fg">{location ? `${location.lat}, ${location.lng} (±${location.accuracyMeters} m)` : form.locationNote}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-subtle">Description</dt><dd className="mt-0.5 whitespace-pre-wrap text-sm text-fg">{form.description}</dd></div>
              </dl>
              {saveError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">{saveError}</p>}
            </motion.div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
            <Button variant="ghost" icon={ChevronLeft} disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)}>Back</Button>
            {step < 2 ? (
              <Button type="submit" icon={ChevronRight}>Continue</Button>
            ) : (
              <Button icon={queue.online ? Send : Camera} loading={saving} onClick={save}>{queue.online ? 'Save and send' : 'Save on this device'}</Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
