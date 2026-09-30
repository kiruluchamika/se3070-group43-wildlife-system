const { ForbiddenError, UnauthorizedError } = require('../../shared/errors/AppError')
const { toId } = require('../../shared/utils/serialize')

/**
 * Record-level access checks for UC01. Route middleware already checks the
 * role; these rules add what a role check cannot: the staff member's assigned
 * park and the villager's ownership of a report.
 */
function createConflictAccess({ userRepository }) {
  return {
    /** The signed-in user with their park and team (the token only carries id and role). */
    async loadActor(user) {
      const account = await userRepository.findById(user.id)
      if (!account) throw new UnauthorizedError('Your account no longer exists. Please sign in again.', 'USER_NOT_FOUND')
      return { id: toId(account._id), role: account.role, name: account.name, park: toId(account.park), team: toId(account.team) }
    },

    /** Staff with a home park may only act on that park; staff without one cover every park. */
    assertParkAccess(actor, parkId) {
      if (actor.park && toId(parkId) !== actor.park) {
        throw new ForbiddenError('This record belongs to a park you are not assigned to.', 'OUTSIDE_ASSIGNED_PARK')
      }
    },

    assertReporter(actor, report) {
      if (toId(report.reporter) !== actor.id) {
        throw new ForbiddenError('You can only view and update your own conflict reports.', 'NOT_REPORT_OWNER')
      }
    },

    assertTeamMember(actor, team) {
      const members = (team?.members ?? []).map(toId)
      if (!members.includes(actor.id)) {
        throw new ForbiddenError('Only members of the assigned ranger team can update this task.', 'NOT_TEAM_MEMBER')
      }
    }
  }
}

module.exports = { createConflictAccess }
