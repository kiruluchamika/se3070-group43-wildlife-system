const INCIDENT_TYPES = Object.freeze([
  'wildlife-sighting',
  'injured-wildlife',
  'snare',
  'carcass',
  'illegal-camp',
  'footprint',
  'fire',
  'other'
])

const INCIDENT_SEVERITIES = Object.freeze(['low', 'medium', 'high', 'critical'])

/**
 * UC03 incidents are more detailed than UC04 operational alerts. Keep that
 * detail on the incident and translate only actionable reports to the shared
 * alert vocabulary.
 */
const ALERT_RULES = Object.freeze({
  snare: { type: 'snare', severity: 'high', title: 'Snare reported by ranger' },
  carcass: { type: 'carcass', severity: 'high', title: 'Wildlife carcass reported' },
  'illegal-camp': { type: 'illegal-camp', severity: 'critical', title: 'Illegal camp reported' },
  footprint: { type: 'poaching', severity: 'medium', title: 'Suspicious footprints reported' },
  fire: { type: 'fire', severity: 'critical', title: 'Fire reported by ranger' }
})

const DEFAULT_SEVERITY = Object.freeze({
  'wildlife-sighting': 'low',
  'injured-wildlife': 'medium',
  snare: 'high',
  carcass: 'high',
  'illegal-camp': 'critical',
  footprint: 'medium',
  fire: 'critical',
  other: 'low'
})

module.exports = { INCIDENT_TYPES, INCIDENT_SEVERITIES, ALERT_RULES, DEFAULT_SEVERITY }
