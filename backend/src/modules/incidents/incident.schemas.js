const { speciesValue } = require('../../shared/species')
const { z } = require('zod')
const { objectId } = require('../../shared/validation')
const { INCIDENT_SEVERITIES, INCIDENT_TYPES } = require('./incident.constants')

const MAX_PHOTOS = 3
const MAX_PHOTO_CHARS = 300_000

const location = z.object({
  lat: z.number({ error: 'Latitude must be a number.' }).min(-90).max(90),
  lng: z.number({ error: 'Longitude must be a number.' }).min(-180).max(180),
  accuracyMeters: z.number().min(0).max(100_000).optional()
})

const photo = z.object({
  caption: z.string().trim().max(120, 'Photo caption must not exceed 120 characters.').optional(),
  dataUrl: z
    .string({ error: 'Photo data is required.' })
    .regex(/^data:image\/(jpeg|png|webp);base64,/, 'Photos must be JPEG, PNG or WebP images.')
    .max(MAX_PHOTO_CHARS, 'Each photo must be smaller than about 220 KB.')
})

const submitBody = z
  .object({
    clientId: z.string({ error: 'A client report id is required.' }).uuid('The client report id is not valid.'),
    parkId: objectId('Park'),
    zoneId: objectId('Zone').optional(),
    type: z.enum(INCIDENT_TYPES, { error: 'Choose the type of incident.' }),
    species: speciesValue.optional(),
    severity: z.enum(INCIDENT_SEVERITIES, { error: 'Choose a valid urgency.' }).optional(),
    description: z
      .string({ error: 'A description is required.' })
      .trim()
      .min(10, 'Describe what you observed in at least 10 characters.')
      .max(1000, 'Description must not exceed 1,000 characters.'),
    observedAt: z.coerce.date({ error: 'Observation time must be a valid date and time.' }),
    deviceCreatedAt: z.coerce.date({ error: 'Device save time must be a valid date and time.' }),
    location: location.optional(),
    locationNote: z.string().trim().max(200, 'Location note must not exceed 200 characters.').optional(),
    recordedOffline: z.boolean().optional(),
    photos: z.array(photo).max(MAX_PHOTOS, `Attach at most ${MAX_PHOTOS} photos.`).optional()
  })
  .superRefine((body, context) => {
    if (!body.location && !body.zoneId && !body.locationNote) {
      context.addIssue({ code: 'custom', path: ['location'], message: 'Add GPS, choose a zone, or describe the location.' })
    }
  })

module.exports = { submitBody, MAX_PHOTOS, MAX_PHOTO_CHARS }
