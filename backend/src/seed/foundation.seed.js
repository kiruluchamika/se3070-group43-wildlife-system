/*
 * Demonstration data shared by every module: parks, zones, ranger teams,
 * demo accounts and alerts. Zone boundaries are illustrative, not official
 * park boundaries. Collar and camera-trap alerts are simulated inputs.
 */
const { ROLES } = require('../shared/roles')

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

const DEMO_EMAIL_DOMAIN = '@wildguard.lk'

const PARKS = [
  {
    code: 'YALA',
    name: 'Yala National Park',
    region: 'Southern & Uva Provinces',
    terrain: 'Open grassland, scrub jungle and lagoons',
    areaSqKm: 979,
    center: { lat: 6.43, lng: 81.42 },
    coveragePolicy: { windowDays: 7, minCoveragePercent: 50, maxGapHours: { high: 24, medium: 48, low: 72 } }
  },
  {
    code: 'SINHARAJA',
    name: 'Sinharaja Forest Reserve',
    region: 'Sabaragamuwa & Southern Provinces',
    terrain: 'Dense tropical rainforest',
    areaSqKm: 88.6,
    center: { lat: 6.41, lng: 80.5 },
    // Dense forest slows foot patrols, so the park tolerates longer gaps.
    coveragePolicy: { windowDays: 7, minCoveragePercent: 40, maxGapHours: { high: 36, medium: 72, low: 120 } }
  }
]

const polygon = (points) => ({ type: 'Polygon', coordinates: [points] })

const ZONES = [
  {
    park: 'YALA',
    code: 'NORTH',
    name: 'North Sector',
    riskLevel: 'medium',
    targetWeeklyPatrolHours: 14,
    description: 'Northern waterholes and the Menik Ganga corridor.',
    boundary: polygon([[81.3, 6.47], [81.38, 6.47], [81.47, 6.475], [81.57, 6.49], [81.555, 6.545], [81.46, 6.565], [81.36, 6.555], [81.3, 6.52], [81.3, 6.47]])
  },
  {
    park: 'YALA',
    code: 'WEST',
    name: 'West Sector',
    riskLevel: 'medium',
    targetWeeklyPatrolHours: 14,
    description: 'Western boundary next to farmland and villages.',
    boundary: polygon([[81.26, 6.38], [81.34, 6.38], [81.34, 6.47], [81.3, 6.47], [81.26, 6.45], [81.26, 6.38]])
  },
  {
    park: 'YALA',
    code: 'CENTRAL',
    name: 'Central Zone',
    riskLevel: 'low',
    targetWeeklyPatrolHours: 7,
    description: 'Tourist tracks with frequent vehicle presence.',
    boundary: polygon([[81.34, 6.38], [81.44, 6.38], [81.46, 6.4], [81.47, 6.475], [81.38, 6.47], [81.34, 6.47], [81.34, 6.38]])
  },
  {
    park: 'YALA',
    code: 'EAST',
    name: 'East Zone',
    riskLevel: 'high',
    targetWeeklyPatrolHours: 21,
    description: 'Remote coastal scrub with a history of snaring.',
    boundary: polygon([[81.46, 6.4], [81.44, 6.38], [81.47, 6.35], [81.51, 6.37], [81.56, 6.41], [81.57, 6.49], [81.47, 6.475], [81.46, 6.4]])
  },
  {
    park: 'YALA',
    code: 'SOUTH',
    name: 'South Sector',
    riskLevel: 'low',
    targetWeeklyPatrolHours: 7,
    description: 'Coastal lagoons near the Palatupana entrance.',
    boundary: polygon([[81.28, 6.31], [81.4, 6.3], [81.47, 6.35], [81.44, 6.38], [81.34, 6.38], [81.26, 6.38], [81.28, 6.31]])
  },
  {
    park: 'SINHARAJA',
    code: 'KUDAWA',
    name: 'Kudawa Gate Sector',
    riskLevel: 'medium',
    targetWeeklyPatrolHours: 10,
    description: 'Northern entrance and research trails.',
    boundary: polygon([[80.4, 6.4], [80.45, 6.4], [80.45, 6.45], [80.4, 6.44], [80.4, 6.4]])
  },
  {
    park: 'SINHARAJA',
    code: 'CORE',
    name: 'Core Forest Block',
    riskLevel: 'high',
    targetWeeklyPatrolHours: 14,
    description: 'Undisturbed rainforest core; illegal logging risk.',
    boundary: polygon([[80.45, 6.38], [80.52, 6.38], [80.53, 6.44], [80.45, 6.45], [80.45, 6.38]])
  },
  {
    park: 'SINHARAJA',
    code: 'DENIYAYA',
    name: 'Deniyaya Sector',
    riskLevel: 'low',
    targetWeeklyPatrolHours: 6,
    description: 'Southern entrance bordering tea smallholdings.',
    boundary: polygon([[80.52, 6.38], [80.58, 6.37], [80.6, 6.42], [80.53, 6.44], [80.52, 6.38]])
  }
]

