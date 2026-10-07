// Render HotspotMap itself; replace only the external Leaflet DOM/network
// boundary. The state harness exercises its tile-error callback without tiles.
const harness = vi.hoisted(() => ({ slots: [], cursor: 0, map: null, tile: null, polygons: [] }))
vi.mock('../../../../frontend/node_modules/react/index.js', async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = harness.cursor++
    if (!(index in harness.slots)) harness.slots[index] = initial
    return [harness.slots[index], (value) => { harness.slots[index] = value }]
  },
}))
vi.mock('../../../../frontend/node_modules/react-leaflet/lib/index.js', () => ({
  MapContainer(props) { harness.map = props; return React.createElement('div', { 'data-map': true }, props.children) },
  TileLayer(props) { harness.tile = props; return null },
  Polygon(props) { harness.polygons.push(props); return React.createElement('div', { 'data-polygon': true }, props.children) },
  Tooltip(props) { return React.createElement('span', null, props.children) },
  Popup(props) { return React.createElement('span', null, props.children) },
}))
/* global React */
let HotspotMap, ThemeContext, renderToStaticMarkup
beforeAll(async () => {
  vi.stubGlobal('React', await import('../../../../frontend/node_modules/react/index.js'))
  ;({ default: HotspotMap } = await import('../../../../frontend/src/features/analytics/components/HotspotMap.jsx'))
  ;({ ThemeContext } = await import('../../../../frontend/src/context/theme-context.js'))
  ;({ renderToStaticMarkup } = await import('../../../../frontend/node_modules/react-dom/server.node.js'))
})
beforeEach(() => { harness.slots = []; harness.cursor = 0; harness.map = null; harness.tile = null; harness.polygons = [] })
afterAll(() => vi.unstubAllGlobals())
const boundary = { type: 'Polygon', coordinates: [[[81, 6], [82, 6], [82, 7], [81, 6]]] }
const row = (id, count, geometry = boundary) => ({ zone: { id, name: id, boundary: geometry }, count })
function render(represented, theme = 'dark') {
  harness.cursor = 0
  harness.polygons = []
  return renderToStaticMarkup(React.createElement(ThemeContext.Provider, { value: { theme } }, React.createElement(HotspotMap, { represented })))
}

it('keeps the count fallback when every stored boundary is missing or invalid', () => {
  expect(render([row('missing', 3, null), row('invalid', 4, { type: 'Point', coordinates: [81, 6] })])).toContain('Map geometry is unavailable')
  expect(harness.map).toBeNull()
  expect(harness.tile).toBeNull()
})

it.each(['dark', 'light'])('renders real hotspot labels and threshold styles with the %s map theme', (theme) => {
  const html = render([row('Below', 2), row('Hotspot', 3)], theme)
  expect(html).toContain('Below: 2 alert events')
  expect(html).toContain('Below hotspot threshold.')
  expect(html).toContain('Hotspot: 3 alert events')
  expect(html).toContain('threshold met.')
  expect(html).not.toContain('Some zones lack valid geometry')
  expect(harness.tile.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
  expect(harness.tile.attribution).toContain('OpenStreetMap</a> contributors')
  expect(harness.tile.attribution).not.toContain('CARTO')
  expect(harness.tile.referrerPolicy).toBe('strict-origin-when-cross-origin')
  expect(harness.map.scrollWheelZoom).toBe(false)
  expect(harness.map.bounds).toEqual([[6, 81], [6, 82], [7, 82], [6, 81], [6, 81], [6, 82], [7, 82], [6, 81]])
  expect(harness.polygons[0].pathOptions).toMatchObject({ fillOpacity: 0.1, dashArray: '5 5' })
  expect(harness.polygons[1].pathOptions).toMatchObject({ fillOpacity: 0.3, dashArray: undefined })
  expect(harness.polygons[0].pathOptions.color).not.toBe(harness.polygons[1].pathOptions.color)
})

it('discloses partial geometry and retains the stored outlines after a tile error', () => {
  const represented = [row('Visible', 3), row('List only', 4, null)]
  const before = structuredClone(represented)
  expect(render(represented)).toContain('Some zones lack valid geometry')
  expect(harness.polygons).toHaveLength(1)
  harness.tile.eventHandlers.tileerror()
  const html = render(represented)
  expect(html).toContain('Map tiles unavailable')
  expect(html).toContain('stored zone outlines and counts remain available')
  expect(html).toContain('Visible: 3 alert events')
  expect(harness.polygons).toHaveLength(1)
  expect(represented).toEqual(before)
})
