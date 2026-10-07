import { roundCorners, truncatePolyline } from './geometry'

const POCKET_STUB = 25 // 最外側匯入處以東再延伸的ポケット末端
const START_MARGIN = 15 // 起點後方保留的閘門空間
const MERGE_RADIUS = 30
const SWEEP_RADIUS = 90 // 2,000m 由南側ポケット轉入斜向帶的大弧線
const LEG_EXTENT = 600 // 先畫足夠長的直線，圓角後再依距離截斷
const SAMPLE_STEP = 5

/** 引込線上各起點的官方距離 */
export const CHUTE_STARTS = { pocket: 1600, diagonal: 1800, south: 2000 }

const normalize = ([x, y]) => {
  const len = Math.hypot(x, y)
  return { x: x / len, z: y / len }
}
const advance = (p, dir, d) => ({ x: p.x + dir.x * d, z: p.z + dir.z * d })

/** 直線 p + s·u 與 q + t·v 的交點參數 s */
function intersectParam(p, u, q, v) {
  const denom = u.x * v.z - u.z * v.x
  return ((q.x - p.x) * v.z - (q.z - p.z) * v.x) / denom
}

function sampleStraight(from, dir, length) {
  const steps = Math.max(1, Math.ceil(length / SAMPLE_STEP))
  return Array.from({ length: steps + 1 }, (_, k) => advance(from, dir, (length * k) / steps))
}

/**
 * 依官方起點距離與圖面描線建立 2コーナー奥 的引込線。所有點列皆「由匯入點往外」排列。
 * - pocket：向正面直線沿切線往東延長（1,600m 起點位於此）
 * - branches[0]：內側斜向支線（1,800m）
 * - branches[1]：外側斜向帶 + 南側ポケット（2,000m），以大弧線相接、不經過 1,800m 發走點
 * @param {{ points, junctionIndex: number, junctionRemaining: number, toWorld: Function }} loop
 * @param {typeof import('./tracing').CHUTE_LAYOUT} layout
 */
export function buildChute({ points, junctionIndex, junctionRemaining, toWorld }, layout) {
  const n = points.length
  const junction = points[junctionIndex]
  const behind = points[(junctionIndex - 1 + n) % n]
  const ahead = points[(junctionIndex + 1) % n]
  const outward = normalize([behind.x - ahead.x, behind.z - ahead.z])

  const lineOf = ({ through, direction }) => ({ point: toWorld(through), dir: normalize(direction) })
  const inner = lineOf(layout.diagonal1800)
  const outer = lineOf(layout.outer2000)
  const south = { point: toWorld([layout.pocket2000X, 0]), dir: { x: 0, z: 1 } }

  const merge1800 = intersectParam(junction, outward, inner.point, inner.dir)
  const merge2000 = intersectParam(junction, outward, outer.point, outer.dir)
  const m1800 = advance(junction, outward, merge1800)
  const m2000 = advance(junction, outward, merge2000)
  const bend2000 = advance(m2000, outer.dir, intersectParam(m2000, outer.dir, south.point, south.dir))

  const reach = (distance) => distance - junctionRemaining + START_MARGIN
  const branch1800 = truncatePolyline(
    roundCorners([junction, m1800, advance(m1800, inner.dir, LEG_EXTENT)], MERGE_RADIUS),
    reach(CHUTE_STARTS.diagonal),
  )
  const branch2000 = truncatePolyline(
    roundCorners([junction, m2000, bend2000, advance(bend2000, south.dir, LEG_EXTENT)], [MERGE_RADIUS, SWEEP_RADIUS]),
    reach(CHUTE_STARTS.south),
  )

  return {
    junctionIndex,
    pocket: sampleStraight(junction, outward, Math.max(merge1800, merge2000) + POCKET_STUB),
    branches: [
      { points: branch1800, mergeDistance: merge1800 },
      { points: branch2000, mergeDistance: merge2000 },
    ],
  }
}
