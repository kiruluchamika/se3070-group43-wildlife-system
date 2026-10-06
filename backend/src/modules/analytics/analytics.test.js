const request = require('supertest')
const { createApp } = require('../../app')
const { createAuthenticate } = require('../../shared/middleware/authenticate')
const { createTokenService } = require('../../shared/security/token-service')
const { createAnalyticsRouter } = require('./analytics.routes')
const { createAnalyticsService, inspectFreshness } = require('./analytics.service')
const { retrievalQuery, dateWindow } = require('./analytics.schemas')

const parkId = '111111111111111111111111'
const otherPark = '222222222222222222222222'
const userId = '333333333333333333333333'
const filters = { parkId, startDate: '2026-10-01', endDate: '2026-10-04', species: '', incidentType: '' }
const empty = () => ({ alerts: [], conflicts: [], patrolRecords: [] })

function setup(account = { _id: userId, role: 'data-analyst', park: parkId }) {
  const repositories = {
    userRepository: { findById: vi.fn(async () => account) },
    parkRepository: {
      listParks: vi.fn(async () => [{ _id: parkId }, { _id: otherPark }]),
      findParkById: vi.fn(async () => ({ _id: parkId, name: 'Yala' })),
      listZones: vi.fn(async () => [])
    },
    analyticsRepository: { retrieve: vi.fn(async () => empty()) }
  }
  const service = createAnalyticsService({ ...repositories, clock: () => new Date('2026-10-05T00:00:00Z') })
  const tokens = createTokenService({ secret: 'analytics-test-secret', expiresIn: '1h' })
  const app = createApp({ config: { clientOrigins: [] }, logger: { error: vi.fn() }, routes: [
    { path: '/api/analytics', router: createAnalyticsRouter({ analyticsService: service, authenticate: createAuthenticate({ tokenService: tokens }) }) }
  ] })
  const token = (role = 'data-analyst') => `Bearer ${tokens.sign({ _id: userId, role })}`
  return { ...repositories, service, app, token }
}

describe('UC02 retrieval validation and date semantics', () => {
  it('uses inclusive Sri Lankan days with an exclusive upper boundary', () => {
    expect(dateWindow(filters)).toEqual({ from: new Date('2026-09-30T18:30:00Z'), until: new Date('2026-10-04T18:30:00Z') })
  })
  it.each([
    { startDate: '2026-02-30' }, { endDate: '2026-09-30' }, { parkId: 'bad' },
    { species: 'elephant' }, { incidentType: 'invented' }, { startDate: 'today' }
  ])('rejects invalid or unsupported filters %j', (override) => {
    expect(retrievalQuery.safeParse({ ...filters, ...override }).success).toBe(false)
  })
  it('allows same-day selection and existing incident types', () => {
    expect(retrievalQuery.safeParse({ ...filters, endDate: filters.startDate, incidentType: 'snare' }).success).toBe(true)
  })
})

describe('UC02 freshness', () => {
  it('does not treat old simulated camera alerts as stale or invent sync times', () => {
    const freshness = inspectFreshness({ ...empty(), alerts: [{ _id: 'camera', source: 'camera-trap', sourceRef: 'CT-07', simulated: true, createdAt: new Date('2000-01-01') }] })
    expect(freshness.requiresConfirmation).toBe(false)
    expect(freshness.status).toBe('unknown')
    expect(freshness.sources[0]).toMatchObject({ label: 'Camera Trap CT-07', lastSuccessfulSyncAt: null, status: 'unknown' })
  })
  it('warns only for explicitly pending retrieved patrol records', () => {
    const freshness = inspectFreshness({ ...empty(), patrolRecords: [{ _id: 'pending', syncStatus: 'pending', updatedAt: new Date() }, { _id: 'ok', syncStatus: 'synced' }] })
    expect(freshness.requiresConfirmation).toBe(true)
    expect(freshness.affectedSources).toHaveLength(1)
    expect(freshness.affectedSources[0]).toMatchObject({ recordId: 'pending', lastSuccessfulSyncAt: null })
  })
  it('allows synced records and empty results without a warning', () => {
    expect(inspectFreshness({ ...empty(), patrolRecords: [{ _id: 'ok', syncStatus: 'synced' }] }).status).toBe('synced')
    expect(inspectFreshness(empty())).toMatchObject({ status: 'unknown', requiresConfirmation: false })
  })
})

