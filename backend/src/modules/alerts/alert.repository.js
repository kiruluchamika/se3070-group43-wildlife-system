/** Data access for operational alerts. */
function createAlertRepository(Alert) {
  return {
    listByPark(parkId, { statuses } = {}) {
      const filter = { park: parkId }
      if (statuses?.length) filter.status = { $in: statuses }
      return Alert.find(filter).populate('zone', 'name code riskLevel').sort({ createdAt: -1 }).lean()
    },

    findById(id, { session } = {}) {
      return Alert.findById(id).session(session ?? null).lean()
    },

    async create(data, { session } = {}) {
      const [alert] = await Alert.create([data], { session: session ?? null })
      return alert.toObject()
    },

    /** Applies `changes` only while the alert is in one of `fromStatuses`. */
    updateIfStatus(id, fromStatuses, changes, { session } = {}) {
      return Alert.findOneAndUpdate(
        { _id: id, status: { $in: fromStatuses } },
        { $set: changes },
        { returnDocument: 'after', session }
      ).lean()
    }
  }
}

module.exports = { createAlertRepository }
