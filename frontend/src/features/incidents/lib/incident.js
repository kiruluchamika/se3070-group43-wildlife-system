export const INCIDENT_TYPES = [
  { value: 'snare', label: 'Snare or trap', hint: 'Wire, rope or another animal trap.' },
  { value: 'illegal-camp', label: 'Illegal camp', hint: 'Signs of people camping or hunting illegally.' },
  { value: 'carcass', label: 'Animal carcass', hint: 'A dead wild animal that needs investigation.' },
  { value: 'footprint', label: 'Suspicious footprints', hint: 'Human or vehicle tracks in a restricted area.' },
  { value: 'injured-wildlife', label: 'Injured wildlife', hint: 'An animal needs assessment or assistance.' },
  { value: 'wildlife-sighting', label: 'Wildlife sighting', hint: 'A noteworthy animal observation.' },
  { value: 'fire', label: 'Fire or smoke', hint: 'Smoke, flames or a recently burned area.' },
  { value: 'other', label: 'Other evidence', hint: 'Something important not listed above.' },
]

export const TYPE_LABELS = Object.fromEntries(INCIDENT_TYPES.map((type) => [type.value, type.label]))

export const SEVERITIES = [
  { value: 'low', label: 'Low', hint: 'Record for awareness.' },
  { value: 'medium', label: 'Medium', hint: 'Needs review soon.' },
  { value: 'high', label: 'High', hint: 'Needs a prompt response.' },
  { value: 'critical', label: 'Critical', hint: 'Immediate danger or active offence.' },
]

export const DEFAULT_SEVERITY = {
  'wildlife-sighting': 'low',
  'injured-wildlife': 'medium',
  snare: 'high',
  carcass: 'high',
  'illegal-camp': 'critical',
  footprint: 'medium',
  fire: 'critical',
  other: 'low',
}

export function newClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  // Modern browsers have randomUUID; this keeps local development usable on plain HTTP.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

/** `datetime-local` value in the device's current time zone. */
export function toLocalInput(date = new Date()) {
  const value = new Date(date)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}
