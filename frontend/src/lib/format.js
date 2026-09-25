const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const plural = (count, unit) => `${count} ${unit}${count === 1 ? '' : 's'}`

/** "just now", "12 min ago", "3 hours ago", "2 days ago". */
export function formatRelativeTime(value, now) {
  if (!value) return 'Never'
  const elapsed = new Date(now).getTime() - new Date(value).getTime()

  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${plural(Math.floor(elapsed / HOUR), 'hour')} ago`
  return `${plural(Math.floor(elapsed / DAY), 'day')} ago`
}

/** Hours since an event, phrased like the wireframe's "Last Patrolled" column. */
export function formatHoursAgo(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return 'Never patrolled'
  if (hours < 1) return 'Patrolling now'
  if (hours < 24) return `${plural(Math.floor(hours), 'hour')} ago`
  return `${plural(Math.floor(hours / 24), 'day')} ago`
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value)}%`
}

export function formatDistance(km) {
  if (km === null || km === undefined) return '—'
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export function formatEta(minutes) {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `~${minutes} min`
  return `~${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const shortTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const dateTime = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "Fri, 25 Sep 2026" */
export const formatLongDate = (value) => longDate.format(new Date(value))
/** "10:24 AM" */
export const formatTime = (value) => shortTime.format(new Date(value))
/** "25 Sep, 10:24" */
export const formatDateTime = (value) => dateTime.format(new Date(value))

export function initialsOf(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** "on-patrol" → "On patrol" */
export function humanize(value = '') {
  const text = value.replace(/[-_]/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
