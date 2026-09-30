import { Camera, Crosshair, FileCheck2, ImagePlus, Loader2, MapPin, PencilLine, Send, ShieldAlert, Siren, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SuccessCheck } from '../../../components/ui/Animated'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/Feedback'
import { Field, Input, Select, Textarea } from '../../../components/ui/Field'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useAuth } from '../../../context/auth-context'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { cn } from '../../../lib/cn'
import { useNow } from '../../../hooks/useNow'
import { conflictApi } from '../api/conflictApi'
import { ReportFacts } from '../components/ReportDetails'
import { CONFLICT_TYPES, DAMAGE_TYPES, toLocalInput } from '../lib/conflict'
import { captureLocation, preparePhoto } from '../lib/device'

const MAX_PHOTOS = 3

const emptyForm = (user) => ({
  parkId: '',
  conflictType: '',
  immediateDanger: false,
  village: '',
  landmark: '',
  occurredAt: toLocalInput(),
  description: '',
  contactName: user?.name ?? '',
  contactPhone: user?.phone ?? '',
  cropType: '',
  affectedAreaAcres: '',
  propertyType: '',
  estimatedLossLkr: '',
})

/** Client-side checks that mirror the server rules, so most mistakes are caught before sending. */
function validateForm(form, parkId) {
  const errors = {}
  if (!parkId) errors.parkId = 'Choose the nearest park.'
  if (!form.conflictType) errors.conflictType = 'Choose what is happening.'
  if (form.village.trim().length < 2) errors.village = 'Enter your village.'
  if (form.description.trim().length < 10) errors.description = 'Describe what happened in at least 10 characters.'
  if (form.contactName.trim().length < 2) errors.contactName = 'Enter a contact name.'
  if (!/^\+?[0-9 ()-]{7,20}$/.test(form.contactPhone.trim())) errors.contactPhone = 'Enter a valid phone number.'
  if (!form.occurredAt) errors.occurredAt = 'Enter when it happened.'
  else if (new Date(form.occurredAt).getTime() > Date.now() + 5 * 60 * 1000) errors.occurredAt = 'The time cannot be in the future.'
  if (form.conflictType === 'crop-damage') {
    if (!form.cropType.trim()) errors.cropType = 'Enter the crop that was damaged.'
    if (form.affectedAreaAcres === '') errors.affectedAreaAcres = 'Estimate the damaged area.'
  }
  if (form.conflictType === 'property-damage' && !form.propertyType.trim()) errors.propertyType = 'Enter what was damaged.'
  return errors
}

function toPayload(form, parkId, location, photos) {
  const number = (value) => (value === '' ? undefined : Number(value))
  const damage = DAMAGE_TYPES.includes(form.conflictType)
    ? {
        cropType: form.conflictType === 'crop-damage' ? form.cropType.trim() : undefined,
        affectedAreaAcres: form.conflictType === 'crop-damage' ? number(form.affectedAreaAcres) : undefined,
        propertyType: form.conflictType === 'property-damage' ? form.propertyType.trim() : undefined,
        estimatedLossLkr: number(form.estimatedLossLkr),
      }
    : undefined

  return {
    parkId,
    conflictType: form.conflictType,
    immediateDanger: form.immediateDanger,
    village: form.village.trim(),
    landmark: form.landmark.trim() || undefined,
    occurredAt: new Date(form.occurredAt).toISOString(),
    description: form.description.trim(),
    contactName: form.contactName.trim(),
    contactPhone: form.contactPhone.trim(),
    location: location ?? undefined,
    damage,
    evidence: photos.length ? photos : undefined,
  }
}

/** Maps the server's `details` (for example `damage.cropType`) onto form fields. */
function serverFieldErrors(error) {
  return Object.fromEntries((error.details ?? []).map((detail) => [detail.field.split('.').at(-1), detail.message]))
}

/**
 * UC01 main flow step 1: the villager reports a human–elephant conflict.
 * Mobile-first, with a review step before anything is sent.
 */
