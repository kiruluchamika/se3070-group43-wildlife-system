import { useCallback, useEffect, useRef, useState } from 'react'
import { discardIncident, listIncidents, retryIncident, saveIncident } from './incidentDb'
import { syncIncidents } from './incidentQueue'

export function useIncidentQueue(ownerId, { onSynced } = {}) {
  const [items, setItems] = useState([])
  const [online, setOnline] = useState(() => navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const running = useRef(false)

  const refresh = useCallback(async () => {
    setItems(ownerId ? await listIncidents(ownerId).catch(() => []) : [])
  }, [ownerId])

  const sync = useCallback(async () => {
    if (!ownerId || running.current || !navigator.onLine) return null
    running.current = true
    setSyncing(true)
    try {
      const result = await syncIncidents(ownerId)
      setLastResult({ ...result, at: Date.now() })
      if (result.synced) onSynced?.(result)
      return result
    } finally {
      running.current = false
      setSyncing(false)
      await refresh()
    }
  }, [onSynced, ownerId, refresh])

  const save = useCallback(
    async (payload) => {
      const item = await saveIncident(ownerId, payload)
      await refresh()
      const result = await sync()
      return { item, sent: Boolean(result?.synced) }
    },
    [ownerId, refresh, sync],
  )

  const retry = useCallback(
    async (clientId) => {
      await retryIncident(clientId)
      await refresh()
      return sync()
    },
    [refresh, sync],
  )

  const discard = useCallback(
    async (clientId) => {
      await discardIncident(clientId)
      await refresh()
    },
    [refresh],
  )

  useEffect(() => {
    let active = true
    if (!ownerId) return undefined
    listIncidents(ownerId)
      .then((stored) => active && setItems(stored))
      .catch(() => active && setItems([]))
    return () => {
      active = false
    }
  }, [ownerId])

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      sync()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    sync()
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [sync])

  return { items, online, syncing, lastResult, save, sync, retry, discard, refresh }
}
