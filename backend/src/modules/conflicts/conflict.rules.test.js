const {
  QUEUE_VIEWS,
  TRANSITIONS,
  alertSeverityFor,
  canTransition,
  deploymentRouteFor,
  duplicateReason,
  generateReference,
  isClosed,
  isLocationAdequate,
  pointOf,
  suggestPriority,
  suggestReviewResult
} = require('./conflict.rules')
const { REPORT_STATUS } = require('./conflict.constants')

describe('report status transitions', () => {
  it.each([
    ['submitted', 'validated'],
    ['submitted', 'pending-information'],
    ['pending-information', 'submitted'],
    ['validated', 'awaiting-approval'],
    ['awaiting-approval', 'response-assigned'],
    ['response-assigned', 'response-completed'],
    ['response-completed', 'monitoring'],
    ['monitoring', 'response-assigned'],
    ['escalated', 'response-assigned']
  ])('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it.each([
    ['submitted', 'response-assigned', 'a team cannot be sent before validation'],
    ['response-assigned', 'resolved', 'the officer reviews only a completed response'],
    ['resolved', 'submitted', 'closed reports stay closed'],
    ['invalid', 'validated', 'an invalid report cannot be revived'],
    ['duplicate', 'validated', 'a linked duplicate cannot get its own response'],
    ['awaiting-approval', 'duplicate', 'a report with a pending deployment cannot become a duplicate']
  ])('rejects %s → %s (%s)', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })

  it('rejects unknown statuses', () => {
    expect(canTransition('archived', 'submitted')).toBe(false)
  })

  it('defines transitions for every status and only targets known statuses', () => {
    const statuses = Object.values(REPORT_STATUS)

    expect(Object.keys(TRANSITIONS).sort()).toEqual([...statuses].sort())
    for (const targets of Object.values(TRANSITIONS)) expect(statuses).toEqual(expect.arrayContaining(targets))
  })

  it('places every status in exactly one queue tab besides "all"', () => {
    const tabs = Object.entries(QUEUE_VIEWS).filter(([name]) => name !== 'all')
    for (const status of Object.values(REPORT_STATUS)) {
      expect(tabs.filter(([, statuses]) => statuses.includes(status))).toHaveLength(1)
    }
  })

  it('treats resolved, invalid and duplicate as closed', () => {
    expect(['resolved', 'invalid', 'duplicate'].every(isClosed)).toBe(true)
    expect(isClosed('monitoring')).toBe(false)
  })
})

describe('suggestPriority', () => {
  it.each([
    [{ conflictType: 'elephant-sighting', immediateDanger: true }, 'critical'],
    [{ conflictType: 'human-threat' }, 'critical'],
    [{ conflictType: 'human-injury' }, 'critical'],
    [{ conflictType: 'property-damage' }, 'high'],
    [{ conflictType: 'crop-damage', damage: { affectedAreaAcres: 2 } }, 'high'],
    [{ conflictType: 'crop-damage', damage: { affectedAreaAcres: 1 } }, 'high'],
    [{ conflictType: 'crop-damage', damage: { affectedAreaAcres: 0.5 } }, 'medium'],
    [{ conflictType: 'crop-damage' }, 'medium'],
    [{ conflictType: 'elephant-sighting' }, 'medium'],
    [{ conflictType: 'other' }, 'low'],
    [undefined, 'low']
  ])('suggests the priority for %o', (report, expected) => {
    expect(suggestPriority(report)).toBe(expected)
  })
})

describe('deploymentRouteFor', () => {
  it('sends critical reports through emergency dispatch without approval (A2)', () => {
    expect(deploymentRouteFor('critical')).toEqual({ dispatchType: 'emergency', requiresApproval: false })
  })

  it('needs park manager approval for high priority', () => {
    expect(deploymentRouteFor('high')).toEqual({ dispatchType: 'standard', requiresApproval: true })
  })

  it('needs approval when additional resources are requested, whatever the priority', () => {
    expect(deploymentRouteFor('low', { additionalResources: true }).requiresApproval).toBe(true)
  })

  it.each(['low', 'medium'])('lets the officer assign %s priority directly', (priority) => {
    expect(deploymentRouteFor(priority)).toEqual({ dispatchType: 'standard', requiresApproval: false })
  })
})

