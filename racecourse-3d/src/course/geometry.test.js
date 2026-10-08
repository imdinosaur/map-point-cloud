import { describe, expect, it } from 'vitest'
import {
  buildBandGeometry,
  buildRailGeometry,
  railPostPositions,
  buildCenterline,
  buildSlabGeometry,
  rayDistanceToRing,
  resampleRing,
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

describe('resampleRing', () => {
  it('splits long edges without repeating the closing point', () => {
    const ring = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }]
    const result = resampleRing(ring, 2.5)
    expect(result).toHaveLength(16)
    expect(result[1]).toEqual({ x: 2.5, z: 0 })
    expect(polylineLength(result, true)).toBeCloseTo(40)
  })
})

describe('rayDistanceToRing', () => {
  const square = [{ x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 }]

  it('measures the distance to the nearest edge in the ray direction', () => {
    expect(rayDistanceToRing({ x: 0, z: 0 }, { x: 1, z: 0 }, square)).toBeCloseTo(10)
    expect(rayDistanceToRing({ x: 5, z: 0 }, { x: -1, z: 0 }, square)).toBeCloseTo(15)
  })

  it('returns Infinity when the ray misses the ring', () => {
    expect(rayDistanceToRing({ x: 20, z: 0 }, { x: 1, z: 0 }, square)).toBe(Infinity)
  })
})

describe('buildSlabGeometry with an interior grid', () => {
  const square = [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 40 }, { x: 0, z: 40 }]

  it('adds interior vertices so the top follows a curved height function', () => {
    const coarse = buildSlabGeometry([[square]], () => 0, -1)
    const fine = buildSlabGeometry([[square]], () => 0, -1, 10)
    expect(fine.getAttribute('position').count).toBeGreaterThan(coarse.getAttribute('position').count)
  })

  it('puts every top vertex exactly on topAt', () => {
    const bowl = (x, z) => ((x - 20) ** 2 + (z - 20) ** 2) / 100
    const geometry = buildSlabGeometry([[square]], bowl, -50, 10)
    const pos = geometry.getAttribute('position')
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k)
      if (y !== -50) expect(y).toBeCloseTo(bowl(pos.getX(k), pos.getZ(k)), 4)
    }
  })
})

/** 取出某個 material group 用到的頂點 uv（去重） */
function groupUvs(geometry, materialIndex) {
  const group = geometry.groups.find((g) => g.materialIndex === materialIndex)
  const index = geometry.getIndex()
  const uv = geometry.getAttribute('uv')
  const seen = new Map()
  for (let k = group.start; k < group.start + group.count; k++) {
    const v = index.getX(k)
    seen.set(v, [uv.getX(v), uv.getY(v)])
  }
  return [...seen.values()]
}

describe('buildBandGeometry UVs', () => {
  const points = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }]
  const normals = computeNormals(points, false)
  const band = (closed) =>
    buildBandGeometry({ points, normals, closed, inner: () => 1, outer: () => -1, top: () => 2, base: 0 })

  it('splits the top surface (material 0) from the walls (material 1)', () => {
    const geometry = band(false)
    expect(geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1])
    expect(geometry.groups[0].count).toBe(2 * 6) // 頂面 2 段
  })

  it('maps the top in meters: u along the track, v across it', () => {
    const uvs = groupUvs(band(false), 0)
    expect(uvs).toContainEqual([0, 1])
    expect(uvs).toContainEqual([10, -1])
    expect(uvs).toContainEqual([20, 1])
  })

  it('maps the walls by distance and height so soil is not stretched', () => {
    const vs = groupUvs(band(false), 1).map(([, v]) => v)
    expect(Math.max(...vs)).toBe(2)
    expect(Math.min(...vs)).toBe(0)
  })

  it('duplicates the seam of a closed loop so u runs to the full length instead of wrapping back to 0', () => {
    const us = groupUvs(band(true), 0).map(([u]) => u)
    expect(Math.max(...us)).toBeCloseTo(40)
  })
})

describe('buildSlabGeometry UVs', () => {
  const square = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }]
  const geometry = buildSlabGeometry([[square]], () => 1, -2)

  it('splits the top (material 0) from the walls (material 1)', () => {
    expect(geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1])
  })

  it('projects the top from above in meters', () => {
    expect(groupUvs(geometry, 0)).toContainEqual([10, 10])
  })

  it('maps the walls by perimeter distance and height', () => {
    const uvs = groupUvs(geometry, 1)
    expect(Math.max(...uvs.map(([u]) => u))).toBeCloseTo(40)
    expect(Math.min(...uvs.map(([, v]) => v))).toBe(-2)
  })
})

describe('railPostPositions', () => {
  const straight = [{ x: 0, y: 1, z: 0 }, { x: 10, y: 3, z: 0 }]

  it('places a post every spacing metres including both ends of an open rail', () => {
    const posts = railPostPositions(straight, false, 2.5)
    expect(posts.map((p) => p.x)).toEqual([0, 2.5, 5, 7.5, 10])
  })

  it('follows the slope of the rail', () => {
    const posts = railPostPositions(straight, false, 2.5)
    expect(posts[2].y).toBeCloseTo(2)
  })

  it('does not double the post at the seam of a closed rail', () => {
    const square = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }, { x: 0, y: 0, z: 10 }]
    expect(railPostPositions(square, true, 2.5)).toHaveLength(16)
  })
})

describe('buildRailGeometry', () => {
  const square = [{ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, { x: 10, y: 1, z: 10 }, { x: 0, y: 1, z: 10 }]

  it('wraps a square tube of the given half width around the path', () => {
    const geometry = buildRailGeometry(square, true, 0.05)
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    expect(min.y).toBeCloseTo(0.95)
    expect(max.y).toBeCloseTo(1.05)
    expect(max.x).toBeGreaterThan(10)
    expect(min.x).toBeLessThan(0)
  })

  it('closes the loop with four faces per segment', () => {
    const geometry = buildRailGeometry(square, true, 0.05)
    expect(geometry.getIndex().count).toBe(square.length * 4 * 6)
  })

  it('leaves an open rail open at the ends', () => {
    const geometry = buildRailGeometry(square, false, 0.05)
    expect(geometry.getIndex().count).toBe((square.length - 1) * 4 * 6)
  })
})