describe('UC02 authenticated retrieval HTTP flow', () => {
  it('returns records and freshness without calculations', async () => {
    const { app, token, analyticsRepository } = setup()
    const result = await request(app).get('/api/analytics').query(filters).set('Authorization', token())
    expect(result.status).toBe(200)
    expect(result.headers['cache-control']).toBe('no-store')
    expect(result.body).toMatchObject({ filters, park: { id: parkId }, records: empty(), freshness: { requiresConfirmation: false } })
    expect(result.body).not.toHaveProperty('statistics')
    expect(analyticsRepository.retrieve).toHaveBeenCalledWith({ ...filters, ...dateWindow(filters) })
  })
  it('returns pending metadata for the confirmation flow', async () => {
    const { app, token, analyticsRepository } = setup()
    analyticsRepository.retrieve.mockResolvedValue({ ...empty(), patrolRecords: [{ _id: 'pending', syncStatus: 'pending' }] })
    const result = await request(app).get('/api/analytics').query(filters).set('Authorization', token())
    expect(result.body.freshness.requiresConfirmation).toBe(true)
    expect(result.body.records.patrolRecords).toHaveLength(1)
  })
  it('requires authentication', async () => {
    expect((await request(setup().app).get('/api/analytics').query(filters)).status).toBe(401)
  })
  it.each(['park-manager', 'ranger', 'liaison-officer', 'villager'])('denies role %s', async (role) => {
    const { app, token, analyticsRepository } = setup()
    expect((await request(app).get('/api/analytics').query(filters).set('Authorization', token(role))).status).toBe(403)
    expect(analyticsRepository.retrieve).not.toHaveBeenCalled()
  })
  it('rechecks the current database role instead of trusting an old analyst token', async () => {
    const { app, token } = setup({ _id: userId, role: 'ranger' })
    expect((await request(app).get('/api/analytics').query(filters).set('Authorization', token())).status).toBe(403)
  })
  it('rejects a deleted account', async () => {
    const { app, token } = setup(null)
    expect((await request(app).get('/api/analytics').query(filters).set('Authorization', token())).status).toBe(401)
  })
  it('denies another park before reading records', async () => {
    const { app, token, analyticsRepository } = setup()
    const result = await request(app).get('/api/analytics').query({ ...filters, parkId: otherPark }).set('Authorization', token())
    expect(result.status).toBe(403)
    expect(analyticsRepository.retrieve).not.toHaveBeenCalled()
  })
  it('returns only permitted park options and existing type values', async () => {
    const { app, token } = setup()
    const result = await request(app).get('/api/analytics/options').set('Authorization', token())
    expect(result.body.parks).toEqual([{ id: parkId }])
    expect(result.body.incidentTypes).toContain('crop-damage')
    expect(result.body.species).toEqual([])
  })
  it('allows a park-unassigned analyst to select either park, matching the existing staff convention', async () => {
    const { service } = setup({ _id: userId, role: 'data-analyst' })
    expect((await service.options({ id: userId })).parks).toHaveLength(2)
  })
  it('returns a safe database-failure response', async () => {
    const { app, token, analyticsRepository } = setup()
    analyticsRepository.retrieve.mockRejectedValue(new Error('private database connection detail'))
    const result = await request(app).get('/api/analytics').query(filters).set('Authorization', token())
    expect(result.status).toBe(500)
    expect(result.body.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(result.body)).not.toContain('private database')
  })
  it('validates filters before querying', async () => {
    const { app, token, analyticsRepository } = setup()
    const result = await request(app).get('/api/analytics').query({ ...filters, endDate: '2020-01-01' }).set('Authorization', token())
    expect(result.status).toBe(400)
    expect(analyticsRepository.retrieve).not.toHaveBeenCalled()
  })
})