describe('isLocationAdequate (A3)', () => {
  it('accepts GPS coordinates on their own', () => {
    expect(isLocationAdequate({ location: { lat: 6.4, lng: 81.3 } })).toBe(true)
  })

  it('accepts a village with a landmark of at least three characters', () => {
    expect(isLocationAdequate({ village: 'Kataragama', landmark: 'Old tank' })).toBe(true)
  })

  it.each([
    [{ village: 'Kataragama' }, 'no landmark'],
    [{ village: 'Kataragama', landmark: 'ab' }, 'a two-character landmark'],
    [{ village: '  ', landmark: 'Old tank' }, 'a blank village'],
    [{ location: { lat: 6.4 } }, 'half a coordinate'],
    [{ location: { lat: Number.NaN, lng: 81 } }, 'a non-numeric coordinate'],
    [undefined, 'nothing']
  ])('rejects %o (%s)', (report) => {
    expect(isLocationAdequate(report)).toBe(false)
  })

  it('pointOf returns only complete coordinates', () => {
    expect(pointOf({ lat: 6, lng: 81 })).toEqual({ lat: 6, lng: 81 })
    expect(pointOf({ lat: 6 })).toBeNull()
  })
})

describe('duplicateReason (A4)', () => {
  const base = {
    _id: 'r1',
    park: 'yala',
    status: 'submitted',
    village: 'Kataragama',
    occurredAt: new Date('2026-09-30T02:00:00Z'),
    location: { lat: 6.4, lng: 81.33 }
  }
  const candidate = (overrides) => ({ ...base, _id: 'r2', ...overrides })

  it('matches a nearby report within 2 km and the time window', () => {
    const match = duplicateReason(base, candidate({ village: 'Other', location: { lat: 6.405, lng: 81.33 } }))

    expect(match).toEqual({ rule: 'distance', distanceKm: 0.56 })
  })

  it('matches the same village when either report has no GPS, ignoring case and spacing', () => {
    const match = duplicateReason({ ...base, location: undefined }, candidate({ village: ' kataragama ' }))

    expect(match).toEqual({ rule: 'village', distanceKm: null })
  })

  it('matches the same village even when the GPS points are further apart', () => {
    expect(duplicateReason(base, candidate({ location: { lat: 6.5, lng: 81.33 } }))).toMatchObject({ rule: 'village', distanceKm: 11.12 })
  })

  it.each([
    ['the same report', { _id: 'r1' }],
    ['another park', { park: 'sinharaja' }],
    ['a closed report', { status: 'resolved' }],
    ['an event more than 12 hours apart', { occurredAt: new Date('2026-09-30T14:30:00Z') }],
    ['a distant report in another village', { village: 'Tissamaharama', location: { lat: 6.3, lng: 81.29 } }]
  ])('does not match %s', (label, overrides) => {
    expect(duplicateReason(base, candidate(overrides))).toBeNull()
  })

  it('compares populated park documents by id', () => {
    expect(duplicateReason({ ...base, park: { _id: 'yala' } }, candidate({}))).not.toBeNull()
  })
})

describe('review, alert and reference helpers', () => {
  it.each([
    ['elephant-not-located', 'monitoring'],
    ['requires-further-action', 'escalated'],
    ['elephant-driven-away', 'resolved'],
    [undefined, 'resolved']
  ])('suggests %s → %s', (outcome, expected) => {
    expect(suggestReviewResult(outcome)).toBe(expected)
  })

  it.each([
    ['critical', 'critical'],
    ['high', 'high'],
    ['medium', 'medium'],
    [undefined, 'medium']
  ])('maps priority %s to alert severity %s', (priority, severity) => {
    expect(alertSeverityFor(priority)).toBe(severity)
  })

  it('builds a dated reference from an unambiguous alphabet', () => {
    const reference = generateReference(new Date('2026-09-30T08:00:00Z'), () => 0)

    expect(reference).toBe('HEC-20260930-AAAAA')
    expect(generateReference(new Date('2026-09-30T08:00:00Z'))).toMatch(/^HEC-20260930-[A-HJ-NP-Z2-9]{5}$/)
  })
})
