const DAY = 86400000
const HOUR = 3600000
const OFFSET = 5.5 * HOUR
export const HOTSPOT_THRESHOLD = 3
const idOf = (value) => typeof value === 'string' ? value : value?.id
const timestamp = (value) => value == null || value === '' ? NaN : new Date(value).getTime()
const dayOf = (time) => new Date(time + OFFSET).toISOString().slice(0, 10)

function periodOf(dataset) {
  const from = timestamp(dataset.period?.from)
  const until = timestamp(dataset.period?.until)
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) throw new Error('Invalid period')
  return { from, until }
}

function eventsOf(result, dataset) {
  const { from, until } = periodOf(dataset)
  let omitted = 0
  const events = []
  for (const [source, dateField] of [['alerts', 'createdAt'], ['conflicts', 'occurredAt']]) {
    for (const record of result.sources[source]) {
      const at = timestamp(record[dateField])
      if (!Number.isFinite(at)) { omitted++; continue }
      if (at < from || at >= until) continue
      events.push({ source, recordId: record.id, at, zoneId: source === 'alerts' ? idOf(record.zone) : null })
    }
  }
  return { events, omitted }
}

/** Daily for <=62 days, monthly otherwise. Zero buckets preserve the selected span. */
export function calculateTrends(result, dataset) {
  const { from, until } = periodOf(dataset)
  const { events, omitted } = eventsOf(result, dataset)
  const unit = (until - from) / DAY <= 62 ? 'day' : 'month'
  const buckets = new Map()
  let cursor = new Date(from + OFFSET)
  if (unit === 'month') cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
  while (cursor.getTime() < until + OFFSET) {
    const key = cursor.toISOString().slice(0, unit === 'day' ? 10 : 7)
    buckets.set(key, { key, alerts: 0, conflicts: 0, references: [] })
    if (buckets.size > 1200) throw new Error('Select a shorter trend period')
    if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1)
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  for (const event of events) {
    const bucket = buckets.get(dayOf(event.at).slice(0, unit === 'day' ? 10 : 7))
    bucket[event.source]++
    bucket.references.push({ source: event.source, recordId: event.recordId })
  }
  return { status: events.length ? 'ready' : 'empty', unit, buckets: [...buckets.values()], omitted }
}

/** Current conflicts have no zone field; only zone-linked alert events qualify. */
export function calculateHotspots(result, dataset) {
  const { events, omitted } = eventsOf(result, dataset)
  const zones = new Map(dataset.zones.filter((zone) => zone?.id).map((zone) => [zone.id, zone]))
  const rows = new Map()
  let unzoned = 0
  for (const event of events) {
    if (!zones.has(event.zoneId)) { unzoned++; continue }
    if (!rows.has(event.zoneId)) rows.set(event.zoneId, { zone: zones.get(event.zoneId), count: 0, references: [] })
    const row = rows.get(event.zoneId)
    row.count++
    row.references.push({ source: event.source, recordId: event.recordId })
  }
  const represented = [...rows.values()].sort((a, b) => b.count - a.count || a.zone.id.localeCompare(b.zone.id))
  const hotspots = represented.filter((row) => row.count >= HOTSPOT_THRESHOLD)
  return { status: hotspots.length ? 'ready' : 'empty', threshold: HOTSPOT_THRESHOLD, hotspots, represented, unzoned, omitted }
}

/** UC04 effort semantics, prorated to the selected elapsed window:
 * target = zone target per policy window * elapsed days / policy window days.
 * hours = summed interval overlap, including ongoing patrols up to retrievedAt.
 * No completion percentage, area coverage, assignment state, or risk inference.
 */
export function calculatePatrolCoverage(result, dataset) {
  const { from, until } = periodOf(dataset)
  const retrieved = timestamp(dataset.retrievedAt)
  if (!Number.isFinite(retrieved)) throw new Error('Missing retrieval time')
  const cutoff = Math.min(until, retrieved)
  const elapsedDays = Math.max(0, (cutoff - from) / DAY)
  const windowDays = dataset.park.coveragePolicy?.windowDays ?? 7
  if (!Number.isFinite(windowDays) || windowDays <= 0) throw new Error('Invalid coverage policy')
  const rows = new Map(dataset.zones.filter((zone) => zone?.id).map((zone) => [zone.id, {
    zone, hours: 0, references: [],
    targetHours: Number.isFinite(zone.targetWeeklyPatrolHours) && zone.targetWeeklyPatrolHours > 0 && elapsedDays > 0
      ? zone.targetWeeklyPatrolHours * elapsedDays / windowDays : null
  }]))
  let omitted = 0
  let included = 0
  for (const record of result.sources.patrolRecords) {
    const row = rows.get(idOf(record.zone))
    const start = timestamp(record.startTime)
    const end = record.endTime == null ? cutoff : timestamp(record.endTime)
    if (!row || !Number.isFinite(start) || !Number.isFinite(end) || end < start) { omitted++; continue }
    const overlap = Math.min(end, cutoff) - Math.max(start, from)
    if (overlap <= 0) continue
    row.hours += overlap / HOUR
    row.references.push({ source: 'patrolRecords', recordId: record.id })
    included++
  }
  return {
    status: included ? 'ready' : 'empty', elapsedDays, windowDays, cutoff: new Date(cutoff).toISOString(), omitted,
    zones: [...rows.values()].map((row) => ({ ...row, percent: row.targetHours === null ? null : Math.min(100, Math.round(row.hours / row.targetHours * 100)) }))
  }
}

function safely(work) {
  try { return work() } catch { return { status: 'error', message: 'Unable to calculate this section. Try retrieving the data again or choose a shorter period.' } }
}

export function calculateVisualizations(result, dataset) {
  if (result.status === 'error') return null
  const trends = safely(() => calculateTrends(result, dataset))
  const hotspots = safely(() => calculateHotspots(result, dataset))
  const coverage = safely(() => calculatePatrolCoverage(result, dataset))
  return {
    trends, hotspots, coverage,
    supportingCategories: ['all', 'trends', ...(hotspots.status === 'ready' ? ['hotspots'] : []), 'patrol-coverage']
  }
}

/** Validate existing GeoJSON rings before passing them to Leaflet; never invent geometry. */
export function polygonPositions(boundary) {
  if (boundary?.type !== 'Polygon' || !Array.isArray(boundary.coordinates) || !boundary.coordinates.length) return null
  const valid = boundary.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4 &&
    ring.every((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
      Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90) &&
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
  return valid ? boundary.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng])) : null
}
