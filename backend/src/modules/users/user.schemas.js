const { z } = require('zod')
const { registerBody } = require('./auth.schemas')
const { ALL_ROLES } = require('../../shared/roles')
const { objectId } = require('../../shared/validation')

const fields = { role: z.enum(ALL_ROLES), park: objectId('Park').nullable().optional() }
const createUserBody = registerBody.extend(fields).strict()
const editUserBody = registerBody.omit({ password: true }).extend(fields).strict()
const userStatusBody = z.object({ isActive: z.boolean() }).strict()
const userListQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict()
module.exports = { createUserBody, editUserBody, userStatusBody, userListQuery }
