const { createResponseService } = require('./response.service')
const { createConflictWorld } = require('../../test-support/conflict-fakes')
const { nextId } = require('../../test-support/ids')

const HOUR = 60 * 60 * 1000

function setup(options) {
  const world = createConflictWorld(options)
  const responseService = createResponseService(world.dependencies)
  return { ...world, responseService, repository: world.dependencies.conflictRepository }
}

function seedReport(world, overrides = {}) {
  const report = {
    _id: nextId(),
    reference: `HEC-20260930-R${world.repository.reports.size}`,
    park: world.park._id,
    reporter: world.users.villager._id,
    conflictType: 'crop-damage',
    village: 'Kataragama',
    landmark: 'Old tank',
    occurredAt: new Date(world.now.getTime() - HOUR),
    description: 'Elephant in the paddy field',
    contactName: 'Sunil',
    contactPhone: '+94 71 555 0101',
    location: { lat: 6.44, lng: 81.32 },
    status: 'validated',
    priority: 'medium',
    locationAdequate: true,
    history: [],
    contactAttempts: [],
    linkedReports: [],
    createdAt: world.now,
    ...overrides
  }
  world.repository.reports.set(report._id, report)
  return report
}

function seedTask(world, report, overrides = {}) {
  const task = {
    _id: nextId(),
    report: report._id,
    park: report.park,
    team: world.teamByName('Team Alpha')._id,
    status: 'assigned',
    priority: report.priority,
    dispatchType: 'standard',
    proposedBy: world.users.officer._id,
    createdAt: world.now,
    ...overrides
  }
  world.repository.tasks.set(task._id, task)
  return task
}

const actionBody = (world, overrides = {}) => ({
  clientUpdateId: 'c0ffee00-1111-4222-8333-444455556666',
  type: 'drive-away',
  note: 'Used thunder flashes',
  recordedAt: new Date(world.now.getTime() - 10 * 60 * 1000),
  ...overrides
})

describe('responseService.listTeams (main flow step 3)', () => {
  it('lists the park’s available teams nearest first and the busy ones separately', async () => {
    const world = setup()
    const report = seedReport(world)

    const result = await world.responseService.listTeams(report._id, world.actor('officer'))

    expect(result.available.map((team) => team.name)).toEqual(['Team Alpha', 'Team Charlie'])
    expect(result.busy.map((team) => team.name)).toEqual(['Team Bravo'])
    expect(result.recommended.name).toBe('Team Alpha')
    expect(result.available[0]).toMatchObject({ distanceKm: 1.6, etaMinutes: 4 })
    expect(result.route).toEqual({ dispatchType: 'standard', requiresApproval: false })
  })

  it('sorts by name when the report has no GPS and reports no route before a priority is set', async () => {
    const world = setup()
    const report = seedReport(world, { location: undefined, priority: undefined, status: 'submitted' })

    const result = await world.responseService.listTeams(report._id, world.actor('officer'))

    expect(result.available.map((team) => team.distanceKm)).toEqual([null, null])
    expect(result.route).toBeNull()
  })

  it('shows no recommendation when every team is busy (A5)', async () => {
    const world = setup()
    world.teamByName('Team Alpha').status = 'responding'
    world.teamByName('Team Charlie').status = 'off-duty'
    const report = seedReport(world)

    const result = await world.responseService.listTeams(report._id, world.actor('officer'))

    expect(result.available).toEqual([])
    expect(result.recommended).toBeNull()
  })

  it('refuses officers from another park', async () => {
    const world = setup()
    const report = seedReport(world)

    await expect(world.responseService.listTeams(report._id, world.actor('outsideOfficer'))).rejects.toMatchObject({ code: 'OUTSIDE_ASSIGNED_PARK' })
  })
})

