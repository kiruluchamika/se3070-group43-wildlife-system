const { createPatrolWorld, NOW } = require('../../test-support/patrol-fakes')
const { nextId } = require('../../test-support/ids')

/**
 * Yala with three zones and four teams:
 *   East Zone     high risk, last patrol 30 h ago -> under-patrolled (highest priority)
 *   North Sector  medium risk, recently patrolled -> adequate
 *   Central Zone  low risk, Team Bravo on patrol  -> covered (lowest priority)
 *   Team Alpha available (nearest to East), Team Charlie available, Team Delta off duty
 */
function setup() {
  const world = createPatrolWorld()
  const manager = { id: nextId(), role: 'park-manager' }
  const rangers = { nuwan: nextId(), chaminda: nextId(), isuru: nextId(), kasun: nextId() }

  const east = world.addZone({ name: 'East Zone', riskLevel: 'high', targetWeeklyPatrolHours: 21, lng: 81, lat: 6 })
  const north = world.addZone({ name: 'North Sector', riskLevel: 'medium', lng: 81.4, lat: 6 })
  const central = world.addZone({ name: 'Central Zone', riskLevel: 'low', targetWeeklyPatrolHours: 7, lng: 81.6, lat: 6 })

  const alpha = world.addTeam({ name: 'Team Alpha', location: { lat: 6.06, lng: 81.06 }, members: [rangers.nuwan, rangers.chaminda] })
  const bravo = world.addTeam({ name: 'Team Bravo', location: { lat: 6.05, lng: 81.65 }, members: [rangers.isuru] })
  const charlie = world.addTeam({ name: 'Team Charlie', location: { lat: 6.5, lng: 81.5 }, members: [rangers.kasun] })
  const delta = world.addTeam({ name: 'Team Delta', status: 'off-duty' })

  world.addRecord({ zone: east, team: alpha, startedHoursAgo: 33, endedHoursAgo: 30 })
  world.addRecord({ zone: north, team: charlie, startedHoursAgo: 18, endedHoursAgo: 10 })
  const bravoAssignment = world.addAssignment({ zone: central, team: bravo, startedHoursAgo: 2, assignedBy: manager.id })

  return { world, service: world.allocationService, manager, rangers, zones: { east, north, central }, teams: { alpha, bravo, charlie, delta }, bravoAssignment }
}

const teamStatus = (world, team) => world.state.teams.find((entry) => entry._id === team._id).status

describe('allocationService.listTeams (main flow step 7)', () => {
  it('lists available teams first, nearest to the selected zone first', async () => {
    const { world, service, zones } = setup()

    const teams = await service.listTeams(world.park._id, { zoneId: zones.east._id })

    expect(teams.map((team) => [team.name, team.status])).toEqual([
      ['Team Alpha', 'available'],
      ['Team Charlie', 'available'],
      ['Team Bravo', 'on-patrol'],
      ['Team Delta', 'off-duty']
    ])
    expect(teams[0].distanceKm).toBeLessThan(teams[1].distanceKm)
    expect(teams[0]).toMatchObject({ distanceKm: 1.6, etaMinutes: 4 })
  })

  it('includes the current assignment of a team on patrol', async () => {
    const { world, service, zones, bravoAssignment } = setup()

    const teams = await service.listTeams(world.park._id, { zoneId: zones.east._id })
    const bravo = teams.find((team) => team.name === 'Team Bravo')

    expect(bravo.currentAssignment).toMatchObject({ id: bravoAssignment._id, allocationType: 'allocation', zone: { name: 'Central Zone' } })
    expect(teams.find((team) => team.name === 'Team Alpha').currentAssignment).toBeNull()
  })

  it('leaves out distances when no zone is selected and sorts by name within a status', async () => {
    const { world, service } = setup()

    const teams = await service.listTeams(world.park._id)

    expect(teams.map((team) => team.name)).toEqual(['Team Alpha', 'Team Charlie', 'Team Bravo', 'Team Delta'])
    expect(teams.every((team) => team.distanceKm === null && team.etaMinutes === null)).toBe(true)
  })

  it('reports an unknown zone', async () => {
    const { world, service } = setup()

    await expect(service.listTeams(world.park._id, { zoneId: nextId() })).rejects.toMatchObject({ status: 404, code: 'ZONE_NOT_FOUND' })
  })
})

