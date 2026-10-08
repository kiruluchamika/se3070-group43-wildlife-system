const { NotFoundError } = require('../../shared/errors/AppError')
const { toId } = require('../../shared/utils/serialize')

/**
 * In-app notifications shared by every module (UC01 party notifications,
 * UC02 report sharing, UC04 team assignment notices).
 */
function createNotificationService({ notificationRepository, clock = () => new Date() }) {
  return {
    notifyUsers(userIds, { type, title, message, link }, { session } = {}) {
      const recipients = [...new Set(userIds.map(toId).filter(Boolean))]
      const notifications = recipients.map((recipient) => ({ recipient, type, title, message, link }))
      return notificationRepository.createMany(notifications, { session })
    },

    async listMine(userId) {
      const [items, unreadCount] = await Promise.all([
        notificationRepository.listForRecipient(userId),
        notificationRepository.countUnread(userId)
      ])
      return { items, unreadCount }
    },

    async markRead(notificationId, userId) {
      const notification = await notificationRepository.markRead(notificationId, userId, clock())
      if (!notification) throw new NotFoundError('The notification was not found.', 'NOTIFICATION_NOT_FOUND')
      return notification
    },

    markAllRead(userId) {
      return notificationRepository.markAllRead(userId, clock())
    }
  }
}

module.exports = { createNotificationService }
