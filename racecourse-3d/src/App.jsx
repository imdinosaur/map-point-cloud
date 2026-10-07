import { useCallback, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, Sky } from '@react-three/drei'
import { TURF_COURSES } from './course/courseData'
import { createCourseModel, isValidRunId } from './course/courseModel'
import Landmarks from './scene/Landmarks'
import RaceGuide from './scene/RaceGuide'
import Field from './scene/Field'
import FollowCamera from './scene/FollowCamera'
import Runner from './scene/Runner'
import SunLight, { SUN_DIRECTION } from './scene/SunLight'
import Tracks from './scene/Tracks'
import Venue from './scene/Venue'
import { COLORS } from './scene/sceneConfig'
import { useSurfaceMaterials } from './scene/useSurfaceMaterials'
import { chartX, chartY } from './ui/chartScale'
import ControlPanel from './ui/ControlPanel'
import { EXAGGERATION } from './ui/exaggerationScale'
import { createRankingStore } from './ui/rankingStore'

// 模型只依官方數據與描點計算，與 UI 狀態無關，建立一次即可
const MODEL = createCourseModel()
const MODEL_LENGTHS = Object.fromEntries(
  Object.entries(TURF_COURSES).map(([key, { railShift }]) => [key, MODEL.measureLength(-railShift)]),
)
const LOWEST_ELEVATION = -3
// 天空中太陽的位置（與 SunLight 的光源方向一致）
const SUN_SKY_POSITION = SUN_DIRECTION.clone().multiplyScalar(1000).toArray()
// 初始視角：拉遠到能同時看到整圈與右側引込線，並避開左上控制面板
const CAMERA_TARGET = [-20, 0, 50]

/** 跑法存在網址 ?run= 以便分享 */
function readRunIdFromUrl() {
  const id = new URLSearchParams(window.location.search).get('run')
  return isValidRunId(id) ? id : 'lap'
}

function writeRunIdToUrl(id) {
  const url = new URL(window.location.href)
  if (id === 'lap') url.searchParams.delete('run')
  else url.searchParams.set('run', id)
  window.history.replaceState(null, '', url)
}