describe('allocationService.allocate (main flow steps 8-12)', () => {
  it('assigns an available team to the zone and puts it on patrol', async () => {
    const { world, service, manager, zones, teams } = setup()

    const result = await service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id, notes: 'Sweep the river crossing.' }, manager)

    expect(result.team).toEqual({ id: teams.alpha._id, name: 'Team Alpha' })
    expect(result.zone).toEqual({ id: zones.east._id, name: 'East Zone' })
    expect(result.assignment).toMatchObject({
      park: world.park._id,
      zone: zones.east._id,
      team: teams.alpha._id,
      allocationType: 'allocation',
      status: 'active',
      priority: 'high',
      notes: 'Sweep the river crossing.',
      assignedBy: manager.id,
      assignedAt: NOW
    })
    expect(teamStatus(world, teams.alpha)).toBe('on-patrol')
  })

  it('records the allocation decision (main flow step 11)', async () => {
    const { world, service, manager, zones, teams } = setup()

    const { assignment } = await service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id, notes: 'Sweep the river crossing.' }, manager)

    expect(world.state.decisions).toHaveLength(1)
    expect(world.state.decisions[0]).toMatchObject({
      type: 'allocate',
      zone: zones.east._id,
      team: teams.alpha._id,
      assignment: assignment._id,
      decidedBy: manager.id,
      notes: 'Sweep the river crossing.'
    })
  })

  it('notifies every member of the team with a link to My Assignment', async () => {
    const { world, service, manager, rangers, zones, teams } = setup()

    await service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id, notes: 'Sweep the river crossing.' }, manager)

    expect(world.state.notifications.map((notification) => notification.recipient)).toEqual([rangers.nuwan, rangers.chaminda])
    expect(world.state.notifications[0]).toMatchObject({
      type: 'patrol-assignment',
      title: 'New patrol assignment: East Zone',
      message: 'Sweep the river crossing.',
      link: '/my-assignment'
    })
  })

  it('writes a default notification message when the manager adds no notes', async () => {
    const { world, service, manager, zones, teams } = setup()

    await service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id }, manager)

    expect(world.state.notifications[0].message).toBe('Team Alpha has been assigned to East Zone.')
  })

  it('makes every change inside one transaction', async () => {
    const { world, service, manager, zones, teams } = setup()

    await service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id }, manager)

    const { teamRepository, patrolRepository, notificationRepository } = world.repositories
    expect(world.transactionRunner.run).toHaveBeenCalledTimes(1)
    expect(teamRepository.updateStatusIf).toHaveBeenCalledWith(teams.alpha._id, ['available'], 'on-patrol', { session: 'session' })
    expect(patrolRepository.createAssignment.mock.calls[0][1]).toEqual({ session: 'session' })
    expect(patrolRepository.recordDecision.mock.calls[0][1]).toEqual({ session: 'session' })
    expect(notificationRepository.createMany.mock.calls[0][1]).toEqual({ session: 'session' })
  })

  it('tells the manager to reassign a team that is already on patrol', async () => {
    const { world, service, manager, zones, teams } = setup()

    await expect(service.allocate({ zoneId: zones.east._id, teamId: teams.bravo._id }, manager)).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NOT_AVAILABLE',
      message: 'Team Bravo is already on patrol. Use reassignment to move it to East Zone.',
      details: { status: 'on-patrol', canReassign: true }
    })
    expect(world.transactionRunner.run).not.toHaveBeenCalled()
  })

  it('refuses a team that is off duty (E2)', async () => {
    const { service, manager, zones, teams } = setup()

    await expect(service.allocate({ zoneId: zones.east._id, teamId: teams.delta._id }, manager)).rejects.toMatchObject({
      code: 'TEAM_NOT_AVAILABLE',
      message: 'Team Delta is not available (currently off-duty).',
      details: { status: 'off-duty', canReassign: false }
    })
  })

  it('refuses a team that another manager allocated a moment earlier', async () => {
    const { world, service, manager, zones, teams } = setup()
    world.repositories.teamRepository.updateStatusIf.mockResolvedValueOnce(null)

    await expect(service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id }, manager)).rejects.toMatchObject({ status: 409, code: 'TEAM_NOT_AVAILABLE' })
    expect(world.state.assignments).toHaveLength(1)
    expect(world.state.decisions).toHaveLength(0)
  })

  it('refuses a team from a different park', async () => {
    const { world, service, manager, zones } = setup()
    const echo = world.addTeam({ name: 'Team Echo', parkId: nextId() })

    await expect(service.allocate({ zoneId: zones.east._id, teamId: echo._id }, manager)).rejects.toMatchObject({
      status: 422,
      code: 'TEAM_PARK_MISMATCH',
      message: 'Team Echo belongs to a different park and cannot patrol East Zone.'
    })
  })

  it('reports an unknown zone or team', async () => {
    const { service, manager, zones, teams } = setup()

    await expect(service.allocate({ zoneId: nextId(), teamId: teams.alpha._id }, manager)).rejects.toMatchObject({ status: 404, code: 'ZONE_NOT_FOUND' })
    await expect(service.allocate({ zoneId: zones.east._id, teamId: nextId() }, manager)).rejects.toMatchObject({ status: 404, code: 'TEAM_NOT_FOUND' })
  })

  it('surfaces a failure while saving so the caller can roll back (E3)', async () => {
    const { world, service, manager, zones, teams } = setup()
    world.repositories.patrolRepository.recordDecision.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id }, manager)).rejects.toThrow('database unavailable')
    expect(world.state.notifications).toHaveLength(0)
  })
})

