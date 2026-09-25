const { UnauthorizedError } = require('../errors/AppError')

/** Reads the Bearer token and attaches `{ id, role }` to `request.user`. */
function createAuthenticate({ tokenService }) {
  return function authenticate(request, response, next) {
    const header = request.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

    if (!token) return next(new UnauthorizedError())

    try {
      request.user = tokenService.verify(token)
      return next()
    } catch (error) {
      return next(error)
    }
  }
}

module.exports = { createAuthenticate }
