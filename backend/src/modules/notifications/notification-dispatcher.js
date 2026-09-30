/**
 * Common notification adapter with a fallback chain (UC01 exception flow E1):
 * in-app first, then SMS to the contact phone. It never throws; the caller
 * receives every attempt so it can record them and react when all channels
 * fail (E2).
 *
 * Call it after the business transaction commits: a delivery failure must
 * not roll back a validated report or an assigned team.
 */
function createNotificationDispatcher({ notificationService, smsGateway, logger = console }) {
  async function tryInApp(userId, { type, title, message, link }) {
    try {
      await notificationService.notifyUsers([userId], { type, title, message, link })
      return { channel: 'in-app', status: 'delivered' }
    } catch (error) {
      logger.warn?.(`In-app notification failed: ${error.message}`)
      return { channel: 'in-app', status: 'failed', detail: error.message }
    }
  }

  async function trySms(phone, { title, message }) {
    try {
      const result = await smsGateway.send({ to: phone, message: `WildGuard: ${title}. ${message}` })
      return { channel: 'sms', status: result.status === 'simulated' ? 'simulated' : 'sent', detail: result.providerRef }
    } catch (error) {
      return { channel: 'sms', status: 'failed', detail: error.message }
    }
  }

  return {
    /**
     * Delivers `payload` to a person. Returns `{ reached, attempts }`, where
     * `reached` is true once any channel accepted the message.
     */
    async deliver({ userId, phone }, payload) {
      const attempts = []

      if (userId) {
        const inApp = await tryInApp(userId, payload)
        attempts.push(inApp)
        if (inApp.status !== 'failed') return { reached: true, attempts }
      }

      const sms = await trySms(phone, payload)
      attempts.push(sms)
      return { reached: sms.status !== 'failed', attempts }
    }
  }
}

module.exports = { createNotificationDispatcher }
