const { serialize } = require('../../shared/utils/serialize')

function createIncidentController({ incidentService }) {
  return {
    async submit(request, response) {
      const result = await incidentService.submit(request.validated.body, request.user)
      response.status(result.created ? 201 : 200).json({
        incident: serialize(result.incident),
        alert: serialize(result.alert),
        duplicate: !result.created
      })
    },

    async listMine(request, response) {
      const incidents = await incidentService.listMine(request.user)
      response.json({ incidents: serialize(incidents) })
    },

    async getMine(request, response) {
      const result = await incidentService.getMine(request.validated.params.id, request.user)
      response.json(serialize(result))
    }
  }
}

module.exports = { createIncidentController }
