import { describe, expect, it } from 'vitest'
import { buildLapPath, buildRacePath, createLoop, lookAheadSpan, loopPositionFor, pointAlong } from './racePath'

// 半徑 100 的圓，第 0 點為終點
const circle = Array.from({ length: 720 }, (_, i) => {
  const a = (i / 720) * Math.PI * 2
  return { x: Math.cos(a) * 100, z: Math.sin(a) * 100 }
})
const loop = createLoop(circle)

describe('loopPositionFor', () => {
  it('wraps distances longer than one lap', () => {
    expect(loopPositionFor(loop, loop.length)).toBeCloseTo(0)
    expect(loopPositionFor(loop, loop.length * 1.25)).toBeCloseTo(loop.length * 0.75)
  })
})

describe('buildRacePath on the loop', () => {
  it('has the requested length and ends at the goal', () => {
    for (const distance of [100, loop.length, loop.length * 1.6]) {
      const path = buildRacePath(loop, distance)
      expect(path.length).toBeCloseTo(distance, 0)
      expect(path.points.at(-1)).toEqual(circle[0])
    }
  })

  it('a full lap starts and ends at the goal', () => {
    const path = buildLapPath(loop)
    expect(path.points[0]).toEqual(circle[0])
    expect(path.length).toBeCloseTo(loop.length)
  })
})

describe('buildRacePath with a chute', () => {
  const junctionIndex = 180 // 圓上 90°，切線往外即 +x 方向
  const short = [circle[junctionIndex], { x: circle[junctionIndex].x + 100, z: circle[junctionIndex].z }]
  const long = [circle[junctionIndex], { x: circle[junctionIndex].x, z: circle[junctionIndex].z + 300 }]
  const chute = { branches: [short, long].map((points) => ({ points, junctionIndex })) }
  const junctionRemaining = loop.length - loop.cumulative[junctionIndex]

  it('starts on the chute when the distance exceeds the junction', () => {
    const path = buildRacePath(loop, junctionRemaining + 80, chute)
    expect(path.points[0].x).toBeCloseTo(circle[junctionIndex].x + 80)
    expect(path.length).toBeCloseTo(junctionRemaining + 80, 0)
    expect(path.points.at(-1)).toEqual(circle[0])
  })

  it('uses the first branch long enough to hold the start', () => {
    const path = buildRacePath(loop, junctionRemaining + 200, chute)
    expect(path.points[0].z).toBeCloseTo(circle[junctionIndex].z + 200)
  })

  it('falls back to the loop when the start is beyond every branch', () => {
    const path = buildRacePath(loop, junctionRemaining + 400, chute)
    expect(Math.hypot(path.points[0].x, path.points[0].z)).toBeCloseTo(100, 0)
  })
})

describe('pointAlong', () => {
  it('interpolates within a segment and clamps at the ends', () => {
    const path = { points: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }], traveled: [0, 10, 20], length: 20 }
    expect(pointAlong(path, 5)).toMatchObject({ x: 5, z: 0, index: 0 })
    expect(pointAlong(path, 15)).toMatchObject({ x: 10, z: 5, index: 1 })
    expect(pointAlong(path, 99)).toMatchObject({ x: 10, z: 10 })
  })
})

describe('lookAheadSpan', () => {
  it('looks ahead from the current position mid-race', () => {
    expect(lookAheadSpan(1000, 200, false, 30)).toEqual({ from: 200, to: 230 })
  })

  it('keeps the heading of the final stretch at the finish', () => {
    expect(lookAheadSpan(1000, 1000, false, 30)).toEqual({ from: 970, to: 1000 })
    expect(lookAheadSpan(1000, 990, false, 30)).toEqual({ from: 970, to: 1000 })
  })

  it('wraps past the goal on a continuous lap', () => {
    expect(lookAheadSpan(1000, 990, true, 30)).toEqual({ from: 990, to: 20 })
  })
})
