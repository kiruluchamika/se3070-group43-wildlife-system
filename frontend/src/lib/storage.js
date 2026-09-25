/*
 * localStorage can throw in private windows or when site data is blocked, so
 * every access is guarded and the app keeps working without it.
 */

export function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the value only lasts for this page load.
  }
}

const TOKEN_KEY = 'wildguard-token'

export const sessionStore = {
  getToken: () => readStorage(TOKEN_KEY),
  setToken: (token) => writeStorage(TOKEN_KEY, token),
  clear: () => writeStorage(TOKEN_KEY, null),
}
