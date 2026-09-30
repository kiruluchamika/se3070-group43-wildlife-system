const { createConflictService } = require('./conflict.service')
const { createConflictWorld } = require('../../test-support/conflict-fakes')

const HOUR = 60 * 60 * 1000

function setup(options) {
  const world = createConflictWorld(options)
  const conflictService = createConflictService({ ...world.dependencies, random: () => 0.5 })
  return { ...world, conflictService, repository: world.dependencies.conflictRepository }
}

const submission = (world, overrides = {}) => ({
  parkId: world.park._id,
  conflictType: 'crop-damage',
  village: 'Kataragama',
  landmark: 'Near the old tank',
  occurredAt: new Date(world.now.getTime() - 2 * HOUR),
  description: 'A tusker broke the fence and ate the paddy.',
  contactName: 'Sunil Bandara',
  contactPhone: '+94 71 555 0101',
  damage: { cropType: 'Paddy', affectedAreaAcres: 0.5 },
  ...overrides
})

/** Stores a report directly, in any status, for tests that start mid-flow. */
function seedReport(world, overrides = {}) {
  const report = {
    _id: `${Object.keys(overrides).length}-${Math.random().toString(16).slice(2, 14)}`.padEnd(24, '0').slice(0, 24),
    reference: `HEC-20260930-T${world.dependencies.conflictRepository.reports.size}`,
    park: world.park._id,
    reporter: world.users.villager._id,
    conflictType: 'elephant-sighting',
    village: 'Kataragama',
    landmark: 'Old tank',
    occurredAt: new Date(world.now.getTime() - HOUR),
    description: 'Elephant near the houses',
    contactName: 'Sunil',
    contactPhone: '+94 71 555 0101',
    location: { lat: 6.41, lng: 81.33 },
    status: 'submitted',
    locationAdequate: true,
    history: [],
    contactAttempts: [],
    linkedReports: [],
    contactStatus: 'ok',
    createdAt: world.now,
    ...overrides
  }
  world.dependencies.conflictRepository.reports.set(report._id, report)
  return report
}

