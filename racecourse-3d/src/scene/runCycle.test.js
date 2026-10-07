import { describe, expect, it } from 'vitest'
import { RUN_BONES, cadenceFor, runPose, standPose, toVrm0 } from './runCycle'

describe('runPose', () => {
  it('swings the legs in opposite directions', () => {
    const pose = runPose(Math.PI / 2)
    expect(pose.leftUpperLeg[0]).toBeCloseTo(-pose.rightUpperLeg[0])
    expect(pose.leftUpperLeg[0]).toBeLessThan(0) // 負值 = 往前抬
  })

  it('swings each arm against the leg on the same side', () => {
    for (const phase of [0.5, 2, 4]) {
      const pose = runPose(phase)
      expect(Math.sign(pose.leftUpperArm[0])).toBe(-Math.sign(pose.leftUpperLeg[0]))
    }
  })

  it('never bends the knees backwards', () => {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
      const pose = runPose(phase)
      expect(pose.leftLowerLeg[0]).toBeGreaterThan(0)
      expect(pose.rightLowerLeg[0]).toBeGreaterThan(0)
    }
  })

  it('repeats every full cycle', () => {
    const a = runPose(1)
    const b = runPose(1 + Math.PI * 2)
    for (const bone of Object.keys(a)) a[bone].forEach((v, i) => expect(b[bone][i]).toBeCloseTo(v))
  })
})

describe('runPose twist', () => {
  it('turns the pelvis with the leading leg and the chest the other way', () => {
    const pose = runPose(Math.PI / 2) // 左腳在前
    expect(pose.hips[1]).toBeLessThan(0)
    expect(Math.sign(pose.chest[1])).toBe(-Math.sign(pose.hips[1]))
  })
})

describe('toVrm0', () => {
  it('mirrors x and z rotations for models facing -Z', () => {
    expect(toVrm0([0.3, 0.2, -1])).toEqual([-0.3, 0.2, 1])
  })
})

describe('cadenceFor', () => {
  it('speeds up with the playback speed but stays readable', () => {
    expect(cadenceFor(4)).toBeGreaterThan(cadenceFor(1))
    expect(cadenceFor(20)).toBeLessThanOrEqual(3)
  })
})

describe('standPose', () => {
  it('covers every animated bone with the arms lowered', () => {
    const pose = standPose()
    expect(Object.keys(pose).sort()).toEqual([...RUN_BONES].sort())
    expect(pose.leftUpperLeg).toEqual([0, 0, 0])
    expect(pose.leftUpperArm[2]).toBeLessThan(0)
  })
})
