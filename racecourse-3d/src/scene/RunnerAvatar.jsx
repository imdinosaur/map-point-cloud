import { useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'
import { useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { WIND, applyExternalForces, setupAvatarPhysics, swayRateFor, windGainFor } from './avatarPhysics'
import { createInertiaTracker } from './inertia'
import { createRunAnimator } from './runAnimator'
import { RUN_BONES, cadenceFor, runPose, standPose, toVrm0 } from './runCycle'
import { MAX_FRAME_DELTA } from './sceneConfig'
import useRunClips from './useRunClips'

const MODEL_URL = `${import.meta.env.BASE_URL}models/runner.vrm`
const BOB_HEIGHT = 0.06 // 每步上下起伏（模型原尺寸，公尺）
const TWO_PI = Math.PI * 2
const MAX_PHYSICS_DELTA = 1 / 30 // 分頁切回時 delta 很大，物理會一次甩飛
const WARMUP_DELTA = 1 / 60
const WARMUP_STEPS = 90 // 約 1.5 秒
const STAND_POSE = standPose()
const WIND_EASE = 3 // 起跑、停下時風力漸變速度
const worldQuaternion = new Quaternion()
const worldPosition = new Vector3()
const back = new Vector3()

const withVrmPlugin = (loader) => loader.register((parser) => new VRMLoaderPlugin(parser))

/** useLoader 會快取模型，重新掛載時拿到同一個 vrm，只需整理一次 */
const prepared = new WeakSet()
function prepare(vrm, scale) {
  if (prepared.has(vrm)) return
  prepared.add(vrm)
  VRMUtils.rotateVRM0(vrm) // VRM 0.x 面向 -Z，轉成與 1.0 相同的 +Z
  VRMUtils.combineSkeletons(vrm.scene)
  vrm.scene.traverse((object) => {
    if (!object.isMesh) return
    object.frustumCulled = false // 骨骼動畫會讓網格超出原本的包圍盒
    object.castShadow = true
    for (const material of [object.material].flat()) shadeWithMainTexture(material)
  })
  setupAvatarPhysics(vrm, scale)
}

/**
 * 這個模型的 MToon 材質沒有陰影貼圖，背光面會整片變成單色的淡粉紅（shadeColor）。
 * 改用主貼圖當陰影貼圖（VRoid 的預設做法），背光面才會是原本顏色的暗色調。
 */
function shadeWithMainTexture(material) {
  if (!material.isMToonMaterial || material.shadeMultiplyTexture || !material.map) return
  material.shadeMultiplyTexture = material.map
  material.needsUpdate = true
}

/** 設定物理中心，再空跑一段讓頭髮、裙子先在重力下垂好，否則載入瞬間會看到它們從建模姿勢甩下來 */
function settlePhysics(vrm, center) {
  // 以角色為中心：物理只受肢體動作、重力與風影響，不會被每秒數十公尺的跑速整片吹飛
  for (const joint of vrm.springBoneManager.joints) joint.center = center
  // 必須在實際起始姿勢（站姿）下空跑；若在 T-pose 下垂好，換成跑姿時頭髮會卡進身體碰撞體被彈飛
  applyPose(vrm, 0, false)
  vrm.humanoid.update()
  vrm.scene.updateWorldMatrix(true, true)
  for (let step = 0; step < WARMUP_STEPS; step++) vrm.springBoneManager.update(WARMUP_DELTA)
}

/** 套用跑步（或站立）姿勢與上下起伏 */
function applyPose(vrm, phase, moving) {
  const pose = moving ? runPose(phase) : STAND_POSE
  const isVrm0 = vrm.meta?.metaVersion === '0'
  for (const bone of RUN_BONES) {
    const node = vrm.humanoid.getNormalizedBoneNode(bone)
    if (node) node.rotation.set(...(isVrm0 ? toVrm0(pose[bone]) : pose[bone]))
  }
  vrm.scene.position.y = moving ? Math.abs(Math.sin(phase)) * BOB_HEIGHT : 0
}

/** 依角色在世界中的位置與朝向，套用迎面風（吹向身後）與慣性 */
function applyForces(vrm, group, { windUnit, windGain, tracker, dt, timeScale, swayTime }) {
  group.getWorldQuaternion(worldQuaternion)
  back.set(0, 0, -1).applyQuaternion(worldQuaternion).setY(0).normalize() // 角色面向 +Z，身後為 -Z
  const inertia = tracker.update(group.getWorldPosition(worldPosition), dt, timeScale)
  applyExternalForces(vrm.springBoneManager, { back, windUnit, windGain, inertia, swayTime })
}

/**
 * VRM 跑者。需包在 <Suspense> 內。
 * 有 Mixamo 跑步動作（public/animations/*.fbx）時用動作檔，否則用程序式動作。
 * movingRef.current 為 false 時（暫停、終點停留）停在原地站立。
 */
export default function RunnerAvatar({ scale, speedMultiplier, movingRef }) {
  const vrm = useLoader(GLTFLoader, MODEL_URL, withVrmPlugin).userData.vrm
  const groupRef = useRef(null)
  const phaseRef = useRef(0)
  const windGainRef = useRef(0)
  const swayTimeRef = useRef(0)
  const tracker = useMemo(() => createInertiaTracker(), [])
  const clips = useRunClips(vrm)
  const animator = useMemo(() => clips && createRunAnimator(vrm, clips), [vrm, clips])

  useEffect(() => () => animator?.dispose(), [animator])

  useEffect(() => {
    prepare(vrm, scale)
    settlePhysics(vrm, groupRef.current)
  }, [vrm, scale])

  useFrame((_, delta) => {
    const moving = movingRef.current
    if (animator) {
      animator.update(delta, { moving, speedMultiplier })
      vrm.scene.position.y = 0 // 上下起伏已在動作的 hips 位移裡
    } else {
      if (moving) phaseRef.current = (phaseRef.current + delta * cadenceFor(speedMultiplier) * TWO_PI) % TWO_PI
      applyPose(vrm, phaseRef.current, moving)
    }

    const targetGain = moving ? windGainFor(speedMultiplier) : 0
    windGainRef.current += (targetGain - windGainRef.current) * (1 - Math.exp(-WIND_EASE * delta))
    // 陣風時間自行累加：直接用 時間×倍率 的話，改變速度時相位會跳動
    swayTimeRef.current += delta * swayRateFor(speedMultiplier)
    applyForces(vrm, groupRef.current, {
      windUnit: WIND.strength * scale,
      windGain: windGainRef.current,
      tracker,
      dt: Math.min(delta, MAX_FRAME_DELTA), // 與 Runner 移動用同一個上限，否則切回分頁會誤判成急停
      timeScale: speedMultiplier,
      swayTime: swayTimeRef.current,
    })

    vrm.update(Math.min(delta, MAX_PHYSICS_DELTA)) // 套用 normalized 骨骼、裙子頭髮尾巴的 spring bone
  })

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={vrm.scene} />
    </group>
  )
}
