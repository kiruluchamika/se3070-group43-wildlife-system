const { serialize } = require('../../shared/utils/serialize')

/**
 * HTTP adapter for UC04. The method names follow the lifelines of Group 41's
 * sequence diagram (PatrolCtrl, RangerCtrl, DispatchCtrl); the rules live in the services.
 */
function createPatrolController({ coverageService, allocationService, emergencyDispatchService }) {
  return {
    // PatrolCtrl
    async getCoverage(request, response) {
      const coverage = await coverageService.getCoverage(request.validated.query.parkId)
      response.json(serialize(coverage))
    },

    async listAssignments(request, response) {
      const assignments = await allocationService.listActiveAssignments(request.validated.query.parkId)
      response.json({ assignments: serialize(assignments) })
    },

    async allocate(request, response) {
      const result = await allocationService.allocate(request.validated.body, request.user)
      response.status(201).json(serialize(result))
    },

    async reassign(request, response) {
      const result = await allocationService.reassign(request.validated.body, request.user)
      response.status(201).json(serialize(result))
    },

    async complete(request, response) {
      const assignment = await allocationService.complete(request.validated.params.id, request.user)
      response.json({ assignment: serialize(assignment) })
    },

    async listDecisions(request, response) {
      const decisions = await allocationService.listDecisions(request.validated.query.parkId)
      response.json({ decisions: serialize(decisions) })
    },

    // RangerCtrl
    async listTeams(request, response) {
      const { parkId, zoneId } = request.validated.query
      const teams = await allocationService.listTeams(parkId, { zoneId })
      response.json({ teams: serialize(teams) })
    },

    async myAssignment(request, response) {
      const result = await allocationService.getMyAssignment(request.user.id)
      response.json(serialize(result))
    },

    async acknowledge(request, response) {
      const assignment = await allocationService.acknowledge(request.validated.params.id, request.user)
      response.json({ assignment: serialize(assignment) })
    },

    // DispatchCtrl
    async recommendDispatch(request, response) {
      const recommendation = await emergencyDispatchService.recommend(request.validated.query.alertId)
      response.json(serialize(recommendation))
    },

    async dispatch(request, response) {
      const result = await emergencyDispatchService.dispatch(request.validated.body, request.user)
      response.status(201).json(serialize(result))
    }
  }
}

module.exports = { createPatrolController }
