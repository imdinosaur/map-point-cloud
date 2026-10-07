import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { TURF } from '../course/courseData'
import { LAYOUT } from '../course/courseModel'
import { offsetPoint } from '../course/geometry'
import { COLORS, turfSurfaceY } from './sceneConfig'

const FURLONG_STEP = 200
const FURLONG_POST_HEIGHT = 3
const GOAL_POST_HEIGHT = 9

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
      <mesh position={[0, FURLONG_POST_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.6, 0.6, FURLONG_POST_HEIGHT, 8]} />
        <meshStandardMaterial color={COLORS.furlong} />
      </mesh>
      <Html position={[0, FURLONG_POST_HEIGHT + 4, 0]} center zIndexRange={[10, 0]}>
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
        <mesh position={[0, GOAL_POST_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[0.8, 0.8, GOAL_POST_HEIGHT, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, GOAL_POST_HEIGHT, 0]}>
          <cylinderGeometry args={[3, 3, 0.6, 24]} />
          <meshStandardMaterial color={COLORS.goal} />
        </mesh>
        <Html position={[0, GOAL_POST_HEIGHT + 6, 0]} center zIndexRange={[10, 0]}>
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
