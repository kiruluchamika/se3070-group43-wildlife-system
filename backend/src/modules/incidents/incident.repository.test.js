const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')
const { createIncidentRepository } = require('./incident.repository')

const square = { type: 'Polygon', coordinates: [[[81, 6], [81.1, 6], [81.1, 6.1], [81, 6.1], [81, 6]]] }

describe.skipIf(!hasTestDatabase)('UC03 incident repository (in-memory MongoDB)', () => {
  let db
  let repository
  let park
  let zone
  let ranger

  beforeAll(async () => {
    db = await connectTestDatabase('incidents')
    repository = createIncidentRepository(db.models)
  })

  afterAll(async () => db?.disconnect())

  beforeEach(async () => {
    await db.clear()
    park = await db.models.Park.create({ code: 'yala', name: 'Yala National Park' })
    zone = await db.models.Zone.create({ park: park._id, code: 'east', name: 'East Zone', boundary: square })
    ranger = await db.models.User.create({ name: 'Kasun', email: 'kasun@example.com', passwordHash: 'x', role: 'ranger', park: park._id })
  })

  const incidentData = () => ({
    clientId: 'd9428888-122b-41e1-b85c-61cd3cbb3210',
    payloadFingerprint: 'fingerprint-one',
    reference: 'INC-20261004-D9428888',
    ranger: ranger._id,
    park: park._id,
    zone: zone._id,
    type: 'snare',
    severity: 'high',
    description: 'A wire snare was found beside the animal trail.',
    location: { lat: 6.372, lng: 81.518 },
    observedAt: new Date('2026-10-04T09:30:00Z'),
    deviceCreatedAt: new Date('2026-10-04T09:35:00Z'),
    receivedAt: new Date('2026-10-04T10:00:00Z'),
    photoCount: 1
  })

  it('creates, finds, lists and links an incident alert', async () => {
    const created = await repository.createIncident(incidentData())
    const alert = await db.models.Alert.create({ park: park._id, zone: zone._id, type: 'snare', severity: 'high', title: 'Snare' })

    expect(await repository.createPhotos(created._id, [])).toEqual([])
    await repository.createPhotos(created._id, [
      { caption: 'Evidence', contentType: 'image/jpeg', sizeBytes: 5, dataUrl: 'data:image/jpeg;base64,cGhvdG8=' }
    ])
    const defaultFind = await repository.findByClientId(created.clientId)
    const idempotencyFind = await repository.findByClientId(created.clientId, { includeFingerprint: true })
    const byId = await repository.findById(created._id)
    const [listed] = await repository.listByRanger(ranger._id, { limit: 1 })
    const [photo] = await repository.listPhotoMetadata(created._id)
    const linked = await repository.setAlert(created._id, alert._id)

    expect(defaultFind).not.toHaveProperty('payloadFingerprint')
    expect(idempotencyFind.payloadFingerprint).toBe('fingerprint-one')
    expect(byId.reference).toBe(created.reference)
    expect(listed.park).toMatchObject({ name: 'Yala National Park' })
    expect(listed.zone).toMatchObject({ name: 'East Zone' })
    expect(photo).toMatchObject({ caption: 'Evidence', contentType: 'image/jpeg', order: 0 })
    expect(photo).not.toHaveProperty('dataUrl')
    expect(String(linked.alert)).toBe(String(alert._id))
  })

  it('enforces the unique offline client id', async () => {
    await repository.createIncident(incidentData())
    await expect(repository.createIncident({ ...incidentData(), reference: 'INC-OTHER' })).rejects.toMatchObject({ code: 11000 })
  })
})
