const path = require('node:path')

const DEFAULT_PORT = 5000
const DEFAULT_FRONTEND_DIST = path.resolve(__dirname, '../../../frontend/dist')
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173'

/** Splits a comma-separated environment value into trimmed, non-empty entries. */
function parseList(value) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * Reads and validates runtime configuration once, so the rest of the
 * application never touches process.env directly.
 */
function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'

  if (isProduction && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production.')
  }

  const clientOrigins = parseList(env.CLIENT_URL)

  return Object.freeze({
    nodeEnv,
    isProduction,
    port: Number(env.PORT) || DEFAULT_PORT,
    clientOrigins: clientOrigins.length ? clientOrigins : [DEFAULT_CLIENT_ORIGIN],
    mongoUri: env.MONGODB_URI || '',
    mongoDbName: env.MONGODB_DB_NAME || 'wildguard',
    jwtSecret: env.JWT_SECRET || 'development-only-secret',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    demoPassword: env.DEMO_PASSWORD || 'WildGuard@2026',
    serveFrontend: env.SERVE_FRONTEND === 'true',
    frontendDist: env.FRONTEND_DIST_PATH || DEFAULT_FRONTEND_DIST
  })
}

module.exports = { loadConfig, parseList }
