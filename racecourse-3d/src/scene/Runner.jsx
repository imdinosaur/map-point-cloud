import { Suspense, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { lookAheadSpan } from '../course/racePath'
import FallbackBoundary from './FallbackBoundary'
import RunnerAvatar from './RunnerAvatar'
import { AVATAR, COLORS, MAX_FRAME_DELTA, RACE_SPEED } from './sceneConfig'
import { runPositionAt } from './runPosition'

const BODY_RADIUS = AVATAR.height * 0.3 // 模型載入前或缺少模型時的替代球，大小與角色相當
const MARKER_HEIGHT = AVATAR.height + 6 // 頭上的倒三角標記，俯瞰時用來找到跑者
const HEADING_SPAN = 4 // 取前方幾公尺決定面向
const FINISH_HOLD = 1.5 // 跑完一場後在終點停留秒數

/**
 * 沿 run.path 移動的標記。連續繞圈時無限循環；比賽跑法到終點停留後重新起跑。
 * traveledRef 由外部提供，讓跟隨鏡頭讀取同一個位置。
 * hidden 時只隱藏外觀、照常前進；showMarker 控制頭上的倒三角（只在俯瞰需要）。
 * onProgress({ remaining, elevation, lapFraction }) 每幀呼叫，請只做 DOM 更新。
 */
export default function Runner({ run, exaggeration, playing, speedMultiplier, traveledRef, hidden, showMarker, onProgress }) {
  const groupRef = useRef(null)
  const bodyRef = useRef(null)
  const holdRef = useRef(0)
  const movingRef = useRef(false)

  useEffect(() => {
    traveledRef.current = 0
    holdRef.current = 0
  }, [run, traveledRef])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const dt = Math.min(delta, MAX_FRAME_DELTA)

    movingRef.current = playing && advance(run, traveledRef, holdRef, RACE_SPEED * speedMultiplier * dt, dt)

    const { x, y, z, elevation } = runPositionAt(run, traveledRef.current, exaggeration)
    group.position.set(x, y, z)
    if (bodyRef.current) bodyRef.current.rotation.y = headingAt(run, traveledRef.current, exaggeration)

    const remaining = run.path.length - traveledRef.current
    onProgress({
      remaining,
      elevation,
      surface: run.surface,
      lapFraction: (((1 - remaining / run.loopLength) % 1) + 1) % 1,
    })
  })

  return (
    <group ref={groupRef} visible={!hidden}>
      <group ref={bodyRef}>
        {/* 模型檔不進版控：載入中或找不到模型時都以紅球代替 */}
        <FallbackBoundary fallback={<FallbackBall />}>
          <Suspense fallback={<FallbackBall />}>
            <RunnerAvatar scale={AVATAR.scale} speedMultiplier={speedMultiplier} movingRef={movingRef} />
          </Suspense>
        </FallbackBoundary>
      </group>
      <mesh position={[0, MARKER_HEIGHT, 0]} rotation={[Math.PI, 0, 0]} visible={showMarker}>
        <coneGeometry args={[2.2, 5, 12]} />
        <meshStandardMaterial color={COLORS.runner} />
      </mesh>
    </group>
  )
}

function FallbackBall() {
  return (
    <mesh position={[0, BODY_RADIUS, 0]} castShadow>
      <sphereGeometry args={[BODY_RADIUS, 24, 16]} />
      <meshStandardMaterial color={COLORS.runner} emissive={COLORS.runner} emissiveIntensity={0.35} />
    </mesh>
  )
}

/** 沿跑法前進的方向（繞 Y 軸角度，0 = 面向 +Z） */
function headingAt(run, traveled, exaggeration) {
  const { from, to } = lookAheadSpan(run.path.length, traveled, run.isLap, HEADING_SPAN)
  const a = runPositionAt(run, from, exaggeration)
  const b = runPositionAt(run, to, exaggeration)
  return Math.atan2(b.x - a.x, b.z - a.z)
}

/** 推進已跑距離；回傳這一幀是否有在跑（終點停留時為 false） */
function advance(run, traveledRef, holdRef, step, dt) {
  const { length } = run.path
  if (run.isLap) {
    traveledRef.current = (traveledRef.current + step) % length
    return true
  }
  if (traveledRef.current < length) {
    traveledRef.current = Math.min(traveledRef.current + step, length)
    return true
  }
  holdRef.current += dt
  if (holdRef.current >= FINISH_HOLD) {
    traveledRef.current = 0
    holdRef.current = 0
  }
  return false
}
