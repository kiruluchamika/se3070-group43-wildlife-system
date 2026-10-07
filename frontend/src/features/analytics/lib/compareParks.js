import { calculateStatistics } from './calculateStatistics'
import { calculateVisualizations } from './calculateVisualizations'

/** Reuse the single-park calculators; never concatenate source records or zones. */
export function calculateComparison(dataset) {
  const parks = dataset.datasets.map((data) => {
    const result = calculateStatistics(data)
    return { ...result, analysis: calculateVisualizations(result, data) }
  })
  return { context: { filters: dataset.filters, retrievedAt: dataset.retrievedAt }, parks }
}

// Existing metrics only. No combined event totals or invented coverage percentage.
export function comparisonRows(parks) {
  return parks.map((park) => ({
    id: park.context.park.id, name: park.context.park.name, ...park.statistics,
    hotspots: park.analysis.hotspots.status === 'error' ? null : park.analysis.hotspots.hotspots.length,
    patrolHours: park.analysis.coverage.status === 'error' ? null : park.analysis.coverage.zones.reduce((total, zone) => total + zone.hours, 0),
  }))
}
