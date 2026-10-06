import { useCallback, useEffect, useRef, useState } from 'react'
import { api, toQuery } from '../../../lib/api'

/** The dataset stays in memory for Stage 3, never localStorage or the URL. */
export function useAnalysisRetrieval() {
  const [state, setState] = useState({ phase: 'filters', dataset: null, error: null })
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  const reset = useCallback(() => {
    request.current?.abort()
    request.current = null
    setState({ phase: 'filters', dataset: null, error: null })
  }, [])

  const retrieve = useCallback(async (filters) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState({ phase: 'retrieving', dataset: null, error: null })
    try {
      const dataset = await api.get(`/analytics${toQuery(filters)}`, { signal: controller.signal })
      if (controller.signal.aborted) return
      setState({ phase: dataset.freshness.requiresConfirmation ? 'warning' : 'ready', dataset, error: null })
    } catch (error) {
      if (controller.signal.aborted) return
      setState({ phase: 'filters', dataset: null, error })
    }
  }, [])

  const continueAnalysis = useCallback(() => {
    setState((current) => current.phase === 'warning' ? { ...current, phase: 'ready' } : current)
  }, [])

  return { ...state, retrieve, reset, continueAnalysis }
}
