const mongoose = require('mongoose')
const { DISPATCH_TYPES, FIELD_OUTCOMES, OPEN_TASK_STATUSES, PRIORITIES, TASK_STATUS } = require('./conflict.constants')

const { ObjectId } = mongoose.Schema.Types

/** A ranger team's response to one conflict report (main flow steps 3–4). */
const responseTaskSchema = new mongoose.Schema(
  {
    report: { type: ObjectId, ref: 'ConflictReport', required: true },
    park: { type: ObjectId, ref: 'Park', required: true, index: true },
    team: { type: ObjectId, ref: 'RangerTeam', required: true, index: true },
    status: { type: String, enum: Object.values(TASK_STATUS), required: true },
    priority: { type: String, enum: PRIORITIES, required: true },
    dispatchType: { type: String, enum: Object.values(DISPATCH_TYPES), default: DISPATCH_TYPES.STANDARD },
    additionalResources: { type: Boolean, default: false },
    instructions: { type: String, trim: true, maxlength: 500 },
    proposedBy: { type: ObjectId, ref: 'User', required: true },

    approval: {
      required: { type: Boolean, default: false },
      decision: { type: String, enum: ['approved', 'rejected'] },
      by: { type: ObjectId, ref: 'User' },
      at: Date,
      notes: { type: String, trim: true, maxlength: 500 }
    },

    // Alert raised for UC04 when this is an emergency dispatch.
    alert: { type: ObjectId, ref: 'Alert' },

    assignedAt: Date,
    acknowledgedBy: { type: ObjectId, ref: 'User' },
    acknowledgedAt: Date,

    completion: {
      outcome: { type: String, enum: Object.values(FIELD_OUTCOMES) },
      notes: { type: String, trim: true, maxlength: 1000 },
      completedBy: { type: ObjectId, ref: 'User' },
      // Time on the ranger's device; may be earlier than syncedAt after offline work (E4).
      completedAt: Date,
      syncedAt: Date,
      clientUpdateId: { type: String, trim: true }
    }
  },
  { timestamps: true }
)

// A4: a report never gets a second open task, even under concurrent requests.
responseTaskSchema.index(
  { report: 1 },
  { name: 'one_open_task_per_report', unique: true, partialFilterExpression: { status: { $in: [...OPEN_TASK_STATUSES] } } }
)
responseTaskSchema.index({ report: 1, createdAt: -1 })

module.exports = mongoose.models.ResponseTask || mongoose.model('ResponseTask', responseTaskSchema)
