// 程序式跑步動作：以相位（0〜2π 一個步態週期）算出 VRM normalized 骨骼的 Euler 角（XYZ，弧度）。
// 座標採 VRM 1.0 慣例：模型面向 +Z、左手在 +X；繞 X 正轉 = 往後擺，負轉 = 往前抬。

const LEG_SWING = 0.75
const KNEE_BASE = 0.2
const KNEE_BEND = 1.3
const ARM_DOWN = 1.25 // T-pose 的手臂放下到身側
const ARM_SWING = 0.6
const ELBOW_BEND = 1.4
const LEAN = 0.18 // 上身前傾
const HIP_TWIST = 0.18 // 骨盆隨跨步左右扭轉，上身反向，裙擺才會被帶動
const CHEST_TWIST = 0.12
const BASE_CADENCE = 1.5 // 速度 ×1 時每秒步態週期數
const MAX_CADENCE = 3 // 高倍速時仍看得清楚動作

/** 一條腿的大腿擺動與膝蓋彎曲；膝蓋在腿從後方往前收時彎得最多 */
function legPose(phase) {
  const swing = -LEG_SWING * Math.sin(phase)
  const knee = KNEE_BASE + KNEE_BEND * Math.max(0, -Math.sin(phase + 0.6))
  return { upper: [swing, 0, 0], lower: [knee, 0, 0] }
}

/**
 * @param {number} phase 步態相位（弧度）
 * @returns {Record<string, [number, number, number]>} normalized 骨骼名稱 → Euler 角
 */
export function runPose(phase) {
  const left = legPose(phase)
  const right = legPose(phase + Math.PI)
  const armSwing = ARM_SWING * Math.sin(phase) // 手臂與同側腿反向
  const twist = Math.sin(phase)
  return {
    hips: [0, -HIP_TWIST * twist, 0], // 左腳往前時左髖也往前
    spine: [LEAN, 0, 0],
    chest: [0, CHEST_TWIST * twist, 0],
    leftUpperLeg: left.upper,
    leftLowerLeg: left.lower,
    rightUpperLeg: right.upper,
    rightLowerLeg: right.lower,
    leftUpperArm: [armSwing, 0, -ARM_DOWN],
    leftLowerArm: [0, -ELBOW_BEND, 0],
    rightUpperArm: [-armSwing, 0, ARM_DOWN],
    rightLowerArm: [0, ELBOW_BEND, 0],
  }
}

/** 跑步動作會用到的骨骼 */
export const RUN_BONES = Object.keys(runPose(0))

/** 停下站立：手臂放到身側，其餘骨骼歸零 */
export function standPose() {
  const pose = Object.fromEntries(RUN_BONES.map((bone) => [bone, [0, 0, 0]]))
  return { ...pose, leftUpperArm: [0, 0, -ARM_DOWN], rightUpperArm: [0, 0, ARM_DOWN] }
}

/** VRM 0.x 模型面向 -Z（等於繞 Y 轉半圈），X、Z 軸旋轉方向相反 */
export const toVrm0 = ([x, y, z]) => [-x, y, -z]

/** 依播放速度決定步頻：隨速度變快，但設上限避免高倍速時糊成一團 */
export const cadenceFor = (speedMultiplier) => Math.min(BASE_CADENCE * Math.sqrt(speedMultiplier), MAX_CADENCE)