describe('conflictService.submit (main flow step 1)', () => {
  it('stores the report with a reference, suggested priority and history, then notifies the officer', async () => {
    const world = setup()

    const report = await world.conflictService.submit(submission(world), world.actor('villager'))

    expect(report).toMatchObject({
      reference: 'HEC-20260930-SSSSS',
      status: 'submitted',
      reporter: world.users.villager._id,
      park: world.park._id,
      locationAdequate: true,
      suggestedPriority: 'medium',
      damage: { cropType: 'Paddy', affectedAreaAcres: 0.5 }
    })
    expect(report.history).toEqual([{ at: world.now, by: world.users.villager._id, action: 'submitted', toStatus: 'submitted' }])
    const [officerIds, officerPayload] = world.mocks.notificationService.notifyUsers.mock.calls[0]
    expect(officerIds).toEqual([world.users.officer._id])
    expect(officerPayload).toMatchObject({ type: 'conflict-report', title: 'New conflict report: Crop damage at Kataragama' })
  })

  it('acknowledges the villager in-app and records the contact attempt', async () => {
    const world = setup()

    const report = await world.conflictService.submit(submission(world), world.actor('villager'))

    const [villagerIds, payload] = world.mocks.notificationService.notifyUsers.mock.calls[1]
    expect(villagerIds).toEqual([world.users.villager._id])
    expect(payload.title).toBe(`Report ${report.reference} received`)
    expect(world.mocks.smsGateway.send).not.toHaveBeenCalled()
    expect(world.repository.reports.get(report._id).contactAttempts).toEqual([
      { channel: 'in-app', status: 'delivered', at: world.now, purpose: 'acknowledgement' }
    ])
  })

  it('flags immediate danger as critical and warns the villager to move to safety (A2)', async () => {
    const world = setup()

    const report = await world.conflictService.submit(submission(world, { conflictType: 'elephant-sighting', immediateDanger: true }), world.actor('villager'))

    expect(report.suggestedPriority).toBe('critical')
    expect(world.mocks.notificationService.notifyUsers.mock.calls[0][1].title).toBe('IMMEDIATE DANGER: Elephant sighting at Kataragama')
    expect(world.mocks.notificationService.notifyUsers.mock.calls[1][1].message).toMatch(/Move people to a safe place/)
  })

  it('marks a vague location so the officer requests more information (A3)', async () => {
    const world = setup()

    const report = await world.conflictService.submit(submission(world, { landmark: undefined }), world.actor('villager'))

    expect(report.locationAdequate).toBe(false)
  })

  it('rejects an unknown park', async () => {
    const world = setup()

    await expect(world.conflictService.submit(submission(world, { parkId: 'f'.repeat(24) }), world.actor('villager'))).rejects.toMatchObject({
      status: 404,
      code: 'PARK_NOT_FOUND'
    })
  })

  it('rejects an incident time in the future but tolerates small clock differences', async () => {
    const world = setup()

    await expect(
      world.conflictService.submit(submission(world, { occurredAt: new Date(world.now.getTime() + HOUR) }), world.actor('villager'))
    ).rejects.toMatchObject({ status: 422, code: 'TIME_IN_FUTURE' })
    await expect(
      world.conflictService.submit(submission(world, { occurredAt: new Date(world.now.getTime() + 60 * 1000) }), world.actor('villager'))
    ).resolves.toMatchObject({ status: 'submitted' })
  })

  it('retries with a new reference when the generated one is already taken', async () => {
    const world = setup()
    const values = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1]
    const service = createConflictService({ ...world.dependencies, random: () => values.shift() ?? 0.2 })

    const first = await service.submit(submission(world), world.actor('villager'))
    const second = await service.submit(submission(world), world.actor('villager'))

    expect(first.reference).toBe('HEC-20260930-SSSSS')
    expect(second.reference).toBe('HEC-20260930-DDDDD')
  })

  it('gives up after repeated reference collisions and rethrows other database errors', async () => {
    const world = setup()
    const service = createConflictService({ ...world.dependencies, random: () => 0.5 })
    await service.submit(submission(world), world.actor('villager'))

    await expect(service.submit(submission(world), world.actor('villager'))).rejects.toMatchObject({ code: 11000 })

    world.repository.createReport = vi.fn(async () => {
      throw new Error('disk full')
    })
    await expect(service.submit(submission(world), world.actor('villager'))).rejects.toThrow('disk full')
  })
})

