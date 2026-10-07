const { createPatrolWorld, HOUR, NOW } = require('../../test-support/patrol-fakes')
const { nextId } = require('../../test-support/ids')
const { assessZones, lastPatrolledAt, patrolHoursInWindow } = require('./coverage.service')

const hoursAgo = (hours) => new Date(NOW.getTime() - hours * HOUR)
const record = (startedHoursAgo, endedHoursAgo) => ({
  startTime: hoursAgo(startedHoursAgo),
  endTime: endedHoursAgo === undefined ? null : hoursAgo(endedHoursAgo)
})

/**
 * Four zones, one in each situation:
 *   East Zone     high risk, last patrol 30 h ago, high alert  -> under-patrolled
 *   West Sector   medium risk, never patrolled                 -> under-patrolled
 *   North Sector  medium risk, 8 h patrol that ended 10 h ago  -> adequate
 *   Central Zone  low risk, Team Bravo on patrol               -> covered
 */
function setup(options) {
  const world = createPatrolWorld(options)
  const east = world.addZone({ name: 'East Zone', riskLevel: 'high', targetWeeklyPatrolHours: 21, lng: 81, lat: 6 })
  const west = world.addZone({ name: 'West Sector', riskLevel: 'medium', targetWeeklyPatrolHours: 14, lng: 81.2, lat: 6 })
  const north = world.addZone({ name: 'North Sector', riskLevel: 'medium', targetWeeklyPatrolHours: 14, lng: 81.4, lat: 6 })
  const central = world.addZone({ name: 'Central Zone', riskLevel: 'low', targetWeeklyPatrolHours: 7, lng: 81.6, lat: 6 })

  const alpha = world.addTeam({ name: 'Team Alpha', location: { lat: 6.06, lng: 81.06 }, baseLocationName: 'Katagamuwa Base Camp' })
  const bravo = world.addTeam({ name: 'Team Bravo' })
  const charlie = world.addTeam({ name: 'Team Charlie' })

  const route = [[6.01, 81.01], [6.02, 81.02]]
  const eastRecord = world.addRecord({ zone: east, team: alpha, startedHoursAgo: 33, endedHoursAgo: 30, route })
  world.addRecord({ zone: north, team: charlie, startedHoursAgo: 18, endedHoursAgo: 10 })
  const assignment = world.addAssignment({ zone: central, team: bravo, startedHoursAgo: 2 })
  const ongoing = world.addRecord({ zone: central, team: bravo, startedHoursAgo: 2, route })
  const alert = world.addAlert({ zone: east, severity: 'high', title: 'Snare Detected' })

  return { world, zones: { east, west, north, central }, teams: { alpha, bravo, charlie }, eastRecord, ongoing, assignment, alert }
}

describe('patrolHoursInWindow', () => {
  const windowStart = hoursAgo(168)

  it('adds up the patrols inside the window', () => {
    expect(patrolHoursInWindow([record(33, 30), record(20, 16)], windowStart, NOW)).toBe(7)
  })

  it('counts a patrol in progress up to now', () => {
    expect(patrolHoursInWindow([record(2)], windowStart, NOW)).toBe(2)
  })

  it('counts only the part of a patrol that falls inside the window', () => {
    expect(patrolHoursInWindow([record(170, 165)], windowStart, NOW)).toBe(3)
  })

  it('ignores patrols that ended before the window and returns 0 for no records', () => {
    expect(patrolHoursInWindow([record(200, 190)], windowStart, NOW)).toBe(0)
    expect(patrolHoursInWindow([], windowStart, NOW)).toBe(0)
  })
})

describe('lastPatrolledAt', () => {
  it('returns the latest end time', () => {
    expect(lastPatrolledAt([record(100, 96), record(33, 30), record(60, 58)], NOW)).toEqual(hoursAgo(30))
  })

  it('returns now while a patrol is still in progress', () => {
    expect(lastPatrolledAt([record(33, 30), record(2)], NOW)).toBe(NOW)
  })

  it('returns null when the zone has no patrol records', () => {
    expect(lastPatrolledAt([], NOW)).toBeNull()
  })
})

