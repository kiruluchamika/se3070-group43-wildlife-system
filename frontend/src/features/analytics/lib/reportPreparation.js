export const REPORT_LIMITS = { title: 200, findings: 5000, recommendations: 5000 }
export const initialReportState = {
  step: 'results', title: '', findings: '', recommendations: '', errors: {}, handoff: null,
}

export function validateReport(state, requireTitle = false) {
  const errors = {}
  for (const [field, limit] of Object.entries(REPORT_LIMITS)) {
    if (state[field].length > limit) errors[field] = `Use ${limit} characters or fewer.`
  }
  if (requireTitle && !state.title.trim()) errors.title = 'Enter a report title.'
  return errors
}

// Generation creates a session-only preview; persistence requires a save action.
export function reportPreparationReducer(state, action) {
  switch (action.type) {
    case 'findings': return { ...state, step: 'findings', errors: {} }
    case 'back': return { ...state, step: 'results', errors: {} }
    case 'preparation': return state.step === 'preview' ? { ...state, step: 'preparation', errors: {} } : state
    case 'edit':
      if (!(action.field in REPORT_LIMITS)) return state
      return { ...state, [action.field]: action.value, errors: { ...state.errors, [action.field]: undefined }, handoff: null }
    case 'prepare': {
      if (state.step !== 'findings') return state
      const errors = validateReport(state)
      return { ...state, errors, step: Object.keys(errors).length ? 'findings' : 'preparation' }
    }
    case 'generate': {
      if (state.step !== 'preparation') return state
      const errors = validateReport(state, true)
      if (Object.keys(errors).length) return { ...state, errors, handoff: null }
      return { ...state, step: 'preview', requestId: action.requestId, errors, handoff: structuredClone({
        title: state.title, findings: state.findings, recommendations: state.recommendations,
        context: action.result.context, statistics: action.result.statistics,
        analysis: action.analysis, sources: action.result.sources, dataset: action.dataset,
        ...(action.result.parks && { parks: action.result.parks }),
      }) }
    }
    default: return state
  }
}
