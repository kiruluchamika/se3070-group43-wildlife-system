// Render the actual UC02 dialogs. Only shared portal/control boundaries are
// replaced so their callbacks can be exercised without installing a DOM library.
const controls = vi.hoisted(() => ({ buttons: [], selects: [], modal: null }))
vi.mock('../../../../frontend/src/components/ui/Modal.jsx', () => ({
  Modal(props) {
    controls.modal = props
    return props.open ? React.createElement('section', { role: 'dialog' }, props.description, props.children, props.footer) : null
  },
}))
vi.mock('../../../../frontend/src/components/ui/Button.jsx', () => ({
  Button(props) {
    controls.buttons.push(props)
    return React.createElement('button', { disabled: props.disabled, type: props.type }, props.children)
  },
}))
vi.mock('../../../../frontend/src/components/ui/Field.jsx', async (importOriginal) => ({
  ...await importOriginal(),
  Select(props) {
    controls.selects.push(props)
    return React.createElement('select', props, props.children)
  },
}))
/* global React */
let renderToStaticMarkup, SupportingRecordsModal, FreshnessDialog, calculateStatistics, calculateVisualizations, supportingReducer
beforeAll(async () => {
  vi.stubGlobal('React', await import('../../../../frontend/node_modules/react/index.js'))
  ;({ renderToStaticMarkup } = await import('../../../../frontend/node_modules/react-dom/server.node.js'))
  ;({ SupportingRecordsModal } = await import('../../../../frontend/src/features/analytics/components/SupportingRecordsModal.jsx'))
  ;({ FreshnessDialog } = await import('../../../../frontend/src/features/analytics/components/FreshnessDialog.jsx'))
  ;({ calculateStatistics } = await import('../../../../frontend/src/features/analytics/lib/calculateStatistics.js'))
  ;({ calculateVisualizations } = await import('../../../../frontend/src/features/analytics/lib/calculateVisualizations.js'))
  ;({ supportingReducer } = await import('../../../../frontend/src/features/analytics/lib/supportingRecords.js'))
})
afterAll(() => vi.unstubAllGlobals())
function render(Component, props) {
  controls.buttons = []
  controls.selects = []
  return renderToStaticMarkup(React.createElement(Component, props))
}
const button = (label) => controls.buttons.find((entry) => entry.children === label)
function fixture() {
  const at = '2026-10-01T18:30:00Z'
  const dataset = {
    filters: { parkId: 'park', startDate: '2026-10-01', endDate: '2026-10-07', species: '', incidentType: 'fire' },
    park: { id: 'park', name: 'Yala' },
    period: { from: '2026-09-30T18:30:00Z', until: '2026-10-07T18:30:00Z' },
    retrievedAt: '2026-10-08T00:00:00Z',
    zones: [{ id: 'north', name: 'North', targetWeeklyPatrolHours: 7 }, { id: 'south', name: 'South', targetWeeklyPatrolHours: 7 }],
    records: {
      alerts: [1, 2, 3].map((i) => ({ id: `alert-${i}`, zone: i === 1 ? { id: 'north' } : 'north',
        eventAt: at, createdAt: '2026-09-01T00:00:00Z', type: 'fire', source: 'camera-trap', status: 'new', title: `Camera ${i}`, simulated: i === 1 })),
      conflicts: [{ id: 'conflict', occurredAt: at, conflictType: 'crop-damage', reference: 'CF-001', status: 'reported' }],
      patrolRecords: [{ id: 'patrol', zone: { id: 'south' }, startTime: at, endTime: null, syncStatus: 'pending' }],
    },
  }
  return dataset
}
function dialog(dataset = fixture()) {
  const result = calculateStatistics(dataset)
  const analysis = calculateVisualizations(result, dataset)
  let state = { open: true, category: 'all', zoneId: '', page: 0 }
  const dispatch = vi.fn((action) => { state = supportingReducer(state, action) })
  const onClose = vi.fn()
  return { result, analysis, dispatch, onClose,
    render: (override = {}) => render(SupportingRecordsModal, { result, dataset, analysis, state, dispatch, onClose, ...override }),
  }
}
const bodyRows = (html) => html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr[\s\S]*?<\/tr>/g) ?? []

