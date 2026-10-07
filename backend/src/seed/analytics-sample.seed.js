const { createHash } = require('node:crypto')
const { createTransactionRunner } = require('../config/database')

const DAY = 86400000
const HOUR = 3600000
const PREFIX = 'UC02-SAMPLE-V1'
const sampleId = (parkId, key) => createHash('sha256').update(`${PREFIX}:${parkId}:${key}`).digest('hex').slice(0, 24)
const localDate = (date) => new Date(new Date(date).getTime() + 5.5 * HOUR).toISOString().slice(0, 10)

/** Additive development fixtures only. Existing documents, including samples, never change. */
async function seedAnalyticsSamples({ models, now = new Date(), transactionRunner = createTransactionRunner() }) {
  const profiles = [
    { code: 'YALA', zones: ['NORTH', 'EAST'] },
    { code: 'SINHARAJA', zones: ['KUDAWA', 'CORE'] },
  ]
  // Resolve both parks before any inserts; do not create accounts or permissions.
  for (const profile of profiles) {
    profile.park = await models.Park.findOne({ code: profile.code }).lean()
    if (!profile.park) throw new Error(`Requires the existing ${profile.code} park. No data was written.`)
    const zones = await models.Zone.countDocuments({ park: profile.park._id, code: { $in: profile.zones } })
    const ranger = await models.User.exists({ park: profile.park._id, role: 'ranger' })
    if (zones !== 2 || !ranger) throw new Error(`Requires ${profile.code} ${profile.zones.join('/')} zones and an existing ranger. No data was written.`)
  }
  // When extending an older Yala-only seed, align the second park to its stored dates.
  const anchor = await models.Alert.findById(sampleId(profiles[0].park._id, 'alert-0-0')).lean()
  const firstDay = anchor ? new Date(`${localDate(anchor.createdAt)}T00:00:00+05:30`)
    : new Date(new Date(`${localDate(now)}T00:00:00+05:30`).getTime() - 7 * DAY)
  const parks = await transactionRunner.run(async (session) => {
    const results = []
    for (const profile of profiles) results.push(await seedParkSamples({ models, now, firstDay, profile, session, transactionRunner: { run: (work) => work(session) } }))
    return results
  })
  return { parks, startDate: parks.map((park) => park.startDate).sort()[0], endDate: parks.map((park) => park.endDate).sort().at(-1) }
}

