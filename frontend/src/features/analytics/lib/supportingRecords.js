export const CATEGORY_LABELS = { all: 'All Results', trends: 'Trends', hotspots: 'Hotspots', 'patrol-coverage': 'Patrol Coverage' }
export const EMPTY_MESSAGES = {
  all: 'No supporting records are available for this result.',
  trends: 'No records available for the selected trend analysis.',
  hotspots: 'No hotspot records are available.',
  'patrol-coverage': 'No patrol records are available for this analysis.',
}
export const initialSupportingState = { open: false, category: 'all', zoneId: '', page: 0 }
export function supportingReducer(state, action) {
  switch (action.type) {
    case 'open': return { ...initialSupportingState, open: true }
    case 'close': return { ...state, open: false }
    case 'category': return { ...state, category: action.value, zoneId: '', page: 0 }
    case 'zone': return { ...state, zoneId: action.value, page: 0 }
    case 'page': return { ...state, page: Math.max(0, action.value) }
    default: return state
  }
}

// Index only the current, already normalized Stage 3 sources. Never query again.
export function indexSupportingRecords(result) {
  return new Map(Object.entries(result.sources).flatMap(([source, records]) =>
    records.map((record) => [`${source}:${record.id}`, { source, record }])))
}

export function supportingCategories(analysis) {
  return ['all', 'trends', ...(analysis.hotspots.status === 'ready' && analysis.hotspots.hotspots.length ? ['hotspots'] : []), 'patrol-coverage']
}

export function selectSupportingRecords(index, analysis, category, zoneId = '') {
  if (category === 'all') return { rows: [...index.values()], zones: [], status: index.size ? 'ready' : 'empty' }
  const section = category === 'patrol-coverage' ? analysis.coverage : analysis[category]
  if (!section || section.status === 'error') return { rows: [], zones: [], status: 'error' }
  const groups = category === 'trends' ? section.buckets : category === 'hotspots' ? section.hotspots : section.zones
  const zones = category === 'trends' ? [] : groups.map((group) => group.zone)
  const references = groups.filter((group) => !zoneId || group.zone?.id === zoneId).flatMap((group) => group.references)
  const rows = [...new Set(references.map(({ source, recordId }) => `${source}:${recordId}`))]
    .map((key) => index.get(key)).filter(Boolean)
  return { rows, zones, status: rows.length ? 'ready' : 'empty' }
}
