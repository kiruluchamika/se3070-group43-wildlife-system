/**
 * Converts lean MongoDB documents into API-friendly JSON: `_id` becomes `id`,
 * ObjectIds become strings, and the internal `__v` field is dropped.
 */
function serialize(value) {
  if (Array.isArray(value)) return value.map(serialize)
  if (value instanceof Date) return value
  if (value?._bsontype === 'ObjectId') return value.toString()

  if (value && typeof value === 'object') {
    const result = {}
    for (const [key, entry] of Object.entries(value)) {
      if (key === '__v') continue
      result[key === '_id' ? 'id' : key] = serialize(entry)
    }
    return result
  }

  return value
}

/** Returns the string form of an id, a populated document, or an ObjectId. */
function toId(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && value._id !== undefined) return String(value._id)
  return String(value)
}

module.exports = { serialize, toId }
