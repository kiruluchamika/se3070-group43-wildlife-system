const { createTransactionRunner } = require('../config/database')
const { connectTestDatabase, hasTestDatabase } = require('../test-support/memory-db')
const { createRepositories } = require('../container')

const square = { type: 'Polygon', coordinates: [[[81, 6], [81.1, 6], [81.1, 6.1], [81, 6.1], [81, 6]]] }

describe.skipIf(!hasTestDatabase)('shared repositories (in-memory MongoDB)', () => {
  let db
  let repositories
  let park

  beforeAll(async () => {
    db = await connectTestDatabase('shared')
    repositories = createRepositories(db.models)
  })

  afterAll(async () => {
    await db?.disconnect()
  })

  beforeEach(async () => {
    await db.clear()
    park = await db.models.Park.create({ code: 'yala', name: 'Yala National Park' })
  })

  describe('userRepository', () => {
    it('stores users and only returns the password hash when asked', async () => {
      const created = await repositories.userRepository.create({ name: 'Sunil', email: 'Sunil@Example.com', passwordHash: 'hash' })

      const withoutPassword = await repositories.userRepository.findByEmail('sunil@example.com')
      const withPassword = await repositories.userRepository.findByEmail('SUNIL@example.com', { withPassword: true })

      expect(created.email).toBe('sunil@example.com')
      expect(withoutPassword).not.toHaveProperty('passwordHash')
      expect(withPassword.passwordHash).toBe('hash')
      await expect(repositories.userRepository.findById(created._id)).resolves.toMatchObject({ name: 'Sunil' })
      await expect(repositories.userRepository.findByIds([created._id])).resolves.toHaveLength(1)
    })
  })

  describe('parkRepository', () => {
    it('lists parks and zones', async () => {
      const zone = await db.models.Zone.create({ park: park._id, code: 'east', name: 'East Zone', riskLevel: 'high', boundary: square })

      await expect(repositories.parkRepository.listParks()).resolves.toMatchObject([{ code: 'YALA' }])
      await expect(repositories.parkRepository.findParkById(park._id)).resolves.toMatchObject({ name: 'Yala National Park' })
      await expect(repositories.parkRepository.listZones(park._id)).resolves.toMatchObject([{ code: 'EAST' }])
      await expect(repositories.parkRepository.findZoneById(zone._id)).resolves.toMatchObject({ name: 'East Zone' })
      await expect(repositories.parkRepository.findZonesByIds([zone._id])).resolves.toHaveLength(1)
    })
  })

  describe('teamRepository', () => {
    it('changes status only from the expected state (concurrency guard)', async () => {
      const team = await db.models.RangerTeam.create({ park: park._id, code: 'alpha', name: 'Team Alpha' })

      const first = await repositories.teamRepository.updateStatusIf(team._id, ['available'], 'on-patrol')
      const second = await repositories.teamRepository.updateStatusIf(team._id, ['available'], 'responding')

      expect(first.status).toBe('on-patrol')
      expect(second).toBeNull()
      await expect(repositories.teamRepository.setStatus(team._id, 'available')).resolves.toMatchObject({ status: 'available' })
    })

    it('finds teams by park and by member with member details', async () => {
      const ranger = await db.models.User.create({ name: 'Kasun', email: 'kasun@example.com', passwordHash: 'x', role: 'ranger' })
      const team = await db.models.RangerTeam.create({ park: park._id, code: 'charlie', name: 'Team Charlie', members: [ranger._id] })

      const [listed] = await repositories.teamRepository.listByPark(park._id)
      const byMember = await repositories.teamRepository.findByMember(ranger._id)

      expect(listed.members[0]).toMatchObject({ name: 'Kasun', email: 'kasun@example.com' })
      expect(String(byMember._id)).toBe(String(team._id))
      await expect(repositories.teamRepository.findById(team._id)).resolves.toMatchObject({ code: 'CHARLIE' })
    })
  })

  describe('alertRepository', () => {
    it('filters by status and applies conditional updates', async () => {
      const zone = await db.models.Zone.create({ park: park._id, code: 'north', name: 'North Sector', boundary: square })
      const alert = await repositories.alertRepository.create({ park: park._id, zone: zone._id, type: 'snare', severity: 'high', title: 'Snare Detected' })
      await repositories.alertRepository.create({ park: park._id, type: 'fire', severity: 'low', title: 'Old fire', status: 'resolved' })

      const open = await repositories.alertRepository.listByPark(park._id, { statuses: ['active'] })
      const all = await repositories.alertRepository.listByPark(park._id)
      const acknowledged = await repositories.alertRepository.updateIfStatus(alert._id, ['active'], { status: 'acknowledged' })
      const repeated = await repositories.alertRepository.updateIfStatus(alert._id, ['active'], { status: 'acknowledged' })

      expect(open).toHaveLength(1)
      expect(open[0].zone).toMatchObject({ name: 'North Sector' })
      expect(all).toHaveLength(2)
      expect(acknowledged.status).toBe('acknowledged')
      expect(repeated).toBeNull()
      await expect(repositories.alertRepository.findById(alert._id)).resolves.toMatchObject({ status: 'acknowledged' })
    })
  })

  describe('notificationRepository', () => {
    it('creates, lists, counts and marks notifications as read per recipient', async () => {
      const user = await db.models.User.create({ name: 'Kasun', email: 'kasun@example.com', passwordHash: 'x' })
      const other = await db.models.User.create({ name: 'Nuwan', email: 'nuwan@example.com', passwordHash: 'x' })
      const readAt = new Date()

      await expect(repositories.notificationRepository.createMany([])).resolves.toEqual([])
      const [first] = await repositories.notificationRepository.createMany([
        { recipient: user._id, type: 'patrol-assignment', title: 'New assignment' },
        { recipient: user._id, type: 'patrol-assignment', title: 'Second assignment' }
      ])

      await expect(repositories.notificationRepository.countUnread(user._id)).resolves.toBe(2)
      await expect(repositories.notificationRepository.markRead(first._id, other._id, readAt)).resolves.toBeNull()
      await expect(repositories.notificationRepository.markRead(first._id, user._id, readAt)).resolves.toMatchObject({ readAt })
      await repositories.notificationRepository.markAllRead(user._id, readAt)
      await expect(repositories.notificationRepository.countUnread(user._id)).resolves.toBe(0)
      await expect(repositories.notificationRepository.listForRecipient(user._id)).resolves.toHaveLength(2)
    })
  })

  describe('transaction runner', () => {
    it('commits every write when the work succeeds', async () => {
      const runner = createTransactionRunner(db.connection)

      const result = await runner.run(async (session) => {
        await db.models.RangerTeam.create([{ park: park._id, code: 'echo', name: 'Team Echo' }], { session })
        return 'done'
      })

      expect(result).toBe('done')
      await expect(db.models.RangerTeam.countDocuments()).resolves.toBe(1)
    })

    it('rolls back every write when the work fails', async () => {
      const runner = createTransactionRunner(db.connection)

      await expect(
        runner.run(async (session) => {
          await db.models.RangerTeam.create([{ park: park._id, code: 'delta', name: 'Team Delta' }], { session })
          throw new Error('assignment update failed')
        })
      ).rejects.toThrow('assignment update failed')

      await expect(db.models.RangerTeam.countDocuments()).resolves.toBe(0)
    })
  })
})