describe('allocationService.reassign (alternate flow A3)', () => {
  const reason = 'Snare reports in the east need a team now.'

  it('moves a team on patrol to a higher-priority zone', async () => {
    const { world, service, manager, zones, teams, bravoAssignment } = setup()

    const result = await service.reassign({ zoneId: zones.east._id, teamId: teams.bravo._id, reason }, manager)

    expect(result.assignment).toMatchObject({
      zone: zones.east._id,
      team: teams.bravo._id,
      allocationType: 'reassignment',
      status: 'active',
      priority: 'high',
      reason,
      previousAssignment: bravoAssignment._id,
      assignedBy: manager.id,
      assignedAt: NOW
    })
    expect(result.vacatedZone).toEqual({ id: zones.central._id, name: 'Central Zone' })
    expect(teamStatus(world, teams.bravo)).toBe('on-patrol')
  })

  it('ends the previous assignment and records the patrol the team performed', async () => {
    const { world, service, manager, zones, teams, bravoAssignment } = setup()

    await service.reassign({ zoneId: zones.east._id, teamId: teams.bravo._id, reason }, manager)

    expect(world.state.assignments.find((assignment) => assignment._id === bravoAssignment._id)).toMatchObject({ status: 'superseded', endedAt: NOW })
    expect(world.state.records.at(-1)).toMatchObject({
      zone: zones.central._id,
      team: teams.bravo._id,
      assignment: bravoAssignment._id,
      startTime: world.hoursAgo(2),
      endTime: NOW
    })
  })

  it('records the decision with the zone the team left and notifies the team with the reason', async () => {
    const { world, service, manager, rangers, zones, teams } = setup()

    await service.reassign({ zoneId: zones.east._id, teamId: teams.bravo._id, reason }, manager)

    expect(world.state.decisions[0]).toMatchObject({ type: 'reassign', zone: zones.east._id, fromZone: zones.central._id, team: teams.bravo._id, decidedBy: manager.id, notes: reason })
    expect(world.state.notifications).toHaveLength(1)
    expect(world.state.notifications[0]).toMatchObject({ recipient: rangers.isuru, title: 'Reassigned to East Zone', message: reason, link: '/my-assignment' })
  })

  it('asks for an override before moving a team to a zone of equal or lower priority', async () => {
    const { world, service, manager, zones, teams } = setup()
    world.addAssignment({ zone: zones.east, team: teams.alpha })

    const attempt = service.reassign({ zoneId: zones.north._id, teamId: teams.alpha._id, reason }, manager)

    await expect(attempt).rejects.toMatchObject({
      status: 409,
      code: 'PRIORITY_DOWNGRADE',
      message: 'East Zone has equal or higher priority than North Sector. Confirm the override to reassign anyway.',
      details: { fromZone: 'East Zone', fromPriority: 342, toPriority: 213 }
    })
    expect(world.transactionRunner.run).not.toHaveBeenCalled()
  })

  it('allows the lower-priority move once the manager confirms the override', async () => {
    const { world, service, manager, zones, teams } = setup()
    world.addAssignment({ zone: zones.east, team: teams.alpha })

    const result = await service.reassign({ zoneId: zones.north._id, teamId: teams.alpha._id, reason, override: true }, manager)

    expect(result.assignment).toMatchObject({ zone: zones.north._id, allocationType: 'reassignment', priority: 'medium' })
    expect(result.vacatedZone).toEqual({ id: zones.east._id, name: 'East Zone' })
  })

  it('refuses to reassign a team that is available', async () => {
    const { service, manager, zones, teams } = setup()

    await expect(service.reassign({ zoneId: zones.east._id, teamId: teams.alpha._id, reason }, manager)).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_IS_AVAILABLE',
      message: 'Team Alpha is available. Allocate it directly instead of reassigning.'
    })
  })

  it('refuses to reassign a team that is responding to an emergency', async () => {
    const { world, service, manager, zones, teams } = setup()
    world.addAssignment({ zone: zones.north, team: teams.charlie, allocationType: 'emergency' })

    await expect(service.reassign({ zoneId: zones.east._id, teamId: teams.charlie._id, reason }, manager)).rejects.toMatchObject({ status: 409, code: 'TEAM_RESPONDING' })
  })

  it('refuses a team that has no active patrol', async () => {
    const { world, service, manager, zones, teams } = setup()
    const foxtrot = world.addTeam({ name: 'Team Foxtrot', status: 'on-patrol' })

    await expect(service.reassign({ zoneId: zones.east._id, teamId: teams.delta._id, reason }, manager)).rejects.toMatchObject({ code: 'NO_ACTIVE_ASSIGNMENT' })
    await expect(service.reassign({ zoneId: zones.east._id, teamId: foxtrot._id, reason }, manager)).rejects.toMatchObject({
      status: 409,
      code: 'NO_ACTIVE_ASSIGNMENT',
      message: 'Team Foxtrot has no active patrol to reassign from.'
    })
  })

  it('refuses to reassign a team to the zone it already patrols', async () => {
    const { service, manager, zones, teams } = setup()

    await expect(service.reassign({ zoneId: zones.central._id, teamId: teams.bravo._id, reason }, manager)).rejects.toMatchObject({
      status: 409,
      code: 'SAME_ZONE',
      message: 'Team Bravo is already patrolling Central Zone.'
    })
  })

  it('refuses a team from a different park and reports unknown records', async () => {
    const { world, service, manager, zones, teams } = setup()
    const echo = world.addTeam({ name: 'Team Echo', status: 'on-patrol', parkId: nextId() })

    await expect(service.reassign({ zoneId: zones.east._id, teamId: echo._id, reason }, manager)).rejects.toMatchObject({ code: 'TEAM_PARK_MISMATCH' })
    await expect(service.reassign({ zoneId: nextId(), teamId: teams.bravo._id, reason }, manager)).rejects.toMatchObject({ code: 'ZONE_NOT_FOUND' })
    await expect(service.reassign({ zoneId: zones.east._id, teamId: nextId(), reason }, manager)).rejects.toMatchObject({ code: 'TEAM_NOT_FOUND' })
  })

  it('stops when someone else changed the assignment first', async () => {
    const { world, service, manager, zones, teams } = setup()
    world.repositories.patrolRepository.closeAssignment.mockResolvedValueOnce(null)

    await expect(service.reassign({ zoneId: zones.east._id, teamId: teams.bravo._id, reason }, manager)).rejects.toMatchObject({
      status: 409,
      code: 'CONCURRENT_UPDATE',
      message: "Team Bravo's assignment was changed by someone else. Refresh and try again."
    })
    expect(world.state.assignments).toHaveLength(1)
    expect(world.state.decisions).toHaveLength(0)
  })

  it('still names the vacated zone when it could not be assessed', async () => {
    const { world, service, manager, zones, teams } = setup()
    vi.spyOn(world.coverageService, 'assessPark').mockResolvedValueOnce({ assessments: [] })

    const result = await service.reassign({ zoneId: zones.east._id, teamId: teams.bravo._id, reason }, manager)

    expect(result.vacatedZone).toEqual({ id: zones.central._id })
  })
})

