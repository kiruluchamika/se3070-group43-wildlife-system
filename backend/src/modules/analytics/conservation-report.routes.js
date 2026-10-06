const express = require('express')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { idParams } = require('../../shared/validation')
const { serialize } = require('../../shared/utils/serialize')
const { saveReportBody, reportsQuery, editDraftBody, shareReportBody } = require('./conservation-report.schemas')
const { exportReport } = require('./conservation-report.export')

function createReportRouter({ reportService, authenticate }) {
  const router = express.Router()
  router.use(authenticate, requireRole('data-analyst', 'park-manager'))
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); next() })
  router.post('/', requireRole('data-analyst'), validate({ body: saveReportBody }), async (request, response) => {
    response.status(201).json({ report: serialize(await reportService.save(request.validated.body, request.user)) })
  })
  router.get('/', validate({ query: reportsQuery }), async (request, response) => {
    response.json(serialize(await reportService.list(request.validated.query.page, request.user)))
  })
  router.get('/:id', validate({ params: idParams }), async (request, response) => {
    response.json({ report: serialize(await reportService.get(request.validated.params.id, request.user)) })
  })
  router.patch('/:id', requireRole('data-analyst'), validate({ params: idParams, body: editDraftBody }), async (request, response) => {
    response.json({ report: serialize(await reportService.edit(request.validated.params.id, request.validated.body, request.user)) })
  })
  router.get('/:id/reanalysis', requireRole('data-analyst'), validate({ params: idParams }), async (request, response) => {
    response.json({ draft: serialize(await reportService.reanalysis(request.validated.params.id, request.user)) })
  })
  router.get('/:id/recipients', requireRole('data-analyst'), validate({ params: idParams }), async (request, response) => {
    response.json(await reportService.recipients(request.validated.params.id, request.user))
  })
  router.post('/:id/share', requireRole('data-analyst'), validate({ params: idParams, body: shareReportBody }), async (request, response) => {
    response.json(await reportService.share(request.validated.params.id, request.validated.body.recipients, request.user))
  })
  router.get('/:id/export', validate({ params: idParams }), async (request, response) => {
    const report = await reportService.get(request.validated.params.id, request.user)
    response.json({ html: exportReport(report) })
  })
  return router
}
module.exports = { createReportRouter }
