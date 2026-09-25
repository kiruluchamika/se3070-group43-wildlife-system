import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../../context/auth-context'
import { useApiQuery } from '../../../hooks/useApiQuery'

/**
 * The park shown on the patrol screens. It is kept in the URL (?park=) so the
 * view can be shared, and defaults to the manager's home park.
 */
export function useSelectedPark() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useApiQuery('/parks')

  const parks = data?.parks ?? []
  const requested = params.get('park')
  const park = parks.find((entry) => entry.id === requested) ?? parks.find((entry) => entry.id === user?.park) ?? parks[0] ?? null

  const selectPark = useCallback(
    (parkId) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('park', parkId)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  return { parks, park, parkId: park?.id ?? null, selectPark, loading, error, reload }
}