describe('community contact fallback (E1–E3)', () => {
  it('falls back to SMS when the in-app notification fails (E1) and never calls it delivered', async () => {
    const world = setup()
    world.mocks.notificationService.notifyUsers.mockImplementation(async (ids, payload) => {
      if (payload.type === 'conflict-update') throw new Error('push service down')
      return []
    })

    const report = await world.conflictService.submit(submission(world), world.actor('villager'))

    expect(world.mocks.smsGateway.send).toHaveBeenCalledWith({ to: '+94 71 555 0101', message: expect.stringContaining(report.reference) })
    const stored = world.repository.reports.get(report._id)
    expect(stored.contactAttempts.map(({ channel, status }) => ({ channel, status }))).toEqual([
      { channel: 'in-app', status: 'failed' },
      { channel: 'sms', status: 'simulated' }
    ])
    expect(stored.contactStatus).toBe('ok')
  })

  it('records the failure and alerts the officers when SMS also fails (E2)', async () => {
    const world = setup({ smsMode: 'unavailable' })
    world.mocks.notificationService.notifyUsers.mockImplementation(async (ids, payload) => {
      if (payload.type === 'conflict-update') throw new Error('push service down')
      return []
    })

    const report = await world.conflictService.submit(submission(world), world.actor('villager'))

    const stored = world.repository.reports.get(report._id)
    expect(stored.contactStatus).toBe('failed')
    expect(stored.contactAttempts.at(-1)).toMatchObject({ channel: 'sms', status: 'failed', detail: 'The SMS gateway is unavailable.' })
    const officerAlert = world.mocks.notificationService.notifyUsers.mock.calls.find(([, payload]) => payload.title.startsWith('Could not reach'))
    expect(officerAlert[0]).toEqual([world.users.officer._id])
  })

  it('never lets a contact failure undo the saved report', async () => {
    const world = setup()
    world.repository.updateReport = vi.fn(async () => {
      throw new Error('write failed')
    })

    const report = await world.conflictService.submit(submission(world), world.actor('villager'))

    expect(report.status).toBe('submitted')
    expect(world.logger.error).toHaveBeenCalled()
  })

  it('retries contact with the current status message (E3)', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'validated', priority: 'medium', contactStatus: 'failed' })

    const result = await world.conflictService.retryContact(report._id, world.actor('officer'))

    expect(result.reached).toBe(true)
    expect(result.report.contactStatus).toBe('ok')
    expect(world.mocks.notificationService.notifyUsers.mock.calls[0][1].message).toBe(
      'Your report has been verified and a ranger response is being arranged.'
    )
  })

  it('records an alternative contact and clears the failure (E2)', async () => {
    const world = setup()
    const report = seedReport(world, { contactStatus: 'failed' })

    const updated = await world.conflictService.recordAlternativeContact(
      report._id,
      { method: 'village-officer', contactedPerson: 'Grama Niladhari', notes: 'Informed by phone' },
      world.actor('officer')
    )

    expect(updated.contactStatus).toBe('ok')
    expect(updated.contactAttempts.at(-1)).toMatchObject({ channel: 'alternative', status: 'recorded', method: 'village-officer', detail: 'Grama Niladhari — Informed by phone' })
    expect(updated.history.at(-1)).toMatchObject({ action: 'alternative-contact-recorded', by: world.users.officer._id })
  })
})

describe('villager access and information requests (A3)', () => {
  it('lists only the villager’s own reports', async () => {
    const world = setup()
    seedReport(world)
    seedReport(world, { reporter: world.users.otherVillager._id })

    const reports = await world.conflictService.listMine(world.actor('villager'))

    expect(reports).toHaveLength(1)
  })

  it('shows a villager their report without internal contact logs', async () => {
    const world = setup()
    const report = seedReport(world, { contactAttempts: [{ channel: 'sms', status: 'failed' }] })

    const result = await world.conflictService.getReport(report._id, world.actor('villager'))

    expect(result.report.contactAttempts).toBeUndefined()
    expect(result).toMatchObject({ tasks: [], actions: [], suggestedReview: null })
  })

  it('refuses another villager’s report', async () => {
    const world = setup()
    const report = seedReport(world)

    await expect(world.conflictService.getReport(report._id, world.actor('otherVillager'))).rejects.toMatchObject({ status: 403, code: 'NOT_REPORT_OWNER' })
  })

  it('refuses staff from another park and reports missing records', async () => {
    const world = setup()
    const report = seedReport(world)

    await expect(world.conflictService.getReport(report._id, world.actor('outsideOfficer'))).rejects.toMatchObject({ code: 'OUTSIDE_ASSIGNED_PARK' })
    await expect(world.conflictService.getReport('a'.repeat(24), world.actor('officer'))).rejects.toMatchObject({ status: 404, code: 'REPORT_NOT_FOUND' })
  })

  it('lets a ranger see only reports their team responded to', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-assigned' })
    world.repository.tasks.set('t'.repeat(24), {
      _id: 't'.repeat(24),
      report: report._id,
      team: { _id: world.teamByName('Team Alpha')._id, members: [{ _id: world.users.ranger._id }] },
      status: 'assigned',
      createdAt: world.now
    })

    await expect(world.conflictService.getReport(report._id, world.actor('ranger'))).resolves.toMatchObject({ report: { _id: report._id } })
    await expect(world.conflictService.getReport(report._id, world.actor('otherRanger'))).rejects.toMatchObject({ code: 'NOT_REPORT_OWNER' })
  })

  it('asks the villager for more information and records who asked', async () => {
    const world = setup()
    const report = seedReport(world, { landmark: '', location: undefined, locationAdequate: false })

    const updated = await world.conflictService.requestInformation(report._id, { message: 'Which landmark is closest?' }, world.actor('officer'))

    expect(updated.status).toBe('pending-information')
    expect(updated.informationRequest).toEqual({ message: 'Which landmark is closest?', requestedBy: world.users.officer._id, requestedAt: world.now })
    expect(world.mocks.notificationService.notifyUsers.mock.calls[0][1].title).toMatch(/^More information needed/)
  })

  it('returns the report to the queue with an adequate location once the villager replies', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'pending-information', landmark: '', location: undefined, locationAdequate: false, informationRequest: { message: 'Where?' } })

    const updated = await world.conflictService.provideInformation(report._id, { response: 'Behind the school', landmark: 'Kataragama school' }, world.actor('villager'))

    expect(updated).toMatchObject({ status: 'submitted', landmark: 'Kataragama school', locationAdequate: true })
    expect(updated.informationRequest).toMatchObject({ message: 'Where?', response: 'Behind the school', respondedAt: world.now })
    expect(updated.history.at(-1)).toMatchObject({ action: 'information-provided', fromStatus: 'pending-information', toStatus: 'submitted' })
  })

  it('keeps the existing location when the reply adds none', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'pending-information' })

    const updated = await world.conflictService.provideInformation(report._id, { response: 'Same place as before' }, world.actor('villager'))

    expect(updated.location).toEqual({ lat: 6.41, lng: 81.33 })
  })

  it('refuses a reply when no information was requested, or from another villager', async () => {
    const world = setup()
    const report = seedReport(world)

    await expect(world.conflictService.provideInformation(report._id, { response: 'Extra detail' }, world.actor('villager'))).rejects.toMatchObject({
      code: 'INFORMATION_NOT_REQUESTED'
    })
    await expect(world.conflictService.provideInformation(report._id, { response: 'Extra detail' }, world.actor('otherVillager'))).rejects.toMatchObject({
      code: 'NOT_REPORT_OWNER'
    })
  })
})

