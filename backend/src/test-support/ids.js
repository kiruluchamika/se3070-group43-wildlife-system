let counter = 0

/** Deterministic 24-character hexadecimal ids that pass ObjectId validation. */
function nextId() {
  counter += 1
  return counter.toString(16).padStart(24, '0')
}

module.exports = { nextId }
