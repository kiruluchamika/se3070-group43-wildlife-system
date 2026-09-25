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
