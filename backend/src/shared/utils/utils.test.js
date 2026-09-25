const mongoose = require('mongoose')
const { estimateEtaMinutes, haversineKm, polygonCentroid } = require('./geo')
const { serialize, toId } = require('./serialize')
const { hoursBetween } = require('./time')

describe('haversineKm', () => {
  it('returns zero for the same point', () => {
    expect(haversineKm({ lat: 6.4, lng: 81.4 }, { lat: 6.4, lng: 81.4 })).toBe(0)
  })

  it('matches the known distance for one degree of latitude (~111 km)', () => {
    expect(haversineKm({ lat: 6, lng: 81 }, { lat: 7, lng: 81 })).toBeCloseTo(111.19, 1)
  })

  it('returns null when a location is unknown', () => {
    expect(haversineKm(null, { lat: 6, lng: 81 })).toBeNull()
  })
})

describe('polygonCentroid', () => {
  it('averages the ring vertices, ignoring the closing vertex', () => {
    const square = { type: 'Polygon', coordinates: [[[81, 6], [82, 6], [82, 7], [81, 7], [81, 6]]] }

    expect(polygonCentroid(square)).toEqual({ lat: 6.5, lng: 81.5 })
  })

  it('returns null for an empty polygon', () => {
    expect(polygonCentroid({ coordinates: [[]] })).toBeNull()
    expect(polygonCentroid(undefined)).toBeNull()
  })

  it('handles a single-vertex ring', () => {
    expect(polygonCentroid({ coordinates: [[[81, 6]]] })).toEqual({ lat: 6, lng: 81 })
  })
})

describe('estimateEtaMinutes', () => {
  it('converts distance to minutes at 25 km/h by default', () => {
    expect(estimateEtaMinutes(12.5)).toBe(30)
  })

  it('never estimates less than one minute', () => {
    expect(estimateEtaMinutes(0)).toBe(1)
  })

  it('returns null for unknown distances', () => {
    expect(estimateEtaMinutes(null)).toBeNull()
  })
})

describe('hoursBetween', () => {
  it('returns fractional hours and supports reversed order', () => {
    expect(hoursBetween('2026-09-25T00:00:00Z', '2026-09-25T01:30:00Z')).toBe(1.5)
    expect(hoursBetween('2026-09-25T02:00:00Z', '2026-09-25T00:00:00Z')).toBe(-2)
  })
})

describe('serialize', () => {
  it('renames _id to id, stringifies ObjectIds, keeps dates and drops __v', () => {
    const id = new mongoose.Types.ObjectId()
    const zoneId = new mongoose.Types.ObjectId()
    const createdAt = new Date('2026-09-25T00:00:00Z')

    const result = serialize({ _id: id, __v: 3, createdAt, zone: { _id: zoneId, name: 'East Zone' }, tags: [zoneId], note: null })

    expect(result).toEqual({ id: id.toString(), createdAt, zone: { id: zoneId.toString(), name: 'East Zone' }, tags: [zoneId.toString()], note: null })
  })
})

describe('toId', () => {
  it('handles ids, populated documents and missing values', () => {
    const id = new mongoose.Types.ObjectId()

    expect(toId(id)).toBe(id.toString())
    expect(toId({ _id: id, name: 'Team Alpha' })).toBe(id.toString())
    expect(toId('plain-id')).toBe('plain-id')
    expect(toId(undefined)).toBeNull()
  })
})