describe('allocationService.complete', () => {
  it('ends the patrol, records it for coverage and frees the team', async () => {
    const { world, service, manager, zones, teams, bravoAssignment } = setup()

    const completed = await service.complete(bravoAssignment._id, manager)

    expect(completed).toMatchObject({ _id: bravoAssignment._id, status: 'completed', endedAt: NOW })
    expect(world.state.records.at(-1)).toMatchObject({ zone: zones.central._id, team: teams.bravo._id, assignment: bravoAssignment._id, startTime: world.hoursAgo(2), endTime: NOW })
    expect(teamStatus(world, teams.bravo)).toBe('available')
    expect(world.state.decisions[0]).toMatchObject({ type: 'complete', zone: zones.central._id, team: teams.bravo._id, decidedBy: manager.id })
  })

  it('moves the team to the centre of the zone it patrolled', async () => {
    const { world, service, manager, teams, bravoAssignment } = setup()

    await service.complete(bravoAssignment._id, manager)

    const { lastKnownLocation } = world.state.teams.find((team) => team._id === teams.bravo._id)
    expect(lastKnownLocation.lat).toBeCloseTo(6.05)
    expect(lastKnownLocation.lng).toBeCloseTo(81.65)
    expect(lastKnownLocation.updatedAt).toBe(NOW)
  })

  it('counts the completed patrol in the coverage of the zone', async () => {
    const { world, service, manager, bravoAssignment } = setup()

    await service.complete(bravoAssignment._id, manager)
    const { assessments } = await world.coverageService.assessPark(world.park._id)

    expect(assessments.find((assessment) => assessment.zone.name === 'Central Zone')).toMatchObject({ status: 'under-patrolled', coveragePercent: 29, hoursSinceLastPatrol: 0 })
  })

  it('resolves the alert when an emergency assignment is completed', async () => {
    const { world, service, manager, zones, teams } = setup()
    const alert = world.addAlert({ zone: zones.north, status: 'dispatched' })
    const emergency = world.addAssignment({ zone: zones.north, team: teams.charlie, allocationType: 'emergency', alert: alert._id })

    await service.complete(emergency._id, manager)

    expect(world.state.alerts[0]).toMatchObject({ status: 'resolved', resolvedAt: NOW })
    expect(teamStatus(world, teams.charlie)).toBe('available')
  })

  it('leaves alerts alone when a routine patrol is completed', async () => {
    const { world, service, manager, zones, bravoAssignment } = setup()
    world.addAlert({ zone: zones.central, status: 'active' })

    await service.complete(bravoAssignment._id, manager)

    expect(world.state.alerts[0].status).toBe('active')
  })

  it('reports an unknown assignment', async () => {
    const { service, manager } = setup()

    await expect(service.complete(nextId(), manager)).rejects.toMatchObject({ status: 404, code: 'ASSIGNMENT_NOT_FOUND' })
  })

  it('refuses to complete a patrol twice', async () => {
    const { world, service, manager, bravoAssignment } = setup()
    await service.complete(bravoAssignment._id, manager)

    await expect(service.complete(bravoAssignment._id, manager)).rejects.toMatchObject({
      status: 409,
      code: 'ASSIGNMENT_NOT_ACTIVE',
      message: 'This patrol assignment has already ended.'
    })
    expect(world.state.decisions).toHaveLength(1)
  })

  it('refuses when another request ended the patrol at the same moment', async () => {
    const { world, service, manager, bravoAssignment } = setup()
    world.repositories.patrolRepository.closeAssignment.mockResolvedValueOnce(null)

    await expect(service.complete(bravoAssignment._id, manager)).rejects.toMatchObject({ status: 409, code: 'ASSIGNMENT_NOT_ACTIVE' })
    expect(world.state.records).toHaveLength(2)
  })
})

