const express = require('express')
const { z } = require('zod')
const { requireRole } = require('../../shared/middleware/authorize')
const { validate } = require('../../shared/middleware/validate')
const { ROLES } = require('../../shared/roles')
const { serialize } = require('../../shared/utils/serialize')
const { objectId } = require('../../shared/validation')

const listQuery = z.object({ parkId: objectId('Park id') })

/** Basic team listing shared by the staff modules. */
function createTeamRouter({ teamService, authenticate }) {
  const router = express.Router()

  router.get(
    '/',
    authenticate,
    requireRole(ROLES.PARK_MANAGER, ROLES.LIAISON_OFFICER, ROLES.DATA_ANALYST),
    validate({ query: listQuery }),
    async (request, response) => {
      const teams = await teamService.listTeams(request.validated.query.parkId)
      response.json({ teams: serialize(teams) })
    }
  )

  return router
}

module.exports = { createTeamRouter }