const TEAMS = [
  { park: 'YALA', code: 'ALPHA', name: 'Team Alpha', status: 'available', baseLocationName: 'Katagamuwa Base Camp', location: { lat: 6.455, lng: 81.315 } },
  { park: 'YALA', code: 'BRAVO', name: 'Team Bravo', status: 'on-patrol', baseLocationName: 'Central Zone', location: { lat: 6.425, lng: 81.4 } },
  { park: 'YALA', code: 'CHARLIE', name: 'Team Charlie', status: 'available', baseLocationName: 'Palatupana Outpost', location: { lat: 6.335, lng: 81.37 } },
  { park: 'YALA', code: 'DELTA', name: 'Team Delta', status: 'on-patrol', baseLocationName: 'South Sector', location: { lat: 6.33, lng: 81.42 } },
  { park: 'SINHARAJA', code: 'ECHO', name: 'Team Echo', status: 'available', baseLocationName: 'Kudawa Research Station', location: { lat: 6.43, lng: 80.42 } },
  { park: 'SINHARAJA', code: 'FOXTROT', name: 'Team Foxtrot', status: 'off-duty', baseLocationName: 'Deniyaya Entrance', location: { lat: 6.39, lng: 80.56 } }
]

const USERS = [
  { email: 'manager@wildguard.lk', name: 'Sampath Herath', role: ROLES.PARK_MANAGER, park: 'YALA', phone: '+94 77 100 2001' },
  { email: 'liaison@wildguard.lk', name: 'Dilani Gunasekara', role: ROLES.LIAISON_OFFICER, park: 'YALA', phone: '+94 77 100 2002' },
  { email: 'analyst@wildguard.lk', name: 'Tharushi Fernando', role: ROLES.DATA_ANALYST, phone: '+94 77 100 2003' },
  { email: 'villager@wildguard.lk', name: 'Sunil Bandara', role: ROLES.VILLAGER, phone: '+94 71 555 0101' },
  { email: 'ranger@wildguard.lk', name: 'Kasun Rathnayake', role: ROLES.RANGER, park: 'YALA', team: 'CHARLIE' },
  { email: 'nuwan.silva@wildguard.lk', name: 'Nuwan Silva', role: ROLES.RANGER, park: 'YALA', team: 'ALPHA' },
  { email: 'chaminda.perera@wildguard.lk', name: 'Chaminda Perera', role: ROLES.RANGER, park: 'YALA', team: 'ALPHA' },
  { email: 'isuru.weerasinghe@wildguard.lk', name: 'Isuru Weerasinghe', role: ROLES.RANGER, park: 'YALA', team: 'BRAVO' },
  { email: 'lahiru.jayawardena@wildguard.lk', name: 'Lahiru Jayawardena', role: ROLES.RANGER, park: 'YALA', team: 'BRAVO' },
  { email: 'dinesh.kumara@wildguard.lk', name: 'Dinesh Kumara', role: ROLES.RANGER, park: 'YALA', team: 'CHARLIE' },
  { email: 'pradeep.wijesinghe@wildguard.lk', name: 'Pradeep Wijesinghe', role: ROLES.RANGER, park: 'YALA', team: 'DELTA' },
  { email: 'ashan.karunaratne@wildguard.lk', name: 'Ashan Karunaratne', role: ROLES.RANGER, park: 'YALA', team: 'DELTA' },
  { email: 'malith.abeysekara@wildguard.lk', name: 'Malith Abeysekara', role: ROLES.RANGER, park: 'SINHARAJA', team: 'ECHO' },
  { email: 'roshan.ekanayake@wildguard.lk', name: 'Roshan Ekanayake', role: ROLES.RANGER, park: 'SINHARAJA', team: 'FOXTROT' }
]

