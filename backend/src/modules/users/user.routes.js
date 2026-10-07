const express = require('express')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { idParams } = require('../../shared/validation')
const { createUserBody, editUserBody, userStatusBody, userListQuery } = require('./user.schemas')

function createUserRouter({ userService, authenticate }) {
  const router = express.Router()
  router.use(authenticate, requireRole('administrator'))
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.get('/', validate({ query: userListQuery }), async (req, res) => res.json(await userService.list(req.validated.query.page)))
  router.post('/', validate({ body: createUserBody }), async (req, res) => res.status(201).json({ user: await userService.create(req.validated.body) }))
  router.patch('/:id', validate({ params: idParams, body: editUserBody }), async (req, res) => res.json({ user: await userService.edit(req.validated.params.id, req.validated.body, req.user) }))
  router.patch('/:id/status', validate({ params: idParams, body: userStatusBody }), async (req, res) => res.json({ user: await userService.setActive(req.validated.params.id, req.validated.body.isActive, req.user) }))
  return router
}
module.exports = { createUserRouter }
