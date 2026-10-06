import { describe, expect, it } from 'vitest'
import {
  EXAGGERATION_MAX,
  autoExaggeration,
  maxPointHeight,
  roundExaggeration,
  scaleHeights,
} from './exaggeration'

describe('autoExaggeration', () => {
  it('scales the tallest bar to 15% of the scene extent', () => {
    // 台灣：1 倍時最高約 0.58 單位 → 9 / 0.58 ≈ 15.5
    expect(autoExaggeration(0.58, 60)).toBe(16)
    // 日本：約 0.108 → ≈ 83
    expect(autoExaggeration(0.108, 60)).toBe(83)
  })

  it('never goes below true scale', () => {
    // 玉山單點：1 倍時已有 16.6 單位
    expect(autoExaggeration(16.6, 60)).toBe(1)
  })

  it('caps at the slider maximum for very flat areas', () => {
    expect(autoExaggeration(0.001, 60)).toBe(EXAGGERATION_MAX)
  })

  it.each([0, Number.NaN, -1])('falls back to 1 for invalid height %s', (h) => {
    expect(autoExaggeration(h, 60)).toBe(1)
  })
})

describe('roundExaggeration', () => {
  it('keeps one decimal below 10 and integers above', () => {
    expect(roundExaggeration(1.234)).toBe(1.2)
    expect(roundExaggeration(15.5)).toBe(16)
  })
})

describe('maxPointHeight', () => {
  it('returns the tallest height, or 0 for no points', () => {
    expect(maxPointHeight([{ height: 1 }, { height: 3 }, { height: 2 }])).toBe(3)
    expect(maxPointHeight([])).toBe(0)
  })
})

describe('scaleHeights', () => {
  it('returns new points with scaled heights without mutating input', () => {
    const points = [{ x: 1, y: 2, height: 3 }]
    const scaled = scaleHeights(points, 2)
    expect(scaled).toEqual([{ x: 1, y: 2, height: 6 }])
    expect(points[0].height).toBe(3)
  })
})
