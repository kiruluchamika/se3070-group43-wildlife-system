import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * The selected record lives in the URL (?report=… or ?task=…), so
 * notification links open it directly and the browser back button works.
 */
export function useSelectedParam(name) {
  const [params, setParams] = useSearchParams()
  const selected = params.get(name)

  const select = useCallback(
    (value) =>
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(name, value)
        else next.delete(name)
        return next
      }),
    [name, setParams],
  )

  return [selected, select]
}
