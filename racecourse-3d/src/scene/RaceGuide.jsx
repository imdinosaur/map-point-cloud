import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { LAYOUT } from '../course/courseModel'
import { COLORS, surfaceY } from './sceneConfig'

const ROUTE_LIFT = 0.6
const GATE_WIDTH = 28
const GATE_DEPTH = 3
const GATE_HEIGHT = 4
// 發馬機內側（1 番）貼著內欄，往外側展開；量測線在內欄外 LAYOUT.turfRail 公尺
const GATE_CENTER_OFFSET = GATE_WIDTH / 2 - LAYOUT.turfRail

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
    const { points } = run.path
    const route = points.map((p, k) => [p.x, surfaceY(run.surface, run.elevations[k], exaggeration) + ROUTE_LIFT, p.z])
    const [start, next] = points
    const { startOutward: out } = run
    return {
      route,
      gate: [
        start.x + out.x * GATE_CENTER_OFFSET,
        surfaceY(run.surface, run.elevations[0], exaggeration),
        start.z + out.z * GATE_CENTER_OFFSET,
      ],
      // 發馬機橫跨跑道，長邊與行進方向垂直
      rotation: -Math.atan2(next.z - start.z, next.x - start.x) + Math.PI / 2,
    }
  }, [run, exaggeration])

  if (!guide) return null
  return (
    <group>
      <Line points={guide.route} color={COLORS.route} lineWidth={3} transparent opacity={0.85} />
      <group position={guide.gate} rotation={[0, guide.rotation, 0]}>
        <mesh position={[0, GATE_HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[GATE_WIDTH, GATE_HEIGHT, GATE_DEPTH]} />
          <meshStandardMaterial color={COLORS.gate} roughness={0.6} />
        </mesh>
        <Html position={[0, GATE_HEIGHT, 0]} center zIndexRange={[10, 0]}>
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
