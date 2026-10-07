import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { lookAheadSpan } from '../course/racePath'
import { runPositionAt } from './runPosition'

// 實際尺寸（公尺），不受高度誇張倍率影響
const EYE_HEIGHT = 2.6 // 騎手坐在馬上的視線高度
const LOOK_AHEAD = 40 // 看向前方多遠
const SMOOTHING = 6 // 視線追隨速度（越大越緊），避免在折線頂點處突然轉向
// 近平面拉近才看得到腳下的芝；離開時還原俯瞰用的設定
const RIDER_FOV = 70
const RIDER_NEAR = 0.5
const target = new Vector3() // 每幀重用，避免配置新物件

/**
 * 騎手視角：鏡頭放在跑者位置、沿跑法看向前方，高度跟著誇張後的地形起伏。
 * 必須掛在 Runner 之後，才能讀到同一幀更新過的 traveledRef。
 */
export default function RiderCamera({ run, traveledRef, exaggeration }) {
  const camera = useThree((state) => state.camera)
  const lookRef = useRef(null)

  useEffect(() => {
    const saved = { fov: camera.fov, near: camera.near, position: camera.position.clone() }
    camera.fov = RIDER_FOV
    camera.near = RIDER_NEAR
    camera.updateProjectionMatrix()
    lookRef.current = null
    return () => {
      camera.fov = saved.fov
      camera.near = saved.near
      camera.position.copy(saved.position)
      camera.updateProjectionMatrix()
    }
  }, [camera])

  useFrame((_, delta) => {
    const traveled = traveledRef.current
    const eye = runPositionAt(run, traveled, exaggeration)
    const { from, to } = lookAheadSpan(run.path.length, traveled, run.isLap, LOOK_AHEAD)
    const a = runPositionAt(run, from, exaggeration)
    const b = runPositionAt(run, to, exaggeration)

    // 方向取自前方區間，目標高度取前方路面，上坡時視線自然抬起
    target.set(eye.x + (b.x - a.x), b.y + EYE_HEIGHT, eye.z + (b.z - a.z))
    const look = lookRef.current
    if (!look || look.distanceTo(target) > LOOK_AHEAD * 2) lookRef.current = target.clone()
    else look.lerp(target, 1 - Math.exp(-SMOOTHING * delta))

    camera.position.set(eye.x, eye.y + EYE_HEIGHT, eye.z)
    camera.lookAt(lookRef.current)
  })

  return null
}
