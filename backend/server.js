require('dotenv').config()

const cors = require('cors')
const express = require('express')
const mongoose = require('mongoose')
const authRoutes = require('./src/routes/auth.routes')

const app = express()
const port = process.env.PORT || 5000

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok', message: 'Wildlife backend is running' })
})

app.use('/api/auth', authRoutes)

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI is not configured. Auth requests will be unavailable.')
  } else {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')
  }

  app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`)
  })
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start backend:', error.message)
    process.exit(1)
  })
}

module.exports = app
