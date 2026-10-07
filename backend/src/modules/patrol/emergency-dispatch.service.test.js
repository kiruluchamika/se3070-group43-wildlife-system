const { createPatrolWorld, NOW } = require('../../test-support/patrol-fakes')
const { nextId } = require('../../test-support/ids')
const { estimateEtaMinutes, haversineKm } = require('../../shared/utils/geo')
const { DISPATCHABLE_SEVERITIES } = require('./emergency-dispatch.service')

const ALERT_LOCATION = { lat: 6.05, lng: 81.05 }

/**
 * A critical poaching alert in East Zone.
 *   Team Alpha    available, about 1.6 km away
 *   Team Charlie  available, about 70 km away
 *   Team Bravo    on patrol in Central Zone (low priority)
 *   Team Delta    on patrol in North Sector (higher priority than Central)
 *   Team Echo     off duty
 */
function setup({ availableTeams = true } = {}) {
  const world = createPatrolWorld()
  const manager = { id: nextId(), role: 'park-manager' }
  const rangers = { nuwan: nextId(), isuru: nextId() }

  const east = world.addZone({ name: 'East Zone', riskLevel: 'high', targetWeeklyPatrolHours: 21, lng: 81, lat: 6 })
  const north = world.addZone({ name: 'North Sector', riskLevel: 'medium', lng: 81.4, lat: 6 })
  const central = world.addZone({ name: 'Central Zone', riskLevel: 'low', targetWeeklyPatrolHours: 7, lng: 81.6, lat: 6 })

  const status = availableTeams ? 'available' : 'off-duty'
  const alpha = world.addTeam({ name: 'Team Alpha', status, location: { lat: 6.06, lng: 81.06 }, members: [rangers.nuwan], baseLocationName: 'Katagamuwa Base Camp' })
  const charlie = world.addTeam({ name: 'Team Charlie', status, location: { lat: 6.5, lng: 81.5 } })
  const bravo = world.addTeam({ name: 'Team Bravo', location: { lat: 6.05, lng: 81.65 }, members: [rangers.isuru] })
  const delta = world.addTeam({ name: 'Team Delta', location: { lat: 6.05, lng: 81.45 } })
  const echo = world.addTeam({ name: 'Team Echo', status: 'off-duty' })

  const bravoAssignment = world.addAssignment({ zone: central, team: bravo, startedHoursAgo: 3 })
  const deltaAssignment = world.addAssignment({ zone: north, team: delta, startedHoursAgo: 1 })
  const alert = world.addAlert({ zone: east, severity: 'critical', title: 'Possible Poaching Activity', location: ALERT_LOCATION })

  return {
    world,
    service: world.emergencyDispatchService,
    manager,
    rangers,
    alert,
    zones: { east, north, central },
    teams: { alpha, bravo, charlie, delta, echo },
    bravoAssignment,
    deltaAssignment
  }
}

const teamStatus = (world, team) => world.state.teams.find((entry) => entry._id === team._id).status
const names = (candidates) => candidates.map((candidate) => candidate.team.name)

