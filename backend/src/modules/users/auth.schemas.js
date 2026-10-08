const { z } = require('zod')

const email = z
  .string({ error: 'Email address is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'))

const registerBody = z.object({
  name: z.string({ error: 'Full name is required.' }).trim().min(2, 'Full name must contain at least 2 characters.').max(80),
  email,
  password: z
    .string({ error: 'Password is required.' })
    .min(8, 'Password must contain at least 8 characters.')
    .max(128, 'Password must not exceed 128 characters.'),
  phone: z.string().trim().max(20, 'Phone number is too long.').optional()
})

const loginBody = z.object({
  email,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.')
})

module.exports = { registerBody, loginBody }
