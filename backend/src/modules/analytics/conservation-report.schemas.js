const { z } = require('zod')
const { objectId } = require('../../shared/validation')
const { singleParkQuery, comparisonQuery, dateWindow } = require('./analytics.schemas')

const count = z.number().int().min(0).max(15000)
const hours = z.number().finite().min(0)
const instant = z.iso.datetime({ offset: true })
const zone = z.object({ id: objectId('Zone'), name: z.string().min(1).max(300) })
const reference = z.object({ source: z.enum(['alerts', 'conflicts', 'patrolRecords']), recordId: objectId('Source record') })
const references = z.array(reference).max(15000)
const failed = z.object({ status: z.literal('error') })
const state = z.enum(['ready', 'empty'])
const hotspotRow = z.object({ zone, count, references })
const snapshotSchema = z.object({
  context: z.object({
    filters: singleParkQuery,
    park: z.object({ id: objectId('Park'), name: z.string().min(1).max(300) }),
    period: z.object({ from: instant, until: instant, timeZone: z.literal('Asia/Colombo'), endExclusive: z.literal(true) }),
    retrievedAt: instant,
  }),
  statistics: z.object({ totalEventRecords: count, alertRecords: count, conflictRecords: count, representedZones: count, patrolRecords: count }),
  sourceReferences: references,
  analysis: z.object({
    trends: z.union([failed, z.object({ status: state, unit: z.enum(['day', 'month']), omitted: count,
      buckets: z.array(z.object({ key: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/), alerts: count, conflicts: count, references })).max(1200) })]),
    hotspots: z.union([failed, z.object({ status: state, threshold: z.literal(3), omitted: count, unzoned: count, hotspots: z.array(hotspotRow).max(5000) })]),
    coverage: z.union([failed, z.object({ status: state, elapsedDays: hours, windowDays: z.number().finite().positive(), cutoff: instant, omitted: count,
      zones: z.array(z.object({ zone, hours, references, targetHours: z.number().finite().positive().nullable(), percent: z.number().int().min(0).max(100).nullable() })).max(5000) })]),
  }),
}).strict().superRefine((snapshot, ctx) => {
  const fail = (message) => ctx.addIssue({ code: 'custom', message })
  const { context, statistics, sourceReferences, analysis } = snapshot
  const window = dateWindow(context.filters)
  if (context.park.id !== context.filters.parkId || new Date(context.period.from).getTime() !== window.from.getTime() ||
    new Date(context.period.until).getTime() !== window.until.getTime()) fail('Analysis context does not match its filters.')
  const keys = new Set(sourceReferences.map((ref) => `${ref.source}:${ref.recordId}`))
  if (keys.size !== sourceReferences.length) fail('Duplicate source references are not allowed.')
  for (const [source, field] of [['alerts', 'alertRecords'], ['conflicts', 'conflictRecords'], ['patrolRecords', 'patrolRecords']]) {
    const size = sourceReferences.filter((ref) => ref.source === source).length
    if (size > 5000 || size !== statistics[field]) fail('Statistics do not match the source references.')
  }
  if (statistics.totalEventRecords !== statistics.alertRecords + statistics.conflictRecords) fail('Event totals must exclude patrols.')
  function check(rows, allowed) {
    const seen = new Set()
    for (const row of rows) for (const ref of row.references) {
      const key = `${ref.source}:${ref.recordId}`
      if (!allowed.includes(ref.source) || !keys.has(key) || seen.has(key)) fail('Invalid supporting analysis reference.')
      seen.add(key)
    }
  }
  if (analysis.trends.status !== 'error') {
    check(analysis.trends.buckets, ['alerts', 'conflicts'])
    for (const row of analysis.trends.buckets) for (const source of ['alerts', 'conflicts']) {
      if (row[source] !== row.references.filter((ref) => ref.source === source).length) fail('Trend counts do not match references.')
    }
  }
  if (analysis.hotspots.status !== 'error') {
    check(analysis.hotspots.hotspots, ['alerts'])
    for (const row of analysis.hotspots.hotspots) if (row.count < 3 || row.count !== row.references.length) fail('Invalid hotspot count.')
  }
  if (analysis.coverage.status !== 'error') check(analysis.coverage.zones, ['patrolRecords'])
})

const comparisonSnapshot = z.object({
  context: z.object({ filters: comparisonQuery, retrievedAt: instant }).strict(),
  parks: z.array(snapshotSchema).min(2).max(20),
}).strict().superRefine((snapshot, ctx) => {
  const { parkIds, ...filters } = snapshot.context.filters
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Comparison sections must match all selected parks and filters without shared source records.' })
  if (parkIds.length !== snapshot.parks.length) fail()
  const references = new Set()
  snapshot.parks.forEach((section, index) => {
    if (section.context.park.id !== parkIds[index] || Object.entries(filters).some(([key, value]) => section.context.filters[key] !== value)) fail()
    for (const ref of section.sourceReferences) {
      const key = `${ref.source}:${ref.recordId}`
      if (references.has(key)) fail()
      references.add(key)
    }
  })
})

const saveReportBody = z.object({
  requestId: z.uuid(),
  status: z.enum(['draft', 'finalized']),
  title: z.string().max(200).refine((value) => value.trim().length > 0, 'Enter a report title.'),
  findings: z.string().max(5000),
  recommendations: z.string().max(5000),
  snapshot: z.union([snapshotSchema, comparisonSnapshot]),
}).strict()
const reportsQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
const editDraftBody = saveReportBody.pick({ title: true, findings: true, recommendations: true })
  .extend({ revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1) }).strict()
const shareReportBody = z.object({ recipients: z.array(objectId('Park Manager')).min(1, 'Select at least one Park Manager.').max(100) }).strict()
module.exports = { saveReportBody, reportsQuery, editDraftBody, shareReportBody }