async function seedParkSamples({ models, now, firstDay, profile, session: readSession, transactionRunner }) {
  const { Zone, User, RangerTeam, Alert, WildlifeIncident, PatrolRecord } = models
  const park = profile.park
  const zones = await Zone.find({ park: park._id, code: { $in: profile.zones } }).lean()
  const ranger = await User.findOne({ park: park._id, role: 'ranger' }).sort({ _id: 1 }).lean()
  const zoneFor = (code) => zones.find((zone) => zone.code === code)
  const id = (key) => sampleId(park._id, key)
  const at = (day, hour = 8) => new Date(firstDay.getTime() + day * DAY + hour * HOUR)
  const scenarios = profile.code === 'YALA' ? [
    { zone: 'NORTH', species: 'sri lankan leopard', source: 'camera-trap', type: 'camera-trap', location: { lat: 6.515, lng: 81.445 }, days: [0, 1, 3, 5] },
    { zone: 'EAST', species: 'sri lankan elephant', source: 'gps-collar', type: 'elephant-movement', location: { lat: 6.44, lng: 81.52 }, days: [1, 2, 4, 6] },
  ] : [
    { zone: 'KUDAWA', species: 'purple-faced langur', source: 'camera-trap', type: 'camera-trap', location: { lat: 6.425, lng: 80.425 }, days: [0, 2, 4] },
    { zone: 'CORE', species: 'sri lankan leopard', source: 'camera-trap', type: 'camera-trap', location: { lat: 6.415, lng: 80.49 }, days: [1, 3, 6] },
  ]
  await transactionRunner.run(async (session) => {
    const insert = (Model, key, data) => Model.updateOne({ _id: id(key) }, {
      $setOnInsert: { ...data, createdAt: data.createdAt ?? now, updatedAt: data.createdAt ?? now },
    }, { upsert: true, runValidators: true, timestamps: false, session })
    await insert(RangerTeam, 'team', { park: park._id, code: PREFIX, name: '[SIMULATED SAMPLE] UC02 patrol team', status: 'off-duty', members: [] })
    for (const [index, scenario] of scenarios.entries()) {
      const zone = zoneFor(scenario.zone)
      const clientKey = createHash('sha256').update(`${PREFIX}:${park._id}:client-${index}`).digest('hex')
      const clientId = `${clientKey.slice(0, 8)}-${clientKey.slice(8, 12)}-4${clientKey.slice(13, 16)}-8${clientKey.slice(17, 20)}-${clientKey.slice(20, 32)}`
      // Explicitly labelled sample sightings supply the existing UC03 species options.
      // They do not raise additional alerts or double-count the sensor events.
      await insert(WildlifeIncident, `incident-${index}`, {
        clientId, payloadFingerprint: `${PREFIX}-fixture`,
        reference: `${PREFIX}${profile.code === 'YALA' ? '' : `-${profile.code}`}-${index + 1}`, ranger: ranger._id, park: park._id, zone: zone._id,
        type: 'wildlife-sighting', severity: 'low', species: scenario.species,
        description: `[SIMULATED SAMPLE] Development sighting of ${scenario.species}; not a real field observation.`,
        location: scenario.location, observedAt: at(0), deviceCreatedAt: at(0), receivedAt: at(0),
        recordedOffline: false, photoCount: 0, createdAt: at(0),
      })
      for (const [event, day] of scenario.days.entries()) {
        await insert(Alert, `alert-${index}-${event}`, {
          park: park._id, zone: zone._id, type: scenario.type, severity: 'low', status: 'resolved',
          title: `[SIMULATED SAMPLE] ${scenario.species} observation`,
          message: 'UC02 development fixture only. Simulated sensor event, not verified field evidence.',
          species: scenario.species, source: scenario.source, sourceRef: `${PREFIX}-${scenario.source}-${event + 1}`,
          simulated: true, location: scenario.location, createdAt: at(day), resolvedAt: at(day, 9),
        })
      }
      for (const day of [0, 2, 4]) {
        await insert(PatrolRecord, `patrol-${index}-${day}`, {
          park: park._id, zone: zone._id, team: id('team'), startTime: at(day, 9), endTime: at(day, 12 + index),
          route: [[scenario.location.lat, scenario.location.lng]], distanceKm: 5 + index,
          syncStatus: 'synced', createdAt: at(day, 12 + index),
        })
      }
    }
  })
  const alerts = await Alert.find({ _id: { $in: scenarios.flatMap((scenario, index) => scenario.days.map((_, event) => id(`alert-${index}-${event}`))) } }).sort({ createdAt: 1 }).session(readSession).lean()
  return { park: park.name, parkId: String(park._id), startDate: localDate(alerts[0].createdAt), endDate: localDate(alerts.at(-1).createdAt),
    alerts: alerts.length, incidents: 2, patrolRecords: 6, teamId: id('team'), species: scenarios.map((scenario) => scenario.species) }
}

async function main() {
  require('dotenv').config({ quiet: true })
  const mongoose = require('mongoose')
  const { loadConfig } = require('../config/env')
  const { connectDatabase } = require('../config/database')
  const { loadModels } = require('../container')
  const config = loadConfig()
  if (config.isProduction) throw new Error('Sample analytics data is development-only; production is not supported.')
  try {
    await connectDatabase({ uri: config.mongoUri, dbName: config.mongoDbName })
    const models = loadModels()
    await Promise.all(Object.values(models).map((model) => model.init()))
    const result = await seedAnalyticsSamples({ models })
    console.log(`Sample data ready in ${config.mongoDbName}:`, result)
    console.log('Analyze the printed park/date range with All incident types. Existing records and sample dates were preserved.')
  } finally { await mongoose.disconnect() }
}

if (require.main === module) main().catch((error) => { console.error('Sample seed failed:', error.message); process.exitCode = 1 })
module.exports = { seedAnalyticsSamples, sampleId, PREFIX }