export default function ReportConflictPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = useNow()
  const parks = useApiQuery('/parks')
  const [form, setForm] = useState(() => emptyForm(user))
  const [errors, setErrors] = useState({})
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [photos, setPhotos] = useState([])
  const [photoError, setPhotoError] = useState(null)
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [step, setStep] = useState('edit')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(null)

  const parkList = parks.data?.parks ?? []
  const parkId = form.parkId || parkList[0]?.id || ''
  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function useMyLocation() {
    setLocating(true)
    setLocationError(null)
    try {
      setLocation(await captureLocation())
    } catch (error) {
      setLocationError(error.message)
    } finally {
      setLocating(false)
    }
  }

  async function addPhotos(event) {
    const files = [...event.target.files].slice(0, MAX_PHOTOS - photos.length)
    event.target.value = ''
    if (!files.length) return
    setProcessingPhotos(true)
    setPhotoError(null)
    const results = await Promise.allSettled(files.map(preparePhoto))
    setPhotos((current) => [...current, ...results.filter((result) => result.status === 'fulfilled').map((result) => result.value)].slice(0, MAX_PHOTOS))
    const failed = results.find((result) => result.status === 'rejected')
    if (failed) setPhotoError(failed.reason.message)
    setProcessingPhotos(false)
  }

  function review(event) {
    event.preventDefault()
    const found = validateForm(form, parkId)
    setErrors(found)
    if (Object.keys(found).length === 0) {
      setSubmitError(null)
      setStep('review')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { report } = await conflictApi.submit(toPayload(form, parkId, location, photos))
      setSubmitted(report)
    } catch (error) {
      setSubmitError(error)
      if (error.code === 'VALIDATION_ERROR') {
        setErrors(serverFieldErrors(error))
        setStep('edit')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="panel flex flex-col items-center p-8 text-center">
          <SuccessCheck className="text-emerald-500 dark:text-emerald-400" />
          <h1 className="mt-4 text-2xl font-extrabold text-fg">Report sent</h1>
          <p className="mt-1 text-muted">Your reference number is</p>
          <p className="mt-2 rounded-xl bg-brand-500/10 px-4 py-2 font-mono text-lg font-bold text-brand-700 dark:text-brand-200">{submitted.reference}</p>
          <p className="mt-4 max-w-sm text-sm text-muted">
            {submitted.immediateDanger
              ? 'Officers have been alerted. Move everyone to a safe place and keep away from the elephant.'
              : 'A community liaison officer will verify your report. You will be notified at each step.'}
          </p>
          {!submitted.locationAdequate && (
            <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              The officer may ask you for a clearer landmark before sending rangers.
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button icon={FileCheck2} onClick={() => navigate(`/conflicts/mine?report=${submitted.id}`)}>
              Track this report
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSubmitted(null)
                setForm(emptyForm(user))
                setLocation(null)
                setPhotos([])
                setStep('edit')
              }}
            >
              Report another
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  const preview = { ...toPayload(form, parkId, location, photos), reference: '' }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="UC01 · Villager"
        title="Report an elephant conflict"
        description="Tell the wildlife office what is happening. If anyone is in danger right now, also call the local wildlife office."
      />

      {parks.error ? (
        <div className="panel">
          <ErrorState title="The form could not load" message={parks.error.message} onRetry={parks.reload} />
        </div>
      ) : step === 'review' ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel grid gap-5 p-5">
          <div>
            <h2 className="text-lg font-bold text-fg">Check your report</h2>
            <p className="text-sm text-muted">Nothing is sent until you select Send report.</p>
          </div>
          {form.immediateDanger && (
            <p className="flex items-center gap-2 rounded-xl bg-red-500/12 p-3 text-sm font-semibold text-red-700 dark:text-red-200">
              <Siren className="size-4" aria-hidden="true" /> Marked as immediate danger to people
            </p>
          )}
          <ReportFacts report={preview} now={now} />
          <p className="text-xs text-muted">
            {location ? 'GPS location attached.' : 'No GPS location attached.'} {photos.length ? `${photos.length} photo(s) attached.` : 'No photos attached.'}
          </p>
          {submitError && submitError.code !== 'VALIDATION_ERROR' && (
            <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
              {submitError.message} Your report has not been sent; your details are kept so you can try again.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" icon={PencilLine} onClick={() => setStep('edit')} disabled={submitting}>
              Edit
            </Button>
            <Button icon={Send} loading={submitting} onClick={submit} variant={form.immediateDanger ? 'danger' : 'primary'}>
              Send report
            </Button>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={review} noValidate className="grid gap-5">
          <section className="panel grid gap-4 p-5">
            <Field label="What is happening?" required error={errors.conflictType}>
              {() => (
                <div role="radiogroup" aria-label="Type of conflict" className="grid gap-2 sm:grid-cols-2">
                  {CONFLICT_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={cn(
                        'flex cursor-pointer flex-col rounded-xl border p-3 transition',
                        form.conflictType === type.value ? 'border-brand-400 bg-brand-500/10 shadow-glow' : 'border-line-strong hover:border-brand-500/50',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                        <input type="radio" name="conflictType" value={type.value} checked={form.conflictType === type.value} onChange={set('conflictType')} className="accent-brand-500" />
                        {type.label}
                      </span>
                      <span className="mt-1 pl-5 text-xs text-muted">{type.hint}</span>
                    </label>
                  ))}
                </div>
              )}
            </Field>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                form.immediateDanger ? 'border-red-400/60 bg-red-500/12' : 'border-line-strong hover:border-red-400/50',
              )}
            >
              <input type="checkbox" checked={form.immediateDanger} onChange={set('immediateDanger')} className="mt-1 size-4 accent-red-500" />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-fg">
                  <ShieldAlert className="size-4 text-red-500" aria-hidden="true" /> People are in danger right now
                </span>
                <span className="text-xs text-muted">The report is marked critical and officers are alerted at once.</span>
              </span>
            </label>
            <AnimatePresence>
              {form.immediateDanger && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  Stay indoors or move away from the elephant. Do not approach it, throw things at it or use flash photography.
                </motion.p>
              )}
            </AnimatePresence>
          </section>

          <section className="panel grid gap-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
              <MapPin className="size-4 text-brand-500" aria-hidden="true" /> Where and when
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nearest park" required error={errors.parkId}>
                {(props) => (
                  <Select {...props} value={parkId} onChange={set('parkId')} disabled={parks.loading}>
                    {parkList.map((park) => (
                      <option key={park.id} value={park.id}>
                        {park.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="When did it happen?" required error={errors.occurredAt}>
                {(props) => <Input {...props} type="datetime-local" value={form.occurredAt} max={toLocalInput()} onChange={set('occurredAt')} />}
              </Field>
              <Field label="Village" required error={errors.village}>
                {(props) => <Input {...props} value={form.village} onChange={set('village')} placeholder="e.g. Kataragama" autoComplete="address-level3" />}
              </Field>
              <Field label="Nearby landmark" hint="A tank, temple, school or road helps rangers find you." error={errors.landmark}>
                {(props) => <Input {...props} value={form.landmark} onChange={set('landmark')} placeholder="e.g. Behind the old tank" />}
              </Field>
            </div>

            <div className="rounded-xl border border-dashed border-line-strong p-3">
              {location ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-fg">
                    <Crosshair className="mr-1 inline size-4 text-emerald-500" aria-hidden="true" />
                    GPS {location.lat.toFixed(5)}, {location.lng.toFixed(5)} <span className="text-muted">(±{location.accuracyMeters} m)</span>
                  </p>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setLocation(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted">Optional: share your exact location so rangers can find you faster.</p>
                  <Button variant="secondary" size="sm" icon={locating ? Loader2 : Crosshair} loading={locating} onClick={useMyLocation}>
                    Use my location
                  </Button>
                </div>
              )}
              {locationError && (
                <p role="alert" className="mt-2 text-xs font-medium text-red-500 dark:text-red-300">
                  {locationError}
                </p>
              )}
            </div>
          </section>

          <section className="panel grid gap-4 p-5">
            <Field label="What happened?" required error={errors.description}>
              {(props) => (
                <Textarea {...props} value={form.description} onChange={set('description')} maxLength={1000} placeholder="How many elephants, what they are doing, and anything damaged." />
              )}
            </Field>

            {form.conflictType === 'crop-damage' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Crop" required error={errors.cropType}>
                  {(props) => <Input {...props} value={form.cropType} onChange={set('cropType')} placeholder="Paddy" />}
                </Field>
                <Field label="Area (acres)" required error={errors.affectedAreaAcres}>
                  {(props) => <Input {...props} type="number" min="0" step="0.1" inputMode="decimal" value={form.affectedAreaAcres} onChange={set('affectedAreaAcres')} />}
                </Field>
                <Field label="Estimated loss (LKR)" error={errors.estimatedLossLkr}>
                  {(props) => <Input {...props} type="number" min="0" inputMode="numeric" value={form.estimatedLossLkr} onChange={set('estimatedLossLkr')} />}
                </Field>
              </div>
            )}
            {form.conflictType === 'property-damage' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What was damaged" required error={errors.propertyType}>
                  {(props) => <Input {...props} value={form.propertyType} onChange={set('propertyType')} placeholder="House wall, fence, store…" />}
                </Field>
                <Field label="Estimated loss (LKR)" error={errors.estimatedLossLkr}>
                  {(props) => <Input {...props} type="number" min="0" inputMode="numeric" value={form.estimatedLossLkr} onChange={set('estimatedLossLkr')} />}
                </Field>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Photos (optional, up to {MAX_PHOTOS})</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <div key={photo.dataUrl.slice(-24)} className="group relative size-20 overflow-hidden rounded-xl border border-line">
                    <img src={photo.dataUrl} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((current) => current.filter((entry) => entry !== photo))}
                      className="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center rounded-full bg-slate-950/70 text-white"
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong text-subtle transition hover:border-brand-400 hover:text-brand-500">
                    {processingPhotos ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" aria-hidden="true" />}
                    <span className="sr-only">Add photos</span>
                    <input type="file" accept="image/*" capture="environment" multiple onChange={addPhotos} className="sr-only" disabled={processingPhotos} />
                  </label>
                )}
              </div>
              {photoError && (
                <p role="alert" className="mt-2 flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-300">
                  <Camera className="size-3.5" aria-hidden="true" /> {photoError}
                </p>
              )}
            </div>
          </section>

          <section className="panel grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Contact name" required error={errors.contactName}>
              {(props) => <Input {...props} value={form.contactName} onChange={set('contactName')} autoComplete="name" />}
            </Field>
            <Field label="Contact phone" required hint="Used for SMS updates if the app cannot reach you." error={errors.contactPhone}>
              {(props) => <Input {...props} type="tel" value={form.contactPhone} onChange={set('contactPhone')} autoComplete="tel" placeholder="+94 71 234 5678" />}
            </Field>
          </section>

          <div className="flex justify-end">
            <Button type="submit" size="lg" icon={FileCheck2} disabled={processingPhotos}>
              Review report
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
