import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { runPositionAt } from './runPosition'
import { snapToShadowTexel } from './shadowSnap'

/** 指向太陽的單位向量（天空、光源共用） */
export const SUN_DIRECTION = new Vector3(-400, 600, 300).normalize()

const SHADOW_MAP_SIZE = 4096
/**
 * 俯瞰：陰影涵蓋整座場地（每像素約 34cm）。
 * 跟隨：只涵蓋跑者附近 ±60m（每像素約 3cm），角色與護欄的陰影才清楚。
 * distance：光源離中心點的距離；far 要涵蓋誇張度 ×100 時數百公尺的高低差。
 */
const SHADOW_MODES = {
  overview: { extent: 700, distance: 800, far: 2000 },
  follow: { extent: 60, distance: 400, far: 1200 },
}

const center = new Vector3()

/**
 * 太陽光。俯瞰時固定照整座場地；追跡、騎手視角時陰影範圍跟著跑者移動，並對齊陰影像素避免閃爍。
 * 須掛在 Runner 之後，才能讀到同一幀更新過的 traveledRef。
 */
export default function SunLight({ follow, run, traveledRef, exaggeration }) {
  const lightRef = useRef(null)
  const mode = SHADOW_MODES[follow ? 'follow' : 'overview']

  useEffect(() => {
    const light = lightRef.current
    const camera = light.shadow.camera
    camera.left = -mode.extent
    camera.right = mode.extent
    camera.top = mode.extent
    camera.bottom = -mode.extent
    camera.far = mode.far
    camera.updateProjectionMatrix()
    placeSun(light, center.set(0, 0, 0), mode.distance)
  }, [mode])

  useFrame(() => {
    if (!follow) return
    const { x, y, z } = runPositionAt(run, traveledRef.current, exaggeration)
    const texel = (2 * mode.extent) / SHADOW_MAP_SIZE
    placeSun(lightRef.current, snapToShadowTexel(center.set(x, y, z), SUN_DIRECTION, texel), mode.distance)
  })

  return (
    <directionalLight
      ref={lightRef}
      intensity={2}
      castShadow
      shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
      shadow-bias={-0.0002}
      shadow-normalBias={0.03}
    />
  )
}

/** 把光源放在 target 沿太陽方向 distance 處，並讓它照向 target */
function placeSun(light, target, distance) {
  light.position.copy(target).addScaledVector(SUN_DIRECTION, distance)
  light.target.position.copy(target)
  light.target.updateMatrixWorld()
}
