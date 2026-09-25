const { ForbiddenError, UnauthorizedError } = require('../errors/AppError')

/**
 * Allows the request through only for the listed roles. Hiding a button in the
 * UI is not enough, so every protected route enforces its roles here.
 */
function requireRole(...allowedRoles) {
  return function authorize(request, response, next) {
    if (!request.user) return next(new UnauthorizedError())

    if (!allowedRoles.includes(request.user.role)) {
      return next(new ForbiddenError('Access denied. Your role cannot use this function.', 'ACCESS_DENIED'))
    }

    return next()
  }
}

module.exports = { requireRole }
