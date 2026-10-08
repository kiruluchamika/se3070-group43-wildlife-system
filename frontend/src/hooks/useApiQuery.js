import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

const EMPTY = { path: null, token: -1, data: undefined, error: null, updatedAt: null }

/**
 * Loads `path` from the API and optionally re-polls it.
 * - `loading`: no data yet for this path (show skeletons)
 * - `refreshing`: a newer request is in flight while the old data stays visible
 */
export function useApiQuery(path, { enabled = true, refreshMs } = {}) {
  const [token, setToken] = useState(0)
  const [result, setResult] = useState(EMPTY)
  const active = enabled && Boolean(path)

  useEffect(() => {
    if (!active) return undefined
    const controller = new AbortController()

    api
      .get(path, { signal: controller.signal })
      .then((data) => setResult({ path, token, data, error: null, updatedAt: Date.now() }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setResult((previous) => ({
          path,
          token,
          data: previous.path === path ? previous.data : undefined,
          error,
          updatedAt: previous.path === path ? previous.updatedAt : null,
        }))
      })

    return () => controller.abort()
  }, [active, path, token])

  useEffect(() => {
    if (!active || !refreshMs) return undefined
    const interval = setInterval(() => setToken((value) => value + 1), refreshMs)
    return () => clearInterval(interval)
  }, [active, path, refreshMs])

  const reload = useCallback(() => setToken((value) => value + 1), [])
  const sameRequest = result.path === path

  return {
    data: sameRequest ? result.data : undefined,
    error: sameRequest ? result.error : null,
    loading: active && (!sameRequest || (result.data === undefined && result.error === null)),
    refreshing: active && sameRequest && result.token !== token,
    updatedAt: sameRequest ? result.updatedAt : null,
    reload,
  }
}
