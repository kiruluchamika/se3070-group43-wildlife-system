require('dotenv').config({ quiet: true })
const mongoose = require('mongoose')
const { loadConfig } = require('../../config/env')
const { connectDatabase } = require('../../config/database')
const User = require('./user.model')

/** One-time operator action: promote an existing account, never set a password. */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) throw new Error('Usage: npm run user:admin -- existing-account@example.com')
  const config = loadConfig()
  try {
    await connectDatabase({ uri: config.mongoUri, dbName: config.mongoDbName })
    const user = await User.findOne({ email })
    if (!user || user.isActive === false) throw new Error('An existing active account is required.')
    if (user.role === 'administrator') { console.log('This account is already an administrator.'); return }
    if (await User.exists({ role: 'administrator', isActive: { $ne: false } })) throw new Error('An administrator already exists. Use User Management instead.')
    if (user.team) throw new Error('Use an account without a ranger-team assignment.')
    await User.updateOne({ _id: user._id }, { $set: { role: 'administrator' }, $inc: { sessionVersion: 1 } })
    console.log('Administrator provisioned. Sign in with the existing account password.')
  } finally { await mongoose.disconnect() }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
