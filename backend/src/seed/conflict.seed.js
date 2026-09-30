/*
 * UC01 demonstration data: Yala conflict reports in the states needed to show
 * every flow. Villages are real places near Yala; coordinates are approximate.
 *
 *   Needs validation     Kataragama crop damage, plus a Detagamuwa sighting
 *                        from the same event (duplicate candidate, A4)
 *   Needs information    Weerawila report with no landmark (A3)
 *   Pending information  Tissamaharama property damage; SMS contact failed (E2)
 *   Ready to deploy      Validated high-priority Kirinda report (approval route)
 *   Awaiting review      Completed response where the elephant was not located (A6)
 *   Resolved             Closed report with a full history
 */
const { HOUR, MINUTE } = require('./foundation.seed')

const VILLAGER_EMAIL = 'villager@wildguard.lk'
const OFFICER_EMAIL = 'liaison@wildguard.lk'

function reportsFor({ now, park, villager, officer }) {
  const ago = (minutes) => new Date(now.getTime() - minutes * MINUTE)
  const entry = (minutes, action, fromStatus, toStatus, by, note) => ({ at: ago(minutes), by, action, fromStatus, toStatus, note })
  const contact = { contactName: villager.name, contactPhone: villager.phone, reporter: villager._id, park: park._id }

  return [
    {
      ...contact,
      reference: 'HEC-DEMO-KTG01',
      conflictType: 'crop-damage',
      village: 'Kataragama',
      landmark: 'Paddy fields behind the Kiri Vehera road',
      location: { lat: 6.4139, lng: 81.3336, accuracyMeters: 15 },
      occurredAt: ago(70),
      description: 'A lone tusker broke through the electric fence and is eating the paddy. About one acre is damaged.',
      damage: { cropType: 'Paddy', affectedAreaAcres: 1, estimatedLossLkr: 85000 },
      status: 'submitted',
      suggestedPriority: 'high',
      history: [entry(65, 'submitted', undefined, 'submitted', villager._id)]
    },
    {
      ...contact,
      reference: 'HEC-DEMO-DTG02',
      conflictType: 'elephant-sighting',
      village: 'Detagamuwa',
      landmark: 'Near the Kataragama paddy fields',
      location: { lat: 6.4152, lng: 81.3301 },
      occurredAt: ago(55),
      description: 'A big tusker is walking along the fence line towards the paddy fields.',
      status: 'submitted',
      suggestedPriority: 'medium',
      history: [entry(50, 'submitted', undefined, 'submitted', villager._id)]
    },
    {
      ...contact,
      reference: 'HEC-DEMO-WRW03',
      conflictType: 'elephant-sighting',
      village: 'Weerawila',
      occurredAt: ago(40),
      description: 'Elephants heard trumpeting near the village at night.',
      status: 'submitted',
      locationAdequate: false,
      suggestedPriority: 'medium',
      history: [entry(38, 'submitted', undefined, 'submitted', villager._id)]
    },
    {
      ...contact,
      reference: 'HEC-DEMO-TSM04',
      conflictType: 'property-damage',
      village: 'Tissamaharama',
      landmark: 'Shop',
      occurredAt: ago(300),
      description: 'An elephant damaged the wall of a storehouse last night.',
      damage: { propertyType: 'Storehouse', estimatedLossLkr: 120000 },
      status: 'pending-information',
      locationAdequate: false,
      suggestedPriority: 'high',
      informationRequest: { message: 'Which shop is it near? Please share a landmark or your GPS location.', requestedBy: officer._id, requestedAt: ago(240) },
      contactStatus: 'failed',
      contactAttempts: [
        { at: ago(240), purpose: 'information-request', channel: 'in-app', status: 'failed', detail: 'Notification service unavailable' },
        { at: ago(240), purpose: 'information-request', channel: 'sms', status: 'failed', detail: 'The SMS gateway is unavailable.' }
      ],
      history: [
        entry(295, 'submitted', undefined, 'submitted', villager._id),
        entry(240, 'information-requested', 'submitted', 'pending-information', officer._id, 'Which shop is it near?')
      ]
    },
    {
      ...contact,
      reference: 'HEC-DEMO-KRD05',
      conflictType: 'property-damage',
      village: 'Kirinda',
      landmark: 'Fisheries harbour road',
      location: { lat: 6.2156, lng: 81.3281 },
      occurredAt: ago(180),
      description: 'Two elephants pushed down a boundary wall and are still in the home gardens.',
      damage: { propertyType: 'Boundary wall', estimatedLossLkr: 60000 },
      status: 'validated',
      suggestedPriority: 'high',
      priority: 'high',
      validation: { decision: 'valid', notes: 'Confirmed by phone with the Grama Niladhari.', by: officer._id, at: ago(150) },
      history: [
        entry(175, 'submitted', undefined, 'submitted', villager._id),
        entry(150, 'validated', 'submitted', 'validated', officer._id, 'Priority high — Confirmed by phone with the Grama Niladhari.')
      ]
    },
    {
      ...contact,
      reference: 'HEC-DEMO-YDP06',
      conflictType: 'crop-damage',
      village: 'Yodakandiya',
      landmark: 'Banana plantation near the tank',
      location: { lat: 6.3, lng: 81.29 },
      occurredAt: ago(26 * 60),
      description: 'Elephants destroyed part of the banana plantation.',
      damage: { cropType: 'Banana', affectedAreaAcres: 0.5 },
      status: 'response-completed',
      suggestedPriority: 'medium',
      priority: 'medium',
      validation: { decision: 'valid', by: officer._id, at: ago(25 * 60) },
      history: [
        entry(26 * 60, 'submitted', undefined, 'submitted', villager._id),
        entry(25 * 60, 'validated', 'submitted', 'validated', officer._id, 'Priority medium'),
        entry(24 * 60, 'team-assigned', 'validated', 'response-assigned', officer._id, 'Team Alpha'),
        entry(20 * 60, 'response-completed', 'response-assigned', 'response-completed', undefined, 'elephant not located — Tracks lead back into the park')
      ],
      demoTask: { team: 'ALPHA', outcome: 'elephant-not-located', notes: 'Tracks lead back into the park.', assignedMinutesAgo: 24 * 60, completedMinutesAgo: 20 * 60 }
    },
    {
      ...contact,
      reference: 'HEC-DEMO-KTG07',
      conflictType: 'elephant-sighting',
      village: 'Kataragama',
      landmark: 'Menik Ganga bathing area',
      location: { lat: 6.42, lng: 81.34 },
      occurredAt: ago(5 * 24 * 60),
      description: 'Elephant near the river bathing area in the evening.',
      status: 'resolved',
      suggestedPriority: 'medium',
      priority: 'medium',
      outcome: { result: 'resolved', fieldOutcome: 'elephant-driven-away', notes: 'Elephant returned to the park.', reviewedBy: officer._id, reviewedAt: ago(4 * 24 * 60) },
      history: [
        entry(5 * 24 * 60, 'submitted', undefined, 'submitted', villager._id),
        entry(5 * 24 * 60 - 20, 'validated', 'submitted', 'validated', officer._id, 'Priority medium'),
        entry(5 * 24 * 60 - 30, 'team-assigned', 'validated', 'response-assigned', officer._id, 'Team Charlie'),
        entry(5 * 24 * 60 - 120, 'response-completed', 'response-assigned', 'response-completed', undefined, 'elephant driven away'),
        entry(4 * 24 * 60, 'reviewed-resolved', 'response-completed', 'resolved', officer._id, 'Elephant returned to the park.')
      ],
      demoTask: { team: 'CHARLIE', outcome: 'elephant-driven-away', notes: 'Used thunder flashes.', assignedMinutesAgo: 5 * 24 * 60 - 30, completedMinutesAgo: 5 * 24 * 60 - 120 }
    }
  ]
}

