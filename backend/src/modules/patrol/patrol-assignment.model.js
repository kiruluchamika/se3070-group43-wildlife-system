const mongoose = require('mongoose')

const ALLOCATION_TYPES = Object.freeze({ ALLOCATION: 'allocation', REASSIGNMENT: 'reassignment', EMERGENCY: 'emergency' })
const ASSIGNMENT_STATUS = Object.freeze({ ACTIVE: 'active', COMPLETED: 'completed', SUPERSEDED: 'superseded' })

/** A ranger team deployed to a zone (Group 41 class diagram: PatrolAssignment). */
const patrolAssignmentSchema = new mongoose.Schema(
  {
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true, index: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'RangerTeam', required: true },
    allocationType: { type: String, enum: Object.values(ALLOCATION_TYPES), required: true },
    status: { type: String, enum: Object.values(ASSIGNMENT_STATUS), default: ASSIGNMENT_STATUS.ACTIVE },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    notes: { type: String, trim: true, maxlength: 500 },
    // Why the team was moved away from its previous zone (reassignments only).
    reason: { type: String, trim: true, maxlength: 500 },
    alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' },
    previousAssignment: { type: mongoose.Schema.Types.ObjectId, ref: 'PatrolAssignment' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, required: true },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    endedAt: Date
  },
  { timestamps: true }
)

// A team can hold at most one active assignment, even under concurrent requests.
patrolAssignmentSchema.index({ team: 1 }, { unique: true, partialFilterExpression: { status: 'active' } })

module.exports = mongoose.models.PatrolAssignment || mongoose.model('PatrolAssignment', patrolAssignmentSchema)
Object.assign(module.exports, { ALLOCATION_TYPES, ASSIGNMENT_STATUS })
