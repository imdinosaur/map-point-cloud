import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { pointAlong } from '../course/racePath'
import { COLORS, RACE_SPEED, surfaceY } from './sceneConfig'

const BODY_RADIUS = 2.5
const MAX_FRAME_DELTA = 0.1 // 分頁切回時 delta 可能很大，限制單幀推進量
const FINISH_HOLD = 1.5 // 跑完一場後在終點停留秒數

/**
 * 沿 run.path 移動的標記。連續繞圈時無限循環；比賽跑法到終點停留後重新起跑。
 * onProgress({ remaining, elevation, lapFraction }) 每幀呼叫，請只做 DOM 更新。
 */
export default function Runner({ run, exaggeration, playing, speedMultiplier, onProgress }) {
  const groupRef = useRef(null)
  const traveledRef = useRef(0)
  const holdRef = useRef(0)

  useEffect(() => {
    traveledRef.current = 0
    holdRef.current = 0
  }, [run])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const { path, elevations } = run
    const dt = Math.min(delta, MAX_FRAME_DELTA)

    if (playing) advance(run, traveledRef, holdRef, RACE_SPEED * speedMultiplier * dt, dt)

    const { x, z, index, t } = pointAlong(path, traveledRef.current)
    const elevation = elevations[index] + (elevations[index + 1] - elevations[index]) * t
    group.position.set(x, surfaceY(run.surface, elevation, exaggeration), z)

    const remaining = path.length - traveledRef.current
    onProgress({
      remaining,
      elevation,
      surface: run.surface,
      lapFraction: (((1 - remaining / run.loopLength) % 1) + 1) % 1,
    })
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, BODY_RADIUS, 0]} castShadow>
        <sphereGeometry args={[BODY_RADIUS, 24, 16]} />
        <meshStandardMaterial color={COLORS.runner} emissive={COLORS.runner} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, BODY_RADIUS * 2 + 9, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[2.2, 5, 12]} />
        <meshStandardMaterial color={COLORS.runner} />
      </mesh>
    </group>
  )
}

function advance(run, traveledRef, holdRef, step, dt) {
  const { length } = run.path
  if (run.isLap) {
    traveledRef.current = (traveledRef.current + step) % length
    return
  }
  if (traveledRef.current < length) {
    traveledRef.current = Math.min(traveledRef.current + step, length)
    return
  }
  holdRef.current += dt
  if (holdRef.current >= FINISH_HOLD) {
    traveledRef.current = 0
    holdRef.current = 0
  }
}
