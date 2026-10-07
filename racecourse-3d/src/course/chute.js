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

/** 環線第 i 點的行進方向（單位向量） */
function tangentAt(points, i) {
  const n = points.length
  const a = points[(i - 1 + n) % n]
  const b = points[(i + 1) % n]
  return normalize([b.x - a.x, b.z - a.z])
}

/** 行進方向最接近 dir 的環線取樣點（直線引込線與環線相切處） */
function tangentIndex(points, dir) {
  let best = 0
  let bestDot = -Infinity
  points.forEach((_, i) => {
    const t = tangentAt(points, i)
    const dot = t.x * dir.x + t.z * dir.z
    if (dot > bestDot) {
      best = i
      bestDot = dot
    }
  })
  return best
}

/**
 * 依官方起點距離與圖面描線建立 2コーナー 周邊的引込線。所有點列皆「由匯入點往外」排列。
 * - pocket：向正面直線在 junction 沿切線往東延長（1,600m 起點位於此）
 * - branches[0]：1,800m，與 2コーナー相切的直線，位於本線與空白三角地之間，直接匯入本線
 * - branches[1]：2,000m，由南側ポケット以大弧線轉入外側斜向帶，再經ポケット匯入向正面
 * @param {{ points, junctionIndex: number, remainingAt: (i: number) => number, toWorld: Function }} loop
 * @param {typeof import('./tracing').CHUTE_LAYOUT} layout
 */
export function buildChute({ points, junctionIndex, remainingAt, toWorld }, layout) {
  const junction = points[junctionIndex]
  const forward = tangentAt(points, junctionIndex)
  const outward = { x: -forward.x, z: -forward.z }
  const reach = (distance, index) => distance - remainingAt(index) + START_MARGIN

  const inner = normalize(layout.diagonal1800.direction)
  const junction1800 = tangentIndex(points, { x: -inner.x, z: -inner.z })
  const branch1800 = sampleStraight(
    points[junction1800],
    inner,
    reach(CHUTE_STARTS.diagonal, junction1800),
  )

  const outer = { point: toWorld(layout.outer2000.through), dir: normalize(layout.outer2000.direction) }
  const south = { point: toWorld([layout.pocket2000X, 0]), dir: { x: 0, z: 1 } }
  const merge2000 = intersectParam(junction, outward, outer.point, outer.dir)
  const m2000 = advance(junction, outward, merge2000)
  const bend2000 = advance(m2000, outer.dir, intersectParam(m2000, outer.dir, south.point, south.dir))
  const branch2000 = truncatePolyline(
    roundCorners([junction, m2000, bend2000, advance(bend2000, south.dir, LEG_EXTENT)], [MERGE_RADIUS, SWEEP_RADIUS]),
    reach(CHUTE_STARTS.south, junctionIndex),
  )

  return {
    junctionIndex,
    pocket: sampleStraight(junction, outward, merge2000 + POCKET_STUB),
    branches: [
      { points: branch1800, junctionIndex: junction1800, mergeDistance: 0 },
      { points: branch2000, junctionIndex, mergeDistance: merge2000 },
    ],
  }
}
