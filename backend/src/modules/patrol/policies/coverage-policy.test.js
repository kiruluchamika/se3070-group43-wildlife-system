const { createCoveragePolicy, DEFAULT_POLICY, RECOMMENDED_ACTIONS, RISK_WEIGHT } = require('./coverage-policy')

describe('coverage policy settings', () => {
  it('uses the agreed defaults when a park has no policy', () => {
    expect(createCoveragePolicy().settings).toEqual({ windowDays: 7, minCoveragePercent: 50, maxGapHours: { high: 24, medium: 48, low: 72 } })
    expect(createCoveragePolicy().settings).toEqual(DEFAULT_POLICY)
  })

  it('lets a park override the thresholds for its terrain', () => {
    const sinharaja = createCoveragePolicy({ windowDays: 14, minCoveragePercent: 40, maxGapHours: { high: 36, medium: 72, low: 120 } })

    expect(sinharaja.settings).toEqual({ windowDays: 14, minCoveragePercent: 40, maxGapHours: { high: 36, medium: 72, low: 120 } })
  })

  it('keeps the default for any threshold the park leaves out', () => {
    const policy = createCoveragePolicy({ maxGapHours: { high: 12 } })

    expect(policy.settings).toEqual({ windowDays: 7, minCoveragePercent: 50, maxGapHours: { high: 12, medium: 48, low: 72 } })
  })

  it('weights higher risk more heavily', () => {
    expect(RISK_WEIGHT).toEqual({ low: 1, medium: 2, high: 3 })
  })
})

describe('coverage policy effective risk', () => {
  const policy = createCoveragePolicy()

  it('keeps the base risk of a zone that has no alerts', () => {
    expect(policy.effectiveRisk('medium')).toBe('medium')
    expect(policy.effectiveRisk('medium', [])).toBe('medium')
  })

  it.each([
    ['critical', 'low', 'high'],
    ['high', 'medium', 'high'],
    ['medium', 'low', 'medium']
  ])('raises the risk for a %s alert in a %s-risk zone to %s', (severity, zoneRisk, expected) => {
    expect(policy.effectiveRisk(zoneRisk, [{ severity }])).toBe(expected)
  })

  it('never lowers the base risk of a zone', () => {
    expect(policy.effectiveRisk('high', [{ severity: 'low' }, { severity: 'medium' }])).toBe('high')
  })

  it('treats an unknown severity or a missing base risk as low', () => {
    expect(policy.effectiveRisk('medium', [{ severity: 'unknown' }])).toBe('medium')
    expect(policy.effectiveRisk(undefined, [])).toBe('low')
  })
})

describe('coverage policy evaluation (when a zone is under-patrolled)', () => {
  const policy = createCoveragePolicy()

  it('flags a zone whose patrol gap exceeds the limit for its risk', () => {
    const result = policy.evaluate({ risk: 'high', coveragePercent: 80, hoursSinceLastPatrol: 25, hasActiveAssignment: false })

    expect(result).toEqual({ status: 'under-patrolled', gapExceeded: true, coverageLow: false, maxGapHours: 24, reasons: ['No patrol for more than 24 h'] })
  })

  it('flags a zone whose coverage is below the minimum', () => {
    const result = policy.evaluate({ risk: 'low', coveragePercent: 49, hoursSinceLastPatrol: 5, hasActiveAssignment: false })

    expect(result).toMatchObject({ status: 'under-patrolled', gapExceeded: false, coverageLow: true, reasons: ['Coverage below 50%'] })
  })

  it('flags a zone that was never patrolled and gives both reasons', () => {
    const result = policy.evaluate({ risk: 'medium', coveragePercent: 0, hoursSinceLastPatrol: null, hasActiveAssignment: false })

    expect(result.status).toBe('under-patrolled')
    expect(result.reasons).toEqual(['Never patrolled in the coverage window', 'Coverage below 50%'])
  })

  it('treats a zone exactly on both thresholds as adequate', () => {
    const result = policy.evaluate({ risk: 'medium', coveragePercent: 50, hoursSinceLastPatrol: 48, hasActiveAssignment: false })

    expect(result).toMatchObject({ status: 'adequate', gapExceeded: false, coverageLow: false, reasons: [] })
  })

  it('marks a zone with an active assignment as covered, even when its figures are poor', () => {
    const result = policy.evaluate({ risk: 'high', coveragePercent: 10, hoursSinceLastPatrol: 90, hasActiveAssignment: true })

    expect(result).toMatchObject({ status: 'covered', gapExceeded: true, coverageLow: true, reasons: [] })
  })

  it('applies the per-park thresholds', () => {
    const sinharaja = createCoveragePolicy({ minCoveragePercent: 40, maxGapHours: { high: 36 } })

    const result = sinharaja.evaluate({ risk: 'high', coveragePercent: 45, hoursSinceLastPatrol: 30, hasActiveAssignment: false })

    expect(result).toMatchObject({ status: 'adequate', maxGapHours: 36 })
  })
})

describe('coverage policy recommended action', () => {
  const policy = createCoveragePolicy()

  it.each([
    [{ status: 'covered', risk: 'high', gapExceeded: true }, RECOMMENDED_ACTIONS.TEAM_DEPLOYED],
    [{ status: 'adequate', risk: 'high', gapExceeded: false }, RECOMMENDED_ACTIONS.MONITOR],
    [{ status: 'under-patrolled', risk: 'high', gapExceeded: false }, RECOMMENDED_ACTIONS.ALLOCATE_TEAM],
    [{ status: 'under-patrolled', risk: 'medium', gapExceeded: true }, RECOMMENDED_ACTIONS.INCREASE_FREQUENCY],
    [{ status: 'under-patrolled', risk: 'medium', gapExceeded: false }, RECOMMENDED_ACTIONS.ADDITIONAL_RESOURCES],
    [{ status: 'under-patrolled', risk: 'low', gapExceeded: true }, RECOMMENDED_ACTIONS.MONITOR]
  ])('recommends for %o: %s', (input, expected) => {
    expect(policy.recommendedAction(input)).toBe(expected)
  })
})

describe('coverage policy priority score', () => {
  const policy = createCoveragePolicy()

  it('adds risk, gap, missing coverage and alerts', () => {
    // 3×100 + (48/24)×20 + (100−40)/5 + 1×15
    expect(policy.priorityScore({ risk: 'high', hoursSinceLastPatrol: 48, coveragePercent: 40, alertCount: 1 })).toBe(367)
  })

  it('scores a zone that was never patrolled with the maximum gap', () => {
    // 1×100 + 3×20 + 100/5
    expect(policy.priorityScore({ risk: 'low', hoursSinceLastPatrol: null, coveragePercent: 0, alertCount: 0 })).toBe(180)
  })

  it('caps the gap at three times the limit', () => {
    // 2×100 + 3×20 + 0
    expect(policy.priorityScore({ risk: 'medium', hoursSinceLastPatrol: 1000, coveragePercent: 100, alertCount: 0 })).toBe(260)
  })

  it('ranks a higher-risk zone above a lower-risk zone with the same figures', () => {
    const figures = { hoursSinceLastPatrol: 30, coveragePercent: 50, alertCount: 0 }

    expect(policy.priorityScore({ risk: 'high', ...figures })).toBeGreaterThan(policy.priorityScore({ risk: 'medium', ...figures }))
  })
})
