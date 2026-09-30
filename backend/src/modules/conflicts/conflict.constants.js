/**
 * Shared UC01 vocabulary. Models, services, validation schemas and the
 * frontend all use these values, so a status means the same thing everywhere.
 */

const CONFLICT_TYPES = Object.freeze([
  'elephant-sighting',
  'crop-damage',
  'property-damage',
  'human-threat',
  'human-injury',
  'other'
])

/** Types that need the A1 damage-specific fields. */
const DAMAGE_TYPES = Object.freeze(['crop-damage', 'property-damage'])

const PRIORITIES = Object.freeze(['low', 'medium', 'high', 'critical'])

const REPORT_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  PENDING_INFORMATION: 'pending-information',
  VALIDATED: 'validated',
  INVALID: 'invalid',
  DUPLICATE: 'duplicate',
  AWAITING_APPROVAL: 'awaiting-approval',
  RESPONSE_ASSIGNED: 'response-assigned',
  RESPONSE_COMPLETED: 'response-completed',
  ESCALATED: 'escalated',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved'
})

const TASK_STATUS = Object.freeze({
  AWAITING_APPROVAL: 'awaiting-approval',
  ASSIGNED: 'assigned',
  ACKNOWLEDGED: 'acknowledged',
  COMPLETED: 'completed',
  REJECTED: 'rejected'
})

/** Tasks a ranger team is still working on. */
const OPEN_TASK_STATUSES = Object.freeze([TASK_STATUS.AWAITING_APPROVAL, TASK_STATUS.ASSIGNED, TASK_STATUS.ACKNOWLEDGED])

const DISPATCH_TYPES = Object.freeze({ STANDARD: 'standard', EMERGENCY: 'emergency' })

const FIELD_ACTION_TYPES = Object.freeze([
  'arrived-on-site',
  'elephant-located',
  'drive-away',
  'deterrent-used',
  'community-briefing',
  'damage-assessed',
  'first-aid',
  'other'
])

const FIELD_OUTCOMES = Object.freeze({
  DRIVEN_AWAY: 'elephant-driven-away',
  NOT_LOCATED: 'elephant-not-located',
  CONTAINED: 'situation-contained',
  FURTHER_ACTION: 'requires-further-action'
})

/** The officer's final review decision (main flow step 5). */
const REVIEW_RESULTS = Object.freeze({
  RESOLVED: 'resolved',
  MONITORING: 'monitoring',
  ESCALATED: 'escalated'
})

const CONTACT_CHANNELS = Object.freeze(['in-app', 'sms', 'alternative'])
/**
 * `sent` means a real SMS provider accepted the message; `simulated` means the
 * prototype gateway only logged it. Neither is reported as delivered.
 */
const CONTACT_STATUS = Object.freeze({ DELIVERED: 'delivered', SENT: 'sent', SIMULATED: 'simulated', FAILED: 'failed', RECORDED: 'recorded' })
const ALTERNATIVE_CONTACT_METHODS = Object.freeze(['phone-call', 'village-officer', 'in-person', 'neighbour', 'other'])

module.exports = {
  CONFLICT_TYPES,
  DAMAGE_TYPES,
  PRIORITIES,
  REPORT_STATUS,
  TASK_STATUS,
  OPEN_TASK_STATUSES,
  DISPATCH_TYPES,
  FIELD_ACTION_TYPES,
  FIELD_OUTCOMES,
  REVIEW_RESULTS,
  CONTACT_CHANNELS,
  CONTACT_STATUS,
  ALTERNATIVE_CONTACT_METHODS
}
