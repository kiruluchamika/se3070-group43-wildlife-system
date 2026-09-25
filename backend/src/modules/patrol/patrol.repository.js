const ZONE_FIELDS = 'name code riskLevel boundary'
const TEAM_FIELDS = 'name code status baseLocationName lastKnownLocation members'

const withSession = (session) => ({ session: session ?? null })

/** Data access for patrol records, assignments, allocation decisions and emergency dispatches. */
function createPatrolRepository({ PatrolRecord, PatrolAssignment, AllocationDecision, EmergencyDispatch }) {
  async function createOne(Model, data, session) {
    const [document] = await Model.create([data], withSession(session))
    return document.toObject()
  }

  return {
    // Patrol records
    listRecordsSince(parkId, since) {
      return PatrolRecord.find({ park: parkId, $or: [{ endTime: null }, { endTime: { $gte: since } }] })
        .sort({ startTime: -1 })
        .lean()
    },

    createRecord(data, { session } = {}) {
      return createOne(PatrolRecord, data, session)
    },

    // Patrol assignments
    listActiveAssignments(parkId, { session } = {}) {
      return PatrolAssignment.find({ park: parkId, status: 'active' })
        .populate('zone', ZONE_FIELDS)
        .populate('team', TEAM_FIELDS)
        .populate('alert', 'title severity status')
        .populate('assignedBy', 'name')
        .session(session ?? null)
        .sort({ assignedAt: -1 })
        .lean()
    },

    findAssignmentById(id, { session } = {}) {
      return PatrolAssignment.findById(id).session(session ?? null).lean()
    },

    findActiveAssignmentByTeam(teamId, { session, populate = false } = {}) {
      const query = PatrolAssignment.findOne({ team: teamId, status: 'active' }).session(session ?? null)
      if (populate) {
        query
          .populate('zone', `${ZONE_FIELDS} description`)
          .populate('alert', 'title message severity status location type')
          .populate('assignedBy', 'name')
          .populate('previousAssignment', 'zone')
      }
      return query.lean()
    },

    createAssignment(data, { session } = {}) {
      return createOne(PatrolAssignment, data, session)
    },

    /** Ends an assignment only while it is still active; returns null if another request ended it first. */
    closeAssignment(id, changes, { session } = {}) {
      return PatrolAssignment.findOneAndUpdate(
        { _id: id, status: 'active' },
        { $set: changes },
        { returnDocument: 'after', session }
      ).lean()
    },

    acknowledgeAssignment(id, userId, acknowledgedAt) {
      return PatrolAssignment.findOneAndUpdate(
        { _id: id, status: 'active', acknowledgedAt: null },
        { $set: { acknowledgedBy: userId, acknowledgedAt } },
        { returnDocument: 'after' }
      ).lean()
    },

    // Allocation decisions (audit trail)
    recordDecision(data, { session } = {}) {
      return createOne(AllocationDecision, data, session)
    },

    listDecisions(parkId, { limit = 50 } = {}) {
      return AllocationDecision.find({ park: parkId })
        .populate('zone', 'name code riskLevel')
        .populate('fromZone', 'name code')
        .populate('team', 'name code')
        .populate('decidedBy', 'name')
        .populate('alert', 'title severity')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
    },

    // Emergency dispatches
    createDispatch(data, { session } = {}) {
      return createOne(EmergencyDispatch, data, session)
    }
  }
}

module.exports = { createPatrolRepository }
