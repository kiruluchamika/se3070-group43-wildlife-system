import { Camera, Clock, ExternalLink, MapPin, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { formatDateTime, formatRelativeTime, humanize } from '../../../lib/format'
import { FIELD_ACTION_LABELS, TYPE_LABELS, placeOf } from '../lib/conflict'

function Fact({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl bg-surface-2/70 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-subtle">
        {Icon && <Icon className="size-3" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold break-words text-fg">{children}</dd>
    </div>
  )
}

const mapLink = ({ lat, lng }) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`

/** The facts every UC01 screen shows about a report: what, where, when and who to contact. */
export function ReportFacts({ report, now, showContact = true }) {
  const damage = report.damage
  return (
    <div className="grid gap-3">
      <p className="text-sm whitespace-pre-line text-fg">{report.description}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Fact icon={MapPin} label="Location">
          {placeOf(report) || '—'}
          {report.location?.lat !== undefined && (
            <a
              href={mapLink(report.location)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              GPS {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
              {report.location.accuracyMeters ? ` (±${report.location.accuracyMeters} m)` : ''}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </Fact>
        <Fact icon={Clock} label="Happened">
          {formatDateTime(report.occurredAt)}
          <span className="block text-xs font-normal text-muted">{formatRelativeTime(report.occurredAt, now)}</span>
        </Fact>
        {showContact && (
          <Fact icon={UserRound} label="Contact">
            {report.contactName}
            <a href={`tel:${report.contactPhone}`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
              <Phone className="size-3" aria-hidden="true" /> {report.contactPhone}
            </a>
          </Fact>
        )}
        <Fact label="Type">{TYPE_LABELS[report.conflictType] ?? humanize(report.conflictType)}</Fact>
      </dl>
      {damage && (
        <dl className="grid gap-2 rounded-xl border border-amber-400/30 bg-amber-500/8 p-3 text-sm sm:grid-cols-2">
          {damage.cropType && <Fact label="Crop">{damage.cropType}</Fact>}
          {damage.affectedAreaAcres !== undefined && <Fact label="Affected area">{damage.affectedAreaAcres} acres</Fact>}
          {damage.propertyType && <Fact label="Property">{damage.propertyType}</Fact>}
          {damage.estimatedLossLkr !== undefined && <Fact label="Estimated loss">LKR {damage.estimatedLossLkr.toLocaleString()}</Fact>}
          {damage.notes && <Fact label="Damage notes">{damage.notes}</Fact>}
        </dl>
      )}
    </div>
  )
}

/** Photo thumbnails; selecting one opens it full size. Lists omit the image data, so only the count shows there. */
export function EvidenceGallery({ evidence = [] }) {
  const [open, setOpen] = useState(null)
  if (!evidence.length) return null
  const withImages = evidence.filter((photo) => photo.dataUrl)

  if (!withImages.length) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Camera className="size-3.5" aria-hidden="true" /> {evidence.length} photo{evidence.length === 1 ? '' : 's'} attached
      </p>
    )
  }

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {withImages.map((photo, index) => (
          <li key={photo.id ?? index}>
            <button
              type="button"
              onClick={() => setOpen(photo)}
              className="block size-20 cursor-zoom-in overflow-hidden rounded-xl border border-line transition hover:shadow-glow"
              aria-label={`Open photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ''}`}
            >
              <img src={photo.dataUrl} alt="" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.caption || 'Photo evidence'} size="lg">
        {open && <img src={open.dataUrl} alt={open.caption || 'Conflict evidence'} className="w-full rounded-xl" />}
      </Modal>
    </>
  )
}

/** Audit trail of status changes and decisions (main flow step 5, "record history"). */
export function HistoryTimeline({ history = [] }) {
  if (!history.length) return <p className="text-sm text-muted">No history yet.</p>
  return (
    <ol className="relative grid gap-3 border-l border-line pl-4">
      {[...history].reverse().map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="relative">
          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand-400 ring-4 ring-canvas" aria-hidden="true" />
          <p className="text-sm font-semibold text-fg">{humanize(entry.action)}</p>
          <p className="text-xs text-subtle">
            {formatDateTime(entry.at)}
            {entry.by?.name ? ` · ${entry.by.name}` : ''}
          </p>
          {entry.note && <p className="mt-0.5 text-xs text-muted">{entry.note}</p>}
        </li>
      ))}
    </ol>
  )
}

/** Field actions recorded by the ranger team, oldest first. */
export function ActionList({ actions = [] }) {
  if (!actions.length) return <p className="text-sm text-muted">No field actions recorded yet.</p>
  return (
    <ul className="grid gap-2">
      {actions.map((action) => (
        <li key={action.id ?? action.clientUpdateId} className="rounded-xl bg-surface-2/70 p-3 text-sm">
          <p className="font-semibold text-fg">{FIELD_ACTION_LABELS[action.type] ?? humanize(action.type)}</p>
          <p className="text-xs text-subtle">
            {formatDateTime(action.recordedAt)}
            {action.recordedBy?.name ? ` · ${action.recordedBy.name}` : ''}
            {action.recordedOffline ? ' · recorded offline' : ''}
          </p>
          {action.note && <p className="mt-1 text-xs text-muted">{action.note}</p>}
        </li>
      ))}
    </ul>
  )
}
