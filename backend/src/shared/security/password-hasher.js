const bcrypt = require('bcryptjs')

/** Wraps bcrypt so services depend on an interface rather than the library. */
function createPasswordHasher({ rounds = 12 } = {}) {
  return {
    hash: (password) => bcrypt.hash(password, rounds),
    compare: (password, hash) => bcrypt.compare(password, hash)
  }
}

module.exports = { createPasswordHasher }
