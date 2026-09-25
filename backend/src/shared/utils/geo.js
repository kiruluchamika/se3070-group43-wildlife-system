const EARTH_RADIUS_KM = 6371

const toRadians = (degrees) => (degrees * Math.PI) / 180

/** Great-circle distance between two `{ lat, lng }` points in kilometres. */
function haversineKm(from, to) {
  if (!from || !to) return null

  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/** Average vertex of a GeoJSON polygon's outer ring, as `{ lat, lng }`. */
function polygonCentroid(polygon) {
  const ring = polygon?.coordinates?.[0]
  if (!ring?.length) return null

  // GeoJSON rings repeat the first vertex at the end; skip the duplicate.
  const vertices = ring.length > 1 ? ring.slice(0, -1) : ring
  const sum = vertices.reduce((total, [lng, lat]) => ({ lat: total.lat + lat, lng: total.lng + lng }), { lat: 0, lng: 0 })

  return { lat: sum.lat / vertices.length, lng: sum.lng / vertices.length }
}

/** Travel estimate for off-road vehicles in park terrain. */
function estimateEtaMinutes(distanceKm, averageSpeedKmh = 25) {
  if (distanceKm === null || distanceKm === undefined) return null
  return Math.max(1, Math.round((distanceKm / averageSpeedKmh) * 60))
}

module.exports = { haversineKm, polygonCentroid, estimateEtaMinutes }
