require('dotenv').config({ quiet: true })

const { createApp } = require('./src/app')
const { createContainer } = require('./src/container')
const { connectDatabase, createTransactionRunner } = require('./src/config/database')
const { loadConfig } = require('./src/config/env')

async function startServer() {
  const config = loadConfig()
  const connection = await connectDatabase({ uri: config.mongoUri, dbName: config.mongoDbName })
  console.log(`Connected to MongoDB database "${config.mongoDbName}"`)

  const container = createContainer({ config, transactionRunner: createTransactionRunner(connection) })
  const app = createApp({ config, routes: container.routes })

  app.listen(config.port, () => {
    console.log(`Backend running at http://localhost:${config.port}`)
  })
}

startServer().catch((error) => {
  console.error('Unable to start backend:', error.message)
  process.exit(1)
})
