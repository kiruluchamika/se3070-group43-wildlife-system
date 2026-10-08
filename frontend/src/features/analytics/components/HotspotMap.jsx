import 'leaflet/dist/leaflet.css'
import { useMemo, useState } from 'react'
import { MapContainer, Polygon, Popup, TileLayer, Tooltip } from 'react-leaflet'
import { polygonPositions } from '../lib/calculateVisualizations'

/** Uses public OpenStreetMap tiles; hotspot overlays retain their existing styles. */
export default function HotspotMap({ represented }) {
  const [tileFailure, setTileFailure] = useState(false)
  const mapped = useMemo(() => represented.map((row) => ({ ...row, positions: polygonPositions(row.zone.boundary) })).filter((row) => row.positions), [represented])
  if (!mapped.length) return <p className="mt-4 text-sm text-muted">Map geometry is unavailable for these zones. The hotspot counts remain available above.</p>
  const bounds = mapped.flatMap((row) => row.positions.flat())
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-muted">Solid red: hotspot (≥3 alert events). Dashed teal: below threshold. Select a zone for its count. Boundaries are the existing illustrative park polygons.</p>
      {mapped.length < represented.length && <p className="mb-2 text-xs text-muted">Some zones lack valid geometry and are shown only in the list.</p>}
      {tileFailure && <p role="status" className="mb-2 text-sm text-amber-600 dark:text-amber-300">Map tiles unavailable — stored zone outlines and counts remain available.</p>}
      <div className="relative isolate h-[320px] overflow-hidden rounded-2xl border border-line sm:h-[400px]" aria-label="Zone activity map">
        <MapContainer bounds={bounds} boundsOptions={{ padding: [24, 24] }} scrollWheelZoom={false} className="size-full">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
            referrerPolicy="strict-origin-when-cross-origin"
            eventHandlers={{ tileerror: () => setTileFailure(true) }} />
          {mapped.map((row) => <Polygon key={row.zone.id} positions={row.positions}
            pathOptions={{ color: row.count >= 3 ? '#f87171' : '#24d6c2', fillOpacity: row.count >= 3 ? 0.3 : 0.1, dashArray: row.count >= 3 ? undefined : '5 5' }}>
            <Tooltip className="wg-tooltip">{row.zone.name}: {row.count} alert events{row.count >= 3 ? ' · Hotspot' : ''}</Tooltip>
            <Popup>{row.zone.name}: {row.count} alert events. {row.count >= 3 ? 'Hotspot — threshold met.' : 'Below hotspot threshold.'}</Popup>
          </Polygon>)}
        </MapContainer>
      </div>
    </div>
  )
}
