const { z } = require('zod')
const { objectId } = require('../../shared/validation')
const { QUEUE_VIEWS } = require('./conflict.rules')
const {
  ALTERNATIVE_CONTACT_METHODS,
  CONFLICT_TYPES,
  DAMAGE_TYPES,
  FIELD_ACTION_TYPES,
  FIELD_OUTCOMES,
  PRIORITIES,
  REVIEW_RESULTS
} = require('./conflict.constants')

const MAX_PHOTOS = 3
/** About 220 KB of JPEG once base64-encoded, so three photos fit the API's 1 MB body limit. The browser resizes photos first. */
const MAX_PHOTO_CHARS = 300_000

const text = (label, max, min = 1) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min > 1 ? `${label} must contain at least ${min} characters.` : `${label} is required.`)
    .max(max, `${label} must not exceed ${max} characters.`)

const optionalText = (label, max) => z.string().trim().max(max, `${label} must not exceed ${max} characters.`).optional()

const location = z.object({
  lat: z.number({ error: 'Latitude must be a number.' }).min(-90).max(90),
  lng: z.number({ error: 'Longitude must be a number.' }).min(-180).max(180),
  accuracyMeters: z.number().min(0).optional()
})

const isoDate = (label) => z.coerce.date({ error: `${label} must be a valid date and time.` })

const photo = z.object({
  caption: optionalText('Photo caption', 120),
  dataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/, 'Photos must be JPEG, PNG or WebP images.')
    .max(MAX_PHOTO_CHARS, 'Each photo must be smaller than about 220 KB.')
})

const damage = z.object({
  cropType: optionalText('Crop type', 60),
  affectedAreaAcres: z.number().min(0, 'Affected area cannot be negative.').max(10000).optional(),
  propertyType: optionalText('Property type', 60),
  estimatedLossLkr: z.number().min(0, 'Estimated loss cannot be negative.').optional(),
  notes: optionalText('Damage notes', 300)
})

const phone = z
  .string({ error: 'A contact phone number is required.' })
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number.')

const submitBody = z
  .object({
    parkId: objectId('Park'),
    conflictType: z.enum(CONFLICT_TYPES, { error: 'Choose the type of conflict.' }),
    village: text('Village', 80, 2),
    landmark: optionalText('Landmark', 120),
    occurredAt: isoDate('Time of the incident'),
    description: text('Description', 1000, 10),
    contactName: text('Contact name', 80, 2),
    contactPhone: phone,
    location: location.optional(),
    immediateDanger: z.boolean().optional(),
    damage: damage.optional(),
    evidence: z.array(photo).max(MAX_PHOTOS, `Attach at most ${MAX_PHOTOS} photos.`).optional()
  })
  .superRefine((body, context) => {
    // A1: damage reports must describe what was damaged.
    if (!DAMAGE_TYPES.includes(body.conflictType)) return
    if (body.conflictType === 'crop-damage' && (!body.damage?.cropType || body.damage.affectedAreaAcres === undefined)) {
      context.addIssue({ code: 'custom', path: ['damage', 'cropType'], message: 'Crop damage reports need the crop type and the affected area.' })
    }
    if (body.conflictType === 'property-damage' && !body.damage?.propertyType) {
      context.addIssue({ code: 'custom', path: ['damage', 'propertyType'], message: 'Property damage reports need the type of property damaged.' })
    }
  })

const informationBody = z.object({
  response: text('Your reply', 1000, 5),
  landmark: optionalText('Landmark', 120),
  location: location.optional()
})

const queueQuery = z.object({
  parkId: objectId('Park id').optional(),
  view: z.enum(Object.keys(QUEUE_VIEWS)).optional()
})

const validationBody = z
  .object({
    decision: z.enum(['valid', 'invalid'], { error: 'Choose whether the report is valid.' }),
    priority: z.enum(PRIORITIES).optional(),
    notes: optionalText('Notes', 500)
  })
  .superRefine((body, context) => {
    if (body.decision === 'valid' && !body.priority) {
      context.addIssue({ code: 'custom', path: ['priority'], message: 'Set a priority for a valid report.' })
    }
    if (body.decision === 'invalid' && !body.notes) {
      context.addIssue({ code: 'custom', path: ['notes'], message: 'Explain why the report is invalid; the villager is told the reason.' })
    }
  })

const informationRequestBody = z.object({ message: text('Your question', 500, 5) })

const duplicateBody = z.object({ primaryReportId: objectId('Primary report'), notes: optionalText('Notes', 500) })

const deploymentBody = z.object({
  teamId: objectId('Ranger team'),
  instructions: optionalText('Instructions', 500),
  additionalResources: z.boolean().optional()
})

const escalationBody = z.object({ reason: text('Reason', 500, 5) })

const reviewBody = z
  .object({
    result: z.enum(Object.values(REVIEW_RESULTS), { error: 'Choose the outcome of the response.' }),
    notes: optionalText('Notes', 1000),
    followUpAt: isoDate('Follow-up time').optional()
  })
  .superRefine((body, context) => {
    if (body.result === REVIEW_RESULTS.MONITORING && !body.followUpAt) {
      context.addIssue({ code: 'custom', path: ['followUpAt'], message: 'Schedule when the area will be checked again.' })
    }
    if (body.result === REVIEW_RESULTS.ESCALATED && (body.notes ?? '').length < 5) {
      context.addIssue({ code: 'custom', path: ['notes'], message: 'Explain why the response is being escalated.' })
    }
  })

const alternativeContactBody = z.object({
  method: z.enum(ALTERNATIVE_CONTACT_METHODS, { error: 'Choose how the community was contacted.' }),
  contactedPerson: optionalText('Person contacted', 80),
  notes: text('Notes', 300, 3)
})

const approvalQuery = z.object({ parkId: objectId('Park id').optional() })

const approvalBody = z
  .object({
    decision: z.enum(['approve', 'reject'], { error: 'Choose approve or reject.' }),
    teamId: objectId('Ranger team').optional(),
    notes: optionalText('Notes', 500)
  })
  .superRefine((body, context) => {
    if (body.decision === 'reject' && (body.notes ?? '').length < 5) {
      context.addIssue({ code: 'custom', path: ['notes'], message: 'Give the officer a reason for rejecting the deployment.' })
    }
  })

const clientUpdateId = z
  .string({ error: 'An update id is required.' })
  .trim()
  .regex(/^[A-Za-z0-9-]{8,64}$/, 'The update id is not valid.')

const actionBody = z.object({
  clientUpdateId,
  type: z.enum(FIELD_ACTION_TYPES, { error: 'Choose the action taken.' }),
  note: optionalText('Note', 500),
  location: location.optional(),
  recordedAt: isoDate('Time of the action'),
  recordedOffline: z.boolean().optional()
})

const completeBody = z.object({
  clientUpdateId,
  outcome: z.enum(Object.values(FIELD_OUTCOMES), { error: 'Choose the outcome of the response.' }),
  notes: optionalText('Notes', 1000),
  completedAt: isoDate('Completion time')
})

module.exports = {
  submitBody,
  informationBody,
  queueQuery,
  validationBody,
  informationRequestBody,
  duplicateBody,
  deploymentBody,
  escalationBody,
  reviewBody,
  alternativeContactBody,
  approvalQuery,
  approvalBody,
  actionBody,
  completeBody,
  MAX_PHOTOS
}
