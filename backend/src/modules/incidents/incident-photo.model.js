const mongoose = require('mongoose')

const incidentPhotoSchema = new mongoose.Schema(
  {
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'WildlifeIncident', required: true, index: true },
    caption: { type: String, trim: true, maxlength: 120 },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    sizeBytes: { type: Number, min: 1, required: true },
    order: { type: Number, min: 0, max: 2, required: true },
    // Kept out of normal queries so report lists and details stay lightweight.
    dataUrl: { type: String, required: true, select: false }
  },
  { timestamps: true }
)

incidentPhotoSchema.index({ incident: 1, order: 1 }, { unique: true })

module.exports = mongoose.models.IncidentPhoto || mongoose.model('IncidentPhoto', incidentPhotoSchema)
