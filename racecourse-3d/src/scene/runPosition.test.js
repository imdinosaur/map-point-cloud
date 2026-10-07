import { describe, expect, it } from 'vitest'
import { runPositionAt } from './runPosition'

const run = {
  surface: 'turf',
  path: { points: [{ x: 0, z: 0 }, { x: 10, z: 0 }], traveled: [0, 10], length: 10 },
  elevations: [0, 0],
  outward: [{ x: 0, z: 1 }, { x: 0, z: 1 }],
}

describe('runPositionAt', () => {
  it('stays on the route line without a lateral offset', () => {
    expect(runPositionAt(run, 5, 1)).toMatchObject({ x: 5, z: 0 })
  })

  it('moves the runner outward by its lateral offset', () => {
    const p = runPositionAt(run, 5, 1, 3)
    expect(p.x).toBeCloseTo(5)
    expect(p.z).toBeCloseTo(3)
  })
})