const ALERTS = [
  {
    park: 'YALA',
    zone: 'NORTH',
    type: 'poaching',
    severity: 'critical',
    title: 'Possible Poaching Activity',
    message: 'Camera trap CT-07 captured two people carrying rifles near the northern waterhole.',
    location: { lat: 6.515, lng: 81.445 },
    source: 'camera-trap',
    sourceRef: 'CT-07',
    simulated: true,
    ageMinutes: 25
  },
  {
    park: 'YALA',
    zone: 'EAST',
    type: 'snare',
    severity: 'high',
    title: 'Snare Detected',
    message: 'Wire snare found beside the river crossing. Reported from the field by Team Delta.',
    location: { lat: 6.44, lng: 81.52 },
    source: 'ranger-incident',
    sourceRef: 'INC-2026-0047',
    ageMinutes: 135
  },
  {
    park: 'YALA',
    zone: 'SOUTH',
    type: 'elephant-movement',
    severity: 'medium',
    title: 'Elephant Movement',
    message: 'Collar EL-12 shows a tusker moving toward the Palatupana road.',
    location: { lat: 6.325, lng: 81.39 },
    source: 'gps-collar',
    sourceRef: 'EL-12',
    simulated: true,
    ageMinutes: 220
  },
  {
    park: 'SINHARAJA',
    zone: 'CORE',
    type: 'other',
    severity: 'medium',
    title: 'Illegal Logging Signs',
    message: 'Fresh stumps and drag marks reported along the Mulawella trail.',
    location: { lat: 6.415, lng: 80.49 },
    source: 'ranger-incident',
    sourceRef: 'INC-2026-0051',
    ageMinutes: 300
  }
]

const byCode = (documents) => Object.fromEntries(documents.map((document) => [document.code, document]))

/**
 * Resets the shared demo collections and recreates the demo accounts.
 * Accounts outside the demo email domain (for example registered villagers) are kept.
 */
async function seedFoundation({ models, passwordHash, now }) {
  const { User, Park, Zone, RangerTeam, Alert, Notification } = models

  await Promise.all([
    Park.deleteMany({}),
    Zone.deleteMany({}),
    RangerTeam.deleteMany({}),
    Alert.deleteMany({}),
    Notification.deleteMany({}),
    User.deleteMany({ email: { $regex: `${DEMO_EMAIL_DOMAIN.replace('.', '\\.')}$` } })
  ])

  const parks = byCode(await Park.insertMany(PARKS))

  const zoneDocuments = await Zone.insertMany(ZONES.map((zone) => ({ ...zone, park: parks[zone.park]._id })))
  const zones = Object.fromEntries(zoneDocuments.map((zone) => [`${zone.park}:${zone.code}`, zone]))
  const zoneFor = (parkCode, zoneCode) => zones[`${parks[parkCode]._id}:${zoneCode}`]

  const teams = byCode(
    await RangerTeam.insertMany(
      TEAMS.map(({ location, park, ...team }) => ({
        ...team,
        park: parks[park]._id,
        lastKnownLocation: { ...location, updatedAt: new Date(now.getTime() - 20 * MINUTE) }
      }))
    )
  )

  const users = await User.insertMany(
    USERS.map((user) => ({
      ...user,
      passwordHash,
      park: user.park ? parks[user.park]._id : undefined,
      team: user.team ? teams[user.team]._id : undefined
    }))
  )

  await Promise.all(
    Object.values(teams).map((team) =>
      RangerTeam.updateOne(
        { _id: team._id },
        { $set: { members: users.filter((user) => String(user.team) === String(team._id)).map((user) => user._id) } }
      )
    )
  )

  const alerts = await Alert.insertMany(
    ALERTS.map(({ ageMinutes, park, zone, ...alert }) => {
      const raisedAt = new Date(now.getTime() - ageMinutes * MINUTE)
      return { ...alert, park: parks[park]._id, zone: zoneFor(park, zone)._id, createdAt: raisedAt, updatedAt: raisedAt }
    })
  )

  return { parks, zoneFor, teams, users, alerts }
}

module.exports = { seedFoundation, DEMO_EMAIL_DOMAIN, MINUTE, HOUR }
