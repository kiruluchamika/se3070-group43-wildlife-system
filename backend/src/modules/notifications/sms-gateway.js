class SmsDeliveryError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SmsDeliveryError'
  }
}

const SMS_MODES = Object.freeze(['simulated', 'unavailable'])

/**
 * SMS adapter. The prototype has no SMS provider contract, so the default
 * gateway is **simulated**: it logs the message and reports `simulated`, never
 * `delivered`. `SMS_GATEWAY_MODE=unavailable` makes every send fail, which is
 * how UC01 exception flows E2 and E3 are demonstrated.
 *
 * A real provider only needs the same `send({ to, message })` contract,
 * returning `{ status: 'sent', providerRef }`.
 */
function createSmsGateway({ mode = 'simulated', logger = console } = {}) {
  if (!SMS_MODES.includes(mode)) throw new Error(`Unknown SMS_GATEWAY_MODE "${mode}". Use one of: ${SMS_MODES.join(', ')}.`)
  let counter = 0

  return {
    mode,

    async send({ to, message }) {
      if (!to?.trim()) throw new SmsDeliveryError('No phone number is available for SMS.')
      if (mode === 'unavailable') throw new SmsDeliveryError('The SMS gateway is unavailable.')

      counter += 1
      logger.info?.(`[SIMULATED SMS] to ${to}: ${message}`)
      return { status: 'simulated', providerRef: `SIM-${Date.now().toString(36)}-${counter}` }
    }
  }
}

module.exports = { createSmsGateway, SmsDeliveryError, SMS_MODES }
