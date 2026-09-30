const express = require('express')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { ROLES } = require('../../shared/roles')
const { idParams } = require('../../shared/validation')
const schemas = require('./conflict.schemas')

/** UC01 report routes: /api/conflicts. */
function createConflictRouter({ conflictController, authenticate }) {
  const router = express.Router()
  const villager = requireRole(ROLES.VILLAGER)
  const officer = requireRole(ROLES.LIAISON_OFFICER)
  // One validate() per route: each call replaces request.validated, so params and body are checked together.
  const byId = validate({ params: idParams })

  router.use(authenticate)

  // Villager
  router.post('/', villager, validate({ body: schemas.submitBody }), conflictController.submit)
  router.get('/mine', villager, conflictController.listMine)
  router.patch('/:id/information', villager, validate({ params: idParams, body: schemas.informationBody }), conflictController.provideInformation)

  // Community Liaison Officer
  router.get('/', officer, validate({ query: schemas.queueQuery }), conflictController.listQueue)
  router.patch('/:id/validation', officer, validate({ params: idParams, body: schemas.validationBody }), conflictController.validate)
  router.patch('/:id/information-request', officer, validate({ params: idParams, body: schemas.informationRequestBody }), conflictController.requestInformation)
  router.get('/:id/duplicates', officer, byId, conflictController.findDuplicates)
  router.patch('/:id/duplicate', officer, validate({ params: idParams, body: schemas.duplicateBody }), conflictController.linkDuplicate)
  router.get('/:id/teams', officer, byId, conflictController.listTeams)
  router.post('/:id/deployments', officer, validate({ params: idParams, body: schemas.deploymentBody }), conflictController.deploy)
  router.patch('/:id/escalation', officer, validate({ params: idParams, body: schemas.escalationBody }), conflictController.escalate)
  router.patch('/:id/review', officer, validate({ params: idParams, body: schemas.reviewBody }), conflictController.review)
  router.post('/:id/contact-retry', officer, byId, conflictController.retryContact)
  router.post('/:id/alternative-contact', officer, validate({ params: idParams, body: schemas.alternativeContactBody }), conflictController.recordAlternativeContact)

  // Shared detail view; the service checks ownership, park and team membership.
  router.get(
    '/:id',
    requireRole(ROLES.VILLAGER, ROLES.LIAISON_OFFICER, ROLES.PARK_MANAGER, ROLES.RANGER),
    byId,
    conflictController.getReport
  )

  return router
}

/** UC01 response-task routes: /api/response-tasks. */
function createResponseTaskRouter({ conflictController, authenticate }) {
  const router = express.Router()
  const manager = requireRole(ROLES.PARK_MANAGER)
  const ranger = requireRole(ROLES.RANGER)
  const byId = validate({ params: idParams })

  router.use(authenticate)

  // Park Manager
  router.get('/approvals', manager, validate({ query: schemas.approvalQuery }), conflictController.listApprovals)
  router.patch('/:id/approval', manager, validate({ params: idParams, body: schemas.approvalBody }), conflictController.decideApproval)

  // Ranger
  router.get('/mine', ranger, conflictController.listMyTasks)
  router.patch('/:id/acknowledge', ranger, byId, conflictController.acknowledge)
  router.post('/:id/actions', ranger, validate({ params: idParams, body: schemas.actionBody }), conflictController.recordAction)
  router.patch('/:id/complete', ranger, validate({ params: idParams, body: schemas.completeBody }), conflictController.complete)

  return router
}

module.exports = { createConflictRouter, createResponseTaskRouter }