describe('emergencyDispatchService.recommend (alternate flow A4)', () => {
  it('recommends the nearest available team', async () => {
    const { service, alert, teams } = setup()

    const recommendation = await service.recommend(alert._id)

    expect(recommendation.mode).toBe('available')
    expect(names(recommendation.available)).toEqual(['Team Alpha', 'Team Charlie'])
    expect(recommendation.recommended.team).toEqual({ id: teams.alpha._id, name: 'Team Alpha', status: 'available', members: 1, baseLocationName: 'Katagamuwa Base Camp' })
    expect(recommendation.alert).toMatchObject({ _id: alert._id, title: 'Possible Poaching Activity' })
  })

  it('gives each candidate its distance and travel time to the alert', async () => {
    const { service, alert, teams } = setup()
    const expectedKm = haversineKm(teams.alpha.lastKnownLocation, ALERT_LOCATION)

    const { recommended } = await service.recommend(alert._id)

    expect(recommended.distanceKm).toBe(Math.round(expectedKm * 10) / 10)
    expect(recommended.etaMinutes).toBe(estimateEtaMinutes(expectedKm))
    expect(recommended).toMatchObject({ currentAssignment: null, currentZonePriority: null })
  })

  it('offers teams on routine patrols as divertible, lowest-priority zone first', async () => {
    const { service, alert, zones, bravoAssignment } = setup()

    const { divertible } = await service.recommend(alert._id)

    expect(names(divertible)).toEqual(['Team Bravo', 'Team Delta'])
    expect(divertible[0].currentZonePriority).toBeLessThan(divertible[1].currentZonePriority)
    expect(divertible[0].currentAssignment).toMatchObject({ id: bravoAssignment._id, allocationType: 'allocation', zone: { _id: zones.central._id } })
  })

  it('recommends diverting a team when none is free (E2 fallback)', async () => {
    const { service, alert } = setup({ availableTeams: false })

    const recommendation = await service.recommend(alert._id)

    expect(recommendation).toMatchObject({ mode: 'divert', available: [] })
    expect(recommendation.recommended.team.name).toBe('Team Bravo')
  })

  it('never offers a team that is already responding to an emergency', async () => {
    const { world, service, alert, zones, teams } = setup({ availableTeams: false })
    world.addAssignment({ zone: zones.north, team: teams.charlie, allocationType: 'emergency' })
    teams.charlie.status = 'on-patrol'

    const { divertible } = await service.recommend(alert._id)

    expect(names(divertible)).not.toContain('Team Charlie')
  })

  it('reports that no team can respond', async () => {
    const world = createPatrolWorld()
    const east = world.addZone({ name: 'East Zone', riskLevel: 'high' })
    world.addTeam({ name: 'Team Echo', status: 'off-duty' })
    const alert = world.addAlert({ zone: east, location: ALERT_LOCATION })

    await expect(world.emergencyDispatchService.recommend(alert._id)).resolves.toMatchObject({ mode: 'none', recommended: null, available: [], divertible: [] })
  })

  it('puts a team with an unknown position last', async () => {
    const { world, service, alert } = setup()
    world.addTeam({ name: 'Team Foxtrot', location: null })

    const { available } = await service.recommend(alert._id)

    expect(names(available)).toEqual(['Team Alpha', 'Team Charlie', 'Team Foxtrot'])
    expect(available[2]).toMatchObject({ distanceKm: null, etaMinutes: null })
  })
})

describe('emergency dispatch eligibility', () => {
  it('is reserved for high and critical alerts', async () => {
    const { world, service, zones } = setup()
    const medium = world.addAlert({ zone: zones.east, severity: 'medium', location: ALERT_LOCATION })
    const high = world.addAlert({ zone: zones.east, severity: 'high', location: ALERT_LOCATION })

    expect(DISPATCHABLE_SEVERITIES).toEqual(['high', 'critical'])
    await expect(service.recommend(medium._id)).rejects.toMatchObject({
      status: 422,
      code: 'ALERT_NOT_ELIGIBLE',
      message: 'Emergency dispatch is reserved for high and critical alerts.'
    })
    await expect(service.recommend(high._id)).resolves.toMatchObject({ mode: 'available' })
  })

  it('accepts an alert that was acknowledged but not yet dispatched', async () => {
    const { world, service, zones } = setup()
    const acknowledged = world.addAlert({ zone: zones.east, status: 'acknowledged', location: ALERT_LOCATION })

    await expect(service.recommend(acknowledged._id)).resolves.toMatchObject({ mode: 'available' })
  })

  it('refuses an alert that already has a team or is resolved', async () => {
    const { world, service, zones } = setup()
    const dispatched = world.addAlert({ zone: zones.east, status: 'dispatched', location: ALERT_LOCATION })
    const resolved = world.addAlert({ zone: zones.east, status: 'resolved', location: ALERT_LOCATION })

    await expect(service.recommend(dispatched._id)).rejects.toMatchObject({ status: 409, code: 'ALERT_ALREADY_HANDLED', message: 'A team has already been dispatched.' })
    await expect(service.recommend(resolved._id)).rejects.toMatchObject({
      status: 409,
      code: 'ALERT_ALREADY_HANDLED',
      message: 'A team has already been sent and the alert resolved.'
    })
  })

  it('refuses an alert that has no zone or no location', async () => {
    const { world, service, manager, zones } = setup()
    const withoutLocation = world.addAlert({ zone: zones.east })
    const withoutZone = world.addAlert({ location: ALERT_LOCATION })

    await expect(service.recommend(withoutLocation._id)).rejects.toMatchObject({ status: 422, code: 'ALERT_WITHOUT_LOCATION' })
    await expect(service.dispatch({ alertId: withoutZone._id }, manager)).rejects.toMatchObject({ status: 422, code: 'ALERT_WITHOUT_LOCATION' })
  })

  it('reports an unknown alert', async () => {
    const { service, manager } = setup()

    await expect(service.recommend(nextId())).rejects.toMatchObject({ status: 404, code: 'ALERT_NOT_FOUND' })
    await expect(service.dispatch({ alertId: nextId() }, manager)).rejects.toMatchObject({ status: 404, code: 'ALERT_NOT_FOUND' })
  })
})

