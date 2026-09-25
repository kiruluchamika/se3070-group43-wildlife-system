const mongoose = require('mongoose')

const RISK_LEVELS = ['low', 'medium', 'high']

const zoneSchema = new mongoose.Schema(
  {
    park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    riskLevel: { type: String, enum: RISK_LEVELS, default: 'medium' },
    description: { type: String, trim: true },
    // GeoJSON polygon; coordinates are [longitude, latitude] pairs.
    boundary: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]], required: true }
    },
    // Patrol hours the zone should receive per coverage window.
    targetWeeklyPatrolHours: { type: Number, min: 1, default: 14 }
  },
  { timestamps: true }
)

zoneSchema.index({ park: 1, code: 1 }, { unique: true })

module.exports = mongoose.models.Zone || mongoose.model('Zone', zoneSchema)
module.exports.RISK_LEVELS = RISK_LEVELS