describe('allocationService.acknowledge (ranger)', () => {
  it('records which ranger acknowledged the assignment and when', async () => {
    const { service, rangers, bravoAssignment } = setup()

    const assignment = await service.acknowledge(bravoAssignment._id, { id: rangers.isuru, role: 'ranger' })

    expect(assignment).toMatchObject({ _id: bravoAssignment._id, acknowledgedBy: rangers.isuru, acknowledgedAt: NOW })
  })

  it('keeps the first acknowledgement when it is repeated', async () => {
    const { world, service, rangers, bravoAssignment } = setup()
    await service.acknowledge(bravoAssignment._id, { id: rangers.isuru })

    const repeated = await service.acknowledge(bravoAssignment._id, { id: rangers.isuru })

    expect(repeated).toMatchObject({ acknowledgedBy: rangers.isuru, acknowledgedAt: NOW })
    expect(world.repositories.patrolRepository.acknowledgeAssignment).toHaveBeenCalledTimes(1)
  })

  it('returns the assignment when a team mate acknowledged it at the same moment', async () => {
    const { world, service, rangers, bravoAssignment } = setup()
    world.repositories.patrolRepository.acknowledgeAssignment.mockResolvedValueOnce(null)

    await expect(service.acknowledge(bravoAssignment._id, { id: rangers.isuru })).resolves.toMatchObject({ _id: bravoAssignment._id })
  })

  it('refuses a ranger from another team', async () => {
    const { service, rangers, bravoAssignment } = setup()

    await expect(service.acknowledge(bravoAssignment._id, { id: rangers.kasun })).rejects.toMatchObject({
      status: 403,
      code: 'NOT_TEAM_MEMBER',
      message: 'Only members of the assigned team can acknowledge this assignment.'
    })
  })

  it('refuses a ranger who is not in any team', async () => {
    const { service, bravoAssignment } = setup()

    await expect(service.acknowledge(bravoAssignment._id, { id: nextId() })).rejects.toMatchObject({ status: 403, code: 'NOT_TEAM_MEMBER' })
  })

  it('reports an assignment that is unknown or has ended', async () => {
    const { service, manager, rangers, bravoAssignment } = setup()

    await expect(service.acknowledge(nextId(), { id: rangers.isuru })).rejects.toMatchObject({ status: 404, code: 'ASSIGNMENT_NOT_ACTIVE' })

    await service.complete(bravoAssignment._id, manager)
    await expect(service.acknowledge(bravoAssignment._id, { id: rangers.isuru })).rejects.toMatchObject({ status: 404, code: 'ASSIGNMENT_NOT_ACTIVE' })
  })
})

