const { createAlertService, sortBySeverity } = require('./alert.service')

const NOW = new Date('2026-09-25T10:00:00Z')

const alert = (id, severity, minutesAgo, status = 'active') => ({
  _id: id,
  severity,
  status,
  createdAt: new Date(NOW.getTime() - minutesAgo * 60000)
})

function setup(alerts = []) {
  const alertRepository = {
    listByPark: vi.fn(async () => alerts),
    findById: vi.fn(async (id) => alerts.find((entry) => entry._id === id) ?? null),
    create: vi.fn(async (data) => ({ _id: 'new-alert', ...data })),
    updateIfStatus: vi.fn(async (id, fromStatuses, changes) => {
      const current = alerts.find((entry) => entry._id === id)
      return current && fromStatuses.includes(current.status) ? { ...current, ...changes } : null
    })
  }
  return { alertService: createAlertService({ alertRepository, clock: () => NOW }), alertRepository }
}

describe('sortBySeverity', () => {
  it('orders by severity, then by newest first', () => {
    const sorted = sortBySeverity([alert('a', 'medium', 5), alert('b', 'critical', 50), alert('c', 'critical', 10), alert('d', 'low', 1)])

    expect(sorted.map((entry) => entry._id)).toEqual(['c', 'b', 'a', 'd'])
  })
})

describe('alertService.listActive', () => {
  it('requests only unresolved alerts for the park', async () => {
    const { alertService, alertRepository } = setup([alert('a', 'high', 5)])

    await alertService.listActive('park-1')

    expect(alertRepository.listByPark).toHaveBeenCalledWith('park-1', { statuses: ['active', 'acknowledged', 'dispatched'] })
  })

  it('returns an empty list when there are no active alerts (UC04 A2)', async () => {
    const { alertService } = setup([])

    await expect(alertService.listActive('park-1')).resolves.toEqual([])
  })
})

describe('alertService.list', () => {
  it.each([
    [undefined, ['active', 'acknowledged', 'dispatched']],
    ['open', ['active', 'acknowledged', 'dispatched']],
    ['all', undefined],
    ['resolved', ['resolved']]
  ])('maps the %s filter to repository statuses', async (status, statuses) => {
    const { alertService, alertRepository } = setup()

    await alertService.list('park-1', { status })

    expect(alertRepository.listByPark).toHaveBeenCalledWith('park-1', { statuses })
  })
})

describe('alertService.acknowledge', () => {
  it('records who acknowledged an active alert and when', async () => {
    const { alertService, alertRepository } = setup([alert('a', 'high', 5)])

    const result = await alertService.acknowledge('a', 'manager-1')

    expect(alertRepository.updateIfStatus).toHaveBeenCalledWith('a', ['active'], {
      status: 'acknowledged',
      acknowledgedBy: 'manager-1',
      acknowledgedAt: NOW
    })
    expect(result.status).toBe('acknowledged')
  })

  it('refuses to acknowledge an alert that is no longer active', async () => {
    const { alertService } = setup([alert('a', 'high', 5, 'dispatched')])

    await expect(alertService.acknowledge('a', 'manager-1')).rejects.toMatchObject({ status: 409, code: 'ALERT_NOT_ACTIVE' })
  })

  it('reports a missing alert', async () => {
    const { alertService } = setup([])

    await expect(alertService.acknowledge('missing', 'manager-1')).rejects.toMatchObject({ status: 404, code: 'ALERT_NOT_FOUND' })
  })
})

describe('alertService dispatch lifecycle', () => {
  it('marks an open alert as dispatched inside the caller transaction', async () => {
    const { alertService, alertRepository } = setup([alert('a', 'critical', 5)])

    await alertService.markDispatched('a', { session: 'tx' })

    expect(alertRepository.updateIfStatus).toHaveBeenCalledWith('a', ['active', 'acknowledged'], { status: 'dispatched' }, { session: 'tx' })
  })

  it('prevents dispatching the same alert twice', async () => {
    const { alertService } = setup([alert('a', 'critical', 5, 'dispatched')])

    await expect(alertService.markDispatched('a')).rejects.toMatchObject({ code: 'ALERT_ALREADY_HANDLED' })
  })

  it('resolves an unresolved alert with a timestamp', async () => {
    const { alertService } = setup([alert('a', 'critical', 5, 'dispatched')])

    await expect(alertService.resolve('a')).resolves.toMatchObject({ status: 'resolved', resolvedAt: NOW })
  })

  it('raises new alerts as active', async () => {
    const { alertService, alertRepository } = setup()

    await alertService.raise({ title: 'Snare Detected', severity: 'high', status: 'resolved' })

    expect(alertRepository.create).toHaveBeenCalledWith({ title: 'Snare Detected', severity: 'high', status: 'active' }, { session: undefined })
  })

  it('raises an alert inside the caller transaction when given a session', async () => {
    const { alertService, alertRepository } = setup()

    await alertService.raise({ title: 'Escalated conflict', severity: 'high' }, { session: 'tx' })

    expect(alertRepository.create).toHaveBeenCalledWith({ title: 'Escalated conflict', severity: 'high', status: 'active' }, { session: 'tx' })
  })

  it('finds an alert or reports it missing', async () => {
    const { alertService } = setup([alert('a', 'low', 1)])

    await expect(alertService.findById('a')).resolves.toMatchObject({ _id: 'a' })
    await expect(alertService.findById('b')).rejects.toMatchObject({ code: 'ALERT_NOT_FOUND' })
  })
})
