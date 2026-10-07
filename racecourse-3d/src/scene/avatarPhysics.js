import {
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneJoint,
  VRMSpringBoneManager,
} from '@pixiv/three-vrm'
import { Vector3 } from 'three'

// 模型內建的 spring bone 設定是空的，這裡依骨骼命名（Sp_ 開頭為搖晃用骨骼）補上物理與碰撞體。
// 數值以模型原尺寸（公尺）表示，套用時再乘上角色放大倍率。

const SWAY_PREFIX = 'Sp_'

/** 依骨骼名稱比對的搖晃設定；未列出的（胸部）保持靜止 */
// wind：跑步迎面風的受力比例。裙子刻意調低，只讓裙擺飄動而不會整片掀起
const CHAIN_PRESETS = [
  { name: 'skirt', match: /MSkirt/, stiffness: 0.9, gravityPower: 0.6, dragForce: 0.5, hitRadius: 0.02, wind: 0.4, colliders: ['legs', 'hips'] },
  { name: 'tail', match: /Tail/, stiffness: 0.5, gravityPower: 0.3, dragForce: 0.3, hitRadius: 0.03, wind: 1, colliders: ['legs', 'hips'] },
  { name: 'longHair', match: /Hair4/, stiffness: 0.4, gravityPower: 0.8, dragForce: 0.55, hitRadius: 0.03, wind: 0.6, colliders: ['body', 'hips', 'legs'] }, // 髮根長在頭部碰撞球內，加 head 會被往上推
  { name: 'hair', match: /_He_Hair/, stiffness: 1, gravityPower: 0.2, dragForce: 0.4, hitRadius: 0.02, wind: 0.6, colliders: ['head'] },
  { name: 'ear', match: /Ear/, stiffness: 3, gravityPower: 0, dragForce: 0.6, hitRadius: 0.01, wind: 0.2, colliders: [] },
  { name: 'ribbon', match: /Ribbon|Acc/, stiffness: 0.8, gravityPower: 0.4, dragForce: 0.35, hitRadius: 0.02, wind: 1, colliders: ['body'] },
]

const FLUTTER_SPEED = 9 // 風的擾動頻率（rad/s），讓裙擺持續飄動而不是被吹到定格
const FLUTTER_AMOUNT = 0.25

/** 碰撞體（掛在 raw 骨骼上）：膠囊從該骨骼延伸到 tailBone 的位置 */
const COLLIDER_SPECS = {
  hips: [{ bone: 'hips', radius: 0.11 }],
  legs: ['left', 'right'].flatMap((side) => [
    { bone: `${side}UpperLeg`, tailBone: `${side}LowerLeg`, radius: 0.075 },
    { bone: `${side}LowerLeg`, tailBone: `${side}Foot`, radius: 0.055 },
  ]),
  body: [{ bone: 'chest', radius: 0.12 }],
  head: [{ bone: 'head', radius: 0.1, offset: [0, 0.08, 0] }],
}

const GRAVITY_DIR = new Vector3(0, -1, 0)
const jointWind = new WeakMap() // joint → { gravityPower, wind, phase }：每幀疊加風力前的基準值

export const chainPresetFor = (boneName) =>
  boneName.startsWith(SWAY_PREFIX) ? (CHAIN_PRESETS.find(({ match }) => match.test(boneName)) ?? null) : null

/**
 * 重力與迎面風合成單一的拉力（spring bone 只有一個 gravityDir / gravityPower）。
 * @param {number} gravityPower 重力強度
 * @param {Vector3} back 角色身後的世界方向（單位向量）
 * @param {number} wind 風力強度
 */
export function windForce(gravityPower, back, wind) {
  const force = GRAVITY_DIR.clone().multiplyScalar(gravityPower).addScaledVector(back, wind)
  const power = force.length()
  return { dir: power > 0 ? force.divideScalar(power) : GRAVITY_DIR.clone(), power }
}

/**
 * 每幀依跑步方向與強度更新所有 joint 的拉力。
 * @param {Vector3} back 角色身後的世界方向（單位向量）
 * @param {number} strength 0 = 無風；數值已含角色放大倍率
 * @param {number} time 秒，用於擾動
 */
export function applyWind(manager, back, strength, time) {
  for (const joint of manager.joints) {
    const base = jointWind.get(joint)
    if (!base) continue
    const flutter = 1 + FLUTTER_AMOUNT * Math.sin(time * FLUTTER_SPEED + base.phase)
    const { dir, power } = windForce(base.gravityPower, back, strength * base.wind * flutter)
    joint.settings.gravityDir.copy(dir)
    joint.settings.gravityPower = power
  }
}

/** 剛度、重力是世界空間的位移量，半徑是世界長度，都要隨放大倍率等比放大；阻尼是比例不變 */
export const scaledSettings = ({ stiffness, gravityPower, dragForce, hitRadius }, scale) => ({
  stiffness: stiffness * scale,
  gravityPower: gravityPower * scale,
  dragForce,
  hitRadius: hitRadius * scale,
  gravityDir: GRAVITY_DIR.clone(),
})

const firstSwayChild = (object) => object.children.find((child) => child.name.startsWith(SWAY_PREFIX)) ?? null

/** 找出所有 [搖晃骨骼, 下一節搖晃骨骼]；分岔時只沿第一個分支，避免同一根骨骼被兩個 joint 搶著轉 */
export function jointPairs(root) {
  const pairs = []
  root.traverse((object) => {
    if (!object.name.startsWith(SWAY_PREFIX)) return
    const child = firstSwayChild(object)
    const isOnFirstBranch = !object.parent.name.startsWith(SWAY_PREFIX) || firstSwayChild(object.parent) === object
    if (child && isOnFirstBranch) pairs.push([object, child])
  })
  return pairs
}

function createColliderGroup(humanoid, specs, scale) {
  const colliders = specs.flatMap(({ bone, tailBone, radius, offset = [0, 0, 0] }) => {
    const node = humanoid.getRawBoneNode(bone)
    if (!node) return []
    const tailNode = tailBone ? humanoid.getRawBoneNode(tailBone) : null
    const shape = tailNode
      ? new VRMSpringBoneColliderShapeCapsule({ radius: radius * scale, tail: tailNode.position.clone() })
      : new VRMSpringBoneColliderShapeSphere({ radius: radius * scale, offset: new Vector3(...offset) })
    const collider = new VRMSpringBoneCollider(shape)
    node.add(collider)
    return [collider]
  })
  return { colliders }
}

/**
 * 為 VRM 建立 spring bone 與碰撞體。需在套用任何姿勢前呼叫一次。
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @param {number} scale 角色放大倍率
 */
export function setupAvatarPhysics(vrm, scale) {
  const manager = vrm.springBoneManager ?? new VRMSpringBoneManager()
  vrm.springBoneManager = manager

  const groups = Object.fromEntries(
    Object.entries(COLLIDER_SPECS).map(([key, specs]) => [key, createColliderGroup(vrm.humanoid, specs, scale)]),
  )
  for (const [bone, child] of jointPairs(vrm.scene)) {
    const preset = chainPresetFor(bone.name)
    if (!preset) continue
    const colliderGroups = preset.colliders.map((key) => groups[key])
    const settings = scaledSettings(preset, scale)
    const joint = new VRMSpringBoneJoint(bone, child, settings, colliderGroups)
    // 各 joint 的擾動相位錯開，裙擺才會一片片輪流飄
    jointWind.set(joint, { gravityPower: settings.gravityPower, wind: preset.wind, phase: manager.joints.size * 1.7 })
    manager.addJoint(joint)
  }
  manager.setInitState()
  return manager
}
