const express = require('express')
const { validate } = require('../../shared/middleware/validate')
const { serialize } = require('../../shared/utils/serialize')
const { idParams } = require('../../shared/validation')

function createNotificationRouter({ notificationService, authenticate }) {
  const router = express.Router()
  router.use(authenticate)

  router.get('/me', async (request, response) => {
    const { items, unreadCount } = await notificationService.listMine(request.user.id)
    response.json({ notifications: serialize(items), unreadCount })
  })

  router.patch('/read-all', async (request, response) => {
    await notificationService.markAllRead(request.user.id)
    response.status(204).end()
  })

  router.patch('/:id/read', validate({ params: idParams }), async (request, response) => {
    const notification = await notificationService.markRead(request.validated.params.id, request.user.id)
    response.json({ notification: serialize(notification) })
  })

  return router
}

module.exports = { createNotificationRouter }
