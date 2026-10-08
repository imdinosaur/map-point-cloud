import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { snapToShadowTexel } from './shadowSnap'

const SUN = new Vector3(-400, 600, 300).normalize()
const TEXEL = 0.05

describe('snapToShadowTexel', () => {
  it('moves the point by less than one texel across the light', () => {
    const point = new Vector3(123.456, 7.89, -45.678)
    const snapped = snapToShadowTexel(point, SUN, TEXEL)
    const offset = snapped.clone().sub(point)
    const across = offset.clone().sub(SUN.clone().multiplyScalar(offset.dot(SUN)))
    expect(across.length()).toBeLessThanOrEqual(TEXEL * Math.SQRT2 + 1e-9)
  })

  it('gives the same result for points inside the same texel, so the shadow does not shimmer', () => {
    // 從格點出發，橫向移動不到半格、沿光線方向任意移動：橫向結果應完全相同
    const grid = snapToShadowTexel(new Vector3(10, 0, 10), SUN, TEXEL)
    const right = new Vector3(0, 1, 0).cross(SUN).normalize()
    const nudged = grid.clone().addScaledVector(right, TEXEL * 0.3).addScaledVector(SUN, 3)
    const offset = snapToShadowTexel(nudged, SUN, TEXEL).sub(grid)
    const across = offset.clone().sub(SUN.clone().multiplyScalar(offset.dot(SUN)))
    expect(across.length()).toBeLessThan(1e-9)
  })

  it('jumps by whole texels when the point moves further', () => {
    const a = snapToShadowTexel(new Vector3(0, 0, 0), SUN, TEXEL)
    const b = snapToShadowTexel(new Vector3(1, 0, 0), SUN, TEXEL)
    const offset = b.clone().sub(a)
    const across = offset.clone().sub(SUN.clone().multiplyScalar(offset.dot(SUN)))
    expect(across.length() / TEXEL).toBeGreaterThan(1)
  })

  it('does not mutate the input', () => {
    const point = new Vector3(1.234, 0, 5.678)
    snapToShadowTexel(point, SUN, TEXEL)
    expect(point.toArray()).toEqual([1.234, 0, 5.678])
  })
})