describe('assessZones', () => {
  async function assess(options) {
    const context = setup(options)
    const { assessments, policy, windowStart } = await context.world.coverageService.assessPark(context.world.park._id)
    const byName = Object.fromEntries(assessments.map((assessment) => [assessment.zone.name, assessment]))
    return { ...context, assessments, byName, policy, windowStart }
  }

  it('lists under-patrolled zones first by priority, then adequate, then covered', async () => {
    const { assessments } = await assess()

    expect(assessments.map((assessment) => [assessment.zone.name, assessment.status])).toEqual([
      ['East Zone', 'under-patrolled'],
      ['West Sector', 'under-patrolled'],
      ['North Sector', 'adequate'],
      ['Central Zone', 'covered']
    ])
  })

  it('calculates coverage, the patrol gap and the priority of an under-patrolled zone', async () => {
    const { byName } = await assess()

    expect(byName['East Zone']).toMatchObject({
      status: 'under-patrolled',
      effectiveRisk: 'high',
      coveragePercent: 14,
      patrolHours: 3,
      hoursSinceLastPatrol: 30,
      maxGapHours: 24,
      activeAlerts: 1,
      reasons: ['No patrol for more than 24 h', 'Coverage below 50%'],
      recommendedAction: 'Allocate a ranger team',
      priorityScore: 357,
      assignedTeams: []
    })
  })

  it('reports a zone that was never patrolled', async () => {
    const { byName } = await assess()

    expect(byName['West Sector']).toMatchObject({
      status: 'under-patrolled',
      coveragePercent: 0,
      patrolHours: 0,
      lastPatrolledAt: null,
      hoursSinceLastPatrol: null,
      reasons: ['Never patrolled in the coverage window', 'Coverage below 50%'],
      recommendedAction: 'Increase patrol frequency',
      priorityScore: 280
    })
  })

  it('leaves a recently patrolled zone as adequate with no reasons', async () => {
    const { byName } = await assess()

    expect(byName['North Sector']).toMatchObject({ status: 'adequate', coveragePercent: 57, hoursSinceLastPatrol: 10, reasons: [], recommendedAction: 'Monitor', priorityScore: 213 })
  })

  it('marks a zone with a deployed team as covered and names the team', async () => {
    const { byName, teams } = await assess()

    expect(byName['Central Zone']).toMatchObject({
      status: 'covered',
      coveragePercent: 29,
      hoursSinceLastPatrol: 0,
      recommendedAction: 'Team deployed — monitor progress',
      assignedTeams: [{ id: teams.bravo._id, name: 'Team Bravo', allocationType: 'allocation' }]
    })
  })

  it('raises the effective risk of a zone that has an unresolved alert', async () => {
    const context = setup()
    context.world.addAlert({ zone: context.zones.north, severity: 'critical' })

    const { assessments } = await context.world.coverageService.assessPark(context.world.park._id)
    const north = assessments.find((assessment) => assessment.zone.name === 'North Sector')

    expect(north).toMatchObject({ effectiveRisk: 'high', activeAlerts: 1, maxGapHours: 24 })
    expect(north.zone.riskLevel).toBe('medium')
  })

  it('caps coverage at 100% and describes the zone', async () => {
    const context = setup()
    context.world.addRecord({ zone: context.zones.central, team: context.teams.alpha, startedHoursAgo: 60, endedHoursAgo: 40 })

    const { assessments } = await context.world.coverageService.assessPark(context.world.park._id)
    const central = assessments.find((assessment) => assessment.zone.name === 'Central Zone')

    expect(central.coveragePercent).toBe(100)
    expect(central.zone).toMatchObject({ code: 'CENTRAL', riskLevel: 'low', targetWeeklyPatrolHours: 7 })
    expect(central.zone.centroid.lat).toBeCloseTo(6.05)
    expect(central.zone.centroid.lng).toBeCloseTo(81.65)
  })

  it('uses the coverage window and thresholds of the park', async () => {
    const { byName, policy, windowStart } = await assess({ coveragePolicy: { windowDays: 14, minCoveragePercent: 10, maxGapHours: { high: 36 } } })

    expect(policy).toEqual({ windowDays: 14, minCoveragePercent: 10, maxGapHours: { high: 36, medium: 48, low: 72 } })
    expect(windowStart).toEqual(hoursAgo(14 * 24))
    expect(byName['East Zone']).toMatchObject({ status: 'adequate', maxGapHours: 36, reasons: [] })
  })

  it('is a pure function that accepts plain data', () => {
    const zone = { _id: nextId(), code: 'EAST', name: 'East Zone', riskLevel: 'high', targetWeeklyPatrolHours: 10, boundary: null }

    const { assessments } = assessZones({ park: {}, zones: [zone], records: [], alerts: [], assignments: [], now: NOW })

    expect(assessments).toHaveLength(1)
    expect(assessments[0]).toMatchObject({ status: 'under-patrolled', coveragePercent: 0 })
    expect(assessments[0].zone.centroid).toBeNull()
  })
})

