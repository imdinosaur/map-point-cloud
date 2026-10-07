import { useCallback, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { TURF_COURSES } from './course/courseData'
import { createCourseModel, isValidRunId } from './course/courseModel'
import Landmarks from './scene/Landmarks'
import RaceGuide from './scene/RaceGuide'
import RiderCamera from './scene/RiderCamera'
import Runner from './scene/Runner'
import Tracks from './scene/Tracks'
import Venue from './scene/Venue'
import { COLORS } from './scene/sceneConfig'
import { chartX, chartY } from './ui/chartScale'
import ControlPanel from './ui/ControlPanel'
import { EXAGGERATION } from './ui/exaggerationScale'

// 模型只依官方數據與描點計算，與 UI 狀態無關，建立一次即可
const MODEL = createCourseModel()
const MODEL_LENGTHS = Object.fromEntries(
  Object.entries(TURF_COURSES).map(([key, { railShift }]) => [key, MODEL.measureLength(-railShift)]),
)
const LOWEST_ELEVATION = -3
const SHADOW_EXTENT = 700
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
  const [isRiderView, setIsRiderView] = useState(false)
  const traveledRef = useRef(0)
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
        <hemisphereLight args={['#f4f8ff', '#4b6640', 0.9]} />
        <directionalLight
          position={[-400, 600, 300]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-SHADOW_EXTENT}
          shadow-camera-right={SHADOW_EXTENT}
          shadow-camera-top={SHADOW_EXTENT}
          shadow-camera-bottom={-SHADOW_EXTENT}
          shadow-camera-far={2000}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, base - 0.01, 0]} receiveShadow>
          <planeGeometry args={[6000, 6000]} />
          <meshStandardMaterial color={COLORS.ground} roughness={1} />
        </mesh>

        <Venue model={MODEL} exaggeration={exaggeration} base={base} />
        <Tracks model={MODEL} railShift={railShift} exaggeration={exaggeration} base={base} />
        <Landmarks model={MODEL} railShift={railShift} exaggeration={exaggeration} />
        <RaceGuide run={run} exaggeration={exaggeration} />
        <Runner
          run={run}
          exaggeration={exaggeration}
          playing={playing}
          speedMultiplier={speedMultiplier}
          traveledRef={traveledRef}
          hidden={isRiderView}
          onProgress={handleProgress}
        />
        {/* 騎手視角接管鏡頭時移除 OrbitControls，回到俯瞰時重新掛上並沿用原本的注視點 */}
        {isRiderView ? (
          <RiderCamera run={run} traveledRef={traveledRef} exaggeration={exaggeration} />
        ) : (
          <OrbitControls makeDefault target={CAMERA_TARGET} maxPolarAngle={Math.PI / 2.1} minDistance={40} maxDistance={2500} />
        )}
      </Canvas>

      <ControlPanel
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
        isRiderView={isRiderView}
        onToggleRiderView={() => setIsRiderView((v) => !v)}
        speedMultiplier={speedMultiplier}
        onSpeedChange={setSpeedMultiplier}
        remainingRef={remainingRef}
        elevationRef={elevationRef}
        markerRef={markerRef}
      />
    </>
  )
}