describe('responseService.deploy', () => {
  it('assigns a medium-priority team directly, commits it as responding and notifies the team', async () => {
    const world = setup()
    const report = seedReport(world)
    const alpha = world.teamByName('Team Alpha')

    const { task, route } = await world.responseService.deploy(report._id, { teamId: alpha._id, instructions: 'Approach from the tank bund' }, world.actor('officer'))

    expect(route).toBe('direct')
    expect(task).toMatchObject({ status: 'assigned', team: alpha._id, dispatchType: 'standard', assignedAt: world.now, approval: { required: false } })
    expect(alpha.status).toBe('responding')
    expect(world.repository.reports.get(report._id)).toMatchObject({ status: 'response-assigned' })
    const teamNotice = world.mocks.notificationService.notifyUsers.mock.calls.find(([ids]) => ids.includes(world.users.ranger._id))
    expect(teamNotice[1]).toMatchObject({ type: 'conflict-task', title: 'New conflict response: Crop damage at Kataragama', link: `/response-tasks?task=${task._id}` })
    expect(world.mocks.alertService.raise).not.toHaveBeenCalled()
  })

  it('sends a high-priority deployment for park manager approval without committing the team', async () => {
    const world = setup()
    const report = seedReport(world, { priority: 'high' })
    const alpha = world.teamByName('Team Alpha')

    const { task, route } = await world.responseService.deploy(report._id, { teamId: alpha._id }, world.actor('officer'))

    expect(route).toBe('approval')
    expect(task).toMatchObject({ status: 'awaiting-approval', approval: { required: true } })
    expect(alpha.status).toBe('available')
    expect(world.repository.reports.get(report._id).status).toBe('awaiting-approval')
    const managerNotice = world.mocks.notificationService.notifyUsers.mock.calls[0]
    expect(managerNotice[0]).toEqual([world.users.manager._id])
    expect(managerNotice[1]).toMatchObject({ link: '/conflicts/approvals' })
  })

  it('requires approval when the officer asks for additional resources', async () => {
    const world = setup()
    const report = seedReport(world, { priority: 'low' })

    const { route } = await world.responseService.deploy(report._id, { teamId: world.teamByName('Team Alpha')._id, additionalResources: true }, world.actor('officer'))

    expect(route).toBe('approval')
  })

  it('dispatches a critical report as an emergency with a dispatched UC04 alert (A2)', async () => {
    const world = setup()
    const report = seedReport(world, { priority: 'critical', conflictType: 'human-threat' })

    const { task, route } = await world.responseService.deploy(report._id, { teamId: world.teamByName('Team Charlie')._id }, world.actor('officer'))

    expect(route).toBe('emergency')
    expect(task.dispatchType).toBe('emergency')
    const alert = await world.mocks.alertService.raise.mock.results[0].value
    expect(task.alert).toBe(alert._id)
    expect(world.mocks.alertService.markDispatched).toHaveBeenCalledWith(alert._id, { session: 'tx' })
    expect(world.repository.reports.get(report._id).history.at(-1).action).toBe('emergency-dispatched')
    const titles = world.mocks.notificationService.notifyUsers.mock.calls.map(([, payload]) => payload.title)
    expect(titles).toEqual(expect.arrayContaining(['EMERGENCY: Threat to people at Kataragama', 'Emergency dispatch: Threat to people at Kataragama']))
    expect(titles.at(-1)).toBe(`Rangers assigned to ${report.reference}`)
  })

  it('refuses a team that is not available and suggests escalation (A5)', async () => {
    const world = setup()
    const report = seedReport(world)

    await expect(world.responseService.deploy(report._id, { teamId: world.teamByName('Team Bravo')._id }, world.actor('officer'))).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NOT_AVAILABLE',
      message: 'Team Bravo is not available (currently on-patrol). Choose another team or escalate.'
    })
  })

  it('lets only one of two concurrent deployments take the same team', async () => {
    const world = setup()
    const first = seedReport(world)
    const second = seedReport(world, { village: 'Tissamaharama' })
    const alpha = world.teamByName('Team Alpha')

    const results = await Promise.allSettled([
      world.responseService.deploy(first._id, { teamId: alpha._id }, world.actor('officer')),
      world.responseService.deploy(second._id, { teamId: alpha._id }, world.actor('officer'))
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({ code: 'TEAM_NOT_AVAILABLE' })
  })

  it.each([
    ['a team from another park', (world) => world.teamByName('Team Echo')._id, 'TEAM_PARK_MISMATCH'],
    ['a missing team', () => 'e'.repeat(24), 'TEAM_NOT_FOUND']
  ])('refuses %s', async (label, teamOf, code) => {
    const world = setup()
    const report = seedReport(world)

    await expect(world.responseService.deploy(report._id, { teamId: teamOf(world) }, world.actor('officer'))).rejects.toMatchObject({ code })
  })

  it('refuses reports that are not validated, and validated reports without a priority', async () => {
    const world = setup()
    const submitted = seedReport(world, { status: 'submitted' })
    const unprioritised = seedReport(world, { priority: undefined })
    const teamId = world.teamByName('Team Alpha')._id

    await expect(world.responseService.deploy(submitted._id, { teamId }, world.actor('officer'))).rejects.toMatchObject({ code: 'REPORT_NOT_DEPLOYABLE' })
    await expect(world.responseService.deploy(unprioritised._id, { teamId }, world.actor('officer'))).rejects.toMatchObject({ code: 'PRIORITY_REQUIRED' })
  })

  it('reports an existing open task instead of creating a second one (A4)', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'monitoring' })
    seedTask(world, report, { team: world.teamByName('Team Charlie')._id })

    await expect(world.responseService.deploy(report._id, { teamId: world.teamByName('Team Alpha')._id }, world.actor('officer'))).rejects.toMatchObject({
      code: 'TASK_EXISTS'
    })
  })

  it('passes unexpected task storage errors through', async () => {
    const world = setup()
    const report = seedReport(world, { priority: 'high' })
    world.repository.failNextTaskCreate = new Error('write concern timeout')

    await expect(world.responseService.deploy(report._id, { teamId: world.teamByName('Team Alpha')._id }, world.actor('officer'))).rejects.toThrow('write concern timeout')
  })
})