/** Resets the UC01 collections and creates the demonstration reports and their completed tasks. */
async function seedConflictData({ models, now, foundation }) {
  const { ConflictReport, ResponseTask, ResponseAction } = models
  await Promise.all([ConflictReport.deleteMany({}), ResponseTask.deleteMany({}), ResponseAction.deleteMany({})])

  const villager = foundation.users.find((user) => user.email === VILLAGER_EMAIL)
  const officer = foundation.users.find((user) => user.email === OFFICER_EMAIL)
  const park = foundation.parks.YALA
  const rangersOf = (teamCode) => foundation.users.filter((user) => String(user.team) === String(foundation.teams[teamCode]._id))

  const reports = []
  const tasks = []
  for (const { demoTask, ...data } of reportsFor({ now, park, villager, officer })) {
    const report = await ConflictReport.create({ ...data, createdAt: data.history[0].at })
    reports.push(report)
    if (!demoTask) continue

    const ranger = rangersOf(demoTask.team)[0]
    const assignedAt = new Date(now.getTime() - demoTask.assignedMinutesAgo * MINUTE)
    const completedAt = new Date(now.getTime() - demoTask.completedMinutesAgo * MINUTE)
    const task = await ResponseTask.create({
      report: report._id,
      park: park._id,
      team: foundation.teams[demoTask.team]._id,
      status: 'completed',
      priority: report.priority,
      proposedBy: officer._id,
      assignedAt,
      acknowledgedBy: ranger._id,
      acknowledgedAt: new Date(assignedAt.getTime() + 5 * MINUTE),
      completion: { outcome: demoTask.outcome, notes: demoTask.notes, completedBy: ranger._id, completedAt, syncedAt: completedAt, clientUpdateId: `seed-${report.reference}` }
    })
    await ResponseAction.create([
      { task: task._id, report: report._id, clientUpdateId: `seed-${report.reference}-1`, type: 'arrived-on-site', recordedBy: ranger._id, recordedAt: new Date(assignedAt.getTime() + HOUR) },
      { task: task._id, report: report._id, clientUpdateId: `seed-${report.reference}-2`, type: 'drive-away', note: demoTask.notes, recordedBy: ranger._id, recordedAt: completedAt }
    ])
    tasks.push(task)
  }

  return { reports, tasks }
}

module.exports = { seedConflictData }
