import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { TURF } from '../course/courseData'
import { LAYOUT } from '../course/courseModel'
import { offsetPoint } from '../course/geometry'
import { COLORS, turfSurfaceY } from './sceneConfig'

const FURLONG_STEP = 200
// 實際尺寸（公尺）：與 1.6m 的角色、1m 的護欄同比例
const FURLONG = { height: 2.5, radius: 0.08 } // ハロン棒：內欄內側的細桿
const GOAL = { height: 4, radius: 0.12, boardRadius: 0.6, boardThickness: 0.08 } // 決勝標：細桿頂端一塊圓板
const LABEL_LIFT = 1.5 // 名牌（HTML）在桿頂上方的距離

const labelStyle = {
  font: '600 11px/1 system-ui, sans-serif',
  color: 'rgba(29, 42, 31, 0.8)',
  background: 'rgba(255, 255, 255, 0.4)',
  padding: '2px 5px',
  borderRadius: 3,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}

function pointAt(model, i, d) {
  return offsetPoint(model.points[i], model.normals[i], d)
}

function FurlongMarkers({ model, railD, exaggeration }) {
  const markers = useMemo(() => {
    const result = []
    for (let r = FURLONG_STEP; r < TURF.length; r += FURLONG_STEP) {
      const i = model.indexForRemaining(r, TURF.length)
      const p = pointAt(model, i, railD + 1.5)
      result.push({ r, x: p.x, z: p.z, y: turfSurfaceY(model, i, exaggeration) })
    }
    return result
  }, [model, railD, exaggeration])

  return markers.map(({ r, x, y, z }) => (
    <group key={r} position={[x, y, z]}>
      <mesh position={[0, FURLONG.height / 2, 0]} castShadow>
        <cylinderGeometry args={[FURLONG.radius, FURLONG.radius, FURLONG.height, 8]} />
        <meshStandardMaterial color={COLORS.furlong} />
      </mesh>
      <Html position={[0, FURLONG.height + LABEL_LIFT, 0]} center zIndexRange={[10, 0]}>
        <span style={labelStyle}>{r}</span>
      </Html>
    </group>
  ))
}

function Goal({ model, railD, exaggeration }) {
  const { post, line } = useMemo(() => {
    const y = turfSurfaceY(model, 0, exaggeration)
    const inner = pointAt(model, 0, railD)
    const outer = pointAt(model, 0, model.turfOuter(0))
    return {
      post: [inner.x, y, inner.z],
      line: [
        [inner.x, y + 0.08, inner.z],
        [outer.x, y + 0.08, outer.z],
      ],
    }
  }, [model, railD, exaggeration])

  return (
    <group>
      <Line points={line} color="#ffffff" lineWidth={3} />
      <group position={post}>
        <mesh position={[0, GOAL.height / 2, 0]} castShadow>
          <cylinderGeometry args={[GOAL.radius, GOAL.radius, GOAL.height, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, GOAL.height, 0]} castShadow>
          <cylinderGeometry args={[GOAL.boardRadius, GOAL.boardRadius, GOAL.boardThickness, 24]} />
          <meshStandardMaterial color={COLORS.goal} />
        </mesh>
        <Html position={[0, GOAL.height + LABEL_LIFT, 0]} center zIndexRange={[10, 0]}>
          <span style={{ ...labelStyle, background: COLORS.goal, color: '#fff', opacity: 0.85 }}>ゴール</span>
        </Html>
      </group>
    </group>
  )
}

/** 終點、ハロン棒（每 200m） */
export default function Landmarks({ model, railShift, exaggeration }) {
  const railD = LAYOUT.turfRail - railShift
  return (
    <group>
      <Goal model={model} railD={railD} exaggeration={exaggeration} />
      <FurlongMarkers model={model} railD={railD} exaggeration={exaggeration} />
    </group>
  )
}
