const mongoose = require('mongoose')

const DECISION_TYPES = Object.freeze({ ALLOCATE: 'allocate', REASSIGN: 'reassign', EMERGENCY: 'emergency', COMPLETE: 'complete' })

/**
 * Audit trail of every resource-allocation decision (UC04 main flow step 11,
 * "the system records the resource allocation decision"). This class is added
 * to Group 41's class diagram.
 */
const allocationDecisionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(DECISION_TYPES), required: true },
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true, index: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    fromZone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'RangerTeam', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'PatrolAssignment' },
    alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
)

module.exports = mongoose.models.AllocationDecision || mongoose.model('AllocationDecision', allocationDecisionSchema)
module.exports.DECISION_TYPES = DECISION_TYPES
