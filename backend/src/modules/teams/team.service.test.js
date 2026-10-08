const { createTeamService, TEAM_STATUS } = require('./team.service')

function setup(teams) {
  const store = new Map(teams.map((team) => [team._id, { ...team }]))
  const teamRepository = {
    listByPark: vi.fn(async () => [...store.values()]),
    findById: vi.fn(async (id) => store.get(id) ?? null),
    updateStatusIf: vi.fn(async (id, fromStatuses, status) => {
      const team = store.get(id)
      if (!team || !fromStatuses.includes(team.status)) return null
      team.status = status
      return { ...team }
    }),
    setStatus: vi.fn(async (id, status) => {
      const team = store.get(id)
      if (!team) return null
      team.status = status
      return { ...team }
    })
  }
  return { teamService: createTeamService({ teamRepository }), teamRepository, store }
}

describe('teamService availability rules', () => {
  it('treats only the available status as available', () => {
    const { teamService } = setup([])

    expect(teamService.isAvailable({ status: TEAM_STATUS.AVAILABLE })).toBe(true)
    expect(teamService.isAvailable({ status: TEAM_STATUS.ON_PATROL })).toBe(false)
    expect(teamService.isAvailable(null)).toBe(false)
  })

  it('commits an available team as responding by default', async () => {
    const { teamService, store } = setup([{ _id: 'alpha', name: 'Team Alpha', status: 'available' }])

    await teamService.commitTeam('alpha')

    expect(store.get('alpha').status).toBe('responding')
  })

  it('refuses to commit a team that another action already took', async () => {
    const { teamService } = setup([{ _id: 'bravo', name: 'Team Bravo', status: 'on-patrol' }])

    await expect(teamService.commitTeam('bravo', TEAM_STATUS.ON_PATROL)).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NOT_AVAILABLE',
      message: 'Team Bravo is no longer available (currently on-patrol).'
    })
  })

  it('reports a missing team when committing', async () => {
    const { teamService } = setup([])

    await expect(teamService.commitTeam('ghost')).rejects.toMatchObject({ status: 404, code: 'TEAM_NOT_FOUND' })
  })

  it('releases a team back to available', async () => {
    const { teamService, store } = setup([{ _id: 'bravo', name: 'Team Bravo', status: 'responding' }])

    await teamService.releaseTeam('bravo')

    expect(store.get('bravo').status).toBe('available')
  })

  it('reports a missing team when releasing', async () => {
    const { teamService } = setup([])

    await expect(teamService.releaseTeam('ghost')).rejects.toMatchObject({ code: 'TEAM_NOT_FOUND' })
  })

  it('lists the teams of a park', async () => {
    const { teamService, teamRepository } = setup([{ _id: 'alpha', status: 'available' }])

    await expect(teamService.listTeams('park-1')).resolves.toHaveLength(1)
    expect(teamRepository.listByPark).toHaveBeenCalledWith('park-1')
  })
})
