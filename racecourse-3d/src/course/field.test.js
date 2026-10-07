import { describe, expect, it } from 'vitest'
import { FIELD, createField, rankings, stallLateral, stepField } from './field'
import { wakuOf } from './startingGate'

const RACE_SPEED = 16.7
const straight = (length) => ({ length, curvatureAt: () => 0 })

/** 以固定步長跑完整場，回傳每一步的狀態 */
function runRace(field, course, dt = 1 / 30, limit = 400) {
  const history = [field]
  let current = field
  for (let t = 0; t < limit && current.finishOrder.length < current.runners.length; t += dt) {
    current = stepField(current, dt, course)
    history.push(current)
  }
  return history
}

describe('createField', () => {
  it('lines up 18 runners in their stalls with the JRA waku colours', () => {
    const field = createField({ seed: 1 })
    expect(field.runners).toHaveLength(FIELD.runners)
    field.runners.forEach((runner, k) => {
      expect(runner.number).toBe(k + 1)
      expect(runner.waku).toBe(wakuOf(k + 1, FIELD.runners))
      expect(runner.lateral).toBeCloseTo(stallLateral(k + 1))
      expect(runner.traveled).toBe(0)
    })
  })

  it('is reproducible from its seed and differs between seeds', () => {
    const styles = (seed) => createField({ seed }).runners.map((r) => `${r.style}:${r.ability.toFixed(4)}`)
    expect(styles(7)).toEqual(styles(7))
    expect(styles(7)).not.toEqual(styles(8))
  })
})

describe('stepField', () => {
  const course = straight(1600)
  const history = runRace(createField({ seed: 3 }), course)
  const final = history.at(-1)

  it('brings every runner home exactly once', () => {
    expect([...final.finishOrder].sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, k) => k + 1))
  })

  it('runs the race at roughly race pace', () => {
    const winnerTime = final.runners.find((r) => r.number === final.finishOrder[0]).finishedAt
    expect(winnerTime).toBeGreaterThan((1600 / RACE_SPEED) * 0.85)
    expect(winnerTime).toBeLessThan((1600 / RACE_SPEED) * 1.15)
  })

  it('never lets two running horses occupy the same spot', () => {
    for (const { runners } of history.slice(30)) {
      const running = runners.filter((r) => r.finishedAt === null)
      for (let a = 0; a < running.length; a++) {
        for (let b = a + 1; b < running.length; b++) {
          const close = Math.abs(running[a].traveled - running[b].traveled) < 0.8
          const sideBySide = Math.abs(running[a].lateral - running[b].lateral) < 0.5
          expect(close && sideBySide).toBe(false)
        }
      }
    }
  })

  it('keeps everyone outside the inner rail', () => {
    for (const { runners } of history) for (const r of runners) expect(r.lateral).toBeGreaterThanOrEqual(FIELD.minLateral - 1e-9)
  })

  it('does not mutate the previous state', () => {
    const field = createField({ seed: 5 })
    const snapshot = JSON.stringify(field)
    stepField(field, 0.1, course)
    expect(JSON.stringify(field)).toBe(snapshot)
  })

  it('rewards the inside line on a curve', () => {
    const curve = { length: 1000, curvatureAt: () => 1 / 100 } // 半徑 100m 的彎道
    const field = createField({ seed: 9 })
    const pick = (lateral) => ({ ...field.runners[0], lateral, speed: RACE_SPEED })
    const inside = stepField({ ...field, runners: [pick(0)] }, 1, curve).runners[0].traveled
    const outside = stepField({ ...field, runners: [pick(10)] }, 1, curve).runners[0].traveled
    expect(inside).toBeGreaterThan(outside * 1.05)
  })
})

describe('rankings', () => {
  it('orders finishers by time, then the rest by distance covered', () => {
    const field = createField({ seed: 1 })
    const runners = field.runners.slice(0, 3).map((r, k) => ({ ...r, traveled: [500, 900, 700][k] }))
    const finished = { ...runners[0], traveled: 1000, finishedAt: 60 }
    const ordered = rankings({ ...field, runners: [finished, runners[1], runners[2]], finishOrder: [1] })
    expect(ordered).toEqual([1, 2, 3])
  })
})
