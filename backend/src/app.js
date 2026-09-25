const path = require('node:path')
const cors = require('cors')
const express = require('express')
const helmet = require('helmet')
const { createErrorHandler, notFoundHandler } = require('./shared/middleware/errorHandler')

/**
 * Builds the Express application from already-wired routes, so tests can
 * create it without a database connection.
 */
function createApp({ config, routes, logger = console }) {
  const app = express()

  app.disable('x-powered-by')
  app.use(
    helmet({
      // Map tiles are loaded from an external tile server when Express serves the built frontend.
      contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'blob:', 'https:'] } }
    })
  )
  app.use(cors({ origin: config.clientOrigins }))
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (request, response) => {
    response.json({ status: 'ok', message: 'Wildlife backend is running' })
  })

  for (const { path: mountPath, router } of routes) app.use(mountPath, router)
  app.use('/api', notFoundHandler)

  if (config.serveFrontend) {
    // Integrated deployment: one origin serves the built React app and the API.
    app.use(express.static(config.frontendDist))
    app.use((request, response, next) => {
      if (request.method !== 'GET') return next()
      return response.sendFile(path.join(config.frontendDist, 'index.html'), (error) => error && next())
    })
  }

  app.use(notFoundHandler)
  app.use(createErrorHandler({ logger }))

  return app
}

module.exports = { createApp }
