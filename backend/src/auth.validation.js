function validateRegistration({ name, email, password }) {
  if (!name || !email || !password) return 'Name, email, and password are required.'
  if (password.length < 8) return 'Password must contain at least 8 characters.'
  return null
}

module.exports = { validateRegistration }
