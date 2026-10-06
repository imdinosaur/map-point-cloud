import { describe, expect, it } from 'vitest'
import { lonLatToPixel, lonLatToTile, metersPerPixel, pixelYToLat } from './mercator'

describe('lonLatToTile', () => {
  it('returns tile 0/0 for zoom 0', () => {
    expect(lonLatToTile(121.5, 25, 0)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('locates Yushan at zoom 12', () => {
    // 玉山主峰 23.47N, 120.957E
    expect(lonLatToTile(120.957, 23.47, 12)).toEqual({ x: 3424, y: 1773, z: 12 })
  })

  it('clamps out-of-range coordinates into valid tiles', () => {
    const tile = lonLatToTile(180, 89, 3)
    expect(tile.x).toBe(7)
    expect(tile.y).toBe(0)
  })
})

describe('lonLatToPixel', () => {
  it('maps (0, 0) to the world center', () => {
    expect(lonLatToPixel(0, 0, 1)).toEqual({ px: 256, py: 256 })
  })
})

describe('pixelYToLat', () => {
  it.each([0, 23.47, -45, 80])('round-trips latitude %s', (lat) => {
    const { py } = lonLatToPixel(0, lat, 10)
    expect(pixelYToLat(py, 10)).toBeCloseTo(lat, 9)
  })
})

describe('metersPerPixel', () => {
  it('matches the known equator resolution at zoom 0', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543.03, 1)
  })

  it('halves per zoom level and shrinks with latitude', () => {
    expect(metersPerPixel(0, 1)).toBeCloseTo(metersPerPixel(0, 0) / 2, 5)
    expect(metersPerPixel(60, 0)).toBeCloseTo(metersPerPixel(0, 0) / 2, 5)
  })
})
