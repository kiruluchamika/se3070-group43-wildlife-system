import Dexie from 'dexie'

/*
 * UC01 exception flow E4: rangers record field updates for a task they
 * already received, even without connectivity. Each update is stored in
 * IndexedDB with a client-generated id before anything is shown as saved,
 * then sent in order when the app is online. The server treats a repeated id
 * as the same update, so a retry after a lost response never duplicates it.
 *
 * Records belong to the signed-in user (ownerId) and are only ever sent with
 * that user's session. KALMADU's shared UC03 queue can absorb this module
 * later; the item shape (ownerId, clientUpdateId, status, error) is the same idea.
 */

const db = new Dexie('wildguard-conflict-response')
db.version(1).stores({
  pending: '++localId, ownerId, taskId, clientUpdateId, createdAt',
  taskCache: 'ownerId',
})

export class LocalStorageError extends Error {
  constructor(cause) {
    super(
      cause?.name === 'QuotaExceededError'
        ? 'This device is out of storage, so the update was NOT saved. Free some space and try again.'
        : 'The update could not be saved on this device, so it was NOT saved. Try again.',
    )
    this.name = 'LocalStorageError'
    this.cause = cause
  }
}

/** Saves an update locally. Resolves only once it is safely stored. */
export async function queueUpdate({ ownerId, taskId, kind, body }) {
  try {
    const item = { ownerId, taskId, kind, body, clientUpdateId: body.clientUpdateId, status: 'pending', error: null, createdAt: Date.now() }
    item.localId = await db.pending.add(item)
    return item
  } catch (error) {
    throw new LocalStorageError(error)
  }
}

export function listPending(ownerId) {
  return db.pending.where('ownerId').equals(ownerId).sortBy('createdAt')
}

export function discardUpdate(localId) {
  return db.pending.delete(localId)
}

/** Keeps the last task list the server sent, so a received task can be opened offline. */
export async function cacheTasks(ownerId, data) {
  try {
    await db.taskCache.put({ ownerId, data, savedAt: Date.now() })
  } catch {
    // A missing cache only affects offline viewing; the live data is still shown.
  }
}

export async function readCachedTasks(ownerId) {
  try {
    return (await db.taskCache.get(ownerId)) ?? null
  } catch {
    return null
  }
}

/** Errors that mean "try again later" rather than "this update is wrong". */
const isRetryable = (error) => error?.code === 'NETWORK_ERROR' || error?.status === 0 || error?.status >= 500 || error?.status === 401

/**
 * Sends the owner's pending updates oldest first. Stops at the first network
 * or session problem (everything stays queued). An update the server rejects
 * for a business reason is marked failed with the reason and kept for review.
 * Returns `{ synced, failed, stoppedBy }`.
 */
export async function syncPending(ownerId, send) {
  const items = (await listPending(ownerId)).filter((item) => item.status === 'pending')
  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      await send(item)
      await db.pending.delete(item.localId)
      synced += 1
    } catch (error) {
      if (isRetryable(error)) {
        await db.pending.update(item.localId, { error: error.message })
        return { synced, failed, stoppedBy: error }
      }
      await db.pending.update(item.localId, { status: 'failed', error: error.message })
      failed += 1
    }
  }
  return { synced, failed, stoppedBy: null }
}