describe('coverageService.getCoverage', () => {
  it('summarises the park for the dashboard', async () => {
    const { world } = setup()

    const coverage = await world.coverageService.getCoverage(world.park._id)

    expect(coverage.generatedAt).toBe(NOW)
    expect(coverage.park).toMatchObject({ name: 'Yala National Park' })
    expect(coverage.zones).toHaveLength(4)
    expect(coverage.summary).toEqual({
      overallCoverage: 25,
      zoneCount: 4,
      underPatrolledZones: 2,
      coveredZones: 1,
      activeAlerts: 1,
      criticalAlerts: 0,
      totalTeams: 3,
      availableTeams: 2
    })
  })

  it('counts critical alerts separately', async () => {
    const { world, zones } = setup()
    world.addAlert({ zone: zones.north, severity: 'critical' })

    const { summary } = await world.coverageService.getCoverage(world.park._id)

    expect(summary).toMatchObject({ activeAlerts: 2, criticalAlerts: 1 })
  })

  it('ignores resolved alerts', async () => {
    const { world, zones } = setup()
    world.addAlert({ zone: zones.north, severity: 'critical', status: 'resolved' })

    const { summary } = await world.coverageService.getCoverage(world.park._id)

    expect(summary.activeAlerts).toBe(1)
  })

  it('returns each team with its position and assigned zone', async () => {
    const { world, zones, teams } = setup()

    const coverage = await world.coverageService.getCoverage(world.park._id)
    const byName = Object.fromEntries(coverage.teams.map((team) => [team.name, team]))

    expect(byName['Team Alpha']).toEqual({
      id: teams.alpha._id,
      name: 'Team Alpha',
      status: 'available',
      location: { lat: 6.06, lng: 81.06 },
      baseLocationName: 'Katagamuwa Base Camp',
      assignedZone: null
    })
    expect(byName['Team Bravo']).toMatchObject({ status: 'on-patrol', assignedZone: { id: zones.central._id, name: 'Central Zone' } })
  })

  it('returns only recent or ongoing patrol routes that have at least two points', async () => {
    const { world, zones, teams, eastRecord, ongoing } = setup()
    const route = [[6.01, 81.01], [6.02, 81.02]]
    world.addRecord({ zone: zones.north, team: teams.charlie, startedHoursAgo: 104, endedHoursAgo: 100, route })
    world.addRecord({ zone: zones.north, team: teams.charlie, startedHoursAgo: 12, endedHoursAgo: 11, route: [[6.01, 81.01]] })

    const coverage = await world.coverageService.getCoverage(world.park._id)

    expect(coverage.routes.map((entry) => entry.id).sort()).toEqual([eastRecord._id, ongoing._id].sort())
    expect(coverage.routes.find((entry) => entry.id === eastRecord._id)).toEqual({ id: eastRecord._id, team: teams.alpha._id, zone: zones.east._id, route, endTime: hoursAgo(30) })
  })

  it('reports 0% coverage for a park without zones', async () => {
    const world = createPatrolWorld()

    const coverage = await world.coverageService.getCoverage(world.park._id)

    expect(coverage.zones).toEqual([])
    expect(coverage.summary).toMatchObject({ overallCoverage: 0, zoneCount: 0, totalTeams: 0 })
  })

  it('reports an unknown park (E1: no allocation decision is possible)', async () => {
    const { world } = setup()

    await expect(world.coverageService.getCoverage(nextId())).rejects.toMatchObject({ status: 404, code: 'PARK_NOT_FOUND' })
  })
})
