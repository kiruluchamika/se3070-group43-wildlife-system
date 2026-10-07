const path = require('node:path')
const { chromium } = require('playwright')
const { comparisonFixture } = require('../../test-support/comparison-fixture')

// Exercise the actual React DOM and lazy Leaflet map, which headless render
// tests replace. Only API responses and remote map tiles are controlled.
describe('Analysis to Results browser regression', () => {
  let server, browser, origin
  beforeAll(async () => {
    const { createServer } = await import('vite')
    server = await createServer({ root: path.resolve(__dirname, '../../../../frontend'),
      server: { host: '127.0.0.1', port: 0, open: false } })
    await server.listen()
    origin = `http://127.0.0.1:${server.httpServer.address().port}`
    browser = await chromium.launch({ headless: true })
  })
  afterAll(async () => { await browser?.close(); await server?.close() })

  it.each([false, true])('renders complete Results after valid filters (comparison: %s)', async (comparison) => {
    const page = await browser.newPage()
    const errors = []
    let retrievalCalls = 0
    page.on('pageerror', error => errors.push(error.message))
    const dataset = comparisonFixture()
    dataset.filters.startDate = '2026-09-30'
    dataset.filters.endDate = '2026-10-06'
    dataset.filters.species = ''
    for (const [index, data] of dataset.datasets.entries()) {
      data.filters.species = ''
      data.filters.startDate = dataset.filters.startDate
      data.filters.endDate = dataset.filters.endDate
      data.period.from = '2026-09-29T18:30:00Z'
      data.period.until = '2026-10-06T18:30:00Z'
      data.park.name = index ? 'Sinharaja Forest Reserve' : 'Yala National Park'
      data.zones[0].boundary = { type: 'Polygon', coordinates: [[[81, 6], [82, 6], [82, 7], [81, 6]]] }
      data.freshness = { requiresConfirmation: false }
    }
    dataset.freshness = { requiresConfirmation: false }
    const user = { id: 'analyst', name: 'Conservation Analyst', role: 'data-analyst', park: null }
    await page.addInitScript(profile => {
      localStorage.setItem('wildguard-token', 'browser-test-token')
      localStorage.setItem('wildguard-user', JSON.stringify(profile))
    }, user)
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/analytics')) retrievalCalls++
      const data = url.pathname.endsWith('/auth/me') ? { user }
        : url.pathname.endsWith('/analytics/options') ? { parks: dataset.datasets.map(item => item.park), species: [], incidentTypes: [] }
          : url.pathname.endsWith('/analytics') ? comparison ? dataset : dataset.datasets[0]
            : { notifications: [], unreadCount: 0 }
      await route.fulfill({ json: data })
    })
    await page.route('https://tile.openstreetmap.org/**', route => route.abort())
    try {
      await page.goto(`${origin}/analytics`)
      await page.locator('select[name=parkId]').selectOption(dataset.datasets[0].park.id)
      if (comparison) {
        await page.getByLabel('Compare multiple parks').check()
        await page.getByLabel('Sinharaja Forest Reserve', { exact: true }).check()
      }
      await page.locator('input[name=startDate]').fill('2999-01-01')
      await page.locator('input[name=endDate]').fill(dataset.filters.endDate)
      await page.getByRole('button', { name: 'Analyze Data' }).click()
      await page.getByText('Start date cannot be in the future. Dates use Sri Lanka time.', { exact: true }).waitFor()
      expect(retrievalCalls).toBe(0)
      await page.locator('input[name=startDate]').fill(dataset.filters.startDate)
      await page.locator('input[name=endDate]').fill('2999-01-01')
      await page.getByRole('button', { name: 'Analyze Data' }).click()
      await page.getByText('End date cannot be in the future. Dates use Sri Lanka time.', { exact: true }).waitFor()
      expect(retrievalCalls).toBe(0)
      await page.locator('input[name=startDate]').fill(dataset.filters.endDate)
      await page.locator('input[name=endDate]').fill(dataset.filters.startDate)
      await page.getByRole('button', { name: 'Analyze Data' }).click()
      await page.getByText('End date must be on or after the start date.', { exact: true }).waitFor()
      expect(retrievalCalls).toBe(0)
      await page.locator('input[name=startDate]').fill(dataset.filters.startDate)
      await page.locator('input[name=endDate]').fill(dataset.filters.endDate)
      await page.getByRole('button', { name: 'Analyze Data' }).click()
      await page.getByRole('heading', { name: 'Analysis Results', exact: true }).waitFor()
      await page.locator('.leaflet-container').first().waitFor()
      expect(retrievalCalls).toBe(1)
      expect(await page.getByRole('heading', { name: 'Incident Trends', exact: true }).count()).toBe(comparison ? 2 : 1)
      expect(await page.getByRole('heading', { name: 'Patrol Coverage', exact: true }).count()).toBe(comparison ? 2 : 1)
      expect(await page.getByRole('button', { name: 'View Supporting Records' }).count()).toBe(comparison ? 2 : 1)
      expect(await page.getByRole('button', { name: 'Continue to Report', exact: true }).isVisible()).toBe(true)
      if (comparison) expect(await page.getByRole('heading', { name: 'Comparative Overview' }).isVisible()).toBe(true)
      expect(errors).toEqual([])
    } finally { await page.close() }
  })
})
