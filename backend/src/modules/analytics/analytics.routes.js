const express = require('express')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { ROLES } = require('../../shared/roles')
const { serialize } = require('../../shared/utils/serialize')
const { retrievalQuery } = require('./analytics.schemas')

function createAnalyticsRouter({ analyticsService, authenticate }) {
  const router = express.Router()
  router.use(authenticate, requireRole(ROLES.DATA_ANALYST))
  router.get('/options', async (request, response) => {
    response.json(serialize(await analyticsService.options(request.user)))
  })
  router.get('/', validate({ query: retrievalQuery }), async (request, response) => {
    response.set('Cache-Control', 'no-store')
    response.json(serialize(await analyticsService.retrieve(request.validated.query, request.user)))
  })
  return router
}

module.exports = { createAnalyticsRouter }
