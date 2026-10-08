const mongoose = require('mongoose')
const {
  ALTERNATIVE_CONTACT_METHODS,
  CONFLICT_TYPES,
  CONTACT_CHANNELS,
  CONTACT_STATUS,
  FIELD_OUTCOMES,
  PRIORITIES,
  REPORT_STATUS,
  REVIEW_RESULTS
} = require('./conflict.constants')

const { ObjectId } = mongoose.Schema.Types

const pointSchema = new mongoose.Schema({ lat: Number, lng: Number, accuracyMeters: Number }, { _id: false })

/** A1: damage-specific details for crop and property damage reports. */
const damageSchema = new mongoose.Schema(
  {
    cropType: { type: String, trim: true, maxlength: 60 },
    affectedAreaAcres: { type: Number, min: 0 },
    propertyType: { type: String, trim: true, maxlength: 60 },
    estimatedLossLkr: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 300 }
  },
  { _id: false }
)

/** Photo evidence, resized in the browser and stored as a data URL (max 3 per report). */
const evidenceSchema = new mongoose.Schema(
  {
    caption: { type: String, trim: true, maxlength: 120 },
    dataUrl: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: true }
)

/** Audit trail: every status change and officer decision (main flow step 5, "record history"). */
const historySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    by: { type: ObjectId, ref: 'User' },
    action: { type: String, required: true, trim: true },
    fromStatus: String,
    toStatus: String,
    note: { type: String, trim: true, maxlength: 500 }
  },
  { _id: false }
)

/** E1–E3: every attempt to reach the reporting community, including failures. */
const contactAttemptSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    purpose: { type: String, trim: true, maxlength: 60 },
    channel: { type: String, enum: CONTACT_CHANNELS, required: true },
    status: { type: String, enum: Object.values(CONTACT_STATUS), required: true },
    method: { type: String, enum: ALTERNATIVE_CONTACT_METHODS },
    detail: { type: String, trim: true, maxlength: 300 },
    recordedBy: { type: ObjectId, ref: 'User' }
  },
  { _id: false }
)

const conflictReportSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    park: { type: ObjectId, ref: 'Park', required: true, index: true },
    reporter: { type: ObjectId, ref: 'User', required: true, index: true },

    // Main flow step 1
    conflictType: { type: String, enum: CONFLICT_TYPES, required: true },
    village: { type: String, required: true, trim: true, maxlength: 80 },
    landmark: { type: String, trim: true, maxlength: 120 },
    occurredAt: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    contactName: { type: String, required: true, trim: true, maxlength: 80 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 20 },
    location: pointSchema,
    evidence: { type: [evidenceSchema], default: [] },
    damage: damageSchema,
    // A2: the villager says people are in immediate danger.
    immediateDanger: { type: Boolean, default: false },
    locationAdequate: { type: Boolean, default: true },

    status: { type: String, enum: Object.values(REPORT_STATUS), default: REPORT_STATUS.SUBMITTED, index: true },
    suggestedPriority: { type: String, enum: PRIORITIES },
    priority: { type: String, enum: PRIORITIES },

    // Main flow step 2
    validation: {
      decision: { type: String, enum: ['valid', 'invalid'] },
      notes: { type: String, trim: true, maxlength: 500 },
      by: { type: ObjectId, ref: 'User' },
      at: Date
    },
    // A3
    informationRequest: {
      message: { type: String, trim: true, maxlength: 500 },
      requestedBy: { type: ObjectId, ref: 'User' },
      requestedAt: Date,
      response: { type: String, trim: true, maxlength: 1000 },
      respondedAt: Date
    },
    // A4
    duplicateOf: { type: ObjectId, ref: 'ConflictReport' },
    linkedReports: [{ type: ObjectId, ref: 'ConflictReport' }],

    // Main flow step 5
    outcome: {
      result: { type: String, enum: Object.values(REVIEW_RESULTS) },
      fieldOutcome: { type: String, enum: Object.values(FIELD_OUTCOMES) },
      notes: { type: String, trim: true, maxlength: 1000 },
      followUpAt: Date,
      reviewedBy: { type: ObjectId, ref: 'User' },
      reviewedAt: Date
    },
    // A5, and escalation at review
    escalation: {
      reason: { type: String, trim: true, maxlength: 500 },
      by: { type: ObjectId, ref: 'User' },
      at: Date,
      alert: { type: ObjectId, ref: 'Alert' }
    },

    // E1–E3
    contactStatus: { type: String, enum: ['ok', 'failed'], default: 'ok' },
    contactAttempts: { type: [contactAttemptSchema], default: [] },

    history: { type: [historySchema], default: [] }
  },
  { timestamps: true }
)

conflictReportSchema.index({ park: 1, status: 1, occurredAt: -1 })

module.exports = mongoose.models.ConflictReport || mongoose.model('ConflictReport', conflictReportSchema)
