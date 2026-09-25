const mongoose = require('mongoose')
const { loadModels } = require('../container')

const hasTestDatabase = Boolean(process.env.MONGO_TEST_URI)

/**
 * Connects this test file to its own database on the shared in-memory replica
 * set started by global-setup.mjs, and creates the model indexes.
 */
async function connectTestDatabase(name) {
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName: `wildguard-test-${name}` })
  const models = loadModels()
  await Promise.all(Object.values(models).map((model) => model.init()))

  return {
    models,
    connection: mongoose.connection,
    async clear() {
      await Promise.all(Object.values(models).map((model) => model.deleteMany({})))
    },
    async disconnect() {
      await mongoose.connection.dropDatabase()
      await mongoose.disconnect()
    }
  }
}

module.exports = { connectTestDatabase, hasTestDatabase }
