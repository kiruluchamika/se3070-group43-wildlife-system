const bcrypt = require('bcryptjs')
const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { validateRegistration } = require('../auth.validation')

const router = express.Router()
const tokenSecret = process.env.JWT_SECRET || 'development-only-secret'

function createToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, tokenSecret, { expiresIn: '8h' })
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role }
}

router.post('/register', async (request, response) => {
  try {
    const { name, email, password, role } = request.body
    const validationMessage = validateRegistration({ name, email, password })
    if (validationMessage) return response.status(400).json({ message: validationMessage })

    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return response.status(409).json({ message: 'An account with this email already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, passwordHash, role })
    return response.status(201).json({ token: createToken(user), user: publicUser(user) })
  } catch (error) {
    return response.status(500).json({ message: 'Unable to create account.' })
  }
})

router.post('/login', async (request, response) => {
  try {
    const { email, password } = request.body
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+passwordHash')
    const passwordMatches = user && await bcrypt.compare(password || '', user.passwordHash)

    if (!passwordMatches) {
      return response.status(401).json({ message: 'Invalid email or password.' })
    }

    return response.json({ token: createToken(user), user: publicUser(user) })
  } catch (error) {
    return response.status(500).json({ message: 'Unable to sign in.' })
  }
})

router.get('/me', async (request, response) => {
  try {
    const header = request.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return response.status(401).json({ message: 'Authentication is required.' })

    const payload = jwt.verify(token, tokenSecret)
    const user = await User.findById(payload.userId)
    if (!user) return response.status(404).json({ message: 'User account was not found.' })

    return response.json({ user: publicUser(user) })
  } catch (error) {
    return response.status(401).json({ message: 'Your session is invalid or expired.' })
  }
})

module.exports = router