describe('allocationService.getMyAssignment (ranger)', () => {
  it("returns the ranger's team with its active assignment", async () => {
    const { service, rangers, bravoAssignment } = setup()

    const result = await service.getMyAssignment(rangers.isuru)

    expect(result.team).toMatchObject({ name: 'Team Bravo', status: 'on-patrol' })
    expect(result.assignment).toMatchObject({ _id: bravoAssignment._id, zone: { name: 'Central Zone' } })
  })

  it('returns no assignment for a team that is not deployed', async () => {
    const { service, rangers } = setup()

    await expect(service.getMyAssignment(rangers.kasun)).resolves.toMatchObject({ team: { name: 'Team Charlie' }, assignment: null })
  })

  it('returns nothing for a ranger who is not in a team', async () => {
    const { service } = setup()

    await expect(service.getMyAssignment(nextId())).resolves.toEqual({ team: null, assignment: null })
  })
})

describe('allocationService lists', () => {
  it('lists the active assignments of a park', async () => {
    const { world, service, manager, bravoAssignment, zones, teams } = setup()
    await service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id }, manager)
    await service.complete(bravoAssignment._id, manager)

    const assignments = await service.listActiveAssignments(world.park._id)

    expect(assignments).toHaveLength(1)
    expect(assignments[0]).toMatchObject({ status: 'active', zone: { name: 'East Zone' }, team: { name: 'Team Alpha' } })
  })

  it('lists the allocation decisions of a park (allocation history)', async () => {
    const { world, service, manager, bravoAssignment, zones, teams } = setup()
    await service.allocate({ zoneId: zones.east._id, teamId: teams.alpha._id }, manager)
    await service.complete(bravoAssignment._id, manager)

    const decisions = await service.listDecisions(world.park._id)

    expect(decisions.map((decision) => decision.type)).toEqual(['allocate', 'complete'])
  })
})
