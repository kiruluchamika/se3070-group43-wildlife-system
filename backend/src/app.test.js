const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const request = require('supertest')
const { createApp } = require('./app')
const { loadConfig } = require('./config/env')
const { createContainer } = require('./container')
const { nextId } = require('./test-support/ids')

const PARK_ID = nextId()

/** In-memory repositories so the HTTP layer can be tested without MongoDB. */
function createFakeRepositories() {
  const users = []
  const alerts = [
    { _id: nextId(), park: PARK_ID, severity: 'medium', status: 'active', title: 'Elephant Movement', createdAt: new Date('2026-09-25T08:00:00Z') },
    { _id: nextId(), park: PARK_ID, severity: 'critical', status: 'active', title: 'Possible Poaching Activity', createdAt: new Date('2026-09-25T07:00:00Z') }
  ]

  return {
    userRepository: {
      findByEmail: async (email) => users.find((user) => user.email === email) ?? null,
      findById: async (id) => users.find((user) => user._id === id) ?? null,
      findByIds: async () => [],
      create: async (data) => {
        const user = { _id: nextId(), ...data }
        users.push(user)
        return user
      }
    },
    parkRepository: { listParks: async () => [{ _id: PARK_ID, code: 'YALA', name: 'Yala National Park', __v: 0 }] },
    teamRepository: { listByPark: async () => [{ _id: nextId(), name: 'Team Alpha', status: 'available' }] },
    alertRepository: {
      listByPark: async () => alerts,
      findById: async (id) => alerts.find((alert) => alert._id === id) ?? null,
      updateIfStatus: async (id, fromStatuses, changes) => {
        const alert = alerts.find((entry) => entry._id === id && fromStatuses.includes(entry.status))
        return alert ? Object.assign(alert, changes) : null
      }
    },
    notificationRepository: {
      listForRecipient: async () => [],
      countUnread: async () => 0,
      markRead: async () => null,
      markAllRead: async () => ({})
    },
    users,
    alerts
  }
}

function buildApp(configOverrides = {}) {
  const config = loadConfig({ JWT_SECRET: 'test-secret', ...configOverrides })
  const repositories = createFakeRepositories()
  const passwordHasher = { hash: async (password) => `hashed:${password}`, compare: async (password, hash) => hash === `hashed:${password}` }
  const container = createContainer({ config, repositories, passwordHasher })
  const logger = { error: vi.fn() }
  const app = createApp({ config, routes: container.routes, logger })

  const tokenFor = (role) => {
    const user = { _id: nextId(), role }
    repositories.users.push(user)
    return container.tokenService.sign(user)
  }
  return { app, repositories, tokenFor, logger }
}

