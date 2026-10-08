function createReportRepository(Model) {
  // A park-assigned reader must have access to EVERY section, not just the first.
  const scope = (park) => park ? { park, parks: { $not: { $elemMatch: { $ne: park } } } } : {}
  return {
    create: async (data, session) => (session ? (await Model.create([data], { session }))[0] : await Model.create(data)).toObject(),
    findRequest: (author, requestId, session = null) => Model.findOne({ author, $or: [{ requestId }, { supersededRequestIds: requestId }] }).select('+contentHash').session(session).lean(),
    findOwned: (id, author, park, session = null) => Model.findOne({ _id: id, author, ...scope(park) }).select('+supersededRequestIds').session(session).lean(),
    removeDraft: (id, author, park, revision, session) => Model.deleteOne({
      _id: id, author, status: 'draft', ...scope(park),
      ...(revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision }),
    }, { session }),
    findShared: (id, recipient, park) => Model.findOne({ _id: id, status: 'finalized', sharedWith: recipient, ...scope(park) }).lean(),
    listShared: (recipient, park, page, status) => Model.find({ status: 'finalized', ...(status && { $and: [{ status }] }), sharedWith: recipient, ...scope(park) })
      .select('title status park parks createdAt finalizedAt snapshot.context snapshot.parks.context')
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(21).lean(),
    grantShare: (id, author, recipients, session) => Model.findOneAndUpdate(
      { _id: id, author, status: 'finalized' }, { $addToSet: { sharedWith: { $each: recipients } } },
      { session, returnDocument: 'before', timestamps: false }).lean(),
    updateDraft: (id, author, park, revision, fields) => Model.findOneAndUpdate({
      _id: id, author, status: 'draft', ...scope(park),
      ...(revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision }),
    }, { $set: fields, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true }).lean(),
    list: (author, park, page, status) => Model.find({ author, ...scope(park), ...(status && { status }) })
      .select('title status park parks createdAt finalizedAt snapshot.context snapshot.parks.context')
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(21).lean(),
  }
}
module.exports = { createReportRepository }