describe('park manager approval', () => {
  function pending(world, overrides) {
    const report = seedReport(world, { status: 'awaiting-approval', priority: 'high' })
    const task = seedTask(world, report, { status: 'awaiting-approval', approval: { required: true }, ...overrides })
    return { report, task }
  }

  it('lists deployments waiting in the manager’s park', async () => {
    const world = setup()
    pending(world)
    seedTask(world, seedReport(world), { status: 'assigned' })

    const tasks = await world.responseService.listApprovals({}, world.actor('manager'))

    expect(tasks).toHaveLength(1)
    expect(tasks[0].status).toBe('awaiting-approval')
  })

  it('approves the proposed team, commits it and notifies the team and the officers', async () => {
    const world = setup()
    const { report, task } = pending(world)

    const approved = await world.responseService.decideApproval(task._id, { decision: 'approve', notes: 'Go ahead' }, world.actor('manager'))

    expect(approved).toMatchObject({ status: 'assigned', assignedAt: world.now, approval: { decision: 'approved', by: world.users.manager._id, notes: 'Go ahead' } })
    expect(world.teamByName('Team Alpha').status).toBe('responding')
    expect(world.repository.reports.get(report._id).status).toBe('response-assigned')
    const recipients = world.mocks.notificationService.notifyUsers.mock.calls.map(([ids]) => ids).flat()
    expect(recipients).toEqual(expect.arrayContaining([world.users.ranger._id, world.users.officer._id, world.users.villager._id]))
  })

  it('lets the manager approve with a different team', async () => {
    const world = setup()
    const { task } = pending(world)
    const charlie = world.teamByName('Team Charlie')

    const approved = await world.responseService.decideApproval(task._id, { decision: 'approve', teamId: charlie._id }, world.actor('manager'))

    expect(approved.team).toBe(charlie._id)
    expect(charlie.status).toBe('responding')
    expect(world.teamByName('Team Alpha').status).toBe('available')
  })

  it('reports that the proposed team became busy while waiting for approval', async () => {
    const world = setup()
    const { task } = pending(world)
    world.teamByName('Team Alpha').status = 'on-patrol'

    await expect(world.responseService.decideApproval(task._id, { decision: 'approve' }, world.actor('manager'))).rejects.toMatchObject({
      code: 'TEAM_NOT_AVAILABLE'
    })
  })

  it('rejects a deployment and returns the report to the officer', async () => {
    const world = setup()
    const { report, task } = pending(world)

    const rejected = await world.responseService.decideApproval(task._id, { decision: 'reject', notes: 'Use the village volunteers' }, world.actor('manager'))

    expect(rejected).toMatchObject({ status: 'rejected', approval: { decision: 'rejected' } })
    expect(world.repository.reports.get(report._id)).toMatchObject({ status: 'validated' })
    expect(world.teamByName('Team Alpha').status).toBe('available')
  })

  it('refuses to decide twice or outside the manager’s park', async () => {
    const world = setup()
    const { task } = pending(world, { status: 'assigned' })
    const other = pending(world, { park: world.otherPark._id })

    await expect(world.responseService.decideApproval(task._id, { decision: 'approve' }, world.actor('manager'))).rejects.toMatchObject({
      code: 'APPROVAL_ALREADY_DECIDED'
    })
    await expect(world.responseService.decideApproval(other.task._id, { decision: 'approve' }, world.actor('manager'))).rejects.toMatchObject({
      code: 'OUTSIDE_ASSIGNED_PARK'
    })
  })

  it.each(['approve', 'reject'])('detects a concurrent %s decision', async (decision) => {
    const world = setup()
    const { task } = pending(world)
    world.repository.updateTaskIf = vi.fn(async () => null)

    await expect(world.responseService.decideApproval(task._id, { decision, notes: 'Too late now' }, world.actor('manager'))).rejects.toMatchObject({
      code: 'APPROVAL_ALREADY_DECIDED'
    })
  })

  it('reports a missing task', async () => {
    const world = setup()

    await expect(world.responseService.decideApproval('f'.repeat(24), { decision: 'approve' }, world.actor('manager'))).rejects.toMatchObject({
      status: 404,
      code: 'TASK_NOT_FOUND'
    })
  })
})

