const { ValidationError } = require('../errors/AppError')

const REQUEST_PARTS = ['params', 'query', 'body']

/**
 * Validates request parts against zod schemas and stores the parsed values on
 * `request.validated` (Express 5 exposes `request.query` as read-only).
 */
function validate(schemas) {
  return function validateRequest(request, response, next) {
    const validated = {}

    for (const part of REQUEST_PARTS) {
      if (!schemas[part]) continue

      const result = schemas[part].safeParse(request[part] ?? {})
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
        return next(new ValidationError(details[0].message, details))
      }

      validated[part] = result.data
    }

    request.validated = validated
    return next()
  }
}

module.exports = { validate }