it('renders source-specific records with Colombo event time, real state and missing end-time feedback', () => {
  const view = dialog()
  const html = view.render()
  const rows = bodyRows(html)
  expect(rows).toHaveLength(5)
  expect(rows[0]).toContain('2 Oct 2026, 00:00')
  expect(rows[0]).not.toContain('1 Sept 2026')
  expect(rows[0]).toContain('North')
  expect(rows[0]).toContain('Source: Camera trap')
  expect(rows[0]).not.toContain('Simulated')
  expect(rows[3]).toContain('CF-001')
  expect(rows[3]).toContain('Not recorded') // Conflicts have no zone.
  expect(rows[4]).toContain('South')
  expect(rows[4]).toContain('End: Not recorded')
  expect(rows[4]).toContain('Sync: Pending')
  button('Close').onClick()
  expect(view.onClose).toHaveBeenCalledOnce()
})

it('omits only the fixture title marker without changing stored records or explanatory text', () => {
  const dataset = fixture()
  dataset.records.alerts[0].title = '[SIMULATED SAMPLE] Leopard observation'
  dataset.records.alerts[1].title = 'Sample collection near the waterhole'
  const before = structuredClone(dataset)
  const html = dialog(dataset).render()
  expect(html).toContain('Leopard observation')
  expect(html).not.toContain('[SIMULATED SAMPLE]')
  expect(html).toContain('Sample collection near the waterhole')
  expect(html).toContain('Source: Camera trap')
  expect(dataset).toEqual(before)
})

it('renders legacy alert timestamps and missing or invalid source fields without inventing values', () => {
  const dataset = fixture()
  dataset.filters.incidentType = ''
  dataset.records = {
    alerts: [{ id: 'legacy', createdAt: '2026-10-01T18:30:00Z', zone: 'unknown' }, { id: 'bad-time', createdAt: 'invalid' }],
    conflicts: [{ id: 'missing-conflict-time' }],
    patrolRecords: [{ id: 'missing-patrol-time', endTime: 'invalid' }],
  }
  const html = dialog(dataset).render()
  const rows = bodyRows(html)
  expect(controls.modal.description).toContain('All incident types')
  expect(rows[0]).toContain('2 Oct 2026, 00:00')
  for (const row of rows) expect(row).toContain('Not recorded')
  expect(rows[1]).not.toContain('Invalid Date')
  expect(rows[3]).toContain('Start: Not recorded')
  expect(rows[3]).toContain('End: Not recorded')
  expect(html).not.toContain('Sync: Synced')
})

it('wires category and zone controls to the retained references and resets contextual selection', () => {
  const dataset = fixture()
  const before = structuredClone(dataset)
  const view = dialog(dataset)
  view.render()
  controls.selects[0].onChange({ target: { value: 'hotspots' } })
  let html = view.render()
  expect(bodyRows(html)).toHaveLength(3)
  expect(controls.selects[1].children[0].props.children).toBe('All Hotspots')
  controls.selects[1].onChange({ target: { value: 'north' } })
  view.render()
  expect(controls.selects[1].value).toBe('north')
  controls.selects[0].onChange({ target: { value: 'patrol-coverage' } })
  html = view.render()
  expect(controls.selects[1].value).toBe('')
  expect(controls.selects[1].children[0].props.children).toBe('All Zones')
  expect(bodyRows(html)).toHaveLength(1)
  expect(html).toContain('ID: patrol')
  controls.selects[1].onChange({ target: { value: 'south' } })
  expect(view.render()).toContain('ID: patrol')
  controls.selects[0].onChange({ target: { value: 'trends' } })
  html = view.render()
  expect(controls.selects).toHaveLength(1)
  expect(bodyRows(html)).toHaveLength(4)
  expect(html).not.toContain('ID: patrol')
  expect(dataset).toEqual(before)
})

