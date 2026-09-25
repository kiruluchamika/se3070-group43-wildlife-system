const MEMBER_FIELDS = 'name email phone'

/** Data access for ranger teams. */
function createTeamRepository(RangerTeam) {
  return {
    listByPark(parkId) {
      return RangerTeam.find({ park: parkId }).populate('members', MEMBER_FIELDS).sort({ name: 1 }).lean()
    },

    findById(id, { session } = {}) {
      return RangerTeam.findById(id).session(session ?? null).lean()
    },

    findByMember(userId) {
      return RangerTeam.findOne({ members: userId }).populate('members', MEMBER_FIELDS).lean()
    },

    /**
     * Changes the status only while the team is still in one of `fromStatuses`.
     * Returns null when another request changed the team first, which lets
     * callers detect a concurrent allocation instead of overwriting it.
     */
    updateStatusIf(teamId, fromStatuses, status, { session } = {}) {
      return RangerTeam.findOneAndUpdate(
        { _id: teamId, status: { $in: fromStatuses } },
        { $set: { status } },
        { returnDocument: 'after', session }
      ).lean()
    },

    setStatus(teamId, status, { session } = {}) {
      return RangerTeam.findByIdAndUpdate(teamId, { $set: { status } }, { returnDocument: 'after', session }).lean()
    }
  }
}

module.exports = { createTeamRepository }
