const { createIncidentService, fingerprintOf } = require('./incident.service')
const { nextId } = require('../../test-support/ids')

const NOW = new Date('2026-10-04T10:00:00.000Z')

function validBody(overrides = {}) {
  return {
    clientId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
    parkId: nextId(),
    zoneId: nextId(),
    type: 'snare',
    description: 'A wire snare was found beside the animal trail.',
    observedAt: new Date('2026-10-04T09:30:00.000Z'),
    deviceCreatedAt: new Date('2026-10-04T09:35:00.000Z'),
    location: { lat: 6.372, lng: 81.518, accuracyMeters: 12 },
    recordedOffline: true,
    photos: [],
    ...overrides
  }
}

function createWorld() {
  const incidents = []
  const photos = []
  const alerts = []
  const park = { _id: nextId(), name: 'Yala National Park' }
  const zone = { _id: nextId(), park: park._id, name: 'Block One' }

  const incidentRepository = {
    async findByClientId(clientId) {
      return incidents.find((incident) => incident.clientId === clientId) ?? null
    },
    async createIncident(data) {
      const incident = { _id: nextId(), ...structuredClone(data) }
      incidents.push(incident)
      return structuredClone(incident)
    },
    async createPhotos(incidentId, entries) {
      const stored = entries.map((entry, order) => ({ _id: nextId(), incident: incidentId, order, ...entry }))
      photos.push(...stored)
      return structuredClone(stored)
    },
    async setAlert(incidentId, alertId) {
      const incident = incidents.find((entry) => entry._id === incidentId)
      incident.alert = alertId
      return structuredClone(incident)
    },
    async listByRanger(rangerId) {
      return incidents.filter((incident) => incident.ranger === rangerId).map((incident) => structuredClone(incident))
    },
    async findById(id) {
      return structuredClone(incidents.find((incident) => incident._id === id) ?? null)
    },
    async listPhotoMetadata(incidentId) {
      return photos.filter((photo) => photo.incident === incidentId).map(({ dataUrl: _dataUrl, ...photo }) => structuredClone(photo))
    }
  }

  const parkRepository = {
    findParkById: vi.fn(async (id) => (id === park._id ? park : null)),
    findZoneById: vi.fn(async (id) => (id === zone._id ? zone : null))
  }
  const alertService = {
    raise: vi.fn(async (data) => {
      const alert = { _id: nextId(), ...structuredClone(data) }
      alerts.push(alert)
      return alert
    })
  }
  const transactionRunner = { run: vi.fn(async (work) => work('session')) }
  const service = createIncidentService({ incidentRepository, parkRepository, alertService, transactionRunner, clock: () => new Date(NOW) })
  const ranger = { id: nextId(), role: 'ranger' }

  return { service, ranger, park, zone, incidents, photos, alerts, incidentRepository, parkRepository, alertService, transactionRunner }
}

