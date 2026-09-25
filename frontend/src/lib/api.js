import { sessionStore } from './storage'

/** Set VITE_API_URL in frontend/.env: `/api` locally, the deployed backend URL in production. */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

/** Error thrown for every failed request, carrying the backend's `{ message, code, details }`. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN_ERROR', details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const unauthorizedListeners = new Set()

/** Subscribes to expired-session responses; returns an unsubscribe function. */
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const token = sessionStore.getToken()
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError('Unable to reach the WildGuard server. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
    })
  }

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new ApiError(data?.message || `The request failed (HTTP ${response.status}).`, {
      status: response.status,
      code: data?.code,
      details: data?.details,
    })
    if (response.status === 401 && token) unauthorizedListeners.forEach((listener) => listener(error))
    throw error
  }

  return data
}

export const api = {
  get: (path, options) => apiRequest(path, options),
  post: (path, body, options) => apiRequest(path, { ...options, method: 'POST', body: body ?? {} }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body: body ?? {} }),
}

/** Builds `?a=1&b=2`, skipping empty values. */
export function toQuery(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}
