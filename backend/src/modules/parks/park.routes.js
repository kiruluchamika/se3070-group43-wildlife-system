const express = require('express')
const { serialize } = require('../../shared/utils/serialize')

/** Read-only park reference data used by every module. */
function createParkRouter({ parkRepository, authenticate }) {
  const router = express.Router()

  router.get('/', authenticate, async (request, response) => {
    const parks = await parkRepository.listParks()
    response.json({ parks: serialize(parks) })
  })

  return router
}

module.exports = { createParkRouter }