describe('HTTP API', () => {
  it('reports health', async () => {
    const { app } = buildApp()

    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('returns JSON 404s for unknown API routes', async () => {
    const { app } = buildApp()

    const response = await request(app).get('/api/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.body.code).toBe('ROUTE_NOT_FOUND')
  })

  it('rejects malformed JSON bodies', async () => {
    const { app } = buildApp()

    const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":')

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_JSON')
  })

  describe('user management', () => {
    it('registers a villager even when a staff role is requested', async () => {
      const { app } = buildApp()

      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Sunil Bandara', email: 'SUNIL@example.com ', password: 'long-enough', role: 'park-manager' })

      expect(response.status).toBe(201)
      expect(response.body.token).toEqual(expect.any(String))
      expect(response.body.user).toMatchObject({ email: 'sunil@example.com', role: 'villager' })
    })

    it('validates registration input field by field', async () => {
      const { app } = buildApp()

      const response = await request(app).post('/api/auth/register').send({ name: 'S', email: 'not-an-email', password: 'short' })

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('VALIDATION_ERROR')
      expect(response.body.details.map((detail) => detail.field)).toEqual(['name', 'email', 'password'])
    })

    it('signs in and restores the profile with the issued token', async () => {
      const { app } = buildApp()
      await request(app).post('/api/auth/register').send({ name: 'Sunil Bandara', email: 'sunil@example.com', password: 'long-enough' })

      const login = await request(app).post('/api/auth/login').send({ email: 'sunil@example.com', password: 'long-enough' })
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)

      expect(login.status).toBe(200)
      expect(me.status).toBe(200)
      expect(me.body.user).toMatchObject({ name: 'Sunil Bandara', role: 'villager' })
    })

    it('rejects a wrong password', async () => {
      const { app } = buildApp()
      await request(app).post('/api/auth/register').send({ name: 'Sunil Bandara', email: 'sunil@example.com', password: 'long-enough' })

      const response = await request(app).post('/api/auth/login').send({ email: 'sunil@example.com', password: 'wrong-password' })

      expect(response.status).toBe(401)
      expect(response.body.code).toBe('INVALID_CREDENTIALS')
    })

    it('requires a token for the profile endpoint', async () => {
      const { app } = buildApp()

      const response = await request(app).get('/api/auth/me')

      expect(response.status).toBe(401)
    })
  })

  describe('role-based access (UC04 E4)', () => {
    it('denies alerts to a villager', async () => {
      const { app, tokenFor } = buildApp()

      const response = await request(app).get(`/api/alerts?parkId=${PARK_ID}`).set('Authorization', `Bearer ${tokenFor('villager')}`)

      expect(response.status).toBe(403)
      expect(response.body).toEqual({ message: 'Access denied. Your role cannot use this function.', code: 'ACCESS_DENIED' })
    })

    it('returns alerts to a park manager, most severe first', async () => {
      const { app, tokenFor } = buildApp()

      const response = await request(app).get(`/api/alerts?parkId=${PARK_ID}`).set('Authorization', `Bearer ${tokenFor('park-manager')}`)

      expect(response.status).toBe(200)
      expect(response.body.alerts.map((alert) => alert.title)).toEqual(['Possible Poaching Activity', 'Elephant Movement'])
      expect(response.body.alerts[0]).toHaveProperty('id')
    })

    it('acknowledges an alert once', async () => {
      const { app, tokenFor, repositories } = buildApp()
      const token = tokenFor('park-manager')
      const alertId = repositories.alerts[0]._id

      const first = await request(app).patch(`/api/alerts/${alertId}/acknowledge`).set('Authorization', `Bearer ${token}`)
      const second = await request(app).patch(`/api/alerts/${alertId}/acknowledge`).set('Authorization', `Bearer ${token}`)

      expect(first.status).toBe(200)
      expect(first.body.alert.status).toBe('acknowledged')
      expect(second.status).toBe(409)
    })

    it('validates query parameters', async () => {
      const { app, tokenFor } = buildApp()

      const response = await request(app).get('/api/alerts?parkId=not-an-id').set('Authorization', `Bearer ${tokenFor('park-manager')}`)

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Park id is not valid.')
    })
  })

  describe('shared reference data', () => {
    it('lists parks for any signed-in user', async () => {
      const { app, tokenFor } = buildApp()

      const response = await request(app).get('/api/parks').set('Authorization', `Bearer ${tokenFor('ranger')}`)

      expect(response.status).toBe(200)
      expect(response.body.parks).toEqual([{ id: PARK_ID, code: 'YALA', name: 'Yala National Park' }])
    })

    it('lists teams for staff roles', async () => {
      const { app, tokenFor } = buildApp()

      const allowed = await request(app).get(`/api/teams?parkId=${PARK_ID}`).set('Authorization', `Bearer ${tokenFor('liaison-officer')}`)
      const denied = await request(app).get(`/api/teams?parkId=${PARK_ID}`).set('Authorization', `Bearer ${tokenFor('ranger')}`)

      expect(allowed.status).toBe(200)
      expect(allowed.body.teams[0].name).toBe('Team Alpha')
      expect(denied.status).toBe(403)
    })

    it('returns the signed-in user notifications', async () => {
      const { app, tokenFor } = buildApp()
      const token = tokenFor('ranger')

      const list = await request(app).get('/api/notifications/me').set('Authorization', `Bearer ${token}`)
      const readAll = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${token}`)
      const readMissing = await request(app).patch(`/api/notifications/${nextId()}/read`).set('Authorization', `Bearer ${token}`)

      expect(list.body).toEqual({ notifications: [], unreadCount: 0 })
      expect(readAll.status).toBe(204)
      expect(readMissing.status).toBe(404)
    })
  })

  it('hides unexpected failures behind a 500 response', async () => {
    const { app, tokenFor, repositories, logger } = buildApp()
    repositories.alertRepository.listByPark = async () => {
      throw new Error('connection reset')
    }

    const response = await request(app).get(`/api/alerts?parkId=${PARK_ID}`).set('Authorization', `Bearer ${tokenFor('park-manager')}`)

    expect(response.status).toBe(500)
    expect(response.body.code).toBe('INTERNAL_ERROR')
    expect(logger.error).toHaveBeenCalled()
  })

  describe('integrated frontend serving', () => {
    let distDir

    beforeAll(() => {
      distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wildguard-dist-'))
      fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>WildGuard</title>')
    })

    afterAll(() => fs.rmSync(distDir, { recursive: true, force: true }))

    it('serves the React app for browser routes while keeping API 404s as JSON', async () => {
      const { app } = buildApp({ SERVE_FRONTEND: 'true', FRONTEND_DIST_PATH: distDir })

      const page = await request(app).get('/patrol')
      const api = await request(app).get('/api/unknown')
      const post = await request(app).post('/patrol')

      expect(page.status).toBe(200)
      expect(page.text).toContain('<title>WildGuard</title>')
      expect(api.body.code).toBe('ROUTE_NOT_FOUND')
      expect(post.status).toBe(404)
    })

    it('falls back to a 404 when the frontend has not been built', async () => {
      const { app } = buildApp({ SERVE_FRONTEND: 'true', FRONTEND_DIST_PATH: path.join(distDir, 'missing') })

      const response = await request(app).get('/patrol')

      expect(response.status).toBe(404)
    })
  })
})
