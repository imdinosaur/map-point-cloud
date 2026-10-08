import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, MeshStandardMaterial, Object3D, SRGBColorSpace, SphereGeometry } from 'three'
import { createField, rankings, stepField } from '../course/field'
import { WAKU_COLORS, WAKU_TEXT_COLORS } from '../course/startingGate'
import { numberPatchGeometry } from './numberPatch'
import { MAX_FRAME_DELTA } from './sceneConfig'
import { runPositionAt } from './runPosition'

const BALL_RADIUS = 0.4 // 其他出走馬以枠色的球代替（直徑 0.8m，與 1.6m 的角色相襯）
const FINISH_HOLD = 3 // 全員到終點後停留秒數，再開始下一場
const PUBLISH_INTERVAL = 0.2 // 名次發布間隔（秒）
const MOVING_SPEED = 0.5 // 速度高於此值才算在跑（m/s）

const LABEL_SPAN = 1.25 // 背號曲面片涵蓋的角度（弧度），印在球的前後兩面，隨行進方向轉、不隨鏡頭轉
const LABEL_TEXTURE_SIZE = 128
const HEADING_STEP = 0.5 // 取前方幾公尺決定行進方向

const BALL_GEOMETRY = new SphereGeometry(BALL_RADIUS, 20, 14)
const BALL_MATERIAL = new MeshStandardMaterial({ roughness: 0.35 })
const LABEL_GEOMETRY = numberPatchGeometry(BALL_RADIUS, LABEL_SPAN)
const placer = new Object3D()
const color = new Color()

/** 背號貼圖：透明底、依枠色決定黑字或白字；同一馬番與枠只畫一次 */
const labelTextures = new Map()
function numberTexture(number, waku) {
  const key = `${number}-${waku}`
  if (labelTextures.has(key)) return labelTextures.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_TEXTURE_SIZE
  canvas.height = LABEL_TEXTURE_SIZE
  const context = canvas.getContext('2d')
  context.font = `800 ${number >= 10 ? 68 : 84}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = WAKU_TEXT_COLORS[waku - 1]
  context.fillText(String(number), LABEL_TEXTURE_SIZE / 2, LABEL_TEXTURE_SIZE / 2 + 4)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  labelTextures.set(key, texture)
  return texture
}

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
  trackerRef,
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
  const labelsRef = useRef([]) // 每頭馬一個 group，含前後兩片背號

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

    placeBalls(ballsRef.current, labelsRef.current, field, run, exaggeration, player.number)
    trackerRef.current?.(field, player.number)

    publishRef.current += dt
    if (publishRef.current >= PUBLISH_INTERVAL) {
      publishRef.current = 0
      rankingStore.set({ order: rankings(field), runners: field.runners, finished: field.finishOrder.length })
    }
  })

  return (
    <group>
      <instancedMesh
        key={initial.runners.length}
        ref={ballsRef}
        args={[BALL_GEOMETRY, BALL_MATERIAL, initial.runners.length]}
        castShadow
        frustumCulled={false}
      />
      {initial.runners.map((runner, k) => {
        const texture = numberTexture(runner.number, runner.waku)
        return (
          <group
            key={`${initial.runners.length}-${runner.number}`}
            ref={(group) => {
              labelsRef.current[k] = group
            }}
          >
            {/* 前面（+Z = 行進方向）與後面各一片 */}
            {[0, Math.PI].map((turn) => (
              <mesh key={turn} geometry={LABEL_GEOMETRY} rotation={[0, turn, 0]}>
                <meshStandardMaterial map={texture} transparent roughness={0.35} polygonOffset polygonOffsetFactor={-1} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

/** 擺放球與背號；背號跟著球的位置與行進方向，前後兩面各一片 */
function placeBalls(balls, labels, field, run, exaggeration, playerNumber) {
  field.runners.forEach((runner, k) => {
    const { x, y, z } = runPositionAt(run, runner.traveled, exaggeration, runner.lateral)
    const isPlayer = runner.number === playerNumber
    placer.position.set(x, y + BALL_RADIUS, z)
    placer.scale.setScalar(isPlayer ? 0 : 1)
    placer.updateMatrix()
    balls.setMatrixAt(k, placer.matrix)

    const label = labels[k]
    if (!label) return
    label.visible = !isPlayer
    const ahead = runPositionAt(run, Math.min(runner.traveled + HEADING_STEP, run.path.length), exaggeration, runner.lateral)
    const heading = runner.traveled + HEADING_STEP > run.path.length ? label.rotation.y : Math.atan2(ahead.x - x, ahead.z - z)
    label.position.copy(placer.position)
    label.rotation.set(0, heading, 0)
  })
  balls.instanceMatrix.needsUpdate = true
}
