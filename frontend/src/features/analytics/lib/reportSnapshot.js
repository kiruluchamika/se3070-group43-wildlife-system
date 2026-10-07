// Keep report values and traceable references, without duplicate raw source
// documents, map geometry or unrelated retrieval metadata.
export function reportSnapshot(handoff) {
  if (handoff.parks) return structuredClone({ context: handoff.context, parks: handoff.parks.map(reportSnapshot) })
  const zone = (value) => ({ id: value.id, name: value.name })
  const { trends, hotspots, coverage } = handoff.analysis
  const failed = { status: 'error' }
  return structuredClone({
    context: handoff.context,
    statistics: handoff.statistics,
    sourceReferences: Object.entries(handoff.sources).flatMap(([source, records]) => records.map((record) => ({ source, recordId: record.id }))),
    analysis: {
      trends: trends.status === 'error' ? failed : trends,
      hotspots: hotspots.status === 'error' ? failed : {
        status: hotspots.status, threshold: hotspots.threshold, omitted: hotspots.omitted, unzoned: hotspots.unzoned,
        hotspots: hotspots.hotspots.map((row) => ({ ...row, zone: zone(row.zone) })),
      },
      coverage: coverage.status === 'error' ? failed : { ...coverage, zones: coverage.zones.map((row) => ({ ...row, zone: zone(row.zone) })) },
    },
  })
}

export function reportSaveBody(handoff, requestId, status) {
  if (!['draft', 'finalized'].includes(status)) throw new Error('Choose Draft or Finalized.')
  const body = { requestId, status, title: handoff.title, findings: handoff.findings, recommendations: handoff.recommendations, snapshot: reportSnapshot(handoff) }
  // Stay below the existing API's 1 MiB JSON limit; never truncate the report.
  if (new TextEncoder().encode(JSON.stringify(body)).length > 950000) {
    throw new Error('This report exceeds the save size limit. Return to Analysis and select a shorter period to create a smaller report.')
  }
  return body
}
