import { describe, expect, it } from 'vitest'
import {
  buildBandGeometry,
  buildCenterline,
  buildSlabGeometry,
  truncatePolyline,
  roundCorners,
  computeNormals,
  offsetLine,
  polylineLength,
  signedArea,
} from './geometry'

const circle = (radius, count) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return { x: Math.cos(a) * radius, z: Math.sin(a) * radius }
  })

describe('signedArea', () => {
  it('is positive for counter-clockwise (x, z) loops and negative when reversed', () => {
    const square = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 1 }]
    expect(signedArea(square)).toBeCloseTo(1)
    expect(signedArea([...square].reverse())).toBeCloseTo(-1)
  })
})

describe('computeNormals + offsetLine', () => {
  it('points inward for either winding, shrinking the perimeter by 2πd', () => {
    for (const loop of [circle(100, 720), circle(100, 720).reverse()]) {
      const normals = computeNormals(loop, true)
      const inner = offsetLine(loop, normals, 10)
      expect(polylineLength(inner, true)).toBeCloseTo(polylineLength(loop, true) - 2 * Math.PI * 10, 0)
    }
  })
})

describe('buildCenterline', () => {
  const trace = [[0, 0], [200, 0], [260, 60], [200, 120], [0, 120], [-60, 60]]

  it('scales the loop to the requested perimeter and centers it', () => {
    const { points } = buildCenterline(trace, 2000, 800)
    expect(points).toHaveLength(800)
    expect(polylineLength(points, true)).toBeCloseTo(2000, 6)
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length
    expect(cx).toBeCloseTo(0, 6)
  })

  it('starts at the first trace point', () => {
    const { points, toWorld } = buildCenterline(trace, 2000, 800)
    const start = toWorld(trace[0])
    expect(points[0].x).toBeCloseTo(start.x, 6)
    expect(points[0].z).toBeCloseTo(start.z, 6)
  })
})

describe('buildBandGeometry', () => {
  const points = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }]
  const normals = computeNormals(points, false)
  const band = (closed) =>
    buildBandGeometry({ points, normals, closed, inner: () => 1, outer: () => -1, top: () => 2, base: 0 })

  it('builds top + two walls, plus end caps when open', () => {
    const open = band(false)
    expect(open.getAttribute('position').count).toBe(3 * 2 * 3 + 8)
    expect(open.getIndex().count).toBe(3 * 2 * 6 + 2 * 6)
  })

  it('wraps the last segment when closed', () => {
    const closed = band(true)
    expect(closed.getIndex().count).toBe(3 * 3 * 6)
  })

  it('places top vertices at the requested height', () => {
    const ys = Array.from(band(false).getAttribute('position').array).filter((_, k) => k % 3 === 1)
    expect(Math.max(...ys)).toBe(2)
    expect(Math.min(...ys)).toBe(0)
  })
})

describe('roundCorners', () => {
  it('replaces a right-angle corner with an arc that stays inside the corner', () => {
    const corners = [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: 100 }]
    const rounded = roundCorners(corners, 20)
    expect(rounded[0]).toEqual(corners[0])
    expect(rounded.at(-1)).toEqual(corners[2])
    expect(rounded.some((p) => p.x === 100 && p.z === 0)).toBe(false)
    expect(polylineLength(rounded, false)).toBeLessThan(200)
    expect(polylineLength(rounded, false)).toBeGreaterThan(190)
  })
})

describe('truncatePolyline', () => {
  const line = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }]

  it('cuts inside a segment', () => {
    expect(truncatePolyline(line, 15)).toEqual([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 5 }])
  })

  it('returns the whole line when it is shorter than the limit', () => {
    expect(truncatePolyline(line, 50)).toEqual(line)
  })
})

describe('buildSlabGeometry', () => {
  const square = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }]
  const hole = [{ x: 4, z: 4 }, { x: 6, z: 4 }, { x: 6, z: 6 }, { x: 4, z: 6 }]

  it('triangulates the top around holes and adds a wall for every ring edge', () => {
    const geometry = buildSlabGeometry([[square, hole]], () => 1, -2)
    const topTriangles = 8 // 外框 4 點 + 洞 4 點的環狀區
    const wallTriangles = (4 + 4) * 2
    expect(geometry.getIndex().count).toBe((topTriangles + wallTriangles) * 3)
  })

  it('uses topAt for the surface and base for the bottom', () => {
    const geometry = buildSlabGeometry([[square]], (x) => x / 10, -2)
    const ys = Array.from(geometry.getAttribute('position').array).filter((_, k) => k % 3 === 1)
    expect(Math.max(...ys)).toBe(1)
    expect(Math.min(...ys)).toBe(-2)
  })
})
