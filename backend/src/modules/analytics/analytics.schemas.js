const { speciesValue } = require('../../shared/species')
const { z } = require('zod')
const { objectId } = require('../../shared/validation')
const { ALERT_TYPES } = require('../alerts/alert.model')
const { CONFLICT_TYPES } = require('../conflicts/conflict.constants')

const INCIDENT_TYPES = [...new Set([...ALERT_TYPES, ...CONFLICT_TYPES])].sort()
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates.').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Enter a valid calendar date.')

const commonFilters = {
  startDate: calendarDate,
  endDate: calendarDate,
  species: speciesValue.optional().default(''),
  incidentType: z.enum(['', ...INCIDENT_TYPES]).optional().default('')
}
const validDates = (value) => value.startDate <= value.endDate
const dateError = { message: 'End date must be on or after the start date.', path: ['endDate'] }
const singleParkQuery = z.object({ parkId: objectId('Park'), ...commonFilters }).strict().refine(validDates, dateError)
const comparisonQuery = z.object({
  parkIds: z.preprocess((value) => typeof value === 'string' ? value.split(',') : value,
    z.array(objectId('Park')).min(2).max(20).refine((ids) => new Set(ids).size === ids.length, 'Choose distinct parks.')),
  ...commonFilters,
}).strict().refine(validDates, dateError)
const retrievalQuery = z.union([singleParkQuery, comparisonQuery])

function dateWindow({ startDate, endDate }) {
  // Date-only selections are inclusive calendar days in the parks' timezone.
  return {
    from: new Date(`${startDate}T00:00:00+05:30`),
    until: new Date(new Date(`${endDate}T00:00:00+05:30`).getTime() + 86400000)
  }
}

module.exports = { retrievalQuery, singleParkQuery, comparisonQuery, dateWindow, INCIDENT_TYPES }
