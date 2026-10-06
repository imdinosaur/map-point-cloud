import { describe, expect, it } from 'vitest'
import { metersPerPixel, pixelYToLat } from './mercator'
import { buildTerrainGrid, decodeTerrarium, terrariumTileUrl } from './terrarium'

/** 依 (px, py) → 海拔（整數公尺）產生 RGBA 像素 */
function makeRaster(width, height, elevationAt) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const value = elevationAt(px, py) + 32768
      const i = (py * width + px) * 4
      pixels[i] = Math.floor(value / 256)
      pixels[i + 1] = value % 256
      pixels[i + 2] = 0
      pixels[i + 3] = 255
    }
  }
  return pixels
}

// 赤道附近、z0 的一小塊：top 取世界中央使緯度 ≈ 0
const EQUATOR = { top: 128, zoom: 0, cellSize: 1 }

describe('terrariumTileUrl', () => {
  it('builds z/x/y url', () => {
    expect(terrariumTileUrl({ x: 1, y: 2, z: 3 })).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/3/1/2.png',
    )
  })
})

describe('decodeTerrarium', () => {
  it('decodes sea level', () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0)
  })

  it('decodes positive elevation with fractional blue channel', () => {
    // 3952.5 m = 32768 + 3952.5 = 36720.5 → r=143, g=112, b=128
    expect(decodeTerrarium(143, 112, 128)).toBe(3952.5)
  })

  it('decodes negative elevation', () => {
    expect(decodeTerrarium(127, 0, 0)).toBe(-256)
  })
})

describe('buildTerrainGrid', () => {
  it('supports non-square rasters', () => {
    const pixels = makeRaster(40, 100, () => 10)
    const { points, cols, rows } = buildTerrainGrid(pixels, { ...EQUATOR, width: 40, height: 100, sampling: 4 })
    expect(cols).toBe(10)
    expect(rows).toBe(25)
    expect(points).toHaveLength(250)
    expect(points.at(-1)).toMatchObject({ x: 9, y: 24 })
  })

  it('keeps the highest elevation within each cell', () => {
    // 單一像素的山峰位於第一格區塊的中間，不在左上角取樣點上
    const pixels = makeRaster(6, 6, (px, py) => (px === 1 && py === 2 ? 3776 : 100))
    const { points, maxElevation } = buildTerrainGrid(pixels, { ...EQUATOR, width: 6, height: 6, sampling: 3 })
    expect(maxElevation).toBe(3776)
    expect(points.filter((p) => p.height > 0)).toHaveLength(1)
    expect(points.find((p) => p.height > 0)).toMatchObject({ x: 0, y: 0 })
  })

  it('handles partial cells at the raster edge', () => {
    const pixels = makeRaster(5, 5, (px, py) => (px === 4 && py === 4 ? 900 : 0))
    const { points, cols, rows } = buildTerrainGrid(pixels, { ...EQUATOR, width: 5, height: 5, sampling: 2 })
    expect([cols, rows]).toEqual([3, 3])
    expect(points.find((p) => p.x === 2 && p.y === 2).height).toBeGreaterThan(0)
  })

  it('measures heights from the lowest point when sea is shown', () => {
    const pixels = makeRaster(8, 1, (px) => 2000 + px * 100)
    const { points, minElevation, maxElevation, baseElevation } = buildTerrainGrid(pixels, {
      ...EQUATOR, width: 8, height: 1,
    })
    expect([minElevation, maxElevation, baseElevation]).toEqual([2000, 2700, 2000])
    expect(points[0].height).toBe(0)
  })

  it('uses true scale per row: height = meters / metersPerPixel × cellSize × exaggeration / sampling', () => {
    const pixels = makeRaster(4, 4, (px) => (px < 2 ? 0 : 1000))
    const { points } = buildTerrainGrid(pixels, {
      ...EQUATOR, width: 4, height: 4, sampling: 2, cellSize: 3, exaggeration: 5,
    })
    // 第一列格子涵蓋像素列 0–1，以中心 y = top + 1 的緯度換算
    const mpp = metersPerPixel(pixelYToLat(EQUATOR.top + 1, 0), 0)
    expect(points.find((p) => p.x === 1 && p.y === 0).height).toBeCloseTo((1000 * 3 * 5) / (mpp * 2), 9)
  })

  it('makes high-latitude rows taller for the same elevation (Mercator correction)', () => {
    // z2 世界高 1024 px：top=100 約北緯 75°、top=500 約北緯 3°
    const pixels = makeRaster(2, 1, (px) => px * 1000)
    const north = buildTerrainGrid(pixels, { width: 2, height: 1, top: 100, zoom: 2, cellSize: 1 })
    const south = buildTerrainGrid(pixels, { width: 2, height: 1, top: 500, zoom: 2, cellSize: 1 })
    expect(north.points[1].height / south.points[1].height).toBeGreaterThan(3)
  })

  it('hides sea and measures from sea level in hideSea mode', () => {
    const pixels = makeRaster(4, 1, (px) => [-300, 0, 50, 800][px])
    const { points, minElevation, baseElevation } = buildTerrainGrid(pixels, {
      ...EQUATOR, width: 4, height: 1, hideSea: true,
    })
    expect(points.map((p) => p.x)).toEqual([2, 3])
    expect(minElevation).toBe(50)
    expect(baseElevation).toBe(0)
    expect(points[0].height).toBeGreaterThan(0)
  })

  it('clamps below-sea-level elevation to zero when sea is shown', () => {
    const pixels = makeRaster(2, 1, (px) => (px === 0 ? -500 : 100))
    const { points, minElevation } = buildTerrainGrid(pixels, { ...EQUATOR, width: 2, height: 1 })
    expect(minElevation).toBe(0)
    expect(points[0].height).toBe(0)
  })

  it('returns an empty grid when everything is sea', () => {
    const pixels = makeRaster(4, 4, () => -10)
    const result = buildTerrainGrid(pixels, { ...EQUATOR, width: 4, height: 4, hideSea: true })
    expect(result.points).toEqual([])
    expect(result.maxElevation).toBe(0)
  })

  it('drops points outside the inscribed circle in circular mode', () => {
    const pixels = makeRaster(64, 64, () => 0)
    const options = { ...EQUATOR, width: 64, height: 64 }
    const square = buildTerrainGrid(pixels, options)
    const circle = buildTerrainGrid(pixels, { ...options, isCircular: true })
    const ratio = circle.points.length / square.points.length
    expect(ratio).toBeGreaterThan(0.75)
    expect(ratio).toBeLessThan(0.82) // ≈ π/4
    expect(circle.points.some((p) => p.x === 0 && p.y === 0)).toBe(false)
  })
})
