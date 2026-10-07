import { describe, expect, it } from 'vitest'
import { buildVenuePolygons } from './venue'

const rect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]
const area = (ring) =>
  Math.abs(ring.reduce((s, p, i) => s + p.x * ring[(i + 1) % ring.length].z - ring[(i + 1) % ring.length].x * p.z, 0)) / 2

describe('buildVenuePolygons', () => {
  it('removes the oval and the gaps from the outline', () => {
    const polygons = buildVenuePolygons({
      outline: rect(0, 0, 100, 50),
      ovalOuter: rect(10, 10, 90, 40),
      gaps: [rect(92, 20, 98, 30)],
    })
    const total = polygons.reduce((s, [outer, ...holes]) => s + area(outer) - holes.reduce((h, r) => h + area(r), 0), 0)
    expect(total).toBeCloseTo(100 * 50 - 80 * 30 - 6 * 10)
  })

  it('returns rings without the repeated closing point', () => {
    const [[outer]] = buildVenuePolygons({ outline: rect(0, 0, 10, 10), ovalOuter: rect(20, 20, 30, 30), gaps: [] })
    expect(outer).toHaveLength(4)
  })
})
