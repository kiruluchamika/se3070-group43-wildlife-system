/**
 * Coverage policy (Strategy pattern). Group 41 never defines when a zone is
 * "under-patrolled", so the group agreed on this explicit, explainable rule.
 * Each park can override the thresholds, which meets the case study's need
 * to configure the system for different terrain (for example Sinharaja's
 * dense forest compared with Yala's open grassland).
 */

const DEFAULT_POLICY = Object.freeze({
  windowDays: 7,
  minCoveragePercent: 50,
  maxGapHours: Object.freeze({ high: 24, medium: 48, low: 72 })
})

const RISK_ORDER = Object.freeze(['low', 'medium', 'high'])
const RISK_WEIGHT = Object.freeze({ low: 1, medium: 2, high: 3 })

/** Alert severities that raise a zone's effective risk. */
const ALERT_RISK = Object.freeze({ critical: 'high', high: 'high', medium: 'medium', low: 'low' })

const RECOMMENDED_ACTIONS = Object.freeze({
  ALLOCATE_TEAM: 'Allocate a ranger team',
  INCREASE_FREQUENCY: 'Increase patrol frequency',
  ADDITIONAL_RESOURCES: 'Allocate additional resources',
  MONITOR: 'Monitor',
  TEAM_DEPLOYED: 'Team deployed — monitor progress'
})

const higherRisk = (first, second) => (RISK_ORDER.indexOf(first) >= RISK_ORDER.indexOf(second) ? first : second)

function createCoveragePolicy(parkPolicy = {}) {
  const policy = {
    windowDays: parkPolicy.windowDays ?? DEFAULT_POLICY.windowDays,
    minCoveragePercent: parkPolicy.minCoveragePercent ?? DEFAULT_POLICY.minCoveragePercent,
    maxGapHours: { ...DEFAULT_POLICY.maxGapHours, ...(parkPolicy.maxGapHours ?? {}) }
  }

  return {
    settings: policy,

    /** A zone's base risk, raised by any unresolved alert inside it. */
    effectiveRisk(zoneRisk, alerts = []) {
      return alerts.reduce((risk, alert) => higherRisk(risk, ALERT_RISK[alert.severity] ?? 'low'), zoneRisk ?? 'low')
    },

    evaluate({ risk, coveragePercent, hoursSinceLastPatrol, hasActiveAssignment }) {
      const maxGapHours = policy.maxGapHours[risk]
      const gapExceeded = hoursSinceLastPatrol === null || hoursSinceLastPatrol > maxGapHours
      const coverageLow = coveragePercent < policy.minCoveragePercent

      const reasons = []
      if (gapExceeded) {
        reasons.push(hoursSinceLastPatrol === null ? 'Never patrolled in the coverage window' : `No patrol for more than ${maxGapHours} h`)
      }
      if (coverageLow) reasons.push(`Coverage below ${policy.minCoveragePercent}%`)

      let status = 'adequate'
      if (hasActiveAssignment) status = 'covered'
      else if (gapExceeded || coverageLow) status = 'under-patrolled'

      return { status, gapExceeded, coverageLow, maxGapHours, reasons: status === 'under-patrolled' ? reasons : [] }
    },

    recommendedAction({ status, risk, gapExceeded }) {
      if (status === 'covered') return RECOMMENDED_ACTIONS.TEAM_DEPLOYED
      if (status !== 'under-patrolled') return RECOMMENDED_ACTIONS.MONITOR
      if (risk === 'high') return RECOMMENDED_ACTIONS.ALLOCATE_TEAM
      if (risk === 'medium') return gapExceeded ? RECOMMENDED_ACTIONS.INCREASE_FREQUENCY : RECOMMENDED_ACTIONS.ADDITIONAL_RESOURCES
      return RECOMMENDED_ACTIONS.MONITOR
    },

    /**
     * Ranking used to sort zones and to decide whether a reassignment moves a
     * team to a lower-priority area (A3): higher risk, longer gaps, lower
     * coverage and more alerts all raise the score.
     */
    priorityScore({ risk, hoursSinceLastPatrol, coveragePercent, alertCount }) {
      const gapRatio = hoursSinceLastPatrol === null ? 3 : Math.min(hoursSinceLastPatrol / policy.maxGapHours[risk], 3)
      return Math.round(RISK_WEIGHT[risk] * 100 + gapRatio * 20 + (100 - coveragePercent) / 5 + alertCount * 15)
    }
  }
}

module.exports = { createCoveragePolicy, DEFAULT_POLICY, RECOMMENDED_ACTIONS, RISK_WEIGHT }
