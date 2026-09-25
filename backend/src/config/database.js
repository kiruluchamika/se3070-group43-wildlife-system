const mongoose = require('mongoose')

/** Opens the shared Mongoose connection against the configured Atlas database. */
async function connectDatabase({ uri, dbName }) {
  if (!uri) throw new Error('MONGODB_URI is not configured. Copy backend/.env.example to backend/.env.')
  await mongoose.connect(uri, { dbName })
  return mongoose.connection
}

/**
 * Unit of work: every write inside `run` shares one MongoDB session, so the
 * whole operation either commits or rolls back (UC04 exception flow E3).
 */
function createTransactionRunner(connection = mongoose.connection) {
  return {
    async run(work) {
      const session = await connection.startSession()
      try {
        let result
        await session.withTransaction(async () => {
          result = await work(session)
        })
        return result
      } finally {
        await session.endSession()
      }
    }
  }
}

module.exports = { connectDatabase, createTransactionRunner }
