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
const USER_KEY = 'wildguard-user'

function readUser() {
  const value = readStorage(USER_KEY)
  if (!value) return null
  try {
    const user = JSON.parse(value)
    return user && typeof user.id === 'string' && typeof user.role === 'string' ? user : null
  } catch {
    return null
  }
}

/** Only fields needed to render protected offline screens are persisted. */
function offlineUser(user) {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    park: user.park ?? null,
    team: user.team ?? null,
  }
}

export const sessionStore = {
  getToken: () => readStorage(TOKEN_KEY),
  setToken: (token) => writeStorage(TOKEN_KEY, token),
  getUser: readUser,
  setUser: (user) => writeStorage(USER_KEY, user ? JSON.stringify(offlineUser(user)) : null),
  clear: () => {
    writeStorage(TOKEN_KEY, null)
    writeStorage(USER_KEY, null)
  },
}
