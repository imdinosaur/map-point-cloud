import { GATE, GATE_WIDTH, WAKU_COLORS, gateLayout } from '../course/startingGate'

const COLORS = {
  frame: '#e4e7e1',
  partition: '#2f6b3a',
  door: '#f7f7f4',
}
const BEAM = 0.25
const LAYOUT = gateLayout() // 尺寸固定，模組載入時算一次
const DOOR_GAP = 0.06 // 閘門與隔板之間的縫
const PLATE = { width: 0.65, height: 0.35, depth: 0.05 }

function Box({ size, position, color }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  )
}

/**
 * 18 格發馬機：隔板、前後閘門、兩端外框與頂部橫樑，前門上方掛枠番色號牌。
 * 局部座標原點在內欄與起跑線的交點；x 往外側，forward（±1）為局部 z 的行進方向。
 */
export default function StartingGate({ forward }) {
  const { partitions, stalls } = LAYOUT
  const back = -forward * GATE.depth
  const midZ = back / 2
  const doorWidth = GATE.pitch - GATE.partition - DOOR_GAP
  const doorY = GATE.doorLift + GATE.doorHeight / 2

  return (
    <group>
      {[GATE.endFrame / 2, GATE_WIDTH - GATE.endFrame / 2].map((x) => (
        <Box key={x} size={[GATE.endFrame, GATE.height, GATE.depth]} position={[x, GATE.height / 2, midZ]} color={COLORS.frame} />
      ))}
      {[0, back].map((z) => (
        <Box key={z} size={[GATE_WIDTH, BEAM, BEAM]} position={[GATE_WIDTH / 2, GATE.height, z]} color={COLORS.frame} />
      ))}
      {partitions.map((x) => (
        <Box
          key={x}
          size={[GATE.partition, GATE.height - BEAM, GATE.depth]}
          position={[x, (GATE.height - BEAM) / 2, midZ]}
          color={COLORS.partition}
        />
      ))}
      {stalls.map(({ number, x, waku }) => (
        <group key={number}>
          {[0, back].map((z) => (
            <Box key={z} size={[doorWidth, GATE.doorHeight, GATE.doorThickness]} position={[x, doorY, z]} color={COLORS.door} />
          ))}
          <Box
            size={[PLATE.width, PLATE.height, PLATE.depth]}
            position={[x, GATE.doorLift + GATE.doorHeight + PLATE.height, forward * PLATE.depth]}
            color={WAKU_COLORS[waku - 1]}
          />
        </group>
      ))}
    </group>
  )
}
