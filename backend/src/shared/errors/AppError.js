/**
 * Base class for expected failures. The error handler turns these into
 * `{ message, code, details }` responses with the matching HTTP status.
 */
class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.code = code
    this.details = details
  }
}

class ValidationError extends AppError {
  constructor(message = 'The request contains invalid data.', details) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details })
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required.', code = 'UNAUTHORIZED') {
    super(message, { status: 401, code })
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', code = 'FORBIDDEN') {
    super(message, { status: 403, code })
  }
}

class NotFoundError extends AppError {
  constructor(message = 'The requested record was not found.', code = 'NOT_FOUND') {
    super(message, { status: 404, code })
  }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT', details) {
    super(message, { status: 409, code, details })
  }
}

class BusinessRuleError extends AppError {
  constructor(message, code = 'BUSINESS_RULE_VIOLATION', details) {
    super(message, { status: 422, code, details })
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError
}
