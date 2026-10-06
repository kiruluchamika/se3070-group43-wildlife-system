const mongoose = require('mongoose')
const { INCIDENT_SEVERITIES, INCIDENT_TYPES } = require('./incident.constants')

const { ObjectId } = mongoose.Schema.Types

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    accuracyMeters: { type: Number, min: 0 }
  },
  { _id: false }
)

const wildlifeIncidentSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true, trim: true },
    payloadFingerprint: { type: String, required: true, select: false },
    reference: { type: String, required: true, unique: true, trim: true },
    ranger: { type: ObjectId, ref: 'User', required: true, index: true },
    park: { type: ObjectId, ref: 'Park', required: true, index: true },
    zone: { type: ObjectId, ref: 'Zone', index: true },
    type: { type: String, enum: INCIDENT_TYPES, required: true, index: true },
    severity: { type: String, enum: INCIDENT_SEVERITIES, required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    location: locationSchema,
    locationNote: { type: String, trim: true, maxlength: 200 },
    observedAt: { type: Date, required: true },
    deviceCreatedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    recordedOffline: { type: Boolean, default: false },
    photoCount: { type: Number, min: 0, max: 3, default: 0 },
    alert: { type: ObjectId, ref: 'Alert' }
  },
  { timestamps: true }
)

wildlifeIncidentSchema.index({ ranger: 1, observedAt: -1 })
wildlifeIncidentSchema.index({ park: 1, type: 1, observedAt: -1 })

module.exports = mongoose.models.WildlifeIncident || mongoose.model('WildlifeIncident', wildlifeIncidentSchema)
