function createReportRepository(Model) {
  // A park-assigned reader must have access to EVERY section, not just the first.
  const scope = (park) => park ? { park, parks: { $not: { $elemMatch: { $ne: park } } } } : {}
  return {
    create: async (data) => (await Model.create(data)).toObject(),
    findRequest: (author, requestId) => Model.findOne({ author, requestId }).select('+contentHash').lean(),
    findOwned: (id, author, park) => Model.findOne({ _id: id, author, ...scope(park) }).lean(),
    findShared: (id, recipient, park) => Model.findOne({ _id: id, status: 'finalized', sharedWith: recipient, ...scope(park) }).lean(),
    listShared: (recipient, park, page) => Model.find({ status: 'finalized', sharedWith: recipient, ...scope(park) })
      .select('title status park parks createdAt finalizedAt snapshot.context snapshot.parks.context')
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(21).lean(),
    grantShare: (id, author, recipients, session) => Model.findOneAndUpdate(
      { _id: id, author, status: 'finalized' }, { $addToSet: { sharedWith: { $each: recipients } } },
      { session, returnDocument: 'before', timestamps: false }).lean(),
    updateDraft: (id, author, park, revision, fields) => Model.findOneAndUpdate({
      _id: id, author, status: 'draft', ...scope(park),
      ...(revision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision }),
    }, { $set: fields, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true }).lean(),
    list: (author, park, page) => Model.find({ author, ...scope(park) })
      .select('title status park parks createdAt finalizedAt snapshot.context snapshot.parks.context')
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(21).lean(),
  }
}
module.exports = { createReportRepository }