describe('officer queue and validation (main flow step 2)', () => {
  it('lists the officer’s park by tab with counts for every tab', async () => {
    const world = setup()
    seedReport(world)
    seedReport(world, { status: 'validated' })
    seedReport(world, { status: 'resolved' })
    seedReport(world, { park: world.otherPark._id })

    const result = await world.conflictService.listQueue({ view: 'new' }, world.actor('officer'))

    expect(result.park).toBe(world.park._id)
    expect(result.reports).toHaveLength(1)
    expect(result.counts).toMatchObject({ new: 1, active: 1, closed: 1, all: 3, review: 0 })
  })

  it('refuses a queue for a park the officer is not assigned to', async () => {
    const world = setup()

    await expect(world.conflictService.listQueue({ parkId: world.otherPark._id }, world.actor('officer'))).rejects.toMatchObject({ status: 403 })
  })

  it('validates a report with the chosen priority and tells the villager', async () => {
    const world = setup()
    const report = seedReport(world)

    const updated = await world.conflictService.validate(report._id, { decision: 'valid', priority: 'high', notes: 'Confirmed by phone' }, world.actor('officer'))

    expect(updated).toMatchObject({ status: 'validated', priority: 'high', validation: { decision: 'valid', by: world.users.officer._id } })
    expect(updated.history.at(-1)).toMatchObject({ action: 'validated', note: 'Priority high — Confirmed by phone' })
    expect(world.mocks.notificationService.notifyUsers.mock.calls[0][1].title).toMatch(/verified$/)
  })

  it('marks a report invalid and sends the reason to the villager', async () => {
    const world = setup()
    const report = seedReport(world)

    const updated = await world.conflictService.validate(report._id, { decision: 'invalid', notes: 'The animal was a buffalo.' }, world.actor('officer'))

    expect(updated.status).toBe('invalid')
    expect(updated.priority).toBeUndefined()
    expect(world.mocks.notificationService.notifyUsers.mock.calls[0][1].message).toBe('The animal was a buffalo.')
  })

  it('refuses to validate a report whose location is too vague (A3)', async () => {
    const world = setup()
    const report = seedReport(world, { locationAdequate: false })

    await expect(world.conflictService.validate(report._id, { decision: 'valid', priority: 'low' }, world.actor('officer'))).rejects.toMatchObject({
      status: 422,
      code: 'LOCATION_INADEQUATE'
    })
  })

  it('refuses to validate a report twice (invalid transition)', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'resolved' })

    await expect(world.conflictService.validate(report._id, { decision: 'valid', priority: 'low' }, world.actor('officer'))).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_TRANSITION',
      details: { from: 'resolved', to: 'validated' }
    })
  })

  it('detects a concurrent change instead of overwriting it', async () => {
    const world = setup()
    const report = seedReport(world)
    world.repository.updateReportIf = vi.fn(async () => null)

    await expect(world.conflictService.validate(report._id, { decision: 'valid', priority: 'low' }, world.actor('officer'))).rejects.toMatchObject({
      code: 'CONCURRENT_UPDATE'
    })
  })
})

