import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createInertiaTracker, INERTIA } from './inertia'
import { RACE_SPEED } from './sceneConfig'

const DT = 1 / 60

/** 以固定步長餵入位置函式 p(t)，回傳最後的慣性力（g 為單位） */
function track(position, { seconds = 3, timeScale = 1 } = {}) {
  const tracker = createInertiaTracker()
  let result = new Vector3()
  for (let t = 0; t <= seconds; t += DT) result = tracker.update(position(t), DT, timeScale)
  return result
}

describe('createInertiaTracker', () => {
  it('feels nothing at a constant velocity', () => {
    const force = track((t) => new Vector3(RACE_SPEED * t, 0, 0))
    expect(force.length()).toBeCloseTo(0, 3)
  })

  it('pushes outward on a curve (opposite to the centripetal acceleration)', () => {
    const radius = 100
    const omega = RACE_SPEED / radius
    const force = track((t) => new Vector3(Math.cos(omega * t) * radius, 0, Math.sin(omega * t) * radius))
    const outward = new Vector3(Math.cos(omega * 3), 0, Math.sin(omega * 3))
    expect(force.dot(outward)).toBeGreaterThan(0.5) // v²/r ≈ 2.8 m/s²，乘上誇張倍率後清楚可見
  })

  it('measures acceleration in race time so playback speed does not change the swing', () => {
    const radius = 100
    const curve = (scale) => (t) => {
      const angle = (RACE_SPEED * scale * t) / radius
      return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    }
    const normal = track(curve(1), { seconds: 1 }).length()
    const fast = track(curve(3), { seconds: 1, timeScale: 3 }).length()
    expect(fast).toBeCloseTo(normal, 1)
  })

  it('never exceeds the clamp, even on a hard stop', () => {
    const force = track((t) => new Vector3(t < 1 ? RACE_SPEED * t : RACE_SPEED, 0, 0), { seconds: 1.05 })
    expect(force.length()).toBeLessThanOrEqual(INERTIA.max + 1e-9)
    expect(force.x).toBeGreaterThan(0) // 急停時往前甩
  })

  it('ignores teleports such as restarting a race or switching courses', () => {
    const force = track((t) => new Vector3(t < 1.5 ? RACE_SPEED * t : 2000 + RACE_SPEED * t, 0, 0))
    expect(force.length()).toBeCloseTo(0, 3)
  })
})

describe('vertical inertia', () => {
  it('never lifts more than maxUp, so the hair cannot flip over the head', () => {
    // 斷面圖頂點處坡度瞬間改變：上坡後接平地（越過坡頂）→ 向下的加速度尖峰，慣性往上抬
    const force = track((t) => new Vector3(RACE_SPEED * t, t < 1 ? 10 * t : 10, 0), { seconds: 1.05 })
    expect(force.y).toBeGreaterThan(0)
    expect(force.y).toBeLessThanOrEqual(INERTIA.maxUp + 1e-9)
  })
})
