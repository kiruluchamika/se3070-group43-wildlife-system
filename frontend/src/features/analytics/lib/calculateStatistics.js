const ERROR_MESSAGE = 'Unable to generate analysis results. Please try again.'

const idOf = (value) => {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value.id === 'string' && value.id.trim()) return value.id
  return null
}

function sourceRecords(value) {
  if (!Array.isArray(value) || value.some((record) => !record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id.trim())) {
    throw new Error('Invalid source records')
  }
  // Count each stored record once within its own source, not across sources.
  return [...new Map(value.map((record) => [record.id, record])).values()]
}

/** Pure Stage 3 calculation over the authorized, already-filtered Stage 2 response.
 * Event records are a source inventory, NOT a deduplicated wildlife incident total.
 * No refetching, re-filtering, mutation, or historical coverage calculations.
 */
export function calculateStatistics(dataset) {
  try {
    const { filters, park, period, records, zones } = dataset
    if (!filters || !idOf(park?.id) || filters.parkId !== park.id ||
      typeof park.name !== 'string' || typeof filters.startDate !== 'string' ||
      typeof filters.endDate !== 'string' || typeof filters.incidentType !== 'string' ||
      filters.species !== '' || !period || !Array.isArray(zones)) {
      throw new Error('Invalid analysis context')
    }
    const alerts = sourceRecords(records.alerts)
    const conflicts = sourceRecords(records.conflicts)
    const patrolRecords = sourceRecords(records.patrolRecords)
    const knownZones = new Set(zones.map((zone) => idOf(zone?.id)).filter(Boolean))
    const represented = new Set()
    for (const record of [...alerts, ...patrolRecords]) {
      const zoneId = idOf(record.zone)
      if (knownZones.has(zoneId)) represented.add(zoneId)
    }
    const statistics = {
      totalEventRecords: alerts.length + conflicts.length,
      alertRecords: alerts.length,
      conflictRecords: conflicts.length,
      representedZones: represented.size,
      patrolRecords: patrolRecords.length
    }
    return {
      status: statistics.totalEventRecords === 0 && statistics.patrolRecords === 0 ? 'empty' : 'ready',
      context: { filters: { ...filters }, park: { id: park.id, name: park.name }, period: { ...period }, retrievedAt: dataset.retrievedAt },
      statistics,
      representedZoneIds: [...represented].sort(),
      // Preserve source boundaries for later trends, hotspots and coverage.
      sources: { alerts, conflicts, patrolRecords },
      freshness: dataset.freshness
    }
  } catch {
    // Invalid payloads must not render misleading zero/partial results or crash React.
    return { status: 'error', message: ERROR_MESSAGE }
  }
}
