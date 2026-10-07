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
// sway：陣風造成的前後晃動幅度（風力的 ±比例）。雙馬尾最明顯，裙擺只輕微飄動
// windCap：風力倍率上限。高速時雙馬尾可以整束甩到身後，但裙子不能被掀起；未設定 = 不設限
const CHAIN_PRESETS = [
  { name: 'skirt', match: /MSkirt/, stiffness: 0.9, gravityPower: 0.6, dragForce: 0.5, hitRadius: 0.02, wind: 0.4, sway: 0.3, windCap: 2.4, colliders: ['legs', 'hips'] },
  { name: 'tail', match: /Tail/, stiffness: 0.5, gravityPower: 0.3, dragForce: 0.3, hitRadius: 0.03, wind: 1, sway: 0.6, windCap: 8, colliders: ['legs', 'hips'] },
  { name: 'longHair', match: /Hair4/, stiffness: 0.4, gravityPower: 0.8, dragForce: 0.55, hitRadius: 0.03, wind: 1, sway: 0.8, colliders: ['body', 'hips', 'legs'] }, // 髮根長在頭部碰撞球內，加 head 會被往上推
  { name: 'hair', match: /_He_Hair/, stiffness: 1, gravityPower: 0.2, dragForce: 0.4, hitRadius: 0.02, wind: 0.6, sway: 0.4, windCap: 4, colliders: ['head'] },
  { name: 'ear', match: /Ear/, stiffness: 3, gravityPower: 0, dragForce: 0.6, hitRadius: 0.01, wind: 0.2, sway: 0.2, windCap: 2, colliders: [] },
  { name: 'ribbon', match: /Ribbon|Acc/, stiffness: 0.8, gravityPower: 0.4, dragForce: 0.35, hitRadius: 0.02, wind: 1, sway: 0.5, windCap: 5, colliders: ['body'] },
]

/**
 * 迎面風：物理以角色自身為中心（不受跑速影響），改用風力表現「正在跑」。
 * strength 為速度 ×1 時的風力（模型原尺寸，與 gravityPower 同單位）。
 */
export const WIND = {
  strength: 0.3,
  perSpeed: 0.5, // 風力倍率隨倍速線性增加：越快越往後甩，高速時雙馬尾整束甩到身後
  maxGain: 12, // 安全上限（介面最高 ×20 不會碰到）
  swayRatePerSpeed: 0.1, // 陣風頻率隨倍速加快：高速時是快速拍動而非慢慢擺
  maxSwayRate: 3,
}

/** 依播放倍速決定風力倍率（與倍速大致成正比，不會在某個倍速停止增加） */
export const windGainFor = (speedMultiplier) => Math.min(WIND.perSpeed * speedMultiplier, WIND.maxGain)

/** 各部位實際承受的風力倍率（套用該部位的上限） */
export const chainWindGain = (gain, preset) => Math.min(gain, preset.windCap ?? Infinity)

/** 陣風的時間流速倍率 */
export const swayRateFor = (speedMultiplier) => Math.min(1 + WIND.swayRatePerSpeed * speedMultiplier, WIND.maxSwayRate)

// 陣風：三個頻率互不成整數比的正弦疊加，平滑又不會規律重複；權重總和為 1，結果落在 -1..1
const SWAY_WAVES = [
  { hz: 0.53, weight: 0.5, phase: 1 },
  { hz: 1.17, weight: 0.32, phase: 2.3 },
  { hz: 2.41, weight: 0.18, phase: 4.1 },
]

/** 平滑的偽隨機訊號（-1..1）；seed 不同的髮束各自晃動 */
export const swayNoise = (time, seed) =>
  SWAY_WAVES.reduce((sum, { hz, weight, phase }) => sum + weight * Math.sin(2 * Math.PI * hz * time + seed * phase), 0)

/** 同一束（例如左邊雙馬尾的 _00〜_05）共用一個 key，整束一起晃 */
export const chainKey = (boneName) => boneName.replace(/_\d+$/, '')

/**
 * 由字串得到固定的亂數種子（0〜2π），重新整理頁面後同一束的晃法不變。
 * 左右雙馬尾的名稱只差一個字母，簡單的多項式雜湊會得到幾乎相同的種子，所以用 FNV-1a 再打散。
 */
export const seedFor = (key) => {
  let hash = 0x811c9dc5
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193)
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  hash ^= hash >>> 16
  return ((hash >>> 0) / 0x100000000) * 2 * Math.PI
}

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
const NO_INERTIA = new Vector3()
const jointWind = new WeakMap() // joint → { gravityPower, preset, seed }：每幀疊加風力前的基準值

export const chainPresetFor = (boneName) =>
  boneName.startsWith(SWAY_PREFIX) ? (CHAIN_PRESETS.find(({ match }) => match.test(boneName)) ?? null) : null

/**
 * 重力、慣性與迎面風合成單一的拉力（spring bone 只有一個 gravityDir / gravityPower）。
 * 慣性是額外的視重力，所以按各鏈的重力強度等比例加上。
 * @param {number} gravityPower 重力強度
 * @param {Vector3} back 角色身後的世界方向（單位向量）
 * @param {number} wind 風力強度
 * @param {Vector3} [inertia] 慣性造成的額外拉力（以 g 為單位）
 */
export function externalForce(gravityPower, back, wind, inertia = NO_INERTIA) {
  const force = GRAVITY_DIR.clone().add(inertia).multiplyScalar(gravityPower).addScaledVector(back, wind)
  const power = force.length()
  return { dir: power > 0 ? force.divideScalar(power) : GRAVITY_DIR.clone(), power }
}

/**
 * 每幀更新所有 joint 的拉力。
 * @param {{ back: Vector3, windUnit: number, windGain: number, inertia: Vector3, swayTime: number }} forces
 *   back：角色身後的世界方向；windUnit：風力 ×1 的強度（已含角色放大倍率）；windGain：目前風力倍率（0 = 無風）；
 *   inertia：慣性（g）；swayTime：陣風時間（秒，高速時流得較快）
 */
export function applyExternalForces(manager, { back, windUnit, windGain, inertia, swayTime }) {
  for (const joint of manager.joints) {
    const base = jointWind.get(joint)
    if (!base) continue
    const { preset } = base
    // 陣風讓風力在 (1 ± sway) 倍間起伏：風弱時頭髮往前回擺、風強時往後飄
    const gust = 1 + preset.sway * swayNoise(swayTime, base.seed)
    const wind = windUnit * chainWindGain(windGain, preset) * preset.wind * gust
    const { dir, power } = externalForce(base.gravityPower, back, wind, inertia)
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
    jointWind.set(joint, { gravityPower: settings.gravityPower, preset, seed: seedFor(chainKey(bone.name)) })
    manager.addJoint(joint)
  }
  manager.setInitState()
  return manager
}
