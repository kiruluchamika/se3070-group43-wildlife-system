const { z } = require('zod')

// The normalized explicit name is both the identifier and display label.
// Empty means unspecified; never derive it from incident descriptions.
const normalizeSpecies = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : value
const speciesValue = z.string().max(80).transform(normalizeSpecies)
module.exports = { normalizeSpecies, speciesValue }
