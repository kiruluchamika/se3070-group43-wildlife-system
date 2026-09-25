import 'leaflet/dist/leaflet.css'
import { MapPinOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useTheme } from '../../../context/theme-context'
import { cn } from '../../../lib/cn'
import { formatRelativeTime, humanize } from '../../../lib/format'
import { alertIcon, boundsOf, teamIcon, toLatLngs, ZONE_COLORS } from '../lib/mapIcons'

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'

/** Fits the park on first load / park change and flies to the focused zone or alert. */
function MapController({ bounds, boundsKey, focus }) {
  const map = useMap()

  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] })
    // Only refit when the park changes, not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, boundsKey])

  useEffect(() => {
    if (focus?.lat !== undefined) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 12), { duration: 0.8 })
  }, [map, focus])

  return null
}

function Legend() {
  const items = [
    { label: 'Ranger team', swatch: <span className="size-3 rounded-full border-2 border-emerald-400 bg-slate-900" /> },
    { label: 'Patrol route', swatch: <span className="h-0.5 w-4 border-t-2 border-dashed border-brand-400" /> },
    { label: 'Under-patrolled zone', swatch: <span className="size-3 rounded-sm" style={{ background: ZONE_COLORS['under-patrolled'] }} /> },
    { label: 'Team deployed', swatch: <span className="size-3 rounded-sm" style={{ background: ZONE_COLORS.covered }} /> },
    { label: 'Active alert', swatch: <span className="size-3 rounded-full bg-red-500 ring-2 ring-red-500/40" /> },
  ]

  return (
    <div className="panel pointer-events-auto absolute right-3 bottom-3 z-[500] hidden rounded-xl bg-canvas/85 p-3 text-[11px] sm:block">
      <p className="mb-1.5 font-bold text-fg">Legend</p>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-muted">
            <span className="grid w-4 place-items-center">{item.swatch}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Patrol Coverage Map from Group 41's wireframe: zones coloured by coverage
 * status (with labels, never colour alone), ranger team positions, recent
 * patrol routes and pulsing active alerts.
 */
export function CoverageMap({ parkId, zones = [], teams = [], alerts = [], routes = [], selectedZoneId, selectedTeamId, onSelectZone, focus, now, className }) {
  const { theme } = useTheme()
  const [tileFailure, setTileFailure] = useState(false)
  const bounds = useMemo(() => boundsOf(zones), [zones])
  const center = bounds?.getCenter() ?? [6.43, 81.42]
  const alertsWithLocation = alerts.filter((alert) => alert.location?.lat !== undefined)

  return (
    <div className={cn('relative isolate overflow-hidden rounded-2xl border border-line', className)}>
      <MapContainer center={center} zoom={11} scrollWheelZoom className="size-full" attributionControl>
        <TileLayer key={theme} url={TILES[theme]} attribution={ATTRIBUTION} eventHandlers={{ tileerror: () => setTileFailure(true) }} />
        <MapController bounds={bounds} boundsKey={`${parkId}:${zones.length}`} focus={focus} />

        {zones.map((assessment) => {
          const selected = assessment.zone.id === selectedZoneId
          const color = ZONE_COLORS[assessment.status]
          return (
            <Polygon
              key={assessment.zone.id}
              positions={toLatLngs(assessment.zone.boundary)}
              pathOptions={{
                color,
                weight: selected ? 3.5 : 1.5,
                dashArray: selected ? undefined : '5 5',
                fillColor: color,
                fillOpacity: selected ? 0.38 : assessment.status === 'under-patrolled' ? 0.26 : 0.12,
              }}
              eventHandlers={{ click: () => onSelectZone?.(assessment.zone.id) }}
            >
              <Tooltip permanent direction="center" className="wg-tooltip">
                {assessment.zone.name}
              </Tooltip>
            </Polygon>
          )
        })}

        {routes.map((route) => (
          <Polyline key={route.id} positions={route.route} pathOptions={{ color: '#2dd4bf', weight: 2, opacity: 0.75, dashArray: '6 6' }} />
        ))}

        {teams
          .filter((team) => team.location?.lat !== undefined)
          .map((team) => (
            <Marker key={team.id} position={[team.location.lat, team.location.lng]} icon={teamIcon(team.status, team.id === selectedTeamId)}>
              <Tooltip direction="top" offset={[0, -14]} className="wg-tooltip">
                {team.name} · {humanize(team.status)}
                {team.assignedZone?.name ? ` · ${team.assignedZone.name}` : ''}
              </Tooltip>
            </Marker>
          ))}

        {alertsWithLocation.map((alert) => (
          <Marker key={alert.id} position={[alert.location.lat, alert.location.lng]} icon={alertIcon(alert.severity)} zIndexOffset={1000}>
            <Tooltip direction="top" offset={[0, -16]} className="wg-tooltip">
              {alert.title} · {formatRelativeTime(alert.createdAt, now)}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      <Legend />

      {tileFailure && (
        <div className="absolute top-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/40 bg-canvas/90 px-3 py-1.5 text-xs font-semibold text-amber-600 backdrop-blur dark:text-amber-300">
          <MapPinOff className="size-3.5" aria-hidden="true" /> Map tiles unavailable — zone outlines still shown
        </div>
      )}
    </div>
  )
}
