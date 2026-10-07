const { ConflictError, NotFoundError, ForbiddenError } = require('../../shared/errors/AppError')
const { toId } = require('../../shared/utils/serialize')
const { toPublicUser } = require('./auth.service')

function createUserService({ userRepository, parkRepository, passwordHasher }) {
  async function account(id) {
    const user = await userRepository.findById(id)
    if (!user) throw new NotFoundError('User not found.', 'USER_NOT_FOUND')
    return user
  }
  async function validatePark(park) {
    if (park && !await parkRepository.findParkById(park)) throw new NotFoundError('Park not found.', 'PARK_NOT_FOUND')
  }
  async function unique(work) {
    try { return await work() } catch (error) {
      if (error.code === 11000) throw new ConflictError('An account with this email already exists.', 'EMAIL_TAKEN')
      throw error
    }
  }
  return {
    async list(page) {
      const users = await userRepository.list(page)
      return { users: users.slice(0, 20).map(toPublicUser), page, hasMore: users.length > 20 }
    },
    async create(body) {
      await validatePark(body.park)
      const { password, ...fields } = body
      const passwordHash = await passwordHasher.hash(password)
      return toPublicUser(await unique(() => userRepository.create({ ...fields, passwordHash, isActive: true })))
    },
    async edit(id, body, actor) {
      const user = await account(id)
      if (id === actor.id && body.role !== 'administrator') throw new ForbiddenError('You cannot remove your own administrator role.', 'SELF_ROLE_CHANGE')
      const park = body.park === undefined ? toId(user.park) : body.park
      const changedScope = body.role !== user.role || park !== toId(user.park)
      if (user.team && changedScope) throw new ConflictError('This user belongs to a ranger team. Resolve the team assignment before changing role or park.', 'TEAM_ASSIGNMENT_EXISTS')
      await validatePark(park)
      return toPublicUser(await unique(() => userRepository.update(id, { ...body, park }, changedScope)))
    },
    async setActive(id, isActive, actor) {
      if (id === actor.id && !isActive) throw new ForbiddenError('You cannot deactivate your own account.', 'SELF_DEACTIVATION')
      await account(id)
      return toPublicUser(await userRepository.setActive(id, isActive))
    },
  }
}
module.exports = { createUserService }
