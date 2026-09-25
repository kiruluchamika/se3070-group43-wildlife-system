const { z } = require('zod')

/** A 24-character hexadecimal MongoDB ObjectId. */
const objectId = (label = 'Identifier') =>
  z.string({ error: `${label} is required.` }).regex(/^[a-f\d]{24}$/i, `${label} is not valid.`)

const idParams = z.object({ id: objectId('Record id') })

module.exports = { objectId, idParams }
