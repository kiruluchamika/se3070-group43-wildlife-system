const express = require('express')
const { z } = require('zod')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { ROLES } = require('../../shared/roles')
const { serialize } = require('../../shared/utils/serialize')
const { idParams, objectId } = require('../../shared/validation')
const { ALERT_STATUSES } = require('./alert.model')

const listQuery = z.object({
  parkId: objectId('Park id'),
  status: z.enum(['open', 'all', ...ALERT_STATUSES]).optional()
})

/** AlertCtrl in Group 41's UC04 sequence diagram. */
function createAlertRouter({ alertService, authenticate }) {
  const router = express.Router()
  router.use(authenticate, requireRole(ROLES.PARK_MANAGER))

  router.get('/', validate({ query: listQuery }), async (request, response) => {
    const { parkId, status } = request.validated.query
    const alerts = await alertService.list(parkId, { status })
    response.json({ alerts: serialize(alerts) })
  })

  router.patch('/:id/acknowledge', validate({ params: idParams }), async (request, response) => {
    const alert = await alertService.acknowledge(request.validated.params.id, request.user.id)
    response.json({ alert: serialize(alert) })
  })

  return router
}

module.exports = { createAlertRouter }
