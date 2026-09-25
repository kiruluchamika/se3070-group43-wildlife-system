/** Data access for user notifications. */
function createNotificationRepository(Notification) {
  return {
    async createMany(notifications, { session } = {}) {
      if (!notifications.length) return []
      const created = await Notification.insertMany(notifications, { session })
      return created.map((notification) => notification.toObject())
    },

    listForRecipient(userId, { limit = 20 } = {}) {
      return Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(limit).lean()
    },

    countUnread(userId) {
      return Notification.countDocuments({ recipient: userId, readAt: null })
    },

    markRead(id, userId, readAt) {
      return Notification.findOneAndUpdate(
        { _id: id, recipient: userId },
        { $set: { readAt } },
        { returnDocument: 'after' }
      ).lean()
    },

    markAllRead(userId, readAt) {
      return Notification.updateMany({ recipient: userId, readAt: null }, { $set: { readAt } })
    }
  }
}

module.exports = { createNotificationRepository }
