const { ConflictError, NotFoundError } = require('../../shared/errors/AppError')
const { haversineKm, polygonCentroid } = require('../../shared/utils/geo')
const { alertSeverityFor, canTransition, pointOf } = require('./conflict.rules')

const describe = (status) => status.replaceAll('-', ' ')

/**
 * Report state changes shared by the UC01 services. Every change is checked
 * against the transition table, applied only if nobody changed the report in
 * the meantime, and appended to the report's history.
 */
function createConflictWorkflow({ conflictRepository, parkRepository, alertService, clock = () => new Date() }) {
  async function requireReport(reportId, options) {
    const report = await conflictRepository.findReportById(reportId, options)
    if (!report) throw new NotFoundError('The conflict report was not found.', 'REPORT_NOT_FOUND')
    return report
  }

  async function requireTask(taskId, options) {
    const task = await conflictRepository.findTaskById(taskId, options)
    if (!task) throw new NotFoundError('The response task was not found.', 'TASK_NOT_FOUND')
    return task
  }

  function assertCanTransition(report, to) {
    if (!canTransition(report.status, to)) {
      throw new ConflictError(`A report that is ${describe(report.status)} cannot be changed to ${describe(to)}.`, 'INVALID_TRANSITION', {
        from: report.status,
        to
      })
    }
  }

  /** Moves `report` to `to`, recording who did it and why. */
  async function transition(report, to, { actor, action, note, set = {}, push = {} }, { session } = {}) {
    assertCanTransition(report, to)
    const entry = { at: clock(), by: actor.id, action, fromStatus: report.status, toStatus: to, note }
    const updated = await conflictRepository.updateReportIf(
      report._id,
      [report.status],
      { $set: { status: to, ...set }, $push: { history: entry, ...push } },
      { session }
    )
    if (!updated) throw new ConflictError('This report was changed by someone else. Refresh and try again.', 'CONCURRENT_UPDATE')
    return updated
  }

  /** The park zone whose centre is nearest the report, so UC04 can route a team to the alert. */
  async function nearestZone(report) {
    const point = pointOf(report.location)
    if (!point) return null
    const zones = await parkRepository.listZones(report.park)
    let best = null
    for (const zone of zones) {
      const distance = haversineKm(point, polygonCentroid(zone.boundary))
      if (distance !== null && (!best || distance < best.distance)) best = { zone, distance }
    }
    return best?.zone ?? null
  }

  /** Raises the UC04 alert that makes an escalated or emergency conflict visible to the park manager. */
  async function raiseAlert(report, { title, message }, { session } = {}) {
    const zone = await nearestZone(report)
    return alertService.raise(
      {
        park: report.park,
        zone: zone?._id,
        type: 'elephant-movement',
        severity: alertSeverityFor(report.priority),
        title,
        message: message?.slice(0, 500),
        location: pointOf(report.location) ? { lat: report.location.lat, lng: report.location.lng } : undefined,
        source: 'conflict-report',
        sourceRef: report.reference
      },
      { session }
    )
  }

  return { requireReport, requireTask, assertCanTransition, transition, raiseAlert, nearestZone }
}

module.exports = { createConflictWorkflow }
