const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  park: { type: mongoose.Schema.Types.ObjectId, ref: 'Park', required: true, immutable: true },
  // Present only on comparison reports; park retains the first park for legacy compatibility.
  parks: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Park' }], default: undefined, immutable: true },
  requestId: { type: String, required: true, immutable: true },
  contentHash: { type: String, required: true, immutable: true, select: false },
  title: { type: String, required: true, maxlength: 200 },
  findings: { type: String, default: '', maxlength: 5000 },
  recommendations: { type: String, default: '', maxlength: 5000 },
  revision: { type: Number, default: 0, min: 0 },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['draft', 'finalized'], required: true, immutable: true },
  // Validated, bounded report snapshot; no source documents or arbitrary HTML.
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  finalizedAt: { type: Date, default: null, immutable: true },
}, { timestamps: true })
schema.index({ author: 1, requestId: 1 }, { unique: true })
schema.index({ author: 1, createdAt: -1, _id: -1 })
module.exports = mongoose.models.ConservationReport || mongoose.model('ConservationReport', schema)