describe('duplicate linking (A4)', () => {
  it('suggests nearby open reports from the same event, nearest first', async () => {
    const world = setup()
    const report = seedReport(world)
    const near = seedReport(world, { village: 'Other', location: { lat: 6.412, lng: 81.33 } })
    const sameVillage = seedReport(world, { location: undefined })
    seedReport(world, { village: 'Far', location: { lat: 6.6, lng: 81.6 } })
    seedReport(world, { status: 'resolved' })

    const candidates = await world.conflictService.findDuplicates(report._id, world.actor('officer'))

    expect(candidates.map((entry) => entry.report._id)).toEqual([near._id, sameVillage._id])
    expect(candidates[0].match.rule).toBe('distance')
  })

  it('links the report to the primary without creating a task and records it on both reports', async () => {
    const world = setup()
    const primary = seedReport(world, { status: 'response-assigned' })
    const report = seedReport(world)

    const updated = await world.conflictService.linkDuplicate(report._id, { primaryReportId: primary._id }, world.actor('officer'))

    expect(updated).toMatchObject({ status: 'duplicate', duplicateOf: primary._id })
    const storedPrimary = world.repository.reports.get(primary._id)
    expect(storedPrimary.linkedReports).toEqual([report._id])
    expect(storedPrimary.history.at(-1)).toMatchObject({ action: 'duplicate-linked' })
    expect(world.repository.tasks.size).toBe(0)
    expect(world.mocks.notificationService.notifyUsers.mock.calls[0][1].message).toMatch(/already covers this event/)
  })

  it.each([
    ['the report itself', (world, report) => report._id, 'SELF_LINK'],
    ['a report in another park', (world) => seedReport(world, { park: world.otherPark._id })._id, 'PARK_MISMATCH'],
    ['a closed report', (world) => seedReport(world, { status: 'resolved' })._id, 'PRIMARY_CLOSED']
  ])('refuses to link to %s', async (label, primaryOf, code) => {
    const world = setup()
    const report = seedReport(world)

    await expect(world.conflictService.linkDuplicate(report._id, { primaryReportId: primaryOf(world, report) }, world.actor('officer'))).rejects.toMatchObject({ code })
  })
})

