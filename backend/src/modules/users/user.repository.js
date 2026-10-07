/** Data access for user accounts. Returns plain objects, never Mongoose documents. */
function createUserRepository(User) {
  return {
    list(page) {
      return User.find().select('name email role phone park team isActive').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(21).lean()
    },
    update(id, changes, revoke = false) {
      return User.findByIdAndUpdate(id, { $set: changes, ...(revoke && { $inc: { sessionVersion: 1 } }) }, { returnDocument: 'after', runValidators: true }).lean()
    },
    async setActive(id, isActive) {
      const changed = await User.findOneAndUpdate({ _id: id, isActive: isActive ? false : { $ne: false } },
        { $set: { isActive }, $inc: { sessionVersion: 1 } }, { returnDocument: 'after', runValidators: true }).lean()
      return changed || User.findById(id).lean()
    },
    findByEmail(email, { withPassword = false } = {}) {
      const query = User.findOne({ email: email.toLowerCase() }).select('+sessionVersion')
      if (withPassword) query.select('+passwordHash')
      return query.lean()
    },

    findById(id) {
      return User.findById(id).select('+sessionVersion').lean()
    },

    /** Users with `role`; with `park`, only staff of that park plus staff who cover every park (no park set). */
    listByRole(role, { park, activeOnly = false } = {}) {
      const filter = { role, ...(activeOnly && { isActive: { $ne: false } }) }
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
