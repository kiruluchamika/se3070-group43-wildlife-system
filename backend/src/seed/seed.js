require('dotenv').config({ quiet: true })

const mongoose = require('mongoose')
const { connectDatabase } = require('../config/database')
const { loadConfig } = require('../config/env')
const { loadModels } = require('../container')
const { createPasswordHasher } = require('../shared/security/password-hasher')
const { seedFoundation } = require('./foundation.seed')
const { seedPatrolData } = require('./patrol.seed')
const { seedConflictData } = require('./conflict.seed')
const { seedIncidentData } = require('./incident.seed')

/**
 * Resets the demonstration dataset in MONGODB_DB_NAME.
 * Usage: npm run seed   (add -- --force to run with NODE_ENV=production)
 */
async function main() {
  const config = loadConfig()
  if (config.isProduction && !process.argv.includes('--force')) {
    throw new Error('Refusing to reset demo data with NODE_ENV=production. Pass --force if you really mean it.')
  }

  await connectDatabase({ uri: config.mongoUri, dbName: config.mongoDbName })
  const models = loadModels()
  await Promise.all(Object.values(models).map((model) => model.init()))

  const now = new Date()
  const passwordHash = await createPasswordHasher().hash(config.demoPassword)
  const foundation = await seedFoundation({ models, passwordHash, now })
  const patrol = await seedPatrolData({ models, now, foundation })
  const conflicts = await seedConflictData({ models, now, foundation })
  const incidents = await seedIncidentData({ models, now, foundation })

  console.log(`Seeded database "${config.mongoDbName}":`)
  console.log(`  parks: ${Object.keys(foundation.parks).length}, teams: ${Object.keys(foundation.teams).length}`)
  console.log(`  users: ${foundation.users.length}, alerts: ${foundation.alerts.length}`)
  console.log(`  patrol records: ${patrol.records.length}, active assignments: ${patrol.assignments.length}`)
  console.log(`  conflict reports: ${conflicts.reports.length}, completed response tasks: ${conflicts.tasks.length}`)
  console.log(`  wildlife incidents: ${incidents.incidents.length}, incident photos: ${incidents.photos.length}`)
  console.log(`Demo accounts use the password from DEMO_PASSWORD (default: WildGuard@2026).`)
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
