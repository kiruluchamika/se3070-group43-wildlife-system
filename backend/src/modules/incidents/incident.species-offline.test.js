require('fake-indexeddb/auto')
const harness = vi.hoisted(() => ({ submit: vi.fn() }))
vi.mock('../../../../frontend/src/features/incidents/api/incidentApi.js', () => ({ incidentApi: { submit: harness.submit } }))

it('keeps optional species through Dexie storage, failed sync and successful retry', async () => {
  const { saveIncident, listIncidents, discardIncident } = await import('../../../../frontend/src/features/incidents/offline/incidentDb.js')
  const { syncIncidents } = await import('../../../../frontend/src/features/incidents/offline/incidentQueue.js')
  for (const species of ['test species', undefined]) {
    const payload = { clientId: species ? 'species' : 'legacy', species, photos: [] }
    await saveIncident('ranger-test', payload)
    try {
      expect((await listIncidents('ranger-test'))[0].payload.species).toBe(species)
      harness.submit.mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'Offline' })
      await syncIncidents('ranger-test')
      expect((await listIncidents('ranger-test'))[0]).toMatchObject({ status: 'queued', payload })
      harness.submit.mockResolvedValueOnce({ incident: { id: 'server', species } })
      await syncIncidents('ranger-test')
      expect(harness.submit).toHaveBeenLastCalledWith(payload)
      expect((await listIncidents('ranger-test'))[0]).toMatchObject({ status: 'synced', payload })
    } finally { await discardIncident(payload.clientId) }
  }
})
