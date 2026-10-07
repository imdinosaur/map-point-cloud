import { describe, expect, it } from 'vitest'
import { GATE, GATE_WIDTH, gateLayout, wakuOf } from './startingGate'

describe('wakuOf', () => {
  it('gives each horse its own waku up to 8 runners', () => {
    expect([1, 5, 8].map((h) => wakuOf(h, 8))).toEqual([1, 5, 8])
  })

  it('puts the extra horses in the outer waku for 18 runners', () => {
    const counts = Array.from({ length: 8 }, () => 0)
    for (let h = 1; h <= 18; h++) counts[wakuOf(h, 18) - 1] += 1
    expect(counts).toEqual([2, 2, 2, 2, 2, 2, 3, 3])
    expect(wakuOf(1, 18)).toBe(1)
    expect(wakuOf(18, 18)).toBe(8)
  })

  it('splits 16 runners evenly', () => {
    expect(wakuOf(16, 16)).toBe(8)
    expect(wakuOf(9, 16)).toBe(5)
  })
})

describe('gateLayout', () => {
  it('has 18 stalls separated by 19 partitions inside the end frames', () => {
    const { partitions, stalls } = gateLayout()
    expect(stalls).toHaveLength(GATE.stalls)
    expect(partitions).toHaveLength(GATE.stalls + 1)
    expect(partitions[0]).toBeCloseTo(GATE.endFrame)
    expect(partitions.at(-1)).toBeCloseTo(GATE_WIDTH - GATE.endFrame)
  })

  it('centres each stall between its partitions, stall 1 on the inside', () => {
    const { partitions, stalls } = gateLayout()
    stalls.forEach((stall, k) => expect(stall.x).toBeCloseTo((partitions[k] + partitions[k + 1]) / 2))
    expect(stalls[0]).toMatchObject({ number: 1, waku: 1 })
  })
})
