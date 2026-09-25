const { z } = require('zod')
const { objectId } = require('../../shared/validation')

const notes = z.string().trim().max(500, 'Notes must not exceed 500 characters.').optional()

const parkQuery = z.object({ parkId: objectId('Park id') })

const teamsQuery = z.object({
  parkId: objectId('Park id'),
  zoneId: objectId('Zone id').optional()
})

const allocateBody = z.object({
  zoneId: objectId('Zone'),
  teamId: objectId('Ranger team'),
  notes
})

const reassignBody = z.object({
  zoneId: objectId('Zone'),
  teamId: objectId('Ranger team'),
  reason: z
    .string({ error: 'A reason is required when reassigning a team.' })
    .trim()
    .min(5, 'Explain the reassignment in at least 5 characters.')
    .max(500, 'The reason must not exceed 500 characters.'),
  notes,
  override: z.boolean().optional()
})

const recommendationQuery = z.object({ alertId: objectId('Alert id') })

const dispatchBody = z.object({
  alertId: objectId('Alert'),
  teamId: objectId('Ranger team').optional(),
  notes
})

module.exports = { parkQuery, teamsQuery, allocateBody, reassignBody, recommendationQuery, dispatchBody }
