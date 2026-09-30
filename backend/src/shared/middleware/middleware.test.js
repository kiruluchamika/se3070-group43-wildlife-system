const { z } = require('zod')
const { AppError, ConflictError, UnauthorizedError } = require('../errors/AppError')
const { createAuthenticate } = require('./authenticate')
const { requireRole } = require('./authorize')
const { createErrorHandler, notFoundHandler } = require('./errorHandler')
const { validate } = require('./validate')

function createResponse() {
  const response = {}
  response.status = vi.fn(() => response)
  response.json = vi.fn(() => response)
  return response
}

describe('authenticate', () => {
  const tokenService = {
    verify: vi.fn((token) => {
      if (token === 'good-token') return { id: 'user-1', role: 'ranger' }
      throw new UnauthorizedError('Your session is invalid or has expired. Please sign in again.', 'SESSION_EXPIRED')
    })
  }
  const authenticate = createAuthenticate({ tokenService })

  it('attaches the signed-in user for a valid bearer token', () => {
    const request = { headers: { authorization: 'Bearer good-token' } }
    const next = vi.fn()

    authenticate(request, {}, next)

    expect(request.user).toEqual({ id: 'user-1', role: 'ranger' })
    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    ['no header', {}],
    ['a non-bearer scheme', { authorization: 'Basic abc' }],
    ['an empty bearer token', { authorization: 'Bearer   ' }]
  ])('rejects requests with %s', (label, headers) => {
    const next = vi.fn()

    authenticate({ headers }, {}, next)

    expect(next.mock.calls[0][0]).toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
  })

  it('passes token verification failures on to the error handler', () => {
    const next = vi.fn()

    authenticate({ headers: { authorization: 'Bearer expired' } }, {}, next)

    expect(next.mock.calls[0][0]).toMatchObject({ status: 401, code: 'SESSION_EXPIRED' })
  })
})

describe('requireRole (UC04 E4 access denied)', () => {
  const onlyManagers = requireRole('park-manager')

  it('allows a permitted role', () => {
    const next = vi.fn()

    onlyManagers({ user: { role: 'park-manager' } }, {}, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('denies other roles with ACCESS_DENIED', () => {
    const next = vi.fn()

    onlyManagers({ user: { role: 'villager' } }, {}, next)

    expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'ACCESS_DENIED' })
  })

  it('requires authentication first', () => {
    const next = vi.fn()

    onlyManagers({}, {}, next)

    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 })
  })
})

describe('validate', () => {
  const middleware = validate({
    body: z.object({ name: z.string().min(2, 'Name is too short.') }),
    query: z.object({ page: z.coerce.number().default(1) })
  })

  it('stores parsed values on request.validated', () => {
    const request = { body: { name: 'Alpha' }, query: {} }
    const next = vi.fn()

    middleware(request, {}, next)

    expect(request.validated).toEqual({ body: { name: 'Alpha' }, query: { page: 1 } })
    expect(next).toHaveBeenCalledWith()
  })

  it('reports every invalid field with its path', () => {
    const next = vi.fn()

    middleware({ body: { name: 'A' }, query: {} }, {}, next)

    const error = next.mock.calls[0][0]
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Name is too short.' })
    expect(error.details).toEqual([{ field: 'name', message: 'Name is too short.' }])
  })

  it('treats a missing request part as an empty object', () => {
    const next = vi.fn()

    middleware({ query: {} }, {}, next)

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('errorHandler', () => {
  const logger = { error: vi.fn() }
  const errorHandler = createErrorHandler({ logger })

  beforeEach(() => logger.error.mockClear())

  it('returns the status, code and details of an AppError', () => {
    const response = createResponse()

    errorHandler(new ConflictError('Team is busy.', 'TEAM_NOT_AVAILABLE', { status: 'on-patrol' }), {}, response)

    expect(response.status).toHaveBeenCalledWith(409)
    expect(response.json).toHaveBeenCalledWith({ message: 'Team is busy.', code: 'TEAM_NOT_AVAILABLE', details: { status: 'on-patrol' } })
  })

  it('omits details when an AppError has none', () => {
    const response = createResponse()

    errorHandler(new AppError('Boom', { status: 418, code: 'TEAPOT' }), {}, response)

    expect(response.json).toHaveBeenCalledWith({ message: 'Boom', code: 'TEAPOT' })
  })

  it('reports malformed JSON bodies as 400', () => {
    const response = createResponse()

    errorHandler({ type: 'entity.parse.failed' }, {}, response)

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json.mock.calls[0][0].code).toBe('INVALID_JSON')
  })

  it('reports oversized bodies as 413 instead of a server error', () => {
    const response = createResponse()

    errorHandler({ type: 'entity.too.large' }, {}, response)

    expect(response.status).toHaveBeenCalledWith(413)
    expect(response.json.mock.calls[0][0].code).toBe('PAYLOAD_TOO_LARGE')
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('reports invalid database identifiers as 400', () => {
    const response = createResponse()

    errorHandler({ name: 'CastError' }, {}, response)

    expect(response.json.mock.calls[0][0].code).toBe('INVALID_ID')
  })

  it('hides unexpected errors behind a generic 500 and logs them', () => {
    const response = createResponse()
    const failure = new Error('database exploded')

    errorHandler(failure, {}, response)

    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json.mock.calls[0][0]).toEqual({
      message: 'Something went wrong on the server. Please try again.',
      code: 'INTERNAL_ERROR'
    })
    expect(logger.error).toHaveBeenCalledWith(failure)
  })

  it('turns unknown routes into ROUTE_NOT_FOUND errors', () => {
    const next = vi.fn()

    notFoundHandler({ method: 'GET', originalUrl: '/api/missing' }, {}, next)

    expect(next.mock.calls[0][0]).toMatchObject({ status: 404, code: 'ROUTE_NOT_FOUND', message: 'Route GET /api/missing was not found.' })
  })
})
