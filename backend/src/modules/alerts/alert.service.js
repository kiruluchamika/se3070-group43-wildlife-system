const { ConflictError, NotFoundError } = require('../../shared/errors/AppError')

const SEVERITY_RANK = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 })

/** Alerts that still need attention (UC04 "active alerts"). */
const UNRESOLVED_STATUSES = Object.freeze(['active', 'acknowledged', 'dispatched'])
/** Alerts that a team has not yet been sent to. */
const DISPATCHABLE_STATUSES = Object.freeze(['active', 'acknowledged'])

/** Most severe first; newest first within the same severity. */
function sortBySeverity(alerts) {
  return [...alerts].sort(
    (first, second) =>
      (SEVERITY_RANK[second.severity] ?? 0) - (SEVERITY_RANK[first.severity] ?? 0) ||
      new Date(second.createdAt) - new Date(first.createdAt)
  )
}

function statusesFor(filter) {
  if (filter === 'all') return undefined
  if (!filter || filter === 'open') return UNRESOLVED_STATUSES
  return [filter]
}

/**
 * Operational alerts. UC03 incidents and the simulated collar/camera feeds
 * create alerts through `raise`; UC04 reads, acknowledges and dispatches them.
 */
function createAlertService({ alertRepository, clock = () => new Date() }) {
  async function requireAlert(alertId, options) {
    const alert = await alertRepository.findById(alertId, options)
    if (!alert) throw new NotFoundError('The selected alert was not found.', 'ALERT_NOT_FOUND')
    return alert
  }

  return {
    async listActive(parkId) {
      return sortBySeverity(await alertRepository.listByPark(parkId, { statuses: UNRESOLVED_STATUSES }))
    },

    async list(parkId, { status } = {}) {
      return sortBySeverity(await alertRepository.listByPark(parkId, { statuses: statusesFor(status) }))
    },

    findById: requireAlert,

    raise(data) {
      return alertRepository.create({ ...data, status: 'active' })
    },

    async acknowledge(alertId, userId) {
      const alert = await alertRepository.updateIfStatus(alertId, ['active'], {
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: clock()
      })
      if (alert) return alert

      const current = await requireAlert(alertId)
      throw new ConflictError(`This alert is already ${current.status}.`, 'ALERT_NOT_ACTIVE')
    },

    async markDispatched(alertId, { session } = {}) {
      const alert = await alertRepository.updateIfStatus(alertId, DISPATCHABLE_STATUSES, { status: 'dispatched' }, { session })
      if (!alert) throw new ConflictError('A team has already been dispatched to this alert.', 'ALERT_ALREADY_HANDLED')
      return alert
    },

    resolve(alertId, { session } = {}) {
      return alertRepository.updateIfStatus(alertId, UNRESOLVED_STATUSES, { status: 'resolved', resolvedAt: clock() }, { session })
    }
  }
}

module.exports = {
  createAlertService,
  sortBySeverity,
  SEVERITY_RANK,
  UNRESOLVED_STATUSES,
  DISPATCHABLE_STATUSES
}
