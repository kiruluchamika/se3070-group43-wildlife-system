const DUPLICATE_KEY = 11000
const LIST_FIELDS = '-payloadFingerprint'

function createIncidentRepository({ WildlifeIncident, IncidentPhoto }) {
  async function createOne(Model, data, session) {
    const [document] = await Model.create([data], { session: session ?? null })
    return document.toObject()
  }

  return {
    createIncident(data, { session } = {}) {
      return createOne(WildlifeIncident, data, session)
    },

    async createPhotos(incidentId, photos, { session } = {}) {
      if (!photos.length) return []
      const documents = await IncidentPhoto.create(
        photos.map((photo, order) => ({ incident: incidentId, order, ...photo })),
        { session: session ?? null }
      )
      return documents.map((document) => document.toObject())
    },

    findByClientId(clientId, { includeFingerprint = false, session } = {}) {
      let query = WildlifeIncident.findOne({ clientId }).session(session ?? null)
      if (includeFingerprint) query = query.select('+payloadFingerprint')
      return query.lean()
    },

    findById(id, { session } = {}) {
      return WildlifeIncident.findById(id).select(LIST_FIELDS).session(session ?? null).lean()
    },

    listByRanger(rangerId, { limit = 50 } = {}) {
      return WildlifeIncident.find({ ranger: rangerId })
        .select(LIST_FIELDS)
        .populate('park', 'name code')
        .populate('zone', 'name code')
        .sort({ observedAt: -1 })
        .limit(limit)
        .lean()
    },

    listPhotoMetadata(incidentId) {
      return IncidentPhoto.find({ incident: incidentId }).sort({ order: 1 }).lean()
    },

    setAlert(incidentId, alertId, { session } = {}) {
      return WildlifeIncident.findByIdAndUpdate(incidentId, { $set: { alert: alertId } }, { returnDocument: 'after', session }).lean()
    }
  }
}

module.exports = { createIncidentRepository, DUPLICATE_KEY }
