const jwt = require('jsonwebtoken')
const { UnauthorizedError } = require('../errors/AppError')

/** Issues and verifies the JWTs that identify a signed-in user and role. */
function createTokenService({ secret, expiresIn }) {
  return {
    sign(user) {
      return jwt.sign({ sub: String(user._id), role: user.role, sessionVersion: user.sessionVersion ?? 0 }, secret, { expiresIn })
    },

    verify(token) {
      try {
        const payload = jwt.verify(token, secret)
        return { id: payload.sub, role: payload.role, ...(payload.sessionVersion && { sessionVersion: payload.sessionVersion }) }
      } catch {
        throw new UnauthorizedError('Your session is invalid or has expired. Please sign in again.', 'SESSION_EXPIRED')
      }
    }
  }
}

module.exports = { createTokenService }
