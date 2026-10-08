import { useCallback, useEffect, useRef, useState } from 'react'
import { conflictApi } from '../api/conflictApi'
import { discardUpdate, listPending, queueUpdate, syncPending } from './responseQueue'

const send = (item) => (item.kind === 'complete' ? conflictApi.completeTask(item.taskId, item.body) : conflictApi.recordAction(item.taskId, item.body))

/**
 * Offline queue state for the signed-in ranger. Syncs on open, when the
 * browser reports it is back online, and on demand. The online event is only
 * a trigger: an update counts as synced once the server confirms it.
 */
export function useResponseQueue(ownerId, { onSynced } = {}) {
  const [items, setItems] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const running = useRef(false)

  const refresh = useCallback(async () => {
    const pending = await listPending(ownerId).catch(() => [])
    setItems(pending)
  }, [ownerId])

  const sync = useCallback(async () => {
    if (running.current || !ownerId) return null
    running.current = true
    setSyncing(true)
    try {
      const result = await syncPending(ownerId, send)
      setLastResult({ ...result, at: Date.now() })
      if (result.synced > 0) onSynced?.()
      return result
    } finally {
      running.current = false
      setSyncing(false)
      await refresh()
    }
  }, [ownerId, onSynced, refresh])

  const save = useCallback(
    async (update) => {
      const item = await queueUpdate({ ownerId, ...update })
      await refresh()
      const result = await sync()
      return { item, sent: Boolean(result && !result.stoppedBy && result.failed === 0) }
    },
    [ownerId, refresh, sync],
  )

  const discard = useCallback(
    async (localId) => {
      await discardUpdate(localId)
      await refresh()
    },
    [refresh],
  )

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

  return { items, pending: items.filter((item) => item.status === 'pending'), failed: items.filter((item) => item.status === 'failed'), online, syncing, lastResult, save, sync, discard }
}
