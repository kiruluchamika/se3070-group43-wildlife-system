const { haversineKm } = require('../../shared/utils/geo')
const { hoursBetween } = require('../../shared/utils/time')
const { DISPATCH_TYPES, FIELD_OUTCOMES, REPORT_STATUS: S, REVIEW_RESULTS } = require('./conflict.constants')

/**
 * Pure UC01 business rules. Nothing here touches the database, so every
 * decision the services make can be unit-tested directly.
 */

/**
 * Allowed report status changes. Group 41's scenario never states which
 * transitions are legal, so this table is the single source of truth.
 */
const TRANSITIONS = Object.freeze({
  [S.SUBMITTED]: [S.VALIDATED, S.INVALID, S.PENDING_INFORMATION, S.DUPLICATE],
  [S.PENDING_INFORMATION]: [S.SUBMITTED, S.VALIDATED, S.INVALID, S.DUPLICATE],
  [S.VALIDATED]: [S.AWAITING_APPROVAL, S.RESPONSE_ASSIGNED, S.ESCALATED, S.DUPLICATE],
  [S.AWAITING_APPROVAL]: [S.RESPONSE_ASSIGNED, S.VALIDATED, S.ESCALATED],
  [S.RESPONSE_ASSIGNED]: [S.RESPONSE_COMPLETED],
  [S.RESPONSE_COMPLETED]: [S.RESOLVED, S.MONITORING, S.ESCALATED],
  [S.ESCALATED]: [S.AWAITING_APPROVAL, S.RESPONSE_ASSIGNED, S.RESOLVED],
  [S.MONITORING]: [S.AWAITING_APPROVAL, S.RESPONSE_ASSIGNED, S.RESOLVED, S.ESCALATED],
  [S.INVALID]: [],
  [S.DUPLICATE]: [],
  [S.RESOLVED]: []
})

const CLOSED_STATUSES = Object.freeze([S.INVALID, S.DUPLICATE, S.RESOLVED])
/** Reports a team can be deployed to. */
const DEPLOYABLE_STATUSES = Object.freeze([S.VALIDATED, S.ESCALATED, S.MONITORING])

/** Officer queue tabs → the statuses they contain. */
const QUEUE_VIEWS = Object.freeze({
  new: [S.SUBMITTED],
  'pending-information': [S.PENDING_INFORMATION],
  active: [S.VALIDATED, S.AWAITING_APPROVAL, S.RESPONSE_ASSIGNED, S.ESCALATED, S.MONITORING],
  review: [S.RESPONSE_COMPLETED],
  closed: [...CLOSED_STATUSES],
  all: Object.values(S)
})

function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to)
}

function isClosed(status) {
  return CLOSED_STATUSES.includes(status)
}

/**
 * Suggested priority for the officer (main flow step 2). The officer may
 * override it; the suggestion only makes the safe choice the default.
 */
function suggestPriority({ conflictType, immediateDanger, damage } = {}) {
  if (immediateDanger || conflictType === 'human-threat' || conflictType === 'human-injury') return 'critical'
  if (conflictType === 'property-damage') return 'high'
  if (conflictType === 'crop-damage') return (damage?.affectedAreaAcres ?? 0) >= 1 ? 'high' : 'medium'
  if (conflictType === 'elephant-sighting') return 'medium'
  return 'low'
}

/**
 * Deployment route for a priority (main flow step 3):
 * - critical: emergency dispatch, no approval, the park manager is informed afterwards (A2)
 * - high, or a request for additional resources: park manager approval first
 * - low and medium: the officer assigns the team directly
 */
function deploymentRouteFor(priority, { additionalResources = false } = {}) {
  if (priority === 'critical') return { dispatchType: DISPATCH_TYPES.EMERGENCY, requiresApproval: false }
  return { dispatchType: DISPATCH_TYPES.STANDARD, requiresApproval: priority === 'high' || additionalResources }
}

const MIN_LANDMARK_LENGTH = 3

/** The location as `{ lat, lng }` when both coordinates are numbers, otherwise null. */
const pointOf = (location) => (Number.isFinite(location?.lat) && Number.isFinite(location?.lng) ? location : null)

/**
 * A3: a team can only be sent when rangers can find the place. GPS
 * coordinates are enough on their own; otherwise both a village and a
 * landmark are needed.
 */
function isLocationAdequate({ location, village, landmark } = {}) {
  if (pointOf(location)) return true
  return Boolean(village?.trim()) && (landmark?.trim().length ?? 0) >= MIN_LANDMARK_LENGTH
}

/** Duplicate rule (A4): same park, open, within this many hours and this distance or village. */
const DUPLICATE_WINDOW_HOURS = 12
const DUPLICATE_RADIUS_KM = 2

const normalise = (text) => (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Returns why `candidate` looks like a duplicate of `report`, or null. */
function duplicateReason(report, candidate) {
  if (String(report._id) === String(candidate._id)) return null
  if (String(report.park?._id ?? report.park) !== String(candidate.park?._id ?? candidate.park)) return null
  if (isClosed(candidate.status)) return null
  if (Math.abs(hoursBetween(report.occurredAt, candidate.occurredAt)) > DUPLICATE_WINDOW_HOURS) return null

  const distanceKm = haversineKm(pointOf(report.location), pointOf(candidate.location))
  if (distanceKm !== null && distanceKm <= DUPLICATE_RADIUS_KM) {
    return { rule: 'distance', distanceKm: Math.round(distanceKm * 100) / 100 }
  }
  if (normalise(report.village) && normalise(report.village) === normalise(candidate.village)) {
    return { rule: 'village', distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100 }
  }
  return null
}

/** Review decision the officer is offered first (A6: elephant not located → monitoring). */
function suggestReviewResult(fieldOutcome) {
  if (fieldOutcome === FIELD_OUTCOMES.NOT_LOCATED) return REVIEW_RESULTS.MONITORING
  if (fieldOutcome === FIELD_OUTCOMES.FURTHER_ACTION) return REVIEW_RESULTS.ESCALATED
  return REVIEW_RESULTS.RESOLVED
}

/** Alert severity raised for UC04 when a conflict is escalated or dispatched as an emergency. */
function alertSeverityFor(priority) {
  return priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'medium'
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Human-friendly unique report id, e.g. HEC-20260930-7KQ2M. */
function generateReference(date, random = Math.random) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '')
  let suffix = ''
  for (let index = 0; index < 5; index += 1) suffix += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)]
  return `HEC-${day}-${suffix}`
}

module.exports = {
  TRANSITIONS,
  CLOSED_STATUSES,
  DEPLOYABLE_STATUSES,
  QUEUE_VIEWS,
  DUPLICATE_WINDOW_HOURS,
  DUPLICATE_RADIUS_KM,
  canTransition,
  isClosed,
  suggestPriority,
  deploymentRouteFor,
  isLocationAdequate,
  pointOf,
  duplicateReason,
  suggestReviewResult,
  alertSeverityFor,
  generateReference
}
