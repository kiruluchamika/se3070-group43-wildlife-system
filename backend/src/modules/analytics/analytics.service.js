const { ForbiddenError, NotFoundError, UnauthorizedError } = require('../../shared/errors/AppError')
const { ROLES } = require('../../shared/roles')
const { toId } = require('../../shared/utils/serialize')
const { dateWindow, INCIDENT_TYPES } = require('./analytics.schemas')

/** Only explicit stored sync state triggers a warning, never record age. */
function inspectFreshness({ alerts, patrolRecords }) {
  const sources = [
    ...alerts.filter((record) => ['camera-trap', 'gps-collar'].includes(record.source)).map((record) => ({
      recordId: toId(record._id),
      source: record.source,
      label: `${record.source === 'camera-trap' ? 'Camera Trap' : 'GPS Collar'} ${record.sourceRef || toId(record._id)}`,
      status: 'unknown',
      lastSuccessfulSyncAt: null,
      reason: 'This source does not record synchronization status or a last successful synchronization time.'
    })),
    ...patrolRecords.map((record) => ({
      recordId: toId(record._id),
      source: 'patrol-record',
      label: `Patrol record ${toId(record._id)}`,
      status: record.syncStatus === 'pending' ? 'potentially-outdated' : record.syncStatus === 'synced' ? 'synced' : 'unknown',
      lastSuccessfulSyncAt: null,
      reason: record.syncStatus === 'pending'
        ? 'The server has this record marked as pending synchronization.'
        : 'The patrol model records sync status, but no last successful synchronization time.'
    }))
  ]
  const affectedSources = sources.filter((source) => source.status === 'potentially-outdated')
  return {
    requiresConfirmation: affectedSources.length > 0,
    status: affectedSources.length ? 'potentially-outdated' : sources.length && sources.every((source) => source.status === 'synced') ? 'synced' : 'unknown',
    sources,
    affectedSources,
    note: 'Only synchronization information known to the server is shown. Records still only on field devices are not known.'
  }
}

function createAnalyticsService({ analyticsRepository, parkRepository, userRepository, clock = () => new Date() }) {
  async function analyst(user) {
    const account = await userRepository.findById(user.id)
    if (!account) throw new UnauthorizedError('Your account no longer exists.', 'USER_NOT_FOUND')
    if (account.role !== ROLES.DATA_ANALYST) throw new ForbiddenError('Only Data Analysts can retrieve analysis data.', 'ACCESS_DENIED')
    return account
  }
  return {
    async options(user) {
      const account = await analyst(user)
      const parks = await parkRepository.listParks()
      return { parks: parks.filter((park) => !account.park || toId(park._id) === toId(account.park)), incidentTypes: INCIDENT_TYPES, species: [] }
    },
    async retrieve(filters, user) {
      const account = await analyst(user)
      if (account.park && toId(account.park) !== filters.parkId) {
        throw new ForbiddenError('This park is outside your assigned park.', 'OUTSIDE_ASSIGNED_PARK')
      }
      const park = await parkRepository.findParkById(filters.parkId)
      if (!park) throw new NotFoundError('The selected park was not found.', 'PARK_NOT_FOUND')
      const window = dateWindow(filters)
      const [records, zones] = await Promise.all([
        analyticsRepository.retrieve({ ...filters, ...window }),
        parkRepository.listZones(filters.parkId)
      ])
      return {
        filters,
        retrievedAt: clock(),
        period: { ...window, timeZone: 'Asia/Colombo', endExclusive: true },
        park,
        zones,
        records,
        freshness: inspectFreshness(records),
        limitations: [
          'Species filtering is unavailable because current source models have no species field.',
          'Alerts use their creation time; conflicts use occurredAt; patrols overlap the selected period.',
          'Incident type filters alerts and conflicts only. Patrols and zones remain coverage context.',
          'Alerts and conflicts remain separate sources and may describe the same event.',
          'UC03 wildlife incidents are not connected. No analysis or coverage calculations have run.'
        ]
      }
    }
  }
}

module.exports = { createAnalyticsService, inspectFreshness }
