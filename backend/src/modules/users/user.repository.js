/** Data access for user accounts. Returns plain objects, never Mongoose documents. */
function createUserRepository(User) {
  return {
    findByEmail(email, { withPassword = false } = {}) {
      const query = User.findOne({ email: email.toLowerCase() })
      if (withPassword) query.select('+passwordHash')
      return query.lean()
    },

    findById(id) {
      return User.findById(id).lean()
    },

    /** Users with `role`; with `park`, only staff of that park plus staff who cover every park (no park set). */
    listByRole(role, { park } = {}) {
      const filter = { role }
      if (park) filter.$or = [{ park }, { park: null }]
      return User.find(filter).select('name email role park phone').lean()
    },

    findByIds(ids) {
      return User.find({ _id: { $in: ids } }).select('name email role team').lean()
    },

    async create(data) {
      const user = await User.create(data)
      return user.toObject()
    }
  }
}

module.exports = { createUserRepository }
