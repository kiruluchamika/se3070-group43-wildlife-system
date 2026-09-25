const { validateRegistration } = require('./auth.validation')

describe('registration validation', () => {
  it('requires the account fields', () => {
    expect(validateRegistration({ name: '', email: '', password: '' })).toBe('Name, email, and password are required.')
  })

  it('rejects passwords shorter than eight characters', () => {
    expect(validateRegistration({ name: 'Ranger', email: 'ranger@example.com', password: 'short' })).toBe('Password must contain at least 8 characters.')
  })

  it('accepts a complete valid registration', () => {
    expect(validateRegistration({ name: 'Ranger', email: 'ranger@example.com', password: 'long-enough' })).toBeNull()
  })
})