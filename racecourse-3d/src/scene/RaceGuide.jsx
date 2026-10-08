import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { LAYOUT } from '../course/courseModel'
import { GATE, GATE_WIDTH } from '../course/startingGate'
import { COLORS, surfaceY } from './sceneConfig'
import StartingGate from './StartingGate'

const ROUTE_LIFT = 0.6

/**
 * 發馬機的擺放：原點在起跑線與內欄交點（量測線往內 LAYOUT.turfRail 公尺），局部 x 指向外側。
 * 為保持右手座標，局部 z = x × y；forward 記錄行進方向落在 +z 或 -z。
 */
function gatePlacement(start, next, out, y) {
  const xAxis = new Vector3(out.x, 0, out.z)
  const yAxis = new Vector3(0, 1, 0)
  const zAxis = new Vector3().crossVectors(xAxis, yAxis)
  const forward = Math.sign((next.x - start.x) * zAxis.x + (next.z - start.z) * zAxis.z) || 1
  return {
    position: [start.x - out.x * LAYOUT.turfRail, y, start.z - out.z * LAYOUT.turfRail],
    quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis)),
    forward,
  }
}

const labelStyle = {
  font: '700 12px/1 system-ui, sans-serif',
  color: '#1d2a1f',
  background: COLORS.route,
  padding: '3px 6px',
  borderRadius: 3,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
}

const SURFACE_LABEL = { turf: '芝', dirt: 'ダ' }
const STEM_HEIGHT = 36 // 牌子與發馬機之間的引線長度（px），避免牌子遮住發馬機

// Html center 讓元素中心對齊錨點；再上移半個高度，使引線末端落在發馬機頂端
const pinStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
}
const stemStyle = { width: 2, height: STEM_HEIGHT, background: COLORS.route, boxShadow: '0 0 2px rgba(0,0,0,0.4)' }

/** 所選比賽的路線（起點 → 終點）與發馬機位置；連續繞圈時不顯示 */
export default function RaceGuide({ run, exaggeration }) {
  const guide = useMemo(() => {
    if (run.isLap) return null
    const { points, traveled } = run.path
    const route = points
      .filter((_, k) => traveled[k] <= run.distance + 1e-6) // 只畫到終點，不含過終點後的減速區段
      .map((p, k) => [p.x, surfaceY(run.surface, run.elevations[k], exaggeration) + ROUTE_LIFT, p.z])
    const [start, next] = points
    const y = surfaceY(run.surface, run.elevations[0], exaggeration)
    return { route, gate: gatePlacement(start, next, run.startOutward, y) }
  }, [run, exaggeration])

  if (!guide) return null
  return (
    <group>
      <Line points={guide.route} color={COLORS.route} lineWidth={3} transparent opacity={0.85} />
      <group position={guide.gate.position} quaternion={guide.gate.quaternion}>
        <StartingGate forward={guide.gate.forward} />
        <Html position={[GATE_WIDTH / 2, GATE.height, (-guide.gate.forward * GATE.depth) / 2]} center zIndexRange={[10, 0]}>
          <div style={pinStyle}>
            <span style={labelStyle}>
              {SURFACE_LABEL[run.surface]} {Math.round(run.distance).toLocaleString()}m スタート
            </span>
            <span style={stemStyle} />
          </div>
        </Html>
      </group>
    </group>
  )
}
