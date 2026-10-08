const mongoose = require('mongoose')

/**
 * Shared availability vocabulary. UC01 conflict response and UC04 patrol
 * allocation both change these, so every module reads the same state.
 */
const TEAM_STATUS = Object.freeze({
  AVAILABLE: 'available',
  ON_PATROL: 'on-patrol',
  RESPONDING: 'responding',
  OFF_DUTY: 'off-duty'
})

const rangerTeamSchema = new mongoose.Schema(
  {
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(TEAM_STATUS), default: TEAM_STATUS.AVAILABLE },
    baseLocationName: { type: String, trim: true },
    lastKnownLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
)

rangerTeamSchema.index({ park: 1, code: 1 }, { unique: true })

module.exports = mongoose.models.RangerTeam || mongoose.model('RangerTeam', rangerTeamSchema)
module.exports.TEAM_STATUS = TEAM_STATUS
