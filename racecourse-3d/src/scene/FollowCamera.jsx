import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { lookAheadSpan } from '../course/racePath'
import { AVATAR } from './sceneConfig'
import { runPositionAt } from './runPosition'

// 實際尺寸（公尺），不受高度誇張倍率影響
const LOOK_AHEAD = 40 // 取前方多遠決定行進方向
const NEAR = 0.5 // 近平面拉近才看得到腳下的芝；離開時還原俯瞰用的設定

/**
 * rider：騎手目線，鏡頭在跑者身上看向前方，上坡時視線隨前方路面抬起。
 * chase：追跡，鏡頭在跑者後上方，看著角色。
 */
const MODES = {
  // 騎手目線：角色的眼睛高度
  rider: { fov: 70, back: 0, side: 0, up: AVATAR.eyeHeight, lookUp: AVATAR.eyeHeight, lookAtRunner: false },
  // 追跡：距離與高度依角色身高決定。跑者沿內欄跑，鏡頭往外側偏，才不會穿過內欄邊的弗隆標柱
  chase: {
    fov: 55,
    back: AVATAR.height * 4,
    side: AVATAR.height * 1.5,
    up: AVATAR.height * 1.3,
    lookUp: AVATAR.height * 0.6,
    lookAtRunner: true,
  },
}
// 平滑的是「方向」而非位置：位置若用 lerp 追，高倍速時鏡頭會落後數十公尺
const SMOOTHING = 6 // 方向追隨速度（越大越緊），避免在折線頂點處突然轉向

const target = new Vector3() // 每幀重用，避免配置新物件

/**
 * 跟隨跑者的鏡頭。必須掛在 Runner 之後，才能讀到同一幀更新過的 traveledRef。
 * @param {{ mode: keyof typeof MODES, run, traveledRef, lateralRef, exaggeration: number }} props
 */
export default function FollowCamera({ mode, run, traveledRef, lateralRef, exaggeration }) {
  const get = useThree((state) => state.get) // 透過 get() 取鏡頭來改設定，而非直接改 hook 回傳值
  const headingRef = useRef(null) // { dx, dz, rise }：水平單位方向與前方路面相對高度
  const config = MODES[mode]

  useEffect(() => {
    const { camera } = get()
    const saved = { fov: camera.fov, near: camera.near, position: camera.position.clone() }
    camera.near = NEAR
    return () => {
      camera.fov = saved.fov
      camera.near = saved.near
      camera.position.copy(saved.position)
      camera.updateProjectionMatrix()
    }
  }, [get])

  useEffect(() => {
    const { camera } = get()
    camera.fov = config.fov
    camera.updateProjectionMatrix()
  }, [get, config])

  // 換跑法時方向直接就位，不從上一條跑法慢慢轉過來
  useEffect(() => {
    headingRef.current = null
  }, [run])

  useFrame(({ camera }, delta) => {
    const traveled = traveledRef.current
    const runner = runPositionAt(run, traveled, exaggeration, lateralRef.current)
    const heading = smoothHeading(headingRef, measureHeading(run, traveled, exaggeration, runner.y), delta)

    // 追跡時取跑者與後方路面較高者再往上抬，下坡時鏡頭才不會埋進地形
    const length = run.path.length
    const behindAt = run.isLap ? (traveled - config.back + length) % length : Math.max(0, traveled - config.back)
    const behind = runPositionAt(run, behindAt, exaggeration, lateralRef.current)
    const groundY = Math.max(runner.y, behind.y)
    // 左回り：外側在行進方向的右手邊 (-dz, dx)
    camera.position.set(
      runner.x - heading.dx * config.back - heading.dz * config.side,
      groundY + config.up,
      runner.z - heading.dz * config.back + heading.dx * config.side,
    )

    if (config.lookAtRunner) target.set(runner.x, runner.y + config.lookUp, runner.z)
    else target.set(runner.x + heading.dx * LOOK_AHEAD, runner.y + heading.rise + config.lookUp, runner.z + heading.dz * LOOK_AHEAD)
    camera.lookAt(target)
  })

  return null
}

/** 取前方 LOOK_AHEAD 公尺的區間，算出水平單位方向與前方路面比跑者高多少 */
function measureHeading(run, traveled, exaggeration, runnerY) {
  const { from, to } = lookAheadSpan(run.path.length, traveled, run.isLap, LOOK_AHEAD)
  const a = runPositionAt(run, from, exaggeration)
  const b = runPositionAt(run, to, exaggeration)
  const length = Math.hypot(b.x - a.x, b.z - a.z) || 1
  return { dx: (b.x - a.x) / length, dz: (b.z - a.z) / length, rise: b.y - runnerY }
}

/** 與幀率無關的指數平滑；第一次直接就位 */
function smoothHeading(headingRef, next, delta) {
  const current = headingRef.current
  if (!current) {
    headingRef.current = next
    return next
  }
  const k = 1 - Math.exp(-SMOOTHING * delta)
  const dx = current.dx + (next.dx - current.dx) * k
  const dz = current.dz + (next.dz - current.dz) * k
  const length = Math.hypot(dx, dz) || 1
  headingRef.current = { dx: dx / length, dz: dz / length, rise: current.rise + (next.rise - current.rise) * k }
  return headingRef.current
}
