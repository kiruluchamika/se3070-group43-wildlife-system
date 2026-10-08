const { normalizeSpecies } = require('../../shared/species')
const mongoose = require('mongoose')

const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical']
const ALERT_STATUSES = ['active', 'acknowledged', 'dispatched', 'resolved']
const ALERT_TYPES = [
  'poaching',
  'snare',
  'carcass',
  'illegal-camp',
  'elephant-movement',
  'geofence-breach',
  'camera-trap',
  'fire',
  'other'
]
const ALERT_SOURCES = ['ranger-incident', 'gps-collar', 'camera-trap', 'conflict-report', 'system']

const alertSchema = new mongoose.Schema(
  {
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true, index: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    type: { type: String, enum: ALERT_TYPES, required: true },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },
    status: { type: String, enum: ALERT_STATUSES, default: 'active', index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    species: { type: String, maxlength: 80, set: normalizeSpecies },
    message: { type: String, trim: true, maxlength: 500 },
    location: { lat: Number, lng: Number },
    source: { type: String, enum: ALERT_SOURCES, default: 'system' },
    // Id of the incident, collar reading, or conflict report that raised the alert.
    sourceRef: { type: String, trim: true },
    // Collar and camera-trap feeds are simulated for the prototype.
    simulated: { type: Boolean, default: false },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    resolvedAt: Date
  },
  { timestamps: true }
)

module.exports = mongoose.models.Alert || mongoose.model('Alert', alertSchema)
Object.assign(module.exports, { ALERT_SEVERITIES, ALERT_STATUSES, ALERT_TYPES, ALERT_SOURCES })
