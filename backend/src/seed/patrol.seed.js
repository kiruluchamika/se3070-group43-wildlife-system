/*
 * UC04 demonstration data: seven days of patrol records plus two active
 * assignments. Times are relative to "now", so "last patrolled 3 days ago"
 * stays true whenever the seed is run.
 *
 * Resulting Yala picture:
 *   North Sector  medium risk, critical alert, last patrol 26 h ago -> under-patrolled
 *   West Sector   medium risk, last patrol 50 h ago                  -> under-patrolled
 *   Central Zone  Team Bravo on patrol                               -> covered
 *   East Zone     high risk, snare alert, last patrol 74 h ago       -> under-patrolled
 *   South Sector  Team Delta on patrol                               -> covered
 */
const { polygonCentroid } = require('../shared/utils/geo')
const { HOUR } = require('./foundation.seed')

const RECORDS = [
  { park: 'YALA', team: 'ALPHA', zone: 'NORTH', endedHoursAgo: 26, durationHours: 3 },
  { park: 'YALA', team: 'ALPHA', zone: 'NORTH', endedHoursAgo: 100, durationHours: 3 },
  { park: 'YALA', team: 'DELTA', zone: 'WEST', endedHoursAgo: 50, durationHours: 4 },
  { park: 'YALA', team: 'BRAVO', zone: 'WEST', endedHoursAgo: 120, durationHours: 4 },
  { park: 'YALA', team: 'BRAVO', zone: 'CENTRAL', endedHoursAgo: 30, durationHours: 3 },
  { park: 'YALA', team: 'CHARLIE', zone: 'CENTRAL', endedHoursAgo: 70, durationHours: 2 },
  { park: 'YALA', team: 'CHARLIE', zone: 'EAST', endedHoursAgo: 74, durationHours: 3 },
  { park: 'YALA', team: 'ALPHA', zone: 'EAST', endedHoursAgo: 140, durationHours: 2 },
  { park: 'YALA', team: 'DELTA', zone: 'SOUTH', endedHoursAgo: 20, durationHours: 3 },
  { park: 'YALA', team: 'CHARLIE', zone: 'SOUTH', endedHoursAgo: 96, durationHours: 3 },
  { park: 'SINHARAJA', team: 'ECHO', zone: 'KUDAWA', endedHoursAgo: 30, durationHours: 5 },
  { park: 'SINHARAJA', team: 'ECHO', zone: 'KUDAWA', endedHoursAgo: 90, durationHours: 4 },
  { park: 'SINHARAJA', team: 'FOXTROT', zone: 'CORE', endedHoursAgo: 80, durationHours: 4 },
  { park: 'SINHARAJA', team: 'ECHO', zone: 'DENIYAYA', endedHoursAgo: 60, durationHours: 4 }
]

const ACTIVE_ASSIGNMENTS = [
  { park: 'YALA', team: 'BRAVO', zone: 'CENTRAL', startedHoursAgo: 3, notes: 'Routine sweep of the tourist tracks.' },
  { park: 'YALA', team: 'DELTA', zone: 'SOUTH', startedHoursAgo: 5, notes: 'Monitor collar EL-12 near the Palatupana road.' }
]

/** A short zig-zag route around the zone centre, so patrol lines appear on the map. */
function sampleRoute(boundary, seed) {
  const center = polygonCentroid(boundary)
  return Array.from({ length: 6 }, (_, index) => {
    const angle = seed + index * 1.1
    const radius = 0.012 + (index % 2) * 0.008
    return [+(center.lat + Math.sin(angle) * radius).toFixed(5), +(center.lng + Math.cos(angle) * radius).toFixed(5)]
  })
}

async function seedPatrolData({ models, now, foundation }) {
  const { PatrolRecord, PatrolAssignment, AllocationDecision, EmergencyDispatch } = models
  const { parks, zoneFor, teams, users } = foundation
  const manager = users.find((user) => user.email === 'manager@wildguard.lk')

  await Promise.all([PatrolRecord.deleteMany({}), PatrolAssignment.deleteMany({}), AllocationDecision.deleteMany({}), EmergencyDispatch.deleteMany({})])

  const records = await PatrolRecord.insertMany(
    RECORDS.map((record, index) => {
      const zone = zoneFor(record.park, record.zone)
      const endTime = new Date(now.getTime() - record.endedHoursAgo * HOUR)
      return {
        park: parks[record.park]._id,
        zone: zone._id,
        team: teams[record.team]._id,
        startTime: new Date(endTime.getTime() - record.durationHours * HOUR),
        endTime,
        route: sampleRoute(zone.boundary, index),
        distanceKm: record.durationHours * 3.2
      }
    })
  )

  const assignments = []
  for (const entry of ACTIVE_ASSIGNMENTS) {
    const zone = zoneFor(entry.park, entry.zone)
    const assignedAt = new Date(now.getTime() - entry.startedHoursAgo * HOUR)
    const team = teams[entry.team]
    const ranger = users.find((user) => String(user.team) === String(team._id))

    const assignment = await PatrolAssignment.create({
      park: parks[entry.park]._id,
      zone: zone._id,
      team: team._id,
      allocationType: 'allocation',
      priority: zone.riskLevel,
      notes: entry.notes,
      assignedBy: manager._id,
      assignedAt,
      acknowledgedBy: ranger?._id,
      acknowledgedAt: new Date(assignedAt.getTime() + 0.2 * HOUR)
    })
    await PatrolRecord.create({
      park: parks[entry.park]._id,
      zone: zone._id,
      team: team._id,
      assignment: assignment._id,
      startTime: assignedAt,
      route: sampleRoute(zone.boundary, 7)
    })
    await AllocationDecision.create({
      type: 'allocate',
      park: parks[entry.park]._id,
      zone: zone._id,
      team: team._id,
      assignment: assignment._id,
      decidedBy: manager._id,
      notes: entry.notes,
      createdAt: assignedAt,
      updatedAt: assignedAt
    })
    assignments.push(assignment)
  }

  return { records, assignments }
}

module.exports = { seedPatrolData }
