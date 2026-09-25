const mongoose = require('mongoose')

/** One completed (or ongoing) patrol by a team inside a zone. Coverage figures come from these. */
const patrolRecordSchema = new mongoose.Schema(
  {
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'RangerTeam', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'PatrolAssignment' },
    startTime: { type: Date, required: true },
    // Null while the patrol is still in progress.
    endTime: Date,
    // GPS waypoints as [latitude, longitude] pairs.
    route: { type: [[Number]], default: [] },
    distanceKm: Number,
    syncStatus: { type: String, enum: ['synced', 'pending'], default: 'synced' }
  },
  { timestamps: true }
)

patrolRecordSchema.index({ park: 1, endTime: -1 })

module.exports = mongoose.models.PatrolRecord || mongoose.model('PatrolRecord', patrolRecordSchema)
