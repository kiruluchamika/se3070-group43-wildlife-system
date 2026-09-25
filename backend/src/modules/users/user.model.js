const mongoose = require('mongoose')
const { ALL_ROLES, ROLES } = require('../../shared/roles')

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ALL_ROLES, default: ROLES.VILLAGER },
    phone: { type: String, trim: true, maxlength: 20 },
    // Home park for staff roles; dashboards open on this park by default.
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park' },
    // Rangers belong to exactly one ranger team.
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'RangerTeam' }
  },
  { timestamps: true }
)

module.exports = mongoose.models.User || mongoose.model('User', userSchema)
