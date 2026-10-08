const { ConflictError, NotFoundError, UnauthorizedError } = require('../../shared/errors/AppError')
const { ROLES } = require('../../shared/roles')
const { toId } = require('../../shared/utils/serialize')

/** The account fields that are safe to send to the browser. */
function toPublicUser(user) {
  return {
    id: toId(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive !== false,
    phone: user.phone || null,
    park: toId(user.park),
    team: toId(user.team)
  }
}

/**
 * Account registration and sign-in. Public registration always creates a
 * Villager: staff accounts are provisioned by the park administration (seeded
 * demo accounts during development), so nobody can self-assign a staff role.
 */
function createAuthService({ userRepository, tokenService, passwordHasher }) {
  function createSession(user) {
    return { token: tokenService.sign(user), user: toPublicUser(user) }
  }

  return {
    async register({ name, email, password, phone }) {
      const existingUser = await userRepository.findByEmail(email)
      if (existingUser) throw new ConflictError('An account with this email already exists.', 'EMAIL_TAKEN')

      const passwordHash = await passwordHasher.hash(password)
      const user = await userRepository.create({ name, email, passwordHash, phone, role: ROLES.VILLAGER })
      return createSession(user)
    },

    async login({ email, password }) {
      const user = await userRepository.findByEmail(email, { withPassword: true })
      const passwordMatches = user ? await passwordHasher.compare(password, user.passwordHash) : false

      if (!passwordMatches || user.isActive === false) throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS')
      return createSession(user)
    },

    async getProfile(userId) {
      const user = await userRepository.findById(userId)
      if (!user) throw new NotFoundError('Your user account was not found.', 'USER_NOT_FOUND')
      if (user.isActive === false) throw new UnauthorizedError('This account is inactive.', 'ACCOUNT_INACTIVE')
      return toPublicUser(user)
    }
  }
}

module.exports = { createAuthService, toPublicUser }
