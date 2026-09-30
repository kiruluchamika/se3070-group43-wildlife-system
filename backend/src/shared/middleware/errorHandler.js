const { AppError, NotFoundError } = require('../errors/AppError')

function notFoundHandler(request, response, next) {
  next(new NotFoundError(`Route ${request.method} ${request.originalUrl} was not found.`, 'ROUTE_NOT_FOUND'))
}

/** Converts thrown errors into the API's `{ message, code, details }` format. */
function createErrorHandler({ logger = console } = {}) {
  // Express recognises error handlers by their four parameters.
  return function errorHandler(error, request, response, next) {
    if (error instanceof AppError) {
      return response.status(error.status).json({
        message: error.message,
        code: error.code,
        ...(error.details && { details: error.details })
      })
    }

    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({ message: 'The request body is not valid JSON.', code: 'INVALID_JSON' })
    }

    if (error?.type === 'entity.too.large') {
      return response.status(413).json({ message: 'The request is too large. Attach smaller or fewer photos.', code: 'PAYLOAD_TOO_LARGE' })
    }

    if (error?.name === 'CastError') {
      return response.status(400).json({ message: 'An identifier in the request is not valid.', code: 'INVALID_ID' })
    }

    logger.error(error)
    return response.status(500).json({ message: 'Something went wrong on the server. Please try again.', code: 'INTERNAL_ERROR' })
  }
}

module.exports = { notFoundHandler, createErrorHandler }
