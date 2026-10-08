const { BusinessRuleError } = require('../../shared/errors/AppError')
const MAX_RECORDS = 5000
const DATE_BASIS = 'Event time: UC03 incidents use observedAt; conflicts use occurredAt (the conflict event-time field); patrols use startTime. Camera/collar and legacy unlinked alerts use createdAt because no separate event timestamp is stored.'

/** Read-only UC02 projections. No contact details, evidence blobs or source writes. */
function createAnalyticsRepository({ Alert, ConflictReport, PatrolRecord, WildlifeIncident }) {
  async function bounded(query) {
    const records = await query.limit(MAX_RECORDS + 1).exec()
    if (records.length > MAX_RECORDS) {
      throw new BusinessRuleError('Too many matching records. Select a shorter date range.', 'ANALYTICS_RANGE_TOO_LARGE')
    }
    return records
  }

  return {
    async speciesOptions(parkIds) {
      const values = await WildlifeIncident.distinct('species', { park: { $in: parkIds }, species: { $type: 'string', $ne: '' } })
      return values.sort().map((value) => ({ id: value, label: value }))
    },
    async retrieve({ parkId, from, until, incidentType, species }) {
      const period = { $gte: from, $lt: until }
      const [alerts, conflicts, patrolRecords] = await Promise.all([
        bounded(Alert.aggregate([
          { $match: { park: new Alert.base.Types.ObjectId(parkId), ...(species && { species }), ...(incidentType && { type: incidentType }) } },
          { $lookup: { from: WildlifeIncident.collection.name,
            let: { incidentId: { $convert: { input: '$sourceRef', to: 'objectId', onError: null, onNull: null } }, park: '$park', source: '$source' },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$incidentId'] }, { $eq: ['$park', '$$park'] }, { $eq: ['$$source', 'ranger-incident'] }] } } },
              { $project: { _id: 0, observedAt: 1 } }], as: 'incident' } },
          { $set: { eventAt: { $ifNull: [{ $arrayElemAt: ['$incident.observedAt', 0] }, '$createdAt'] } } },
          { $match: { eventAt: period } },
          { $project: { park: 1, zone: 1, type: 1, severity: 1, status: 1, title: 1, species: 1, location: 1,
            source: 1, sourceRef: 1, simulated: 1, createdAt: 1, updatedAt: 1, eventAt: 1 } },
          { $sort: { eventAt: 1, _id: 1 } },
        ])),
        species ? [] : bounded(ConflictReport.find({ park: parkId, occurredAt: period, ...(incidentType && { conflictType: incidentType }) })
          .select('reference park conflictType occurredAt village location status priority duplicateOf damage createdAt updatedAt').sort({ occurredAt: 1, _id: 1 }).lean()),
        // P-UC02-05 selects by start time; coverage still clips selected intervals.
        bounded(PatrolRecord.find({ park: parkId, startTime: period })
          .select('park zone team assignment startTime endTime route distanceKm syncStatus createdAt updatedAt').sort({ startTime: 1, _id: 1 }).lean())
      ])
      return { alerts, conflicts, patrolRecords }
    }
  }
}

module.exports = { createAnalyticsRepository, DATE_BASIS }
