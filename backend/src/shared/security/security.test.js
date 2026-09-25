const jwt = require('jsonwebtoken')
const { createPasswordHasher } = require('./password-hasher')
const { createTokenService } = require('./token-service')

describe('tokenService', () => {
  const tokenService = createTokenService({ secret: 'test-secret', expiresIn: '1h' })

  it('round-trips the user id and role', () => {
    const token = tokenService.sign({ _id: 'abc123', role: 'park-manager' })

    expect(tokenService.verify(token)).toEqual({ id: 'abc123', role: 'park-manager' })
  })

  it('rejects a token signed with another secret', () => {
    const forged = jwt.sign({ sub: 'abc123', role: 'park-manager' }, 'other-secret')

    expect(() => tokenService.verify(forged)).toThrow(expect.objectContaining({ status: 401, code: 'SESSION_EXPIRED' }))
  })

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'abc123', role: 'ranger', exp: Math.floor(Date.now() / 1000) - 60 }, 'test-secret')

    expect(() => tokenService.verify(expired)).toThrow('Your session is invalid or has expired. Please sign in again.')
  })
})

describe('passwordHasher', () => {
  const hasher = createPasswordHasher({ rounds: 4 })

  it('never stores the plain password and verifies the correct one', async () => {
    const hash = await hasher.hash('Correct-Horse-1')

    expect(hash).not.toContain('Correct-Horse-1')
    await expect(hasher.compare('Correct-Horse-1', hash)).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('Correct-Horse-1')

    await expect(hasher.compare('wrong-password', hash)).resolves.toBe(false)
  })
})
