const { createNotificationService } = require('./notification.service')

const NOW = new Date('2026-09-25T10:00:00Z')

function setup() {
  const notificationRepository = {
    createMany: vi.fn(async (notifications) => notifications),
    listForRecipient: vi.fn(async () => [{ _id: 'n1', title: 'New patrol assignment' }]),
    countUnread: vi.fn(async () => 1),
    markRead: vi.fn(async (id, userId, readAt) => (id === 'n1' ? { _id: id, readAt } : null)),
    markAllRead: vi.fn(async () => ({ modifiedCount: 3 }))
  }
  return { notificationService: createNotificationService({ notificationRepository, clock: () => NOW }), notificationRepository }
}

describe('notificationService', () => {
  it('creates one notification per unique recipient, accepting ids or populated users', async () => {
    const { notificationService, notificationRepository } = setup()
    const payload = { type: 'patrol-assignment', title: 'New patrol assignment', message: 'East Zone', link: '/my-assignment' }

    await notificationService.notifyUsers(['u1', { _id: 'u2' }, 'u1', null], payload, { session: 'tx' })

    expect(notificationRepository.createMany).toHaveBeenCalledWith(
      [
        { recipient: 'u1', ...payload },
        { recipient: 'u2', ...payload }
      ],
      { session: 'tx' }
    )
  })

  it('lists the latest notifications with the unread count', async () => {
    const { notificationService } = setup()

    await expect(notificationService.listMine('u1')).resolves.toEqual({
      items: [{ _id: 'n1', title: 'New patrol assignment' }],
      unreadCount: 1
    })
  })

  it('marks one of the user notifications as read', async () => {
    const { notificationService, notificationRepository } = setup()

    await expect(notificationService.markRead('n1', 'u1')).resolves.toEqual({ _id: 'n1', readAt: NOW })
    expect(notificationRepository.markRead).toHaveBeenCalledWith('n1', 'u1', NOW)
  })

  it('does not reveal notifications that belong to someone else', async () => {
    const { notificationService } = setup()

    await expect(notificationService.markRead('other', 'u1')).rejects.toMatchObject({ status: 404, code: 'NOTIFICATION_NOT_FOUND' })
  })

  it('marks every notification as read', async () => {
    const { notificationService, notificationRepository } = setup()

    await notificationService.markAllRead('u1')

    expect(notificationRepository.markAllRead).toHaveBeenCalledWith('u1', NOW)
  })
})
