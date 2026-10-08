const { ROLES } = require('../../shared/roles')
const { toId } = require('../../shared/utils/serialize')
const { CONTACT_STATUS } = require('./conflict.constants')

/**
 * Who UC01 tells what (main flow steps 2 and 5).
 *
 * Staff notifications are in-app and are written inside the caller's
 * transaction, so they appear only if the decision is saved. Community
 * (villager) contact goes through the notification dispatcher after the
 * transaction commits: in-app, then SMS (E1). Every attempt is recorded on the
 * report, and when all channels fail the officers are told to use an
 * alternative contact (E2, E3).
 */
function createConflictNotifier({ userRepository, notificationService, notificationDispatcher, conflictRepository, clock = () => new Date(), logger = console }) {
  async function notifyRole(role, parkId, payload, { session } = {}) {
    const users = await userRepository.listByRole(role, { park: parkId })
    return notificationService.notifyUsers(
      users.map((user) => user._id),
      payload,
      { session }
    )
  }

  const officerLink = (report) => `/conflicts?report=${toId(report._id)}`
  const officers = (parkId, payload, options) => notifyRole(ROLES.LIAISON_OFFICER, parkId, { type: 'conflict-report', ...payload }, options)

  return {
    officerLink,
    officers,

    managers(parkId, payload, options) {
      return notifyRole(ROLES.PARK_MANAGER, parkId, { type: 'conflict-response', ...payload }, options)
    },

    team(team, { taskId, ...payload }, { session } = {}) {
      return notificationService.notifyUsers(team.members ?? [], { type: 'conflict-task', link: `/response-tasks?task=${taskId}`, ...payload }, { session })
    },

    /**
     * Tells the reporting villager about their report. Never throws: a failed
     * contact is recorded and escalated to the officers instead.
     * Returns `{ reached, attempts }`.
     */
    async community(report, { purpose, title, message }) {
      try {
        const { reached, attempts } = await notificationDispatcher.deliver(
          { userId: toId(report.reporter), phone: report.contactPhone },
          { type: 'conflict-update', title, message, link: `/conflicts/mine?report=${toId(report._id)}` }
        )
        const at = clock()
        await conflictRepository.updateReport(report._id, {
          $push: { contactAttempts: { $each: attempts.map((attempt) => ({ ...attempt, at, purpose })) } },
          $set: { contactStatus: reached ? 'ok' : 'failed' }
        })

        if (!reached) {
          await officers(report.park, {
            title: `Could not reach reporter of ${report.reference}`,
            message: `In-app and SMS contact failed (${purpose}). Retry, or record an alternative contact such as the village officer.`,
            link: officerLink(report)
          })
        }
        return { reached, attempts }
      } catch (error) {
        logger.error?.(error)
        return { reached: false, attempts: [{ channel: 'in-app', status: CONTACT_STATUS.FAILED, detail: error.message }] }
      }
    }
  }
}

module.exports = { createConflictNotifier }
