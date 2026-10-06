const { HOUR } = require('./foundation.seed')

/** UC03 demo reports linked to the ranger-originated alerts seeded by the foundation. */
async function seedIncidentData({ models, now, foundation }) {
  const { WildlifeIncident, IncidentPhoto, Alert } = models
  const { parks, zoneFor, users, alerts } = foundation
  await Promise.all([WildlifeIncident.deleteMany({}), IncidentPhoto.deleteMany({})])

  const ranger = users.find((user) => user.email === 'ranger@wildguard.lk')
  const snareAlert = alerts.find((alert) => alert.source === 'ranger-incident' && alert.type === 'snare')
  const observedAt = new Date(now.getTime() - 2.5 * HOUR)

  const snare = await WildlifeIncident.create({
    clientId: '10000000-0000-4000-8000-000000000001',
    payloadFingerprint: 'seed-snare-report',
    reference: 'INC-DEMO-0001',
    ranger: ranger._id,
    park: parks.YALA._id,
    zone: zoneFor('YALA', 'EAST')._id,
    type: 'snare',
    severity: 'high',
    description: 'Wire snare found beside the river crossing during the morning patrol.',
    location: { lat: 6.44, lng: 81.52, accuracyMeters: 10 },
    observedAt,
    deviceCreatedAt: observedAt,
    receivedAt: new Date(observedAt.getTime() + 8 * 60 * 1000),
    recordedOffline: true,
    alert: snareAlert?._id,
    photoCount: 0
  })

  if (snareAlert) await Alert.updateOne({ _id: snareAlert._id }, { $set: { sourceRef: String(snare._id) } })

  const sighting = await WildlifeIncident.create({
    clientId: '10000000-0000-4000-8000-000000000002',
    payloadFingerprint: 'seed-wildlife-sighting',
    reference: 'INC-DEMO-0002',
    ranger: ranger._id,
    park: parks.YALA._id,
    zone: zoneFor('YALA', 'CENTRAL')._id,
    type: 'wildlife-sighting',
    severity: 'low',
    description: 'A leopard crossed the central tourist track and moved east into scrub.',
    location: { lat: 6.425, lng: 81.41, accuracyMeters: 18 },
    observedAt: new Date(now.getTime() - 6 * HOUR),
    deviceCreatedAt: new Date(now.getTime() - 6 * HOUR),
    receivedAt: new Date(now.getTime() - 5.9 * HOUR),
    recordedOffline: false,
    photoCount: 0
  })

  return { incidents: [snare, sighting], photos: [] }
}

module.exports = { seedIncidentData }
