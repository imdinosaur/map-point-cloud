// 以 Mixamo 跑步動作驅動 VRM：慢跑、快跑依速度混合，停下時漸變回站姿。
import { AnimationClip, AnimationMixer, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { RUN_BONES, cadenceFor, standPose, toVrm0 } from './runCycle'

const FAST_RUN_FROM = 3 // 速度 ×3 以上改用快跑
const GAIT_EASE = 4 // 慢跑 ⇄ 快跑漸變速度
const STAND_EASE = 6 // 起跑、停下時跑姿 ⇄ 站姿漸變速度

/** 速度倍率 → 快跑動作所佔比重的目標值 */
export const fastWeightFor = (speedMultiplier) => (speedMultiplier >= FAST_RUN_FROM ? 1 : 0)

/** 指數趨近：每秒以 rate 的速度往 target 靠近，與幀率無關 */
export const easeToward = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt))

/**
 * 站姿做成單一關鍵影格的動作，與跑步動作一起交給 mixer 混合。
 * （mixer 只在數值改變時才寫回骨骼，不能在 mixer 之後另外改骨骼。）
 * 涵蓋跑步動作用到的每根骨骼；不在 standPose 中的骨骼站姿為零旋轉（T-pose）。
 */
function createStandClip(vrm, runClips) {
  const isVrm0 = vrm.meta?.metaVersion === '0'
  const pose = standPose()
  const rotations = Object.fromEntries(
    RUN_BONES.map((bone) => [
      vrm.humanoid.getNormalizedBoneNode(bone)?.name,
      new Quaternion().setFromEuler(new Euler(...(isVrm0 ? toVrm0(pose[bone]) : pose[bone]))),
    ]),
  )
  const hipsName = vrm.humanoid.getNormalizedBoneNode('hips').name
  const trackNames = new Set(runClips.flatMap((clip) => clip.tracks.map((track) => track.name)))
  const tracks = [...trackNames].map((name) => {
    const [nodeName, property] = name.split('.')
    if (property === 'quaternion') {
      return new QuaternionKeyframeTrack(name, [0], (rotations[nodeName] ?? new Quaternion()).toArray())
    }
    if (nodeName === hipsName && property === 'position') {
      return new VectorKeyframeTrack(name, [0], vrm.humanoid.normalizedRestPose.hips.position)
    }
    return null
  })
  return new AnimationClip('stand', 0, tracks.filter(Boolean))
}

/**
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {{ slow: import('three').AnimationClip, fast: import('three').AnimationClip }} clips 已 retarget 的動作
 */
export function createRunAnimator(vrm, { slow, fast }) {
  const mixer = new AnimationMixer(vrm.scene)
  const slowAction = mixer.clipAction(slow).play()
  const fastAction = mixer.clipAction(fast).play()
  const standAction = mixer.clipAction(createStandClip(vrm, [slow, fast])).play()
  let phase = 0 // 步態循環進度 0〜1；兩段動作共用，混合時左右腳才對得上
  let fastWeight = 0
  let standWeight = 1

  return {
    /** 每幀在 vrm.update 之前呼叫 */
    update(delta, { moving, speedMultiplier }) {
      if (moving) phase = (phase + delta * cadenceFor(speedMultiplier)) % 1
      fastWeight = easeToward(fastWeight, fastWeightFor(speedMultiplier), GAIT_EASE, delta)
      standWeight = easeToward(standWeight, moving ? 0 : 1, STAND_EASE, delta)

      slowAction.time = phase * slow.duration
      fastAction.time = phase * fast.duration
      slowAction.setEffectiveWeight((1 - standWeight) * (1 - fastWeight))
      fastAction.setEffectiveWeight((1 - standWeight) * fastWeight)
      standAction.setEffectiveWeight(standWeight)
      mixer.update(0) // 時間由 phase 決定，這裡只套用姿勢
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(vrm.scene)
    },
  }
}
