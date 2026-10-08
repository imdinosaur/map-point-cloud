import { describe, expect, it } from 'vitest'
import { AnimationClip, Euler, Group, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { createRunAnimator, easeToward, fastWeightFor } from './runAnimator'
import { standPose } from './runCycle'

const BONES = ['hips', 'leftUpperArm', 'leftHand']

function fakeVrm() {
  const scene = new Group()
  const nodes = Object.fromEntries(
    BONES.map((bone) => {
      const node = new Group()
      node.name = `Normalized_${bone}`
      scene.add(node)
      return [bone, node]
    }),
  )
  return {
    scene,
    meta: { metaVersion: '1' },
    humanoid: {
      getNormalizedBoneNode: (bone) => nodes[bone] ?? null,
      normalizedRestPose: { hips: { position: [0, 0.8, 0] } },
    },
  }
}

/** 整段動作都維持同一個姿勢的循環 */
function constantClip(angle, hipsY, duration) {
  const q = new Quaternion().setFromEuler(new Euler(angle, 0, 0)).toArray()
  return new AnimationClip('run', duration, [
    ...BONES.map((bone) => new QuaternionKeyframeTrack(`Normalized_${bone}.quaternion`, [0, duration], [...q, ...q])),
    new VectorKeyframeTrack('Normalized_hips.position', [0, duration], [0, hipsY, 0, 0, hipsY, 0]),
  ])
}

const angleOf = (vrm, bone, target) => vrm.humanoid.getNormalizedBoneNode(bone).quaternion.angleTo(target)

describe('fastWeightFor', () => {
  it('uses the slow run at low speeds and the fast run from ×3', () => {
    expect(fastWeightFor(1)).toBe(0)
    expect(fastWeightFor(2)).toBe(0)
    expect(fastWeightFor(3)).toBe(1)
    expect(fastWeightFor(20)).toBe(1)
  })
})

describe('easeToward', () => {
  it('moves toward the target without overshooting and is frame-rate independent', () => {
    expect(easeToward(0, 1, 4, 0)).toBe(0)
    expect(easeToward(0, 1, 4, 100)).toBeCloseTo(1)
    const oneStep = easeToward(0, 1, 4, 0.2)
    let twoSteps = easeToward(0, 1, 4, 0.1)
    twoSteps = easeToward(twoSteps, 1, 4, 0.1)
    expect(twoSteps).toBeCloseTo(oneStep)
  })
})

describe('createRunAnimator', () => {
  const clips = { slow: constantClip(0.4, 0.7, 0.7), fast: constantClip(0.8, 0.6, 0.5) }

  it('holds the stand pose while not moving', () => {
    const vrm = fakeVrm()
    createRunAnimator(vrm, clips).update(1 / 60, { moving: false, speedMultiplier: 1 })
    const [x, y, z] = standPose().leftUpperArm
    expect(angleOf(vrm, 'leftUpperArm', new Quaternion().setFromEuler(new Euler(x, y, z)))).toBeCloseTo(0)
    expect(angleOf(vrm, 'leftHand', new Quaternion())).toBeCloseTo(0) // 不在 standPose 的骨骼回到 T-pose
    expect(vrm.humanoid.getNormalizedBoneNode('hips').position.y).toBeCloseTo(0.8)
  })

  it('plays the slow run at low speed and the fast run at high speed once eased in', () => {
    for (const [speedMultiplier, clip] of [
      [1, clips.slow],
      [10, clips.fast],
    ]) {
      const vrm = fakeVrm()
      const animator = createRunAnimator(vrm, clips)
      for (let i = 0; i < 300; i++) animator.update(1 / 60, { moving: true, speedMultiplier })
      const expected = new Quaternion().fromArray(clip.tracks[1].values)
      expect(angleOf(vrm, 'leftUpperArm', expected)).toBeCloseTo(0, 2) // Float32 四元數的 angleTo 在 0 附近不精確
      expect(vrm.humanoid.getNormalizedBoneNode('hips').position.y).toBeCloseTo(clip.tracks.at(-1).values[1], 3)
    }
  })
})
