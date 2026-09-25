const { createAuthService, toPublicUser } = require('./auth.service')

function setup({ existingUser = null } = {}) {
  const userRepository = {
    findByEmail: vi.fn(async () => existingUser),
    findById: vi.fn(async (id) => (existingUser && String(existingUser._id) === id ? existingUser : null)),
    create: vi.fn(async (data) => ({ _id: 'new-user-id', ...data }))
  }
  const tokenService = { sign: vi.fn(() => 'signed-token') }
  const passwordHasher = {
    hash: vi.fn(async (password) => `hashed:${password}`),
    compare: vi.fn(async (password, hash) => hash === `hashed:${password}`)
  }

  return {
    authService: createAuthService({ userRepository, tokenService, passwordHasher }),
    userRepository,
    tokenService,
    passwordHasher
  }
}

const storedRanger = {
  _id: 'ranger-1',
  name: 'Kasun Rathnayake',
  email: 'ranger@wildguard.lk',
  role: 'ranger',
  passwordHash: 'hashed:WildGuard@2026',
  team: 'team-charlie',
  park: 'park-yala'
}

describe('authService.register', () => {
  it('creates a villager account with a hashed password and returns a session', async () => {
    const { authService, userRepository } = setup()

    const session = await authService.register({ name: 'Sunil Bandara', email: 'sunil@example.com', password: 'long-enough' })

    expect(userRepository.create).toHaveBeenCalledWith({
      name: 'Sunil Bandara',
      email: 'sunil@example.com',
      passwordHash: 'hashed:long-enough',
      phone: undefined,
      role: 'villager'
    })
    expect(session).toEqual({
      token: 'signed-token',
      user: { id: 'new-user-id', name: 'Sunil Bandara', email: 'sunil@example.com', role: 'villager', phone: null, park: null, team: null }
    })
  })

  it('never lets a caller choose a staff role', async () => {
    const { authService, userRepository } = setup()

    await authService.register({ name: 'Eve', email: 'eve@example.com', password: 'long-enough', role: 'park-manager' })

    expect(userRepository.create.mock.calls[0][0].role).toBe('villager')
  })

  it('rejects an email address that is already registered', async () => {
    const { authService, userRepository } = setup({ existingUser: storedRanger })

    await expect(authService.register({ name: 'Copy', email: 'ranger@wildguard.lk', password: 'long-enough' })).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN'
    })
    expect(userRepository.create).not.toHaveBeenCalled()
  })
})

describe('authService.login', () => {
  it('returns a session for the correct password', async () => {
    const { authService, userRepository } = setup({ existingUser: storedRanger })

    const session = await authService.login({ email: 'ranger@wildguard.lk', password: 'WildGuard@2026' })

    expect(userRepository.findByEmail).toHaveBeenCalledWith('ranger@wildguard.lk', { withPassword: true })
    expect(session.user).toMatchObject({ id: 'ranger-1', role: 'ranger', team: 'team-charlie' })
    expect(session.user).not.toHaveProperty('passwordHash')
  })

  it('rejects a wrong password without revealing which field was wrong', async () => {
    const { authService } = setup({ existingUser: storedRanger })

    await expect(authService.login({ email: 'ranger@wildguard.lk', password: 'guess' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    })
  })

  it('rejects an unknown email with the same message', async () => {
    const { authService, passwordHasher } = setup()

    await expect(authService.login({ email: 'nobody@example.com', password: 'guess' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS'
    })
    expect(passwordHasher.compare).not.toHaveBeenCalled()
  })
})

describe('authService.getProfile', () => {
  it('returns the public profile of an existing user', async () => {
    const { authService } = setup({ existingUser: storedRanger })

    await expect(authService.getProfile('ranger-1')).resolves.toEqual(toPublicUser(storedRanger))
  })

  it('reports a deleted account', async () => {
    const { authService } = setup()

    await expect(authService.getProfile('missing')).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
  })
})
