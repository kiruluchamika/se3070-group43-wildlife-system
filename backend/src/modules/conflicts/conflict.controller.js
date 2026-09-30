const { serialize } = require('../../shared/utils/serialize')

/**
 * HTTP adapter for UC01. Each handler loads the signed-in user's park and
 * team (the token only carries id and role), calls one service method and
 * shapes the response; the rules live in the services.
 */
function createConflictController({ conflictService, responseService, conflictAccess }) {
  const actorOf = (request) => conflictAccess.loadActor(request.user)
  const body = (request) => request.validated.body
  const id = (request) => request.validated.params.id

  return {
    // Villager
    async submit(request, response) {
      const report = await conflictService.submit(body(request), await actorOf(request))
      response.status(201).json({ report: serialize(report) })
    },

    async listMine(request, response) {
      const reports = await conflictService.listMine(await actorOf(request))
      response.json({ reports: serialize(reports) })
    },

    async provideInformation(request, response) {
      const report = await conflictService.provideInformation(id(request), body(request), await actorOf(request))
      response.json({ report: serialize(report) })
    },

    // Shared detail view
    async getReport(request, response) {
      const result = await conflictService.getReport(id(request), await actorOf(request))
      response.json(serialize(result))
    },

    // Community Liaison Officer
    async listQueue(request, response) {
      const result = await conflictService.listQueue(request.validated.query, await actorOf(request))
      response.json(serialize(result))
    },

    async validate(request, response) {
      const report = await conflictService.validate(id(request), body(request), await actorOf(request))
      response.json({ report: serialize(report) })
    },

    async requestInformation(request, response) {
      const report = await conflictService.requestInformation(id(request), body(request), await actorOf(request))
      response.json({ report: serialize(report) })
    },

    async findDuplicates(request, response) {
      const candidates = await conflictService.findDuplicates(id(request), await actorOf(request))
      response.json({ candidates: serialize(candidates) })
    },

    async linkDuplicate(request, response) {
      const report = await conflictService.linkDuplicate(id(request), body(request), await actorOf(request))
      response.json({ report: serialize(report) })
    },

    async listTeams(request, response) {
      const result = await responseService.listTeams(id(request), await actorOf(request))
      response.json(serialize(result))
    },

    async deploy(request, response) {
      const result = await responseService.deploy(id(request), body(request), await actorOf(request))
      response.status(201).json(serialize(result))
    },

    async escalate(request, response) {
      const report = await conflictService.escalate(id(request), body(request), await actorOf(request))
      response.json({ report: serialize(report) })
    },

    async review(request, response) {
      const report = await conflictService.review(id(request), body(request), await actorOf(request))
      response.json({ report: serialize(report) })
    },

    async retryContact(request, response) {
      const result = await conflictService.retryContact(id(request), await actorOf(request))
      response.json(serialize(result))
    },

    async recordAlternativeContact(request, response) {
      const report = await conflictService.recordAlternativeContact(id(request), body(request), await actorOf(request))
      response.json({ report: serialize(report) })
    },

    // Park Manager
    async listApprovals(request, response) {
      const tasks = await responseService.listApprovals(request.validated.query, await actorOf(request))
      response.json({ tasks: serialize(tasks) })
    },

    async decideApproval(request, response) {
      const task = await responseService.decideApproval(id(request), body(request), await actorOf(request))
      response.json({ task: serialize(task) })
    },

    // Ranger
    async listMyTasks(request, response) {
      const result = await responseService.listMyTasks(await actorOf(request))
      response.json(serialize(result))
    },

    async acknowledge(request, response) {
      const task = await responseService.acknowledge(id(request), await actorOf(request))
      response.json({ task: serialize(task) })
    },

    /** 201 for a new action, 200 when a retried upload matched an existing one. */
    async recordAction(request, response) {
      const { action, created } = await responseService.recordAction(id(request), body(request), await actorOf(request))
      response.status(created ? 201 : 200).json({ action: serialize(action), duplicate: !created })
    },

    async complete(request, response) {
      const { task, created } = await responseService.complete(id(request), body(request), await actorOf(request))
      response.json({ task: serialize(task), duplicate: !created })
    }
  }
}

module.exports = { createConflictController }
