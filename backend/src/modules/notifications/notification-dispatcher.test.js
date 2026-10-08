const { createNotificationDispatcher } = require('./notification-dispatcher')
const { createSmsGateway } = require('./sms-gateway')

const payload = { type: 'conflict-update', title: 'Report received', message: 'An officer will verify it.', link: '/conflicts/mine' }

function setup({ inAppFails = false, smsMode = 'simulated' } = {}) {
  const notificationService = {
    notifyUsers: vi.fn(async () => {
      if (inAppFails) throw new Error('push service down')
      return []
    })
  }
  const logger = { info: vi.fn(), warn: vi.fn() }
  const smsGateway = createSmsGateway({ mode: smsMode, logger })
  vi.spyOn(smsGateway, 'send')
  return { dispatcher: createNotificationDispatcher({ notificationService, smsGateway, logger }), notificationService, smsGateway, logger }
}

describe('notificationDispatcher.deliver (UC01 E1/E2)', () => {
  it('uses in-app delivery first and does not send an SMS when it works', async () => {
    const { dispatcher, notificationService, smsGateway } = setup()

    const result = await dispatcher.deliver({ userId: 'villager-1', phone: '+94 71 555 0101' }, payload)

    expect(result).toEqual({ reached: true, attempts: [{ channel: 'in-app', status: 'delivered' }] })
    expect(notificationService.notifyUsers).toHaveBeenCalledWith(['villager-1'], payload)
    expect(smsGateway.send).not.toHaveBeenCalled()
  })

  it('falls back to SMS when in-app delivery fails, reporting the SMS as simulated', async () => {
    const { dispatcher, smsGateway, logger } = setup({ inAppFails: true })

    const result = await dispatcher.deliver({ userId: 'villager-1', phone: '+94 71 555 0101' }, payload)

    expect(result.reached).toBe(true)
    expect(result.attempts).toEqual([
      { channel: 'in-app', status: 'failed', detail: 'push service down' },
      { channel: 'sms', status: 'simulated', detail: expect.stringMatching(/^SIM-/) }
    ])
    expect(smsGateway.send).toHaveBeenCalledWith({ to: '+94 71 555 0101', message: 'WildGuard: Report received. An officer will verify it.' })
    expect(logger.warn).toHaveBeenCalled()
  })

  it('goes straight to SMS for a contact without an account', async () => {
    const { dispatcher, notificationService } = setup()

    const result = await dispatcher.deliver({ phone: '+94 71 555 0101' }, payload)

    expect(notificationService.notifyUsers).not.toHaveBeenCalled()
    expect(result.attempts.map((attempt) => attempt.channel)).toEqual(['sms'])
  })

  it('reports that nobody was reached when SMS also fails, without throwing', async () => {
    const { dispatcher } = setup({ inAppFails: true, smsMode: 'unavailable' })

    const result = await dispatcher.deliver({ userId: 'villager-1', phone: '+94 71 555 0101' }, payload)

    expect(result).toEqual({
      reached: false,
      attempts: [
        { channel: 'in-app', status: 'failed', detail: 'push service down' },
        { channel: 'sms', status: 'failed', detail: 'The SMS gateway is unavailable.' }
      ]
    })
  })

  it('labels a real provider acceptance as sent, never delivered', async () => {
    const notificationService = { notifyUsers: vi.fn() }
    const smsGateway = { send: vi.fn(async () => ({ status: 'queued', providerRef: 'TW-1' })) }
    const dispatcher = createNotificationDispatcher({ notificationService, smsGateway })

    const result = await dispatcher.deliver({ phone: '+94 71 555 0101' }, payload)

    expect(result.attempts).toEqual([{ channel: 'sms', status: 'sent', detail: 'TW-1' }])
  })
})

describe('smsGateway', () => {
  it('logs simulated messages with unique references', async () => {
    const logger = { info: vi.fn() }
    const gateway = createSmsGateway({ logger })

    const first = await gateway.send({ to: '+94 71 555 0101', message: 'Hello' })
    const second = await gateway.send({ to: '+94 71 555 0101', message: 'Hello again' })

    expect(first.status).toBe('simulated')
    expect(first.providerRef).not.toBe(second.providerRef)
    expect(logger.info).toHaveBeenCalledWith('[SIMULATED SMS] to +94 71 555 0101: Hello')
    expect(gateway.mode).toBe('simulated')
  })

  it('fails without a phone number', async () => {
    const gateway = createSmsGateway({ logger: {} })

    await expect(gateway.send({ to: '  ', message: 'Hello' })).rejects.toThrow('No phone number is available for SMS.')
    await expect(gateway.send({ message: 'Hello' })).rejects.toMatchObject({ name: 'SmsDeliveryError' })
  })

  it('fails every message in unavailable mode', async () => {
    const gateway = createSmsGateway({ mode: 'unavailable' })

    await expect(gateway.send({ to: '+94 71 555 0101', message: 'Hello' })).rejects.toThrow('The SMS gateway is unavailable.')
  })

  it('refuses an unknown mode at start-up', () => {
    expect(() => createSmsGateway({ mode: 'twilio' })).toThrow('Unknown SMS_GATEWAY_MODE "twilio"')
  })
})
