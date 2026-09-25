const express = require('express')
const { validate } = require('../../shared/middleware/validate')
const { loginBody, registerBody } = require('./auth.schemas')

function createAuthRouter({ authController, authenticate }) {
  const router = express.Router()

  router.post('/register', validate({ body: registerBody }), authController.register)
  router.post('/login', validate({ body: loginBody }), authController.login)
  router.get('/me', authenticate, authController.me)

  return router
}

module.exports = { createAuthRouter }
