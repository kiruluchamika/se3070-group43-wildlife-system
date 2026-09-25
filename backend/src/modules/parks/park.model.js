const mongoose = require('mongoose')

const pointSchema = new mongoose.Schema({ lat: Number, lng: Number }, { _id: false })

/**
 * Patrol expectations can differ by park and terrain (dense forest compared
 * with open grassland). Missing values fall back to the defaults in
 * modules/patrol/policies/coverage-policy.js.
 */
const coveragePolicySchema = new mongoose.Schema(
  {
    windowDays: Number,
    minCoveragePercent: Number,
    maxGapHours: { high: Number, medium: Number, low: Number }
  },
  { _id: false }
)

const parkSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    region: { type: String, trim: true },
    terrain: { type: String, trim: true },
    areaSqKm: Number,
    center: pointSchema,
    coveragePolicy: coveragePolicySchema
  },
  { timestamps: true }
)

module.exports = mongoose.models.Park || mongoose.model('Park', parkSchema)
