/** Data access for parks and their zones. */
function createParkRepository({ Park, Zone }) {
  return {
    listParks() {
      return Park.find().sort({ name: 1 }).lean()
    },

    findParkById(id, { session } = {}) {
      return Park.findById(id).session(session ?? null).lean()
    },

    listZones(parkId) {
      return Zone.find({ park: parkId }).sort({ name: 1 }).lean()
    },

    findZoneById(id, { session } = {}) {
      return Zone.findById(id).session(session ?? null).lean()
    },

    findZonesByIds(ids) {
      return Zone.find({ _id: { $in: ids } }).lean()
    }
  }
}

module.exports = { createParkRepository }
