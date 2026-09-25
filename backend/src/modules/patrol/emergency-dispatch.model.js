const mongoose = require('mongoose')

/**
 * Record of an emergency dispatch (UC04 alternate flow A4). Group 41's sequence
 * diagram uses a DispatchDB, but its class diagram has no matching class, so
 * this class is added.
 */
const emergencyDispatchSchema = new mongoose.Schema(
  {
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true, index: true },
    alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', required: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'RangerTeam', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'PatrolAssignment', required: true },
    // Set when a team was pulled off a patrol to respond.
    divertedFromAssignment: { type: mongoose.Schema.Types.ObjectId, ref: 'PatrolAssignment' },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    distanceKm: Number,
    etaMinutes: Number,
    notes: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
)

module.exports = mongoose.models.EmergencyDispatch || mongoose.model('EmergencyDispatch', emergencyDispatchSchema)
