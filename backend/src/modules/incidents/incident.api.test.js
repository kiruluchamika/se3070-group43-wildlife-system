const request = require('supertest')
const { createApp } = require('../../app')
const { createIncidentController } = require('./incident.controller')
const { createIncidentRouter } = require('./incident.routes')
const { nextId } = require('../../test-support/ids')

function buildApp() {
  const incidentService = {
    submit: vi.fn(async (body, ranger) => ({
      incident: { _id: nextId(), reference: 'INC-20261004-D9428888', ranger: ranger.id, ...body },
      alert: null,
      created: true
    })),
    listMine: vi.fn(async () => []),
    getMine: vi.fn(async () => ({ incident: { _id: nextId() }, photos: [] }))
  }
  const authenticate = (req, _res, next) => {
    req.user = { id: nextId(), role: req.headers['x-test-role'] || 'ranger' }
    next()
  }
  const incidentController = createIncidentController({ incidentService })
  const routes = [{ path: '/api/incidents', router: createIncidentRouter({ incidentController, authenticate }) }]
  const config = { clientOrigins: true, serveFrontend: false }
  return { app: createApp({ config, routes, logger: { error: vi.fn() } }), incidentService }
}

const validPayload = () => ({
  clientId: 'd9428888-122b-41e1-b85c-61cd3cbb3210',
  parkId: nextId(),
  type: 'snare',
  description: 'A wire snare was found beside the animal trail.',
  observedAt: '2026-10-04T09:30:00.000Z',
  deviceCreatedAt: '2026-10-04T09:35:00.000Z',
  location: { lat: 6.372, lng: 81.518 }
})

describe('UC03 incident API', () => {
  it('validates and submits a ranger incident', async () => {
    const { app, incidentService } = buildApp()
    const response = await request(app).post('/api/incidents').send(validPayload())

    expect(response.status).toBe(201)
    expect(response.body.incident.reference).toBe('INC-20261004-D9428888')
    expect(incidentService.submit).toHaveBeenCalledWith(expect.objectContaining({ observedAt: expect.any(Date) }), expect.objectContaining({ role: 'ranger' }))
  })

  it('rejects an incident without any usable location', async () => {
    const { app } = buildApp()
    const payload = validPayload()
    delete payload.location
    const response = await request(app).post('/api/incidents').send(payload)

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ field: 'location' }] })
  })

  it('denies non-ranger roles', async () => {
    const { app } = buildApp()
    const response = await request(app).post('/api/incidents').set('x-test-role', 'villager').send(validPayload())

    expect(response.status).toBe(403)
    expect(response.body.code).toBe('ACCESS_DENIED')
  })

  it('lists the current ranger reports and opens an owned report', async () => {
    const { app, incidentService } = buildApp()
    const id = nextId()
    const list = await request(app).get('/api/incidents/mine')
    const detail = await request(app).get(`/api/incidents/${id}`)

    expect(list.status).toBe(200)
    expect(list.body).toEqual({ incidents: [] })
    expect(detail.status).toBe(200)
    expect(detail.body).toHaveProperty('incident.id')
    expect(incidentService.listMine).toHaveBeenCalled()
    expect(incidentService.getMine).toHaveBeenCalledWith(id, expect.objectContaining({ role: 'ranger' }))
  })
})
