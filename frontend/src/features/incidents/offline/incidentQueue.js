import { incidentApi } from '../api/incidentApi'
import { listIncidents, updateIncident } from './incidentDb'

const isRetryable = (error) => error?.code === 'NETWORK_ERROR' || error?.status === 0 || error?.status === 401 || error?.status >= 500

/** Sends queued reports oldest first. Server idempotency makes every retry safe. */
export async function syncIncidents(ownerId) {
  const items = (await listIncidents(ownerId))
    .filter((item) => item.status === 'queued' || item.status === 'syncing')
    .sort((first, second) => first.createdAt - second.createdAt)
  let synced = 0
  let failed = 0

  for (const item of items) {
    const lastAttemptAt = Date.now()
    await updateIncident(item.clientId, { status: 'syncing', attempts: item.attempts + 1, lastAttemptAt, lastError: null })
    try {
      const result = await incidentApi.submit(item.payload)
      await updateIncident(item.clientId, {
        status: 'synced',
        serverResult: result,
        lastError: null,
        photoCount: item.payload.photos?.length ?? 0,
        // The server now owns the evidence; release the largest local data.
        payload: { ...item.payload, photos: [] },
      })
      synced += 1
    } catch (error) {
      if (isRetryable(error)) {
        await updateIncident(item.clientId, { status: 'queued', lastError: error.message })
        return { synced, failed, stoppedBy: error }
      }
      await updateIncident(item.clientId, { status: 'failed', lastError: error.message })
      failed += 1
    }
  }

  return { synced, failed, stoppedBy: null }
}
