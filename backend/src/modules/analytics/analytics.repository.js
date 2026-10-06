const { BusinessRuleError } = require('../../shared/errors/AppError')
const MAX_RECORDS = 5000

/** Read-only UC02 projections. No contact details, evidence blobs or source writes. */
function createAnalyticsRepository({ Alert, ConflictReport, PatrolRecord }) {
  async function bounded(query) {
    const records = await query.limit(MAX_RECORDS + 1).lean()
    if (records.length > MAX_RECORDS) {
      throw new BusinessRuleError('Too many matching records. Select a shorter date range.', 'ANALYTICS_RANGE_TOO_LARGE')
    }
    return records
  }

  return {
    async retrieve({ parkId, from, until, incidentType }) {
      const period = { $gte: from, $lt: until }
      const [alerts, conflicts, patrolRecords] = await Promise.all([
        bounded(Alert.find({ park: parkId, createdAt: period, ...(incidentType && { type: incidentType }) })
          .select('park zone type severity status title location source sourceRef simulated createdAt updatedAt').sort({ createdAt: 1, _id: 1 })),
        bounded(ConflictReport.find({ park: parkId, occurredAt: period, ...(incidentType && { conflictType: incidentType }) })
          .select('reference park conflictType occurredAt village location status priority duplicateOf damage createdAt updatedAt').sort({ occurredAt: 1, _id: 1 })),
        // Patrols are coverage context, unaffected by incident type; retain overlaps.
        bounded(PatrolRecord.find({ park: parkId, startTime: { $lt: until }, $or: [{ endTime: null }, { endTime: { $gt: from } }] })
          .select('park zone team assignment startTime endTime route distanceKm syncStatus createdAt updatedAt').sort({ startTime: 1, _id: 1 }))
      ])
      return { alerts, conflicts, patrolRecords }
    }
  }
}

module.exports = { createAnalyticsRepository }
