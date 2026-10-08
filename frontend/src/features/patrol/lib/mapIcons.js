import L from 'leaflet'

/** Map colours per coverage status; the legend and polygons share them. */
export const ZONE_COLORS = {
  'under-patrolled': '#f87171',
  adequate: '#34d399',
  covered: '#38bdf8',
}

const TEAM_COLORS = {
  available: '#34d399',
  'on-patrol': '#38bdf8',
  responding: '#a78bfa',
  'off-duty': '#94a3b8',
}

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#38bdf8' }

const iconCache = new Map()

function cached(key, create) {
  if (!iconCache.has(key)) iconCache.set(key, create())
  return iconCache.get(key)
}

const USER_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
const WARNING_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'

/** Round badge for a ranger team, coloured by status. */
export function teamIcon(status, selected = false) {
  return cached(`team:${status}:${selected}`, () => {
    const color = TEAM_COLORS[status] ?? TEAM_COLORS['off-duty']
    const ring = selected ? '0 0 0 4px rgba(36,214,194,.55)' : '0 0 0 2px rgba(255,255,255,.85)'
    return L.divIcon({
      className: 'wg-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:#0b1f26;color:${color};border:2px solid ${color};box-shadow:${ring},0 6px 16px rgba(0,0,0,.45)">${USER_SVG}</span>`,
    })
  })
}

/** Warning triangle with a pulsing ring for an active alert. */
export function alertIcon(severity) {
  return cached(`alert:${severity}`, () => {
    const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.low
    return L.divIcon({
      className: 'wg-marker',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<span style="position:relative;display:grid;place-items:center;width:34px;height:34px">
          <span class="animate-pulse-ring" style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.55"></span>
          <span style="position:relative;display:grid;place-items:center;width:26px;height:26px;border-radius:9999px;background:${color};color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.9),0 6px 18px rgba(0,0,0,.45)">${WARNING_SVG}</span>
        </span>`,
    })
  })
}

/** GeoJSON [lng, lat] rings → Leaflet [lat, lng] positions. */
export const toLatLngs = (boundary) => (boundary?.coordinates?.[0] ?? []).map(([lng, lat]) => [lat, lng])

export function boundsOf(zones) {
  const points = zones.flatMap((assessment) => toLatLngs(assessment.zone.boundary))
  return points.length ? L.latLngBounds(points) : null
}
