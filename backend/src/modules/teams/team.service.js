const { ConflictError, NotFoundError } = require('../../shared/errors/AppError')
const { TEAM_STATUS } = require('./ranger-team.model')

/**
 * Shared team-availability rules. A team is available only while its status is
 * `available`; committing a team (patrol, conflict response, or emergency)
 * moves it out of that state until it is released.
 *
 * UC01 (conflict response) must use commitTeam/releaseTeam so that patrol
 * management sees the same commitment.
 */
function createTeamService({ teamRepository }) {
  return {
    listTeams(parkId) {
      return teamRepository.listByPark(parkId)
    },

    isAvailable(team) {
      return team?.status === TEAM_STATUS.AVAILABLE
    },

    async commitTeam(teamId, status = TEAM_STATUS.RESPONDING, { session, fromStatuses = [TEAM_STATUS.AVAILABLE] } = {}) {
      const team = await teamRepository.updateStatusIf(teamId, fromStatuses, status, { session })
      if (team) return team

      const current = await teamRepository.findById(teamId, { session })
      if (!current) throw new NotFoundError('The selected ranger team was not found.', 'TEAM_NOT_FOUND')
      throw new ConflictError(`${current.name} is no longer available (currently ${current.status}).`, 'TEAM_NOT_AVAILABLE', {
        status: current.status
      })
    },

    async releaseTeam(teamId, { session } = {}) {
      const team = await teamRepository.setStatus(teamId, TEAM_STATUS.AVAILABLE, { session })
      if (!team) throw new NotFoundError('The selected ranger team was not found.', 'TEAM_NOT_FOUND')
      return team
    }
  }
}

module.exports = { createTeamService, TEAM_STATUS }
