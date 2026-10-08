const id = (value) => value.toString(16).padStart(24, '0')
function comparisonFixture() {
  const filters = { parkIds: [id(1), id(2)], startDate: '2026-10-01', endDate: '2026-10-07', species: 'test species', incidentType: '' }
  const retrievedAt = '2026-10-08T00:00:00Z'
  const datasets = filters.parkIds.map((parkId, index) => ({
    filters: { parkId, startDate: filters.startDate, endDate: filters.endDate, species: filters.species, incidentType: '' },
    park: { id: parkId, name: index ? 'Second Park' : 'First Park' },
    zones: [{ id: id(10 + index), name: index ? 'East' : 'North', targetWeeklyPatrolHours: index ? 14 : 7 }],
    retrievedAt, period: { from: '2026-09-30T18:30:00Z', until: '2026-10-07T18:30:00Z', timeZone: 'Asia/Colombo', endExclusive: true },
    records: {
      alerts: Array.from({ length: index ? 1 : 3 }, (_, i) => ({ id: id(100 + index * 10 + i), park: parkId, zone: id(10 + index), species: filters.species, createdAt: '2026-10-01T00:00:00Z' })),
      conflicts: [], patrolRecords: [{ id: id(200 + index), park: parkId, zone: id(10 + index), startTime: '2026-10-01T00:00:00Z', endTime: index ? '2026-10-01T02:00:00Z' : '2026-10-01T01:00:00Z', syncStatus: index ? 'pending' : 'synced' }],
    }, freshness: { requiresConfirmation: Boolean(index) },
  }))
  return { filters, retrievedAt, datasets }
}
module.exports = { comparisonFixture, id }
