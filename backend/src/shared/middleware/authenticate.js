const { UnauthorizedError } = require('../errors/AppError')

/** Reads the Bearer token and attaches `{ id, role }` to `request.user`. */
function createAuthenticate({ tokenService, userRepository }) {
  return async function authenticate(request, response, next) {
    const header = request.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''

    if (!token) return next(new UnauthorizedError())

    try {
      request.user = tokenService.verify(token)
      if (userRepository) {
        const account = await userRepository.findById(request.user.id)
        if (!account || account.isActive === false || (account.sessionVersion ?? 0) !== (request.user.sessionVersion ?? 0)) {
          throw new UnauthorizedError('Your account or session is no longer active. Please sign in again.', 'SESSION_EXPIRED')
        }
        request.user.role = account.role
      }
      return next()
    } catch (error) {
      return next(error)
    }
  }
}

module.exports = { createAuthenticate }