export default function App() {
  const [course, setCourse] = useState('A')
  const [exaggeration, setExaggeration] = useState(EXAGGERATION.initial)
  const [playing, setPlaying] = useState(true)
  const [speedMultiplier, setSpeedMultiplier] = useState(5)
  const [runId, setRunId] = useState(readRunIdFromUrl)
  const [viewMode, setViewMode] = useState('overview')
  const [playerNumber, setPlayerNumber] = useState(1)
  // 玩家跑者的位置：連續繞圈時由 Runner 自己推進，比賽時由 Field 的馬群模擬寫入
  const traveledRef = useRef(0)
  const lateralRef = useRef(0)
  const playerMovingRef = useRef(false)
  const rankingStore = useMemo(() => createRankingStore(), [])
  const surfaceMaterials = useSurfaceMaterials()
  const remainingRef = useRef(null)
  const elevationRef = useRef(null)
  const markerRef = useRef(null)

  const railShift = TURF_COURSES[course].railShift
  const base = LOWEST_ELEVATION * exaggeration - 1
  const run = useMemo(() => MODEL.createRun(runId, railShift), [runId, railShift])

  const handleRunChange = useCallback((id) => {
    setRunId(id)
    writeRunIdToUrl(id)
  }, [])

  // 每幀由 Runner 呼叫，直接寫 DOM 以免整個 App 重新渲染
  const handleProgress = useCallback(
    ({ lapFraction, remaining, elevation }) => {
      if (remainingRef.current) remainingRef.current.textContent = remaining.toFixed(0)
      if (elevationRef.current) elevationRef.current.textContent = elevation.toFixed(2)
      if (markerRef.current) {
        markerRef.current.setAttribute('cx', chartX(lapFraction).toFixed(1))
        markerRef.current.setAttribute('cy', chartY(elevation).toFixed(1))
      }
    },
    [remainingRef, elevationRef, markerRef],
  )

  return (
    <>
      {/* 俯瞰時 near 設 5m 提升深度精度，讓相差數公分的草地與芝面不會互相閃爍 */}
      <Canvas shadows camera={{ position: [-20, 820, 760], fov: 45, near: 5, far: 8000 }}>
        <color attach="background" args={[COLORS.sky]} />
        <fog attach="fog" args={[COLORS.sky, 1800, 5000]} />
        {/* 程序式天空（不需下載），距離要小於鏡頭 far 才不會被裁掉 */}
        <Sky distance={6000} sunPosition={SUN_SKY_POSITION} turbidity={2.5} rayleigh={2.5} mieCoefficient={0.003} mieDirectionalG={0.85} />
        {/* 環境光：用 Lightformer 組出藍天＋草地反光，讓 PBR 路面與護欄有自然的反射，不需 HDR 檔 */}
        <Environment resolution={128} frames={1} environmentIntensity={0.45}>
          <Lightformer form="rect" intensity={1.2} color="#cfe3ff" scale={[40, 40, 1]} position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <Lightformer form="rect" intensity={0.35} color="#56794a" scale={[40, 40, 1]} position={[0, -10, 0]} rotation={[-Math.PI / 2, 0, 0]} />
          <Lightformer form="circle" intensity={3} color="#fff4e0" scale={4} position={SUN_SKY_POSITION.map((v) => v / 100)} />
        </Environment>
        <hemisphereLight args={['#f4f8ff', '#4b6640', 0.45]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, base - 0.01, 0]} receiveShadow>
          <planeGeometry args={[6000, 6000]} />
          <meshStandardMaterial color={COLORS.ground} roughness={1} />
        </mesh>

        <Venue model={MODEL} exaggeration={exaggeration} base={base} materials={surfaceMaterials} />
        <Tracks model={MODEL} railShift={railShift} exaggeration={exaggeration} base={base} materials={surfaceMaterials} detailedRails={viewMode !== 'overview'} />
        <Landmarks model={MODEL} railShift={railShift} exaggeration={exaggeration} />
        <RaceGuide run={run} exaggeration={exaggeration} />
        {/* 比賽時由馬群模擬決定玩家位置，必須排在 Runner 之前 */}
        {!run.isLap && (
          <Field
            run={run}
            exaggeration={exaggeration}
            playing={playing}
            speedMultiplier={speedMultiplier}
            playerNumber={playerNumber}
            traveledRef={traveledRef}
            lateralRef={lateralRef}
            playerMovingRef={playerMovingRef}
            rankingStore={rankingStore}
          />
        )}
        <Runner
          run={run}
          exaggeration={exaggeration}
          playing={playing}
          speedMultiplier={speedMultiplier}
          traveledRef={traveledRef}
          lateralRef={lateralRef}
          driven={!run.isLap}
          drivenMovingRef={playerMovingRef}
          hidden={viewMode === 'rider'}
          showMarker={viewMode === 'overview'}
          onProgress={handleProgress}
        />
        {/* 太陽、跟隨鏡頭都讀取 Runner 這一幀更新的位置，必須排在 Runner 之後 */}
        <SunLight
          follow={viewMode !== 'overview'}
          run={run}
          traveledRef={traveledRef}
          lateralRef={lateralRef}
          exaggeration={exaggeration}
        />
        {/* 跟隨鏡頭接管時移除 OrbitControls，回到俯瞰時重新掛上並沿用原本的注視點 */}
        {viewMode !== 'overview' ? (
          <FollowCamera mode={viewMode} run={run} traveledRef={traveledRef} lateralRef={lateralRef} exaggeration={exaggeration} />
        ) : (
          <OrbitControls makeDefault target={CAMERA_TARGET} maxPolarAngle={Math.PI / 2.1} minDistance={40} maxDistance={2500} />
        )}
      </Canvas>

      <ControlPanel
        isRace={!run.isLap}
        playerNumber={playerNumber}
        onPlayerNumberChange={setPlayerNumber}
        rankingStore={rankingStore}
        course={course}
        onCourseChange={setCourse}
        runId={runId}
        onRunChange={handleRunChange}
        surface={run.surface}
        modelLengths={MODEL_LENGTHS}
        exaggeration={exaggeration}
        onExaggerationChange={setExaggeration}
        playing={playing}
        onTogglePlaying={() => setPlaying((p) => !p)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        speedMultiplier={speedMultiplier}
        onSpeedChange={setSpeedMultiplier}
        remainingRef={remainingRef}
        elevationRef={elevationRef}
        markerRef={markerRef}
      />
    </>
  )
}