describe('emergencyDispatchService.dispatch', () => {
  it('sends the nearest available team when the manager does not choose one', async () => {
    const { world, service, manager, alert, zones, teams } = setup()

    const result = await service.dispatch({ alertId: alert._id, notes: 'Approach from the northern track.' }, manager)

    expect(result.team).toMatchObject({ id: teams.alpha._id, name: 'Team Alpha' })
    expect(result.alert).toEqual({ id: alert._id, title: 'Possible Poaching Activity' })
    expect(result.diverted).toBe(false)
    expect(result.assignment).toMatchObject({
      zone: zones.east._id,
      team: teams.alpha._id,
      allocationType: 'emergency',
      status: 'active',
      priority: 'critical',
      alert: alert._id,
      notes: 'Approach from the northern track.',
      assignedBy: manager.id,
      assignedAt: NOW
    })
    expect(result.assignment.previousAssignment).toBeUndefined()
    expect(teamStatus(world, teams.alpha)).toBe('responding')
  })

  it('records the dispatch with the distance and estimated arrival', async () => {
    const { world, service, manager, alert, zones, teams } = setup()

    const { dispatch, assignment } = await service.dispatch({ alertId: alert._id }, manager)

    expect(world.state.dispatches).toHaveLength(1)
    expect(dispatch).toMatchObject({
      alert: alert._id,
      zone: zones.east._id,
      team: teams.alpha._id,
      assignment: assignment._id,
      dispatchedBy: manager.id,
      distanceKm: 1.6,
      etaMinutes: 4
    })
    expect(dispatch.divertedFromAssignment).toBeUndefined()
  })

  it('marks the alert as dispatched and records the decision', async () => {
    const { world, service, manager, alert, zones, teams } = setup()

    await service.dispatch({ alertId: alert._id }, manager)

    expect(world.state.alerts[0].status).toBe('dispatched')
    expect(world.state.decisions).toHaveLength(1)
    expect(world.state.decisions[0]).toMatchObject({ type: 'emergency', zone: zones.east._id, team: teams.alpha._id, alert: alert._id, decidedBy: manager.id })
    expect(world.state.decisions[0].fromZone).toBeUndefined()
  })

  it('notifies the team with the alert, the travel time and the instructions', async () => {
    const { world, service, manager, rangers, alert } = setup()

    await service.dispatch({ alertId: alert._id, notes: 'Approach from the northern track.' }, manager)

    expect(world.state.notifications).toEqual([
      expect.objectContaining({
        recipient: rangers.nuwan,
        type: 'emergency-dispatch',
        title: 'EMERGENCY: Possible Poaching Activity',
        message: 'Respond immediately. ETA 4 min. Approach from the northern track.',
        link: '/my-assignment'
      })
    ])
  })

  it('lets the manager override the recommendation with another team', async () => {
    const { world, service, manager, alert, teams } = setup()

    const result = await service.dispatch({ alertId: alert._id, teamId: teams.charlie._id }, manager)

    expect(result.team.name).toBe('Team Charlie')
    expect(teamStatus(world, teams.charlie)).toBe('responding')
    expect(teamStatus(world, teams.alpha)).toBe('available')
  })

  it('diverts a team from a routine patrol, ending and recording that patrol', async () => {
    const { world, service, manager, alert, zones, teams, bravoAssignment } = setup()

    const result = await service.dispatch({ alertId: alert._id, teamId: teams.bravo._id }, manager)

    expect(result.diverted).toBe(true)
    expect(result.assignment).toMatchObject({ allocationType: 'emergency', previousAssignment: bravoAssignment._id })
    expect(result.dispatch.divertedFromAssignment).toBe(bravoAssignment._id)
    expect(world.state.assignments.find((assignment) => assignment._id === bravoAssignment._id)).toMatchObject({ status: 'superseded', endedAt: NOW })
    expect(world.state.records.at(-1)).toMatchObject({ zone: zones.central._id, team: teams.bravo._id, assignment: bravoAssignment._id, startTime: world.hoursAgo(3), endTime: NOW })
    expect(world.state.decisions[0]).toMatchObject({ type: 'emergency', fromZone: zones.central._id })
    expect(teamStatus(world, teams.bravo)).toBe('responding')
  })

  it('diverts the team on the lowest-priority patrol when no team is free', async () => {
    const { service, manager, alert } = setup({ availableTeams: false })

    const result = await service.dispatch({ alertId: alert._id }, manager)

    expect(result).toMatchObject({ diverted: true, team: { name: 'Team Bravo' } })
  })

  it('writes "?" for the travel time when the team position is unknown', async () => {
    const { world, service, manager, alert } = setup()
    const foxtrot = world.addTeam({ name: 'Team Foxtrot', location: null, members: [nextId()] })

    await service.dispatch({ alertId: alert._id, teamId: foxtrot._id }, manager)

    expect(world.state.notifications[0].message).toBe('Respond immediately. ETA ? min.')
  })

  it('tells the manager to use radio or telephone when no team can respond', async () => {
    const world = createPatrolWorld()
    const east = world.addZone({ name: 'East Zone', riskLevel: 'high' })
    world.addTeam({ name: 'Team Echo', status: 'off-duty' })
    const alert = world.addAlert({ zone: east, location: ALERT_LOCATION })

    await expect(world.emergencyDispatchService.dispatch({ alertId: alert._id }, { id: nextId() })).rejects.toMatchObject({
      status: 409,
      code: 'NO_TEAM_AVAILABLE',
      message: 'No ranger team is available or can be diverted. Arrange a response by radio or telephone.'
    })
    expect(world.state.alerts[0].status).toBe('active')
  })

  it('refuses a chosen team that can no longer be dispatched', async () => {
    const { world, service, manager, alert, teams } = setup()

    await expect(service.dispatch({ alertId: alert._id, teamId: teams.echo._id }, manager)).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NOT_AVAILABLE',
      message: 'The selected team can no longer be dispatched. Refresh the recommendations.'
    })
    expect(world.transactionRunner.run).not.toHaveBeenCalled()
  })

  it('stops when the patrol being diverted changed during the dispatch', async () => {
    const { world, service, manager, alert, teams } = setup()
    world.repositories.patrolRepository.closeAssignment.mockResolvedValueOnce(null)

    await expect(service.dispatch({ alertId: alert._id, teamId: teams.bravo._id }, manager)).rejects.toMatchObject({
      status: 409,
      code: 'CONCURRENT_UPDATE',
      message: "Team Bravo's patrol changed while dispatching. Try again."
    })
    expect(world.state.dispatches).toHaveLength(0)
    expect(world.state.alerts[0].status).toBe('active')
  })

  it('refuses to dispatch a second team to the same alert', async () => {
    const { world, service, manager, alert, teams } = setup()
    await service.dispatch({ alertId: alert._id }, manager)

    await expect(service.dispatch({ alertId: alert._id, teamId: teams.charlie._id }, manager)).rejects.toMatchObject({ status: 409, code: 'ALERT_ALREADY_HANDLED' })
    expect(world.state.dispatches).toHaveLength(1)
    expect(teamStatus(world, teams.charlie)).toBe('available')
  })

  it('makes every change inside one transaction', async () => {
    const { world, service, manager, alert, teams } = setup()

    await service.dispatch({ alertId: alert._id }, manager)

    const { teamRepository, patrolRepository, alertRepository, notificationRepository } = world.repositories
    expect(world.transactionRunner.run).toHaveBeenCalledTimes(1)
    expect(teamRepository.updateStatusIf).toHaveBeenCalledWith(teams.alpha._id, ['available', 'on-patrol'], 'responding', { session: 'session' })
    expect(patrolRepository.createDispatch.mock.calls[0][1]).toEqual({ session: 'session' })
    expect(alertRepository.updateIfStatus.mock.calls[0][3]).toEqual({ session: 'session' })
    expect(notificationRepository.createMany.mock.calls[0][1]).toEqual({ session: 'session' })
  })
})
