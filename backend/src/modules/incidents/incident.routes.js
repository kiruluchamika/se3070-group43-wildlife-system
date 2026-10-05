const express = require('express')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { ROLES } = require('../../shared/roles')
const { idParams } = require('../../shared/validation')
const { submitBody } = require('./incident.schemas')

function createIncidentRouter({ incidentController, authenticate }) {
  const router = express.Router()
  const ranger = requireRole(ROLES.RANGER)

  router.use(authenticate, ranger)
  router.post('/', validate({ body: submitBody }), incidentController.submit)
  router.get('/mine', incidentController.listMine)
  router.get('/:id', validate({ params: idParams }), incidentController.getMine)

  return router
}

module.exports = { createIncidentRouter }
