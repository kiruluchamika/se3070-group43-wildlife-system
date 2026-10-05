import Dexie from 'dexie'

const db = new Dexie('wildguard-incidents')
db.version(1).stores({
  reports: 'clientId, ownerId, status, createdAt, updatedAt',
})

export class IncidentStorageError extends Error {
  constructor(cause) {
    super(
      cause?.name === 'QuotaExceededError'
        ? 'This device is out of storage, so the report was NOT saved. Remove unused photos or free some space and try again.'
        : 'The report could not be saved on this device. Nothing was sent; please try again.',
    )
    this.name = 'IncidentStorageError'
    this.cause = cause
  }
}

export async function saveIncident(ownerId, payload) {
  const now = Date.now()
  const item = {
    clientId: payload.clientId,
    ownerId,
    payload,
    status: 'queued',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    serverResult: null,
    createdAt: now,
    updatedAt: now,
  }
  try {
    await db.reports.add(item)
    return item
  } catch (error) {
    throw new IncidentStorageError(error)
  }
}

export function listIncidents(ownerId) {
  return db.reports.where('ownerId').equals(ownerId).reverse().sortBy('createdAt')
}

export function getIncident(clientId) {
  return db.reports.get(clientId)
}

export function updateIncident(clientId, changes) {
  return db.reports.update(clientId, { ...changes, updatedAt: Date.now() })
}

export async function retryIncident(clientId) {
  await updateIncident(clientId, { status: 'queued', lastError: null })
}

export function discardIncident(clientId) {
  return db.reports.delete(clientId)
}
