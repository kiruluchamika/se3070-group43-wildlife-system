import { MongoMemoryReplSet } from 'mongodb-memory-server'

let replSet

/**
 * Starts one in-memory MongoDB replica set for the whole test run. A replica
 * set is required because the repositories use multi-document transactions.
 */
export async function setup() {
  try {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    process.env.MONGO_TEST_URI = replSet.getUri()
  } catch (error) {
    console.warn(`In-memory MongoDB unavailable; repository tests will be skipped. ${error.message}`)
  }
}

export async function teardown() {
  await replSet?.stop()
}