describe('UC03 incident service', () => {
  it('stores an incident and raises the mapped UC04 alert in one transaction', async () => {
    const world = createWorld()
    const body = validBody({ parkId: world.park._id, zoneId: world.zone._id })

    const result = await world.service.submit(body, world.ranger)

    expect(result.created).toBe(true)
    expect(result.incident).toMatchObject({ ranger: world.ranger.id, type: 'snare', severity: 'high', recordedOffline: true, photoCount: 0 })
    expect(result.incident.reference).toMatch(/^INC-20261004-/)
    expect(world.transactionRunner.run).toHaveBeenCalledOnce()
    expect(world.alertService.raise).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'snare', severity: 'high', source: 'ranger-incident', sourceRef: result.incident._id }),
      { session: 'session' }
    )
    expect(result.incident.alert).toBe(result.alert._id)
  })

  it('returns the existing incident when the same offline upload is retried', async () => {
    const world = createWorld()
    const body = validBody({ parkId: world.park._id, zoneId: world.zone._id })

    const first = await world.service.submit(body, world.ranger)
    const second = await world.service.submit(body, world.ranger)

    expect(second).toMatchObject({ created: false, incident: { _id: first.incident._id } })
    expect(world.incidents).toHaveLength(1)
    expect(world.alerts).toHaveLength(1)
  })

  it('rejects a client id reused for different evidence', async () => {
    const world = createWorld()
    const body = validBody({ parkId: world.park._id, zoneId: world.zone._id })
    await world.service.submit(body, world.ranger)

    await expect(world.service.submit({ ...body, description: 'Different incident details that are long enough.' }, world.ranger)).rejects.toMatchObject({
      code: 'CLIENT_ID_REUSED',
      status: 409
    })
  })

  it('keeps non-operational wildlife sightings without raising an alert', async () => {
    const world = createWorld()
    const result = await world.service.submit(
      validBody({ parkId: world.park._id, zoneId: world.zone._id, type: 'wildlife-sighting' }),
      world.ranger
    )

    expect(result.incident.severity).toBe('low')
    expect(result.alert).toBeNull()
    expect(world.alertService.raise).not.toHaveBeenCalled()
  })

  it('stores photo bodies separately and returns metadata to the owner', async () => {
    const world = createWorld()
    const body = validBody({
      parkId: world.park._id,
      zoneId: world.zone._id,
      photos: [{ caption: 'Trail evidence', dataUrl: `data:image/jpeg;base64,${Buffer.from('photo').toString('base64')}` }]
    })
    const created = await world.service.submit(body, world.ranger)

    const detail = await world.service.getMine(created.incident._id, world.ranger)

    expect(created.incident.photoCount).toBe(1)
    expect(world.photos[0]).toMatchObject({ contentType: 'image/jpeg', caption: 'Trail evidence' })
    expect(detail.photos[0]).not.toHaveProperty('dataUrl')
  })

  it('rejects a zone from another park', async () => {
    const world = createWorld()
    world.zone.park = nextId()

    await expect(
      world.service.submit(validBody({ parkId: world.park._id, zoneId: world.zone._id }), world.ranger)
    ).rejects.toMatchObject({ code: 'ZONE_PARK_MISMATCH', status: 422 })
  })

  it('rejects an observation time beyond the allowed clock tolerance', async () => {
    const world = createWorld()

    await expect(
      world.service.submit(
        validBody({ parkId: world.park._id, zoneId: world.zone._id, observedAt: new Date('2026-10-04T10:06:00.000Z') }),
        world.ranger
      )
    ).rejects.toMatchObject({ code: 'INCIDENT_TIME_IN_FUTURE', status: 422 })
  })

  it('only returns a report to the ranger who created it', async () => {
    const world = createWorld()
    const created = await world.service.submit(validBody({ parkId: world.park._id, zoneId: world.zone._id }), world.ranger)

    await expect(world.service.getMine(created.incident._id, { id: nextId() })).rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND', status: 404 })
  })

  it('lists only the signed-in ranger reports', async () => {
    const world = createWorld()
    await world.service.submit(validBody({ parkId: world.park._id, zoneId: world.zone._id }), world.ranger)

    await expect(world.service.listMine(world.ranger)).resolves.toHaveLength(1)
  })

  it('accepts a location note without a zone and reports missing reference data clearly', async () => {
    const world = createWorld()
    await expect(
      world.service.submit(validBody({ parkId: world.park._id, zoneId: undefined, location: undefined, locationNote: 'Near the northern boundary marker' }), world.ranger)
    ).resolves.toMatchObject({ created: true })

    await expect(world.service.submit(validBody({ clientId: '20000000-0000-4000-8000-000000000001', parkId: nextId() }), world.ranger)).rejects.toMatchObject({ code: 'PARK_NOT_FOUND' })
    world.parkRepository.findZoneById.mockResolvedValueOnce(null)
    await expect(
      world.service.submit(validBody({ clientId: '20000000-0000-4000-8000-000000000002', parkId: world.park._id, zoneId: nextId() }), world.ranger)
    ).rejects.toMatchObject({ code: 'ZONE_NOT_FOUND' })
  })

  it('recovers from a duplicate-key race by returning the winning upload', async () => {
    const world = createWorld()
    const body = validBody({ parkId: world.park._id, zoneId: world.zone._id })
    const fingerprint = fingerprintOf(body)
    const winner = { _id: nextId(), ranger: world.ranger.id, clientId: body.clientId, payloadFingerprint: fingerprint }
    world.incidentRepository.createIncident = vi.fn(async () => {
      world.incidents.push(winner)
      throw Object.assign(new Error('duplicate'), { code: 11000 })
    })

    await expect(world.service.submit(body, world.ranger)).resolves.toMatchObject({ created: false, incident: { _id: winner._id } })
  })

  it('produces an identical fingerprint for an unchanged retry', () => {
    const body = validBody()
    expect(fingerprintOf(body)).toBe(fingerprintOf(structuredClone(body)))
  })
})
