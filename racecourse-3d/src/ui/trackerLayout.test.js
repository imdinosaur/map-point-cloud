import { describe, expect, it } from 'vitest'
import { TRACKER, trackerLayout } from './trackerLayout'
import { FIELD } from '../course/field'

const runner = (number, traveled, lateral = FIELD.minLateral) => ({ number, traveled, lateral })

describe('trackerLayout', () => {
  it('puts the leader on the right and the last horse on the left', () => {
    const layout = trackerLayout([runner(1, 500), runner(2, 540), runner(3, 520)])
    const x = (n) => layout.find((b) => b.number === n).x
    expect(x(2)).toBeCloseTo(1)
    expect(x(1)).toBeCloseTo(0)
    expect(x(3)).toBeGreaterThan(x(1))
    expect(x(3)).toBeLessThan(x(2))
  })

  it('does not stretch a tight pack across the whole bar', () => {
    const layout = trackerLayout([runner(1, 500), runner(2, 502)])
    const gap = layout[1].x - layout[0].x
    expect(gap).toBeCloseTo(2 / TRACKER.minSpan)
    expect(layout.find((b) => b.number === 2).x).toBeCloseTo(1)
  })

  it('puts the inside (rail) at the top and wider horses lower', () => {
    const layout = trackerLayout([runner(1, 500, FIELD.minLateral), runner(2, 500, FIELD.minLateral + 4)])
    expect(layout[0].y).toBeCloseTo(0)
    expect(layout[1].y).toBeGreaterThan(layout[0].y)
  })

  it('clamps very wide runners to the bottom edge', () => {
    const [badge] = trackerLayout([runner(1, 500, 99)])
    expect(badge.y).toBe(1)
  })
})

describe('trackerLayout overlap', () => {
  const spacing = { minGapX: 0.05, rowStep: 0.3 }

  it('stacks side-by-side horses into separate rows instead of drawing them on top of each other', () => {
    const layout = trackerLayout([runner(1, 500), runner(2, 500), runner(3, 500)], spacing)
    const ys = layout.map((b) => b.y).sort((a, b) => a - b)
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(spacing.rowStep - 1e-9)
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(spacing.rowStep - 1e-9)
  })

  it('leaves horses that are far apart in their own lane', () => {
    const layout = trackerLayout([runner(1, 500), runner(2, 540)], spacing)
    expect(layout[0].y).toBeCloseTo(layout[1].y)
  })

  it('keeps every badge inside the bar even in a big bunch', () => {
    const bunch = Array.from({ length: 18 }, (_, k) => runner(k + 1, 500 + (k % 3) * 0.2))
    for (const { y } of trackerLayout(bunch, spacing)) {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })
})