describe('escalation (A5) and final review (main flow step 5)', () => {
  it('escalates to the park manager with a UC04 alert placed in the nearest zone', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'validated', priority: 'high' })

    const updated = await world.conflictService.escalate(report._id, { reason: 'No team is available' }, world.actor('officer'))

    expect(updated.status).toBe('escalated')
    expect(world.mocks.alertService.raise).toHaveBeenCalledWith(
      expect.objectContaining({ park: world.park._id, zone: world.zones[0]._id, severity: 'high', source: 'conflict-report', sourceRef: report.reference }),
      { session: 'tx' }
    )
    expect(updated.escalation).toMatchObject({ reason: 'No team is available', by: world.users.officer._id })
    const managerNotice = world.mocks.notificationService.notifyUsers.mock.calls.find(([ids]) => ids.includes(world.users.manager._id))
    expect(managerNotice[1]).toMatchObject({ title: 'Conflict escalated: Kataragama', link: '/patrol/alerts' })
  })

  it('raises the alert without a zone when the report has no GPS', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'validated', priority: 'medium', location: undefined })

    await world.conflictService.escalate(report._id, { reason: 'No team is available' }, world.actor('officer'))

    expect(world.mocks.alertService.raise.mock.calls[0][0]).toMatchObject({ zone: undefined, location: undefined, severity: 'medium' })
  })

  it('withdraws a deployment still awaiting approval when escalating', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'awaiting-approval', priority: 'high' })
    world.repository.tasks.set('p'.repeat(24), { _id: 'p'.repeat(24), report: report._id, status: 'awaiting-approval', createdAt: world.now })

    await world.conflictService.escalate(report._id, { reason: 'Herd is growing' }, world.actor('officer'))

    expect(world.repository.tasks.get('p'.repeat(24))).toMatchObject({ status: 'rejected', approval: { decision: 'rejected', notes: 'Withdrawn: Herd is growing' } })
  })

  it('refuses to escalate a closed report', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'invalid' })

    await expect(world.conflictService.escalate(report._id, { reason: 'Too late' }, world.actor('officer'))).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })

  it('resolves a completed response and records the field outcome', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-completed', priority: 'medium' })
    world.repository.tasks.set('c'.repeat(24), {
      _id: 'c'.repeat(24),
      report: report._id,
      status: 'completed',
      completion: { outcome: 'elephant-driven-away' },
      createdAt: world.now
    })

    const updated = await world.conflictService.review(report._id, { result: 'resolved', notes: 'Fence repaired' }, world.actor('officer'))

    expect(updated.status).toBe('resolved')
    expect(updated.outcome).toMatchObject({ result: 'resolved', fieldOutcome: 'elephant-driven-away', notes: 'Fence repaired', reviewedBy: world.users.officer._id })
    expect(world.mocks.notificationService.notifyUsers.mock.calls[0][1].message).toBe('Your report has been resolved. Fence repaired')
  })

  it('puts the area under monitoring with a future follow-up (A6)', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-completed', priority: 'medium' })
    const followUpAt = new Date(world.now.getTime() + 24 * HOUR)

    const updated = await world.conflictService.review(report._id, { result: 'monitoring', followUpAt }, world.actor('officer'))

    expect(updated).toMatchObject({ status: 'monitoring', outcome: { result: 'monitoring', followUpAt } })
  })

  it('rejects a follow-up time in the past', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-completed' })

    await expect(
      world.conflictService.review(report._id, { result: 'monitoring', followUpAt: new Date(world.now.getTime() - HOUR) }, world.actor('officer'))
    ).rejects.toMatchObject({ code: 'FOLLOW_UP_IN_PAST' })
  })

  it('escalates at review with an alert and keeps the review record', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-completed', priority: 'critical' })

    const updated = await world.conflictService.review(report._id, { result: 'escalated', notes: 'Elephant keeps returning' }, world.actor('officer'))

    expect(updated.status).toBe('escalated')
    expect(updated.outcome).toMatchObject({ result: 'escalated', notes: 'Elephant keeps returning' })
    expect(updated.history.at(-1).action).toBe('reviewed-escalated')
    expect(world.mocks.alertService.raise.mock.calls[0][0].severity).toBe('critical')
  })

  it('reviews only reports whose response has been completed', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-assigned' })

    await expect(world.conflictService.review(report._id, { result: 'resolved' }, world.actor('officer'))).rejects.toMatchObject({ code: 'REVIEW_NOT_READY' })
  })

  it('suggests monitoring in the detail view when the elephant was not located', async () => {
    const world = setup()
    const report = seedReport(world, { status: 'response-completed' })
    world.repository.tasks.set('d'.repeat(24), {
      _id: 'd'.repeat(24),
      report: report._id,
      status: 'completed',
      completion: { outcome: 'elephant-not-located' },
      createdAt: world.now
    })

    const result = await world.conflictService.getReport(report._id, world.actor('officer'))

    expect(result.suggestedReview).toBe('monitoring')
  })
})