it('paginates rendered records in groups of 25 and clamps an out-of-range page', () => {
  const dataset = fixture()
  dataset.records = { alerts: Array.from({ length: 30 }, (_, i) => ({ id: `page-record-${i}`, createdAt: '2026-10-01T00:00:00Z' })), conflicts: [], patrolRecords: [] }
  const view = dialog(dataset)
  let html = view.render()
  expect(bodyRows(html)).toHaveLength(25)
  expect(button('Previous').disabled).toBe(true)
  expect(button('Next').disabled).toBe(false)
  button('Next').onClick()
  html = view.render()
  expect(bodyRows(html)).toHaveLength(5)
  expect(html).toContain('ID: page-record-25')
  expect(html).not.toContain('ID: page-record-24')
  expect(button('Next').disabled).toBe(true)
  button('Previous').onClick()
  expect(bodyRows(view.render())).toHaveLength(25)
  html = view.render({ state: { open: true, category: 'all', zoneId: '', page: 99 } })
  expect(html).toContain('Page 2 of 2')
  expect(bodyRows(html)).toHaveLength(5)
})

it('renders the actual empty-category messages and omits Hotspots when no hotspot exists', () => {
  const dataset = fixture()
  dataset.records = { alerts: [], conflicts: [], patrolRecords: [] }
  const view = dialog(dataset)
  expect(view.render()).toContain('No supporting records are available')
  expect(controls.selects[0].children.map((entry) => entry.props.value)).not.toContain('hotspots')
  controls.selects[0].onChange({ target: { value: 'trends' } })
  expect(view.render()).toContain('No records available for the selected trend analysis')
  controls.selects[0].onChange({ target: { value: 'patrol-coverage' } })
  expect(view.render()).toContain('No patrol records are available')
})

it('renders section failure separately from empty results and still allows All Results', () => {
  const view = dialog()
  view.analysis.trends = { status: 'error' }
  view.render()
  controls.selects[0].onChange({ target: { value: 'trends' } })
  expect(view.render()).toContain('this analysis section could not be calculated')
  expect(bodyRows(view.render())).toHaveLength(0)
  controls.selects[0].onChange({ target: { value: 'all' } })
  expect(bodyRows(view.render())).toHaveLength(5)
})

it('renders pending-source freshness details and wires Continue, Cancel and dismissal', () => {
  const onContinue = vi.fn(), onCancel = vi.fn()
  const html = render(FreshnessDialog, { open: true, onContinue, onCancel, freshness: {
    affectedSources: [{ source: 'patrol-record', recordId: 'pending', label: 'Pending patrol', lastSuccessfulSyncAt: null, reason: 'Pending synchronization.' }],
    note: 'Unseen device records are unknown.',
  } })
  expect(html).toContain('Pending patrol')
  expect(html).toContain('Last successful synchronization: Not recorded')
  expect(html).toContain('Pending synchronization.')
  expect(html).toContain('Unseen device records are unknown.')
  button('Continue Analysis').onClick()
  button('Cancel').onClick()
  controls.modal.onClose()
  expect(onContinue).toHaveBeenCalledOnce()
  expect(onCancel).toHaveBeenCalledTimes(2)
})

it('formats a supplied synchronization time locally and tolerates absent freshness while closed', () => {
  const props = { open: true, onContinue: vi.fn(), onCancel: vi.fn(), freshness: { affectedSources: [
    { source: 'patrol-record', recordId: 'known', label: 'Stored timestamp', lastSuccessfulSyncAt: '2026-10-01T18:30:00Z' },
  ] } }
  expect(render(FreshnessDialog, props)).toContain('2 Oct 2026, 00:00')
  expect(render(FreshnessDialog, { ...props, open: false, freshness: undefined })).toBe('')
})
