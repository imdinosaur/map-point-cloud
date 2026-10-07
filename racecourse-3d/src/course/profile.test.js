import { describe, expect, it } from 'vitest'
import { elevationAt, fractionFromRemaining, remainingFromFraction } from './profile'

const PROFILE = [
  [1000, 0],
  [600, -2],
  [200, -2],
  [0, 0],
]

describe('elevationAt', () => {
  it('returns control point values exactly', () => {
    expect(elevationAt(PROFILE, 600)).toBe(-2)
    expect(elevationAt(PROFILE, 0)).toBe(0)
  })

  it('interpolates linearly between control points', () => {
    expect(elevationAt(PROFILE, 800)).toBeCloseTo(-1)
    expect(elevationAt(PROFILE, 100)).toBeCloseTo(-1)
  })

  it('clamps outside the profile range', () => {
    expect(elevationAt(PROFILE, 5000)).toBe(0)
    expect(elevationAt(PROFILE, -50)).toBe(0)
  })
})

describe('fraction ↔ remaining', () => {
  it('maps the goal (fraction 0) to a full lap remaining', () => {
    expect(remainingFromFraction(0, 2000)).toBe(2000)
    expect(remainingFromFraction(0.75, 2000)).toBe(500)
  })

  it('wraps fractions and remaining distances into one lap', () => {
    expect(remainingFromFraction(1.25, 2000)).toBe(1500)
    expect(fractionFromRemaining(500, 2000)).toBeCloseTo(0.75)
    expect(fractionFromRemaining(-100, 2000)).toBeCloseTo(0.05)
    expect(fractionFromRemaining(2400, 2000)).toBeCloseTo(0.8)
  })
})