describe('ranger field response (main flow step 4)', () => {
  it('lists the ranger’s team tasks with their recorded actions for offline use', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-assigned' })
    const task = seedTask(world, report)
    seedTask(world, seedReport(world), { team: world.teamByName('Team Charlie')._id })
    await world.responseService.recordAction(task._id, actionBody(world), world.actor('ranger'))

    const result = await world.responseService.listMyTasks(world.actor('ranger'))

    expect(result.team.name).toBe('Team Alpha')
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].actions).toHaveLength(1)
  })

  it('returns an empty list for a ranger without a team', async () => {
    const world = setup()
    world.teamByName('Team Alpha').members = []

    await expect(world.responseService.listMyTasks(world.actor('ranger'))).resolves.toEqual({ team: null, tasks: [] })
  })

  it('acknowledges a task once and treats a repeat as harmless', async () => {
    const world = setup()
    const task = seedTask(world, seedReport(world, { status: 'response-assigned' }))

    const first = await world.responseService.acknowledge(task._id, world.actor('ranger'))
    const second = await world.responseService.acknowledge(task._id, world.actor('ranger'))

    expect(first).toMatchObject({ status: 'acknowledged', acknowledgedBy: world.users.ranger._id, acknowledgedAt: world.now })
    expect(second.acknowledgedAt).toEqual(world.now)
  })

  it('refuses acknowledgement from a ranger outside the team and on a closed task', async () => {
    const world = setup()
    const task = seedTask(world, seedReport(world, { status: 'response-assigned' }))
    const closed = seedTask(world, seedReport(world), { status: 'completed' })

    await expect(world.responseService.acknowledge(task._id, world.actor('otherRanger'))).rejects.toMatchObject({ status: 403, code: 'NOT_TEAM_MEMBER' })
    await expect(world.responseService.acknowledge(closed._id, world.actor('ranger'))).rejects.toMatchObject({ code: 'TASK_CLOSED' })
  })

  it('records a field action and treats it as the acknowledgement', async () => {
    const world = setup()
    const task = seedTask(world, seedReport(world, { status: 'response-assigned' }))

    const { action, created } = await world.responseService.recordAction(task._id, actionBody(world, { recordedOffline: true }), world.actor('ranger'))

    expect(created).toBe(true)
    expect(action).toMatchObject({ task: task._id, type: 'drive-away', recordedBy: world.users.ranger._id, recordedOffline: true })
    expect(world.repository.tasks.get(task._id).status).toBe('acknowledged')
  })

  it('returns the stored action when an offline upload is retried after a lost acknowledgement (E4)', async () => {
    const world = setup()
    const task = seedTask(world, seedReport(world, { status: 'response-assigned' }))
    const first = await world.responseService.recordAction(task._id, actionBody(world), world.actor('ranger'))

    const retry = await world.responseService.recordAction(task._id, actionBody(world), world.actor('ranger'))

    expect(retry).toEqual({ action: first.action, created: false })
    expect(world.repository.actions.size).toBe(1)
  })

  it('refuses an update id that belongs to another task', async () => {
    const world = setup()
    const task = seedTask(world, seedReport(world, { status: 'response-assigned' }))
    const other = seedTask(world, seedReport(world, { status: 'response-assigned' }), { team: world.teamByName('Team Alpha')._id })
    await world.responseService.recordAction(task._id, actionBody(world), world.actor('ranger'))

    await expect(world.responseService.recordAction(other._id, actionBody(world), world.actor('ranger'))).rejects.toMatchObject({ code: 'CLIENT_ID_REUSED' })
  })

  it('refuses actions on a completed task and actions dated in the future', async () => {
    const world = setup()
    const closed = seedTask(world, seedReport(world), { status: 'completed' })
    const open = seedTask(world, seedReport(world, { status: 'response-assigned' }))

    await expect(world.responseService.recordAction(closed._id, actionBody(world), world.actor('ranger'))).rejects.toMatchObject({ code: 'TASK_CLOSED' })
    await expect(
      world.responseService.recordAction(open._id, actionBody(world, { recordedAt: new Date(world.now.getTime() + HOUR) }), world.actor('ranger'))
    ).rejects.toMatchObject({ code: 'TIME_IN_FUTURE' })
  })

  it('completes the response: frees the team, keeps the device time and asks the officer to review', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-assigned' })
    const task = seedTask(world, report)
    world.teamByName('Team Alpha').status = 'responding'
    const completedAt = new Date(world.now.getTime() - 30 * 60 * 1000)

    const { task: completed, created } = await world.responseService.complete(
      task._id,
      { clientUpdateId: 'done-0001-abcd', outcome: 'elephant-not-located', notes: 'Tracks lead into the forest', completedAt },
      world.actor('ranger')
    )

    expect(created).toBe(true)
    expect(completed).toMatchObject({
      status: 'completed',
      acknowledgedBy: world.users.ranger._id,
      completion: { outcome: 'elephant-not-located', completedAt, syncedAt: world.now, clientUpdateId: 'done-0001-abcd' }
    })
    expect(world.teamByName('Team Alpha').status).toBe('available')
    expect(world.repository.reports.get(report._id)).toMatchObject({ status: 'response-completed' })
    expect(world.mocks.alertService.resolve).not.toHaveBeenCalled()
    const officerNotice = world.mocks.notificationService.notifyUsers.mock.calls.at(-1)
    expect(officerNotice[1].title).toBe(`Review needed: ${report.reference}`)
  })

  it('resolves the UC04 alert when an emergency response is completed', async () => {
    const world = setup()
    const task = seedTask(world, seedReport(world, { status: 'response-assigned', priority: 'critical' }), { dispatchType: 'emergency', alert: 'alert-1' })

    await world.responseService.complete(task._id, { clientUpdateId: 'done-0002-abcd', outcome: 'situation-contained', completedAt: world.now }, world.actor('ranger'))

    expect(world.mocks.alertService.resolve).toHaveBeenCalledWith('alert-1', { session: 'tx' })
  })

  it('treats a repeated completion upload as the same completion (E4)', async () => {
    const world = setup()
    const task = seedTask(world, seedReport(world, { status: 'response-assigned' }))
    const body = { clientUpdateId: 'done-0003-abcd', outcome: 'elephant-driven-away', completedAt: world.now }
    await world.responseService.complete(task._id, body, world.actor('ranger'))

    const retry = await world.responseService.complete(task._id, body, world.actor('ranger'))

    expect(retry.created).toBe(false)
    await expect(world.responseService.complete(task._id, { ...body, clientUpdateId: 'done-9999-abcd' }, world.actor('ranger'))).rejects.toMatchObject({
      code: 'TASK_ALREADY_COMPLETED'
    })
  })

  it('refuses to complete a task awaiting approval, or one changed concurrently', async () => {
    const world = setup()
    const waiting = seedTask(world, seedReport(world, { status: 'awaiting-approval' }), { status: 'awaiting-approval' })
    const open = seedTask(world, seedReport(world, { status: 'response-assigned' }))
    const body = { clientUpdateId: 'done-0004-abcd', outcome: 'elephant-driven-away', completedAt: world.now }

    await expect(world.responseService.complete(waiting._id, body, world.actor('ranger'))).rejects.toMatchObject({ code: 'TASK_CLOSED' })
    world.repository.updateTaskIf = vi.fn(async () => null)
    await expect(world.responseService.complete(open._id, body, world.actor('ranger'))).rejects.toMatchObject({ code: 'CONCURRENT_UPDATE' })
  })
})
