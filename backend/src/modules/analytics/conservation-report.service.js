const { createHash } = require('node:crypto')
const { ForbiddenError, UnauthorizedError, NotFoundError, ConflictError } = require('../../shared/errors/AppError')
const { toId } = require('../../shared/utils/serialize')

function createReportService({ reportRepository, userRepository, parkRepository, notificationService, transactionRunner, clock = () => new Date() }) {
  async function account(user, allowManager = false) {
    const current = await userRepository.findById(user.id)
    if (!current) throw new UnauthorizedError('Your account no longer exists.')
    if (current.role !== 'data-analyst' && !(allowManager && current.role === 'park-manager')) throw new ForbiddenError('You cannot access these conservation reports.')
    return current
  }
  function publicReport(report) {
    const visible = { ...report }
    delete visible.contentHash
    delete visible.requestId
    delete visible.sharedWith
    visible.revision = report.revision ?? 0
    return visible
  }
  async function eligibleManagers(report) {
    const parks = report.parks?.length ? report.parks : [report.park]
    const groups = await Promise.all(parks.map((park) => userRepository.listByRole('park-manager', { park })))
    return groups[0].filter((manager) => groups.every((group) => group.some((item) => toId(item._id) === toId(manager._id))))
  }
  return {
    async recipients(id, user) {
      const current = await account(user)
      const report = await reportRepository.findOwned(id, user.id, current.park)
      if (!report) throw new NotFoundError('Report not found.', 'REPORT_NOT_FOUND')
      if (report.status !== 'finalized') throw new ConflictError('Only Finalized reports can be shared.', 'REPORT_NOT_FINALIZED')
      const managers = await eligibleManagers(report)
      return { managers: managers.map((manager) => ({ id: toId(manager._id), name: manager.name })) }
    },
    async share(id, recipients, user) {
      const current = await account(user)
      const report = await reportRepository.findOwned(id, user.id, current.park)
      if (!report) throw new NotFoundError('Report not found.', 'REPORT_NOT_FOUND')
      if (report.status !== 'finalized') throw new ConflictError('Only Finalized reports can be shared.', 'REPORT_NOT_FINALIZED')
      const permitted = new Set((await eligibleManagers(report)).map((manager) => toId(manager._id)))
      const selected = [...new Set(recipients)]
      if (!selected.length || selected.some((id) => !permitted.has(id))) throw new ForbiddenError('Select only eligible Park Managers for this report.', 'INVALID_REPORT_RECIPIENT')
      return transactionRunner.run(async (session) => {
        const previous = await reportRepository.grantShare(id, user.id, selected, session)
        if (!previous) throw new ConflictError('The finalized report is no longer available.')
        const existing = new Set((previous.sharedWith ?? []).map(toId))
        const added = selected.filter((recipient) => !existing.has(recipient))
        await notificationService.notifyUsers(added, { type: 'conservation-report', title: 'Conservation report shared',
          message: report.title, link: `/reports?reportId=${id}` }, { session })
        return { sharedCount: selected.length, newlySharedCount: added.length }
      })
    },
    async edit(id, input, user) {
      const current = await account(user)
      const report = await reportRepository.findOwned(id, user.id, current.park)
      if (!report) throw new NotFoundError('Report not found.', 'REPORT_NOT_FOUND')
      if (report.status !== 'draft') throw new ConflictError('Finalized reports are read-only.', 'REPORT_READ_ONLY')
      const { revision, title, findings, recommendations } = input
      const fields = { title, findings, recommendations }
      const updated = await reportRepository.updateDraft(id, user.id, current.park, revision, fields)
      if (updated) return publicReport(updated)
      const latest = await reportRepository.findOwned(id, user.id, current.park)
      // A lost response can be retried without creating another revision.
      if (latest?.status === 'draft' && latest.revision === revision + 1 &&
        Object.entries(fields).every(([key, value]) => latest[key] === value)) return publicReport(latest)
      throw new ConflictError('This draft has changed since you opened it. Your edits have been kept. Reopen the draft to review its latest content before saving.', 'DRAFT_CHANGED')
    },
    async reanalysis(id, user) {
      const current = await account(user)
      const report = await reportRepository.findOwned(id, user.id, current.park)
      if (!report) throw new NotFoundError('Report not found.', 'REPORT_NOT_FOUND')
      if (report.status !== 'draft') throw new ConflictError('Only Draft reports can be re-analyzed.', 'REPORT_READ_ONLY')
      return { id: toId(report._id), title: report.title, filters: report.snapshot.context.filters }
    },
    async save(input, user) {
      const current = await account(user)
      const parks = input.snapshot.parks?.map((section) => section.context.park.id) ?? [input.snapshot.context.park.id]
      const park = parks[0]
      if (current.park && parks.some((id) => toId(current.park) !== id)) throw new ForbiddenError('This park is outside your assigned park.', 'OUTSIDE_ASSIGNED_PARK')
      for (const id of parks) if (!await parkRepository.findParkById(id)) throw new NotFoundError('The selected park was not found.')
      const { requestId, ...content } = input
      const contentHash = createHash('sha256').update(JSON.stringify(content)).digest('hex')
      function existing(report) {
        if (report.contentHash !== contentHash) throw new ConflictError('This preview was already saved with different content or status. Open Reports to check the saved report.', 'REPORT_SAVE_CONFLICT')
        return publicReport(report)
      }
      const previous = await reportRepository.findRequest(user.id, requestId)
      if (previous) return existing(previous)
      try {
        return publicReport(await reportRepository.create({ ...content, requestId, contentHash, author: user.id, park, ...(parks.length > 1 && { parks }),
          finalizedAt: input.status === 'finalized' ? clock() : null }))
      } catch (error) {
        if (error.code !== 11000) throw error
        const raced = await reportRepository.findRequest(user.id, requestId)
        if (!raced) throw error
        return existing(raced)
      }
    },
    async get(id, user) {
      const current = await account(user, true)
      const report = current.role === 'park-manager'
        ? await reportRepository.findShared(id, user.id, current.park)
        : await reportRepository.findOwned(id, user.id, current.park)
      if (!report) throw new NotFoundError('Report not found.', 'REPORT_NOT_FOUND')
      return publicReport(report)
    },
    async list(page, user) {
      const current = await account(user, true)
      const rows = current.role === 'park-manager'
        ? await reportRepository.listShared(user.id, current.park, page)
        : await reportRepository.list(user.id, current.park, page)
      return { reports: rows.slice(0, 20).map(publicReport), page, hasMore: rows.length > 20 }
    },
  }
}
module.exports = { createReportService }
