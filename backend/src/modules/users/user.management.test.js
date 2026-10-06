const request = require('supertest')
const { connectTestDatabase, hasTestDatabase } = require('../../test-support/memory-db')
const { createContainer } = require('../../container')
const { createApp } = require('../../app')
const { loadConfig } = require('../../config/env')

describe.skipIf(!hasTestDatabase)('administrator user management and session enforcement', () => {
  let db, app, container, admin, token
  const body = () => ({ name: 'New staff', email: 'staff@example.com', password: 'Long-password-123', role: 'data-analyst', park: null, phone: '' })
  beforeAll(async () => { db = await connectTestDatabase('user-management') })
  afterAll(async () => db?.disconnect())
  beforeEach(async () => {
    await db.clear()
    const config = loadConfig({ JWT_SECRET: 'user-management-test' })
    container = createContainer({ config })
    app = createApp({ config, routes: container.routes, logger: { error: vi.fn() } })
    admin = await db.models.User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'not-used', role: 'administrator' })
    token = `Bearer ${container.tokenService.sign(admin)}`
  })
  it('requires an active current administrator for every management action', async () => {
    const villager = await db.models.User.create({ name: 'Villager', email: 'villager@example.com', passwordHash: 'x' })
    const forgedRole = `Bearer ${container.tokenService.sign({ ...villager.toObject(), role: 'administrator' })}`
    expect((await request(app).get('/api/users')).status).toBe(401)
    for (const [method, path, input] of [['get', '/api/users', {}], ['post', '/api/users', body()], ['patch', `/api/users/${villager.id}`, body()], ['patch', `/api/users/${villager.id}/status`, { isActive: false }]]) {
      expect((await request(app)[method](path).set('Authorization', forgedRole).send(input)).status).toBe(403)
    }
  })
  it('creates, lists and edits using safe fields and the existing password hasher', async () => {
    const created = await request(app).post('/api/users').set('Authorization', token).send(body())
    expect(created.status).toBe(201)
    expect(created.body.user).toMatchObject({ role: 'data-analyst', isActive: true })
    expect(created.body).not.toHaveProperty('token')
    expect(created.body.user).not.toHaveProperty('passwordHash')
    const stored = await db.models.User.findById(created.body.user.id).select('+passwordHash')
    expect(stored.passwordHash).not.toBe(body().password)
    const login = await request(app).post('/api/auth/login').send({ email: body().email, password: body().password })
    expect(login.status).toBe(200)
    const edit = body()
    delete edit.password
    const updated = await request(app).patch(`/api/users/${stored.id}`).set('Authorization', token).send({ ...edit, name: 'Updated staff' })
    expect(updated.body.user.name).toBe('Updated staff')
    const list = await request(app).get('/api/users').set('Authorization', token)
    expect(list.status).toBe(200)
    expect(list.headers['cache-control']).toBe('no-store')
    expect(list.body.users).toHaveLength(2)
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|sessionVersion/)
    expect((await request(app).post('/api/users').set('Authorization', token).send(body())).status).toBe(409)
  })
  it('deactivates without deleting and revokes old tokens permanently across reactivation', async () => {
    const created = (await request(app).post('/api/users').set('Authorization', token).send(body())).body.user
    const login = await request(app).post('/api/auth/login').send({ email: body().email, password: body().password })
    const old = `Bearer ${login.body.token}`
    expect((await request(app).get('/api/parks').set('Authorization', old)).status).toBe(200)
    expect((await request(app).patch(`/api/users/${created.id}/status`).set('Authorization', token).send({ isActive: false })).status).toBe(200)
    expect(await db.models.User.countDocuments({ _id: created.id })).toBe(1)
    expect((await request(app).get('/api/parks').set('Authorization', old)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email: body().email, password: body().password })).status).toBe(401)
    await request(app).patch(`/api/users/${created.id}/status`).set('Authorization', token).send({ isActive: true })
    expect((await request(app).get('/api/auth/me').set('Authorization', old)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email: body().email, password: body().password })).status).toBe(200)
  })
  it('keeps legacy accounts active and protects self-access and validation', async () => {
    await db.models.User.updateOne({ _id: admin.id }, { $unset: { isActive: '', sessionVersion: '' } })
    token = `Bearer ${require('jsonwebtoken').sign({ sub: admin.id, role: 'administrator' }, 'user-management-test', { expiresIn: '1h' })}`
    expect((await request(app).get('/api/users').set('Authorization', token)).status).toBe(200)
    expect((await request(app).patch(`/api/users/${admin.id}/status`).set('Authorization', token).send({ isActive: false })).status).toBe(403)
    const edit = body()
    delete edit.password
    expect((await request(app).patch(`/api/users/${admin.id}`).set('Authorization', token).send(edit)).status).toBe(403)
    expect((await request(app).post('/api/users').set('Authorization', token).send({ ...body(), password: 'short' })).status).toBe(400)
    expect((await request(app).post('/api/users').set('Authorization', token).send({ ...body(), isActive: false })).status).toBe(400)
    expect((await request(app).post('/api/users').set('Authorization', token).send({ ...body(), park: '111111111111111111111111' })).status).toBe(404)
    const registered = await request(app).post('/api/auth/register').send({ ...body(), role: 'administrator' })
    expect(registered.body.user.role).toBe('villager')
  })
  it('paginates without exposing private fields and revokes sessions after role changes', async () => {
    await db.models.User.insertMany(Array.from({ length: 22 }, (_, i) => ({ name: `User ${i}`, email: `user${i}@example.com`, passwordHash: 'x' })))
    const first = await request(app).get('/api/users?page=1').set('Authorization', token)
    const second = await request(app).get('/api/users?page=2').set('Authorization', token)
    expect(first.body.users).toHaveLength(20)
    expect(first.body.hasMore).toBe(true)
    expect(second.body.users).toHaveLength(3)
    const user = await db.models.User.findOne({ email: 'user0@example.com' })
    const old = `Bearer ${container.tokenService.sign(user)}`
    await request(app).patch(`/api/users/${user.id}`).set('Authorization', token).send({ name: user.name, email: user.email, role: 'ranger', park: null })
    expect((await request(app).get('/api/parks').set('Authorization', old)).status).toBe(401)
  })
  it('preserves ranger-team assignments when profile changes would conflict', async () => {
    const park = await db.models.Park.create({ code: 'TEST', name: 'Test park' })
    const team = await db.models.RangerTeam.create({ park: park.id, code: 'TEAM', name: 'Existing team' })
    const ranger = await db.models.User.create({ name: 'Team ranger', email: 'ranger@example.com', passwordHash: 'x', role: 'ranger', park: park.id, team: team.id })
    const response = await request(app).patch(`/api/users/${ranger.id}`).set('Authorization', token).send({ name: ranger.name, email: ranger.email, role: 'data-analyst', park: park.id })
    expect(response.status).toBe(409)
    expect(response.body.code).toBe('TEAM_ASSIGNMENT_EXISTS')
    expect((await db.models.User.findById(ranger.id)).role).toBe('ranger')
    expect(String((await db.models.User.findById(ranger.id)).team)).toBe(team.id)
  })

})
