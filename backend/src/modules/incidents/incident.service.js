const crypto = require('node:crypto')
const { BusinessRuleError, ConflictError, NotFoundError } = require('../../shared/errors/AppError')
const { toId } = require('../../shared/utils/serialize')
const { ALERT_RULES, DEFAULT_SEVERITY } = require('./incident.constants')
const { DUPLICATE_KEY } = require('./incident.repository')

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const SEVERITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 })

const higherSeverity = (first, second) => (SEVERITY_RANK[first] >= SEVERITY_RANK[second] ? first : second)

function photoMetadata(photo) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo.dataUrl)
  return {
    caption: photo.caption,
    contentType: match[1],
    sizeBytes: Buffer.byteLength(match[2], 'base64'),
    dataUrl: photo.dataUrl
  }
}

/** A stable identity for detecting accidental reuse of one offline client id. */
function fingerprintOf(body) {
  const identity = {
    parkId: body.parkId,
    zoneId: body.zoneId ?? null,
    type: body.type,
    severity: body.severity ?? null,
    description: body.description,
    observedAt: body.observedAt.toISOString(),
    deviceCreatedAt: body.deviceCreatedAt.toISOString(),
    location: body.location ?? null,
    locationNote: body.locationNote ?? null,
    recordedOffline: Boolean(body.recordedOffline),
    photos: body.photos ?? []
  }
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex')
}

function referenceFor(clientId, receivedAt) {
  const date = receivedAt.toISOString().slice(0, 10).replaceAll('-', '')
  return `INC-${date}-${clientId.slice(0, 8).toUpperCase()}`
}

function createIncidentService({ incidentRepository, parkRepository, alertService, transactionRunner, clock = () => new Date() }) {
  async function duplicateResult(clientId, fingerprint, rangerId) {
    const existing = await incidentRepository.findByClientId(clientId, { includeFingerprint: true })
    if (!existing) return null
    if (toId(existing.ranger) !== String(rangerId) || existing.payloadFingerprint !== fingerprint) {
      throw new ConflictError('This device report id has already been used for different data.', 'CLIENT_ID_REUSED')
    }
    return { incident: existing, alert: null, created: false }
  }

  async function validateReferences(body) {
    const park = await parkRepository.findParkById(body.parkId)
    if (!park) throw new NotFoundError('The selected park was not found.', 'PARK_NOT_FOUND')
    if (!body.zoneId) return

    const zone = await parkRepository.findZoneById(body.zoneId)
    if (!zone) throw new NotFoundError('The selected zone was not found.', 'ZONE_NOT_FOUND')
    if (toId(zone.park) !== String(body.parkId)) {
      throw new BusinessRuleError('The selected zone does not belong to this park.', 'ZONE_PARK_MISMATCH')
    }
  }

  return {
    async submit(body, ranger) {
      const receivedAt = clock()
      if (body.observedAt.getTime() > receivedAt.getTime() + MAX_CLOCK_SKEW_MS) {
        throw new BusinessRuleError('The observation time cannot be in the future.', 'INCIDENT_TIME_IN_FUTURE')
      }

      const fingerprint = fingerprintOf(body)
      const duplicate = await duplicateResult(body.clientId, fingerprint, ranger.id)
      if (duplicate) return duplicate
      await validateReferences(body)

      const photos = (body.photos ?? []).map(photoMetadata)
      const severity = body.severity ?? DEFAULT_SEVERITY[body.type]
      const incidentData = {
        clientId: body.clientId,
        payloadFingerprint: fingerprint,
        reference: referenceFor(body.clientId, receivedAt),
        ranger: ranger.id,
        park: body.parkId,
        zone: body.zoneId,
        type: body.type,
        severity,
        description: body.description,
        location: body.location,
        locationNote: body.locationNote,
        observedAt: body.observedAt,
        deviceCreatedAt: body.deviceCreatedAt,
        receivedAt,
        recordedOffline: Boolean(body.recordedOffline),
        photoCount: photos.length
      }

      try {
        return await transactionRunner.run(async (session) => {
          let incident = await incidentRepository.createIncident(incidentData, { session })
          await incidentRepository.createPhotos(incident._id, photos, { session })

          let alert = null
          const rule = ALERT_RULES[body.type]
          if (rule) {
            alert = await alertService.raise(
              {
                park: body.parkId,
                zone: body.zoneId,
                type: rule.type,
                // A ranger may increase urgency, but cannot lower the safe baseline for an actionable type.
                severity: higherSeverity(severity, rule.severity),
                title: rule.title,
                message: body.description,
                location: body.location,
                source: 'ranger-incident',
                sourceRef: String(incident._id)
              },
              { session }
            )
            incident = await incidentRepository.setAlert(incident._id, alert._id, { session })
          }

          return { incident, alert, created: true }
        })
      } catch (error) {
        if (error?.code !== DUPLICATE_KEY) throw error
        const racedDuplicate = await duplicateResult(body.clientId, fingerprint, ranger.id)
        if (racedDuplicate) return racedDuplicate
        throw error
      }
    },

    listMine(ranger) {
      return incidentRepository.listByRanger(ranger.id)
    },

    async getMine(incidentId, ranger) {
      const incident = await incidentRepository.findById(incidentId)
      if (!incident || toId(incident.ranger) !== String(ranger.id)) {
        throw new NotFoundError('The incident report was not found.', 'INCIDENT_NOT_FOUND')
      }
      const photos = await incidentRepository.listPhotoMetadata(incidentId)
      return { incident, photos }
    }
  }
}

module.exports = { createIncidentService, fingerprintOf, referenceFor, MAX_CLOCK_SKEW_MS }
