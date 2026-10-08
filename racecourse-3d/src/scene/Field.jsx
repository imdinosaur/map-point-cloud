import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial, Object3D, SphereGeometry } from 'three'
import { createField, rankings, stepField } from '../course/field'
import { WAKU_COLORS } from '../course/startingGate'
import { MAX_FRAME_DELTA } from './sceneConfig'
import { runPositionAt } from './runPosition'

const BALL_RADIUS = 0.4 // 其他出走馬以枠色的球代替（直徑 0.8m，與 1.6m 的角色相襯）
const FINISH_HOLD = 3 // 全員到終點後停留秒數，再開始下一場
const PUBLISH_INTERVAL = 0.2 // 名次發布間隔（秒）
const MOVING_SPEED = 0.5 // 速度高於此值才算在跑（m/s）

const BALL_GEOMETRY = new SphereGeometry(BALL_RADIUS, 20, 14)
const BALL_MATERIAL = new MeshStandardMaterial({ roughness: 0.35 })
const placer = new Object3D()
const color = new Color()

/**
 * 馬群的來源：模擬（每場換一組隨機出走馬）或レース再現（依公布成績重播，每次重播同一場）。
 * create(round) 建立第 round 場的初始狀態；step(state, dt) 推進比賽時間 dt 秒。
 */
function simulationSource(course) {
  return { create: (round) => createField({ seed: round + 1 }), step: (state, dt) => stepField(state, dt, course) }
}

function replaySource(replay) {
  return { create: () => replay.at(0), step: (state, dt) => replay.at(Math.min(state.time + dt, replay.duration + 1)) }
}

/**
 * 多頭數比賽：每幀推進馬群，畫出其他馬的色球，並把玩家那一頭的位置寫進共用的 ref，
 * 讓 Runner（VRM 角色）、跟隨鏡頭、太陽讀取。必須排在 Runner 之前。
 */
export default function Field({
  run,
  exaggeration,
  playing,
  speedMultiplier,
  playerNumber,
  replay,
  traveledRef,
  lateralRef,
  playerMovingRef,
  rankingStore,
}) {
  const source = useMemo(
    () => (replay ? replaySource(replay) : simulationSource({ length: run.path.length, curvatureAt: run.curvatureAt })),
    [replay, run],
  )
  const initial = useMemo(() => source.create(0), [source])
  const roundRef = useRef(0)
  const fieldRef = useRef(null)
  const holdRef = useRef(0)
  const publishRef = useRef(0)
  const ballsRef = useRef(null)

  // 換跑法、換比賽或換馬番時重新開跑
  useEffect(() => {
    fieldRef.current = source.create(roundRef.current)
    holdRef.current = 0
  }, [source, playerNumber])

  // 球的顏色依枠番；玩家那一頭不畫球（由 VRM 角色代表）
  useLayoutEffect(() => {
    const balls = ballsRef.current
    initial.runners.forEach((runner, k) => balls.setColorAt(k, color.set(WAKU_COLORS[runner.waku - 1])))
    balls.instanceColor.needsUpdate = true
  }, [initial])

  useFrame((_, delta) => {
    if (!fieldRef.current) return
    const dt = Math.min(delta, MAX_FRAME_DELTA)
    let field = fieldRef.current
    if (playing) field = source.step(field, dt * speedMultiplier)
    if (field.finishOrder.length === field.runners.length) {
      holdRef.current += dt
      if (holdRef.current >= FINISH_HOLD) {
        roundRef.current += 1 // 模擬：下一場換一組出走馬；再現：重播同一場
        field = source.create(roundRef.current)
        holdRef.current = 0
      }
    }
    fieldRef.current = field

    const player = field.runners.find((runner) => runner.number === playerNumber) ?? field.runners[0]
    traveledRef.current = player.traveled
    lateralRef.current = player.lateral
    playerMovingRef.current = playing && player.speed > MOVING_SPEED

    placeBalls(ballsRef.current, field, run, exaggeration, player.number)

    publishRef.current += dt
    if (publishRef.current >= PUBLISH_INTERVAL) {
      publishRef.current = 0
      rankingStore.set({ order: rankings(field), runners: field.runners, finished: field.finishOrder.length })
    }
  })

  return (
    <instancedMesh
      key={initial.runners.length}
      ref={ballsRef}
      args={[BALL_GEOMETRY, BALL_MATERIAL, initial.runners.length]}
      castShadow
      frustumCulled={false}
    />
  )
}

function placeBalls(balls, field, run, exaggeration, playerNumber) {
  field.runners.forEach((runner, k) => {
    const { x, y, z } = runPositionAt(run, runner.traveled, exaggeration, runner.lateral)
    placer.position.set(x, y + BALL_RADIUS, z)
    placer.scale.setScalar(runner.number === playerNumber ? 0 : 1)
    placer.updateMatrix()
    balls.setMatrixAt(k, placer.matrix)
  })
  balls.instanceMatrix.needsUpdate = true
}
