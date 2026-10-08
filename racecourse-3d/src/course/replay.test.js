import { describe, expect, it } from 'vitest'
import { buildReplay, findCornerDistances, parseCornerOrder, parseMargin, parseTime } from './replay'
import { JAPAN_CUP_2023 } from './races/japanCup2023'
import { FIELD } from './field'

const LENGTH = 2.4 // 1 馬身（m）

describe('parseTime', () => {
  it('reads m:ss.s race times', () => {
    expect(parseTime('2:21.8')).toBeCloseTo(141.8)
    expect(parseTime('59.4')).toBeCloseTo(59.4)
  })
})

describe('parseMargin', () => {
  it('reads JRA margins in lengths', () => {
    expect(parseMargin('')).toBe(0)
    expect(parseMargin('ハナ')).toBeCloseTo(0.05)
    expect(parseMargin('クビ')).toBeCloseTo(0.25)
    expect(parseMargin('3/4')).toBeCloseTo(0.75)
    expect(parseMargin('1.1/2')).toBeCloseTo(1.5)
    expect(parseMargin('2.1/2')).toBeCloseTo(2.5)
    expect(parseMargin('7')).toBe(7)
  })
})

describe('parseCornerOrder', () => {
  const order = parseCornerOrder('8=3-2-(1,17)(5,14),9')
  const of = (n) => order.find((entry) => entry.number === n)

  it('turns the JRA gap symbols into lengths behind the leader', () => {
    expect(of(8).behind).toBe(0)
    expect(of(3).behind).toBeGreaterThanOrEqual(5) // = 5 馬身以上
    expect(of(2).behind - of(3).behind).toBeGreaterThanOrEqual(2) // - 2〜5 馬身
    expect(of(9).behind - of(5).behind).toBeGreaterThanOrEqual(1) // , 1〜2 馬身
    expect(of(5).behind - of(1).behind).toBeLessThan(1) // 括號之間無記號：1 馬身未滿
  })

  it('keeps horses in a bracket side by side, listed from the inside out', () => {
    expect(of(17).behind).toBe(of(1).behind)
    expect(of(1).lane).toBe(0)
    expect(of(17).lane).toBe(1)
  })
})

describe('findCornerDistances', () => {
  it('places two corners in each bend of the route', () => {
    // 0〜300 直線、300〜700 彎道、700〜1300 直線、1300〜1700 彎道、1700〜2000 直線
    const curvatureAt = (d) => ((d > 300 && d < 700) || (d > 1300 && d < 1700) ? 1 / 100 : 0)
    const corners = findCornerDistances(curvatureAt, 2000)
    expect(corners).toHaveLength(4)
    expect(corners[0]).toBeGreaterThan(300)
    expect(corners[1]).toBeLessThan(700)
    expect(corners[2]).toBeGreaterThan(1300)
    expect(corners[3]).toBeLessThan(1700)
  })
})

describe('buildReplay with the 2023 Japan Cup', () => {
  const corners = [350, 650, 1500, 1800]
  const replay = buildReplay(JAPAN_CUP_2023, { length: 2400, cornerDistances: corners })
  const horse = (n) => replay.at(0).runners.find((r) => r.number === n)

  it('starts every horse at the gate', () => {
    for (const runner of replay.at(0).runners) expect(runner.traveled).toBe(0)
  })

  it('finishes in the official order', () => {
    const final = replay.at(replay.duration)
    expect(final.finishOrder).toEqual(JAPAN_CUP_2023.horses.map((h) => h.number))
  })

  it('puts the winner on the line at the official time', () => {
    const atFinish = replay.at(141.8).runners.find((r) => r.number === 2)
    expect(atFinish.traveled).toBeCloseTo(2400, 0)
  })

  it('passes 600m to go at finish time minus the last 600m for each horse', () => {
    for (const { number, last3F } of JAPAN_CUP_2023.horses) {
      const t = replay.finishTimes[number] - last3F
      const runner = replay.at(t).runners.find((r) => r.number === number)
      expect(Math.abs(runner.traveled - 1800)).toBeLessThan(1)
    }
  })

  it('never moves a horse backwards', () => {
    let previous = new Map()
    for (let t = 0; t <= replay.duration; t += 0.5) {
      for (const runner of replay.at(t).runners) {
        expect(runner.traveled).toBeGreaterThanOrEqual((previous.get(runner.number) ?? 0) - 1e-6)
        previous.set(runner.number, runner.traveled)
      }
    }
  })

  it('has Panthalassa (8) far in front at the 2nd corner, as in the official order', () => {
    const t = replay.cornerTimes[1]
    const state = replay.at(t)
    const leader = state.runners.find((r) => r.number === 8)
    const second = state.runners.find((r) => r.number === 3)
    expect(leader.traveled - second.traveled).toBeGreaterThanOrEqual(5 * LENGTH - 0.01) // 「=」：5 馬身以上
  })

  it('labels each runner with its horse name', () => {
    expect(horse(2).label).toBe('イクイノックス')
  })
})

describe('buildReplay after the finish', () => {
  const replay = buildReplay(JAPAN_CUP_2023, { length: 2400, cornerDistances: [350, 650, 1500, 1800] })

  it('carries every horse past the line and stops them at different places', () => {
    const settled = replay.at(replay.settledAt)
    expect(replay.settledAt).toBeGreaterThan(replay.duration)
    for (const runner of settled.runners) {
      expect(runner.traveled).toBeGreaterThan(2400 + FIELD.runoutMin - 1)
      expect(runner.speed).toBeCloseTo(0)
    }
    expect(new Set(settled.runners.map((r) => Math.round(r.traveled))).size).toBeGreaterThan(settled.runners.length / 2)
  })

  it('keeps moving forward while slowing down just after the line', () => {
    const winner = JAPAN_CUP_2023.horses[0].number
    const at = (t) => replay.at(t).runners.find((r) => r.number === winner)
    const finish = replay.finishTimes[winner]
    expect(at(finish + 1).traveled).toBeGreaterThan(2400)
    expect(at(finish + 2).traveled).toBeGreaterThan(at(finish + 1).traveled)
    expect(at(finish + 2).speed).toBeLessThan(at(finish + 0.5).speed)
  })
})
