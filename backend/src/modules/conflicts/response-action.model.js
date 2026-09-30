const mongoose = require('mongoose')
const { FIELD_ACTION_TYPES } = require('./conflict.constants')

const { ObjectId } = mongoose.Schema.Types

/**
 * One field action a ranger recorded during a response (main flow step 4).
 * Actions may be recorded offline and synchronised later (E4), so each one
 * carries a client-generated id that makes a retried upload harmless.
 */
const responseActionSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: 'ResponseTask', required: true, index: true },
    report: { type: ObjectId, ref: 'ConflictReport', required: true },
    clientUpdateId: { type: String, required: true, trim: true, unique: true },
    type: { type: String, enum: FIELD_ACTION_TYPES, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    location: { lat: Number, lng: Number, accuracyMeters: Number },
    recordedBy: { type: ObjectId, ref: 'User', required: true },
    // Time on the ranger's device, separate from the server receipt time (createdAt).
    recordedAt: { type: Date, required: true },
    recordedOffline: { type: Boolean, default: false }
  },
  { timestamps: true }
)

module.exports = mongoose.models.ResponseAction || mongoose.model('ResponseAction', responseActionSchema)
