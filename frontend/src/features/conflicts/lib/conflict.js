/**
 * UC01 labels and options. The values match backend/src/modules/conflicts/conflict.constants.js.
 */

export const CONFLICT_TYPES = [
  { value: 'elephant-sighting', label: 'Elephant sighting', hint: 'An elephant is near homes, roads or fields.' },
  { value: 'crop-damage', label: 'Crop damage', hint: 'Crops have been eaten or trampled.' },
  { value: 'property-damage', label: 'Property damage', hint: 'A house, wall, fence or store was damaged.' },
  { value: 'human-threat', label: 'Threat to people', hint: 'People are in danger right now.' },
  { value: 'human-injury', label: 'Human injury', hint: 'Someone has been hurt by an elephant.' },
  { value: 'other', label: 'Other', hint: 'Anything else involving elephants.' },
]

export const TYPE_LABELS = Object.fromEntries(CONFLICT_TYPES.map((type) => [type.value, type.label]))
export const DAMAGE_TYPES = ['crop-damage', 'property-damage']

export const PRIORITIES = ['low', 'medium', 'high', 'critical']

/** What each priority means for deployment (matches deploymentRouteFor on the server). */
export const PRIORITY_ROUTE = {
  low: 'The officer assigns a team directly.',
  medium: 'The officer assigns a team directly.',
  high: 'The deployment needs park manager approval.',
  critical: 'Emergency dispatch: the team leaves at once and the park manager is informed.',
}

export const REPORT_STATUS_LABELS = {
  submitted: 'Awaiting verification',
  'pending-information': 'More information needed',
  validated: 'Verified',
  invalid: 'Not verified',
  duplicate: 'Linked duplicate',
  'awaiting-approval': 'Awaiting approval',
  'response-assigned': 'Rangers responding',
  'response-completed': 'Awaiting review',
  escalated: 'Escalated',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
}

/** The steps a villager sees on their report, and the step each status belongs to. */
export const VILLAGER_STEPS = ['Reported', 'Verified', 'Rangers assigned', 'Response complete', 'Closed']
export const VILLAGER_STEP_OF = {
  submitted: 0,
  'pending-information': 0,
  validated: 1,
  'awaiting-approval': 1,
  escalated: 1,
  'response-assigned': 2,
  'response-completed': 3,
  monitoring: 3,
  resolved: 4,
  invalid: 4,
  duplicate: 4,
}

export const QUEUE_VIEWS = [
  { key: 'new', label: 'New' },
  { key: 'pending-information', label: 'Need info' },
  { key: 'active', label: 'Active' },
  { key: 'review', label: 'To review' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

export const DEPLOYABLE_STATUSES = ['validated', 'escalated', 'monitoring']

export const FIELD_ACTIONS = [
  { value: 'arrived-on-site', label: 'Arrived on site' },
  { value: 'elephant-located', label: 'Elephant located' },
  { value: 'drive-away', label: 'Drove elephant away' },
  { value: 'deterrent-used', label: 'Used deterrent (thunder flash, fire)' },
  { value: 'community-briefing', label: 'Briefed the community' },
  { value: 'damage-assessed', label: 'Assessed damage' },
  { value: 'first-aid', label: 'Gave first aid' },
  { value: 'other', label: 'Other' },
]
export const FIELD_ACTION_LABELS = Object.fromEntries(FIELD_ACTIONS.map((action) => [action.value, action.label]))

export const FIELD_OUTCOMES = [
  { value: 'elephant-driven-away', label: 'Elephant driven back to the park' },
  { value: 'situation-contained', label: 'Situation contained' },
  { value: 'elephant-not-located', label: 'Elephant could not be located' },
  { value: 'requires-further-action', label: 'Needs further action' },
]
export const FIELD_OUTCOME_LABELS = Object.fromEntries(FIELD_OUTCOMES.map((outcome) => [outcome.value, outcome.label]))

export const REVIEW_RESULTS = [
  { value: 'resolved', label: 'Resolved', hint: 'The conflict is over. The villager is told the report is closed.' },
  { value: 'monitoring', label: 'Monitoring required', hint: 'Check the area again at a set time.' },
  { value: 'escalated', label: 'Escalate', hint: 'Ask the park manager for more resources. An alert appears on the patrol dashboard.' },
]

export const ALTERNATIVE_CONTACT_METHODS = [
  { value: 'phone-call', label: 'Phone call' },
  { value: 'village-officer', label: 'Village officer (Grama Niladhari)' },
  { value: 'in-person', label: 'In person' },
  { value: 'neighbour', label: 'Through a neighbour' },
  { value: 'other', label: 'Other' },
]

export const CONTACT_STATUS_LABELS = {
  delivered: 'Delivered in app',
  sent: 'SMS sent',
  simulated: 'SMS simulated (prototype)',
  failed: 'Failed',
  recorded: 'Recorded by officer',
}

/** `datetime-local` value for a date, in the browser's time zone. */
export function toLocalInput(date = new Date()) {
  const value = new Date(date)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

/** A readable place: "Kataragama · Near the old tank". */
export const placeOf = (report) => [report.village, report.landmark].filter(Boolean).join(' · ')

/** RFC 4122 id for offline updates; falls back when crypto.randomUUID is unavailable (plain HTTP). */
export function newClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`
}
