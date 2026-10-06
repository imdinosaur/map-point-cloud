import { describe, expect, it } from 'vitest'
import {
  MAX_REGION_RASTER_SIDE,
  baseSamplingFor,
  rasterRequestFor,
  tilesForRaster,
  validateArea,
} from './area'
import { lonLatToPixel } from './mercator'

const TAIWAN = { type: 'region', west: 119.9, south: 21.8, east: 122.1, north: 25.4 }
const JAPAN = { type: 'region', west: 129, south: 30, east: 146, north: 45.6 }
const YUSHAN = { type: 'point', lon: 120.957, lat: 23.47, zoom: 12 }

describe('rasterRequestFor (point)', () => {
  it('centers a 256×256 raster on the point', () => {
    const req = rasterRequestFor(YUSHAN)
    const { px, py } = lonLatToPixel(YUSHAN.lon, YUSHAN.lat, YUSHAN.zoom)
    expect(req).toMatchObject({ zoom: 12, width: 256, height: 256 })
    expect(Math.abs(req.left + 128 - px)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(req.top + 128 - py)).toBeLessThanOrEqual(0.5)
  })

  it('keeps the raster inside the world vertically near the poles', () => {
    const req = rasterRequestFor({ type: 'point', lon: 0, lat: 85, zoom: 1 })
    expect(req.top).toBe(0)
  })
})

describe('rasterRequestFor (region)', () => {
  it('picks zoom 8 for Taiwan', () => {
    const req = rasterRequestFor(TAIWAN)
    expect(req.zoom).toBe(8)
    expect(req.width).toBeGreaterThan(390)
    expect(req.width).toBeLessThan(410)
    expect(req.height).toBeGreaterThan(700)
    expect(req.height).toBeLessThan(730)
  })

  it('picks zoom 6 for Japan', () => {
    expect(rasterRequestFor(JAPAN).zoom).toBe(6)
  })

  it('never exceeds the max raster side', () => {
    const regions = [TAIWAN, JAPAN, { type: 'region', west: -180, south: -85, east: 180, north: 85 }]
    for (const region of regions) {
      const { width, height } = rasterRequestFor(region)
      expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_REGION_RASTER_SIDE)
    }
  })
})

describe('tilesForRaster', () => {
  it('covers Taiwan with 2×4 tiles', () => {
    const tiles = tilesForRaster(rasterRequestFor(TAIWAN))
    expect(tiles).toHaveLength(8)
    expect(new Set(tiles.map((t) => t.x))).toEqual(new Set([213, 214]))
  })

  it('places tiles relative to the raster origin', () => {
    const tiles = tilesForRaster({ zoom: 2, left: 300, top: 10, width: 300, height: 100 })
    expect(tiles).toEqual([
      { x: 1, y: 0, z: 2, offsetX: -44, offsetY: -10 },
      { x: 2, y: 0, z: 2, offsetX: 212, offsetY: -10 },
    ])
  })

  it('wraps tile x across the antimeridian', () => {
    const tiles = tilesForRaster({ zoom: 1, left: -100, top: 0, width: 200, height: 10 })
    expect(tiles.map((t) => t.x)).toEqual([1, 0])
    expect(tiles[0].offsetX).toBe(-156)
  })
})

describe('baseSamplingFor', () => {
  it('keeps the point mode at 64 cells', () => {
    expect(baseSamplingFor(YUSHAN, rasterRequestFor(YUSHAN))).toBe(4)
  })

  it('targets about 256 cells on the long side for regions', () => {
    const req = rasterRequestFor(TAIWAN)
    const sampling = baseSamplingFor(TAIWAN, req)
    expect(Math.ceil(req.height / sampling)).toBeGreaterThanOrEqual(256)
    expect(Math.ceil(req.height / (sampling + 1))).toBeLessThan(256)
  })
})

describe('validateArea', () => {
  it('accepts valid point and region', () => {
    expect(validateArea(YUSHAN)).toBeNull()
    expect(validateArea(TAIWAN)).toBeNull()
  })

  it.each([
    [{ ...YUSHAN, lon: 200 }, '經度'],
    [{ ...YUSHAN, lat: 90 }, '緯度'],
    [{ ...YUSHAN, zoom: 0 }, '縮放'],
    [{ ...YUSHAN, zoom: 12.5 }, '縮放'],
    [{ ...YUSHAN, lon: Number.NaN }, '經度'],
    [{ ...TAIWAN, west: 123 }, '西界'],
    [{ ...TAIWAN, south: 26 }, '南界'],
    [{ ...TAIWAN, north: 89 }, '緯度'],
    [{ ...TAIWAN, east: 119.9001, west: 119.9 }, '範圍太小'],
  ])('rejects %o', (area, keyword) => {
    expect(validateArea(area)).toContain(keyword)
  })
})
