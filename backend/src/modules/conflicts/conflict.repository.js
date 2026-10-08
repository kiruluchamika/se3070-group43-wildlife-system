const mongoose = require('mongoose')
const { OPEN_TASK_STATUSES } = require('./conflict.constants')

const withSession = (session) => ({ session: session ?? null })
const DUPLICATE_KEY = 11000

/** Photo data URLs are large, so lists leave them out and only the detail view loads them. */
const LIST_PROJECTION = '-evidence.dataUrl -contactAttempts'
const TEAM_FIELDS = 'name code status baseLocationName lastKnownLocation members park'

/** Data access for conflict reports, response tasks and field actions. Returns plain objects. */
function createConflictRepository({ ConflictReport, ResponseTask, ResponseAction }) {
  async function createOne(Model, data, session) {
    const [document] = await Model.create([data], withSession(session))
    return document.toObject()
  }

  function populateReport(query) {
    return query
      .populate('park', 'name code')
      .populate('reporter', 'name email phone')
      .populate('validation.by', 'name')
      .populate('informationRequest.requestedBy', 'name')
      .populate('duplicateOf', 'reference status village occurredAt')
      .populate('linkedReports', 'reference status village occurredAt contactName')
      .populate('outcome.reviewedBy', 'name')
      .populate('escalation.by', 'name')
      .populate('history.by', 'name role')
      .populate('contactAttempts.recordedBy', 'name')
  }

  function populateTask(query) {
    return query
      .populate({ path: 'team', select: TEAM_FIELDS, populate: { path: 'members', select: 'name phone' } })
      .populate('report', 'reference conflictType village landmark location priority status description contactName contactPhone occurredAt immediateDanger park')
      .populate('proposedBy', 'name')
      .populate('approval.by', 'name')
      .populate('acknowledgedBy', 'name')
      .populate('completion.completedBy', 'name')
  }

  return {
    // Conflict reports
    createReport(data, { session } = {}) {
      return createOne(ConflictReport, data, session)
    },

    findReportById(id, { session, populate = false } = {}) {
      const query = ConflictReport.findById(id).session(session ?? null)
      return (populate ? populateReport(query) : query).lean()
    },

    listReports({ park, statuses, reporter, limit = 100 } = {}) {
      const filter = {}
      if (park) filter.park = park
      if (reporter) filter.reporter = reporter
      if (statuses?.length) filter.status = { $in: statuses }
      return ConflictReport.find(filter)
        .select(LIST_PROJECTION)
        .populate('park', 'name code')
        .populate('duplicateOf', 'reference')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
    },

    async countByStatus({ park } = {}) {
      // aggregate() does not cast strings to ObjectIds the way find() does.
      const match = park ? { park: new mongoose.Types.ObjectId(String(park)) } : {}
      const rows = await ConflictReport.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }])
      return Object.fromEntries(rows.map((row) => [row._id, row.count]))
    },

    /** Open reports in the park whose event time falls inside the window (A4 candidates). */
    listRecentOpenReports({ park, from, to, excludeStatuses, excludeId }) {
      return ConflictReport.find({
        _id: { $ne: excludeId },
        park,
        status: { $nin: excludeStatuses },
        occurredAt: { $gte: from, $lte: to }
      })
        .select(LIST_PROJECTION)
        .sort({ occurredAt: -1 })
        .lean()
    },

    /**
     * Applies `update` only while the report is still in one of `fromStatuses`.
     * Returns null when another request changed the report first.
     */
    updateReportIf(id, fromStatuses, update, { session } = {}) {
      return ConflictReport.findOneAndUpdate({ _id: id, status: { $in: fromStatuses } }, update, { returnDocument: 'after', runValidators: true, session }).lean()
    },

    /** Unconditional update for audit data (contact attempts) that does not change the status. */
    updateReport(id, update, { session } = {}) {
      return ConflictReport.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true, session }).lean()
    },

    // Response tasks
    createTask(data, { session } = {}) {
      return createOne(ResponseTask, data, session)
    },

    findTaskById(id, { session, populate = false } = {}) {
      const query = ResponseTask.findById(id).session(session ?? null)
      return (populate ? populateTask(query) : query).lean()
    },

    findOpenTaskByReport(reportId, { session } = {}) {
      return ResponseTask.findOne({ report: reportId, status: { $in: OPEN_TASK_STATUSES } })
        .session(session ?? null)
        .lean()
    },

    listTasksByReport(reportId) {
      return populateTask(ResponseTask.find({ report: reportId })).sort({ createdAt: -1 }).lean()
    },

    listTasks({ park, team, statuses, limit = 50 } = {}) {
      const filter = {}
      if (park) filter.park = park
      if (team) filter.team = team
      if (statuses?.length) filter.status = { $in: statuses }
      return populateTask(ResponseTask.find(filter)).sort({ createdAt: -1 }).limit(limit).lean()
    },

    /** Changes a task only while it is still in one of `fromStatuses`; null if it was changed first. */
    updateTaskIf(id, fromStatuses, update, { session } = {}) {
      return ResponseTask.findOneAndUpdate({ _id: id, status: { $in: fromStatuses } }, update, { returnDocument: 'after', runValidators: true, session }).lean()
    },

    // Field actions
    /** Returns `{ action, created }`; a repeated clientUpdateId returns the stored action instead of a copy. */
    async createAction(data) {
      try {
        return { action: await createOne(ResponseAction, data), created: true }
      } catch (error) {
        if (error?.code !== DUPLICATE_KEY) throw error
        return { action: await ResponseAction.findOne({ clientUpdateId: data.clientUpdateId }).lean(), created: false }
      }
    },

    findActionByClientId(clientUpdateId) {
      return ResponseAction.findOne({ clientUpdateId }).lean()
    },

    listActionsByTasks(taskIds) {
      return ResponseAction.find({ task: { $in: taskIds } })
        .populate('recordedBy', 'name')
        .sort({ recordedAt: 1 })
        .lean()
    }
  }
}

module.exports = { createConflictRepository, DUPLICATE_KEY }
