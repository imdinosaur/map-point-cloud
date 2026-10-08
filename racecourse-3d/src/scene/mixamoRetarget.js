// 把 Mixamo 下載的 FBX 動作套到 VRM 的 normalized 骨骼上（參考 three-vrm 官方範例 loadMixamoAnimation.js）。
import { AnimationClip, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'

const SIDES = { Left: 'left', Right: 'right' }
const FINGERS = { Index: 'Index', Middle: 'Middle', Ring: 'Ring', Pinky: 'Little' }
const FINGER_JOINTS = ['Proximal', 'Intermediate', 'Distal']
const THUMB_JOINTS = ['Metacarpal', 'Proximal', 'Distal']

/** Mixamo 骨骼名稱 → VRM humanoid 骨骼名稱 */
export const MIXAMO_TO_VRM = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  ...Object.fromEntries(
    Object.entries(SIDES).flatMap(([mixamo, vrm]) => [
      [`mixamorig${mixamo}Shoulder`, `${vrm}Shoulder`],
      [`mixamorig${mixamo}Arm`, `${vrm}UpperArm`],
      [`mixamorig${mixamo}ForeArm`, `${vrm}LowerArm`],
      [`mixamorig${mixamo}Hand`, `${vrm}Hand`],
      [`mixamorig${mixamo}UpLeg`, `${vrm}UpperLeg`],
      [`mixamorig${mixamo}Leg`, `${vrm}LowerLeg`],
      [`mixamorig${mixamo}Foot`, `${vrm}Foot`],
      [`mixamorig${mixamo}ToeBase`, `${vrm}Toes`],
      ...THUMB_JOINTS.map((joint, i) => [`mixamorig${mixamo}HandThumb${i + 1}`, `${vrm}Thumb${joint}`]),
      ...Object.entries(FINGERS).flatMap(([finger, vrmFinger]) =>
        FINGER_JOINTS.map((joint, i) => [`mixamorig${mixamo}Hand${finger}${i + 1}`, `${vrm}${vrmFinger}${joint}`]),
      ),
    ]),
  ),
}

const MIXAMO_CLIP_NAME = 'mixamo.com' // Mixamo FBX 另有一段空的 'Take 001'

/** VRM 0.x 面向 -Z：四元數的 x、z 分量反向（同 runCycle 的 toVrm0） */
const flipQuaternionsForVrm0 = (values) => values.map((v, i) => (i % 2 === 0 ? -v : v))

/**
 * 拿掉 hips 每個循環往前（往旁）累積的位移，只留步伐中的前後左右晃動。
 * 角色位置由跑道路徑決定；保留位移的話每個循環結束會被拉回原點。
 * @param {ArrayLike<number>} values 每 3 個一組的 xyz
 * @param {ArrayLike<number>} times 對應的時間（秒）
 */
export function removeRootDrift(values, times) {
  const count = times.length
  const duration = times[count - 1] - times[0] || 1
  const out = Array.from(values)
  for (const axis of [0, 2]) {
    const first = values[axis]
    const drift = values[(count - 1) * 3 + axis] - first
    for (let i = 0; i < count; i++) out[i * 3 + axis] -= first + (drift * (times[i] - times[0])) / duration
  }
  return out
}

/** Mixamo 骨骼在 FBX 中的靜止姿勢不是 T-pose，轉成相對 VRM normalized 骨骼（T-pose 為零旋轉）的旋轉 */
function retargetRotations(track, rigNode) {
  const restInverse = rigNode.getWorldQuaternion(new Quaternion()).invert()
  const parentRest = rigNode.parent.getWorldQuaternion(new Quaternion())
  const q = new Quaternion()
  const values = new Float32Array(track.values.length)
  for (let i = 0; i < values.length; i += 4) {
    q.fromArray(track.values, i).premultiply(parentRest).multiply(restInverse).toArray(values, i)
  }
  return values
}

/**
 * @param {import('three').Group} asset FBXLoader 載入的 Mixamo 動作
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @returns {AnimationClip} 以 vrm.scene 為根播放的循環動作
 */
export function retargetMixamoClip(asset, vrm) {
  const source = AnimationClip.findByName(asset.animations, MIXAMO_CLIP_NAME)
  if (!source) throw new Error(`FBX 中找不到 Mixamo 動作（${MIXAMO_CLIP_NAME}）`)

  const isVrm0 = vrm.meta?.metaVersion === '0'
  const [restX, vrmHipsHeight, restZ] = vrm.humanoid.normalizedRestPose.hips.position
  const hipsScale = vrmHipsHeight / asset.getObjectByName('mixamorigHips').position.y

  const tracks = source.tracks.flatMap((track) => {
    const [rigName, property] = track.name.split('.')
    const node = vrm.humanoid.getNormalizedBoneNode(MIXAMO_TO_VRM[rigName])
    const rigNode = asset.getObjectByName(rigName)
    if (!node || !rigNode) return []
    const name = `${node.name}.${property}`

    if (property === 'quaternion') {
      const values = retargetRotations(track, rigNode)
      return [new QuaternionKeyframeTrack(name, track.times, isVrm0 ? flipQuaternionsForVrm0(values) : values)]
    }
    if (property === 'position' && rigName === 'mixamorigHips') {
      const values = removeRootDrift(track.values, track.times).map((v, i) => {
        const axis = i % 3
        if (axis === 1) return v * hipsScale
        return (isVrm0 ? -v : v) * hipsScale + (axis === 0 ? restX : restZ)
      })
      return [new VectorKeyframeTrack(name, track.times, values)]
    }
    return []
  })

  return new AnimationClip(source.name, source.duration, tracks)
}
