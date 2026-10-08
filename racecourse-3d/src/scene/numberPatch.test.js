import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { numberPatchGeometry } from './numberPatch'

const RADIUS = 0.4

describe('numberPatchGeometry', () => {
  const geometry = numberPatchGeometry(RADIUS, 1.2)
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const vertex = (k) => new Vector3().fromBufferAttribute(position, k)

  it('hugs the ball just outside its surface', () => {
    for (let k = 0; k < position.count; k++) {
      const length = vertex(k).length()
      expect(length).toBeGreaterThan(RADIUS)
      expect(length).toBeLessThan(RADIUS * 1.02)
    }
  })

  it('is centred on the front of the ball (+Z, the running direction)', () => {
    const center = new Vector3()
    for (let k = 0; k < position.count; k++) center.add(vertex(k))
    center.normalize()
    expect(center.z).toBeGreaterThan(0.95)
  })

  it('reads left-to-right and upright when seen from the front, not mirrored', () => {
    // 從 +Z 往 -Z 看時，畫面右方為 +X、上方為 +Y：u 應隨 x 增加、v 應隨 y 增加
    const pairs = Array.from({ length: position.count }, (_, k) => ({ p: vertex(k), u: uv.getX(k), v: uv.getY(k) }))
    const leftmost = pairs.reduce((a, b) => (b.p.x < a.p.x ? b : a))
    const rightmost = pairs.reduce((a, b) => (b.p.x > a.p.x ? b : a))
    const lowest = pairs.reduce((a, b) => (b.p.y < a.p.y ? b : a))
    const highest = pairs.reduce((a, b) => (b.p.y > a.p.y ? b : a))
    expect(rightmost.u).toBeGreaterThan(leftmost.u)
    expect(highest.v).toBeGreaterThan(lowest.v)
  })
})
