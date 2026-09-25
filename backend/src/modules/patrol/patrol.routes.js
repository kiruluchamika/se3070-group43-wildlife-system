const express = require('express')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { ROLES } = require('../../shared/roles')
const { idParams } = require('../../shared/validation')
const schemas = require('./patrol.schemas')

/** UC04 routes. Park-manager functions deny every other role (exception flow E4). */
function createPatrolRouter({ patrolController, authenticate }) {
  const router = express.Router()
  const managerOnly = requireRole(ROLES.PARK_MANAGER)
  const rangerOnly = requireRole(ROLES.RANGER)

  router.use(authenticate)

  // Ranger (supporting actor)
  router.get('/my-assignment', rangerOnly, patrolController.myAssignment)
  router.patch('/assignments/:id/acknowledge', rangerOnly, validate({ params: idParams }), patrolController.acknowledge)

  // Park Manager
  router.get('/coverage', managerOnly, validate({ query: schemas.parkQuery }), patrolController.getCoverage)
  router.get('/teams', managerOnly, validate({ query: schemas.teamsQuery }), patrolController.listTeams)
  router.get('/assignments', managerOnly, validate({ query: schemas.parkQuery }), patrolController.listAssignments)
  router.post('/assignments', managerOnly, validate({ body: schemas.allocateBody }), patrolController.allocate)
  router.post('/assignments/reassign', managerOnly, validate({ body: schemas.reassignBody }), patrolController.reassign)
  router.patch('/assignments/:id/complete', managerOnly, validate({ params: idParams }), patrolController.complete)
  router.get('/decisions', managerOnly, validate({ query: schemas.parkQuery }), patrolController.listDecisions)
  router.get(
    '/emergency-dispatches/recommendations',
    managerOnly,
    validate({ query: schemas.recommendationQuery }),
    patrolController.recommendDispatch
  )
  router.post('/emergency-dispatches', managerOnly, validate({ body: schemas.dispatchBody }), patrolController.dispatch)

  return router
}

module.exports = { createPatrolRouter }
