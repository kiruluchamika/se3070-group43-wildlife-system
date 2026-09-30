import { useCallback, useState } from 'react'
import { toast } from 'sonner'

/**
 * Runs one server action with a saving flag and an inline error. On success it
 * shows `success` as a toast and calls `onDone`; on failure nothing is
 * assumed to have changed and the error stays next to the form.
 */
export function useAction(onDone) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(
    async (action, success) => {
      setSaving(true)
      setError(null)
      try {
        const result = await action()
        if (success) toast.success(typeof success === 'function' ? success(result) : success)
        onDone?.(result)
        return result
      } catch (actionError) {
        setError(actionError)
        return null
      } finally {
        setSaving(false)
      }
    },
    [onDone],
  )

  return { run, saving, error, clearError: () => setError(null) }
}
