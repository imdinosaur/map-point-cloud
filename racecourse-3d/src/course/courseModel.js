import { buildChute } from './chute'
import { DIRT, DIRT_PROFILE, RACE_DISTANCES, STEEPLE, TURF, TURF_PROFILE } from './courseData'
import {
  buildCenterline,
  computeNormals,
  inwardSignOf,
  offsetLine,
  offsetPoint,
  polylineLength,
  rayDistanceToRing,
  resampleRing,
} from './geometry'
import { elevationAt, fractionFromRemaining, remainingFromFraction } from './profile'
import { buildLapPath, buildRacePath, createLoop } from './racePath'
import { CHUTE_LAYOUT, TURF_INNER_TRACE, VENUE_GAPS, VENUE_OUTLINE } from './tracing'
import { buildVenuePolygons } from './venue'

const SAMPLE_COUNT = 1200
const RAIL_TO_MEASURE_LINE = 1 // 假設距離量測線在內欄外 1m
const VENUE_OVERLAP = 0.5 // 場地草地伸入芝外緣下方的寬度，避免接縫
const EDGE_STEP = 5 // 場地邊線取樣間距（m）
const OUTLINE_INSET = 0.5 // 芝外緣與場地外框保持的距離
const HOME_STRETCH_TAPER = 80 // 芝寬度由 31m 漸變到 41m 的長度

/**
 * 封閉曲線往內偏移 d，周長減少 2πd。
 * 由此反推各コース量測線相對芝 A コース量測線的偏移（芝 A〜D 的官方數據正好符合 3m ↔ 18.8m）。
 */
export const offsetForLength = (length) => (TURF.length - length) / (2 * Math.PI)

/** 沿法向量的偏移量（正值往內場），0 = 芝 A コース量測線 */
export const LAYOUT = (() => {
  const dirtRail = offsetForLength(DIRT.length) + RAIL_TO_MEASURE_LINE
  const steepleRail = offsetForLength(STEEPLE.length) + RAIL_TO_MEASURE_LINE
  return {
    turfRail: RAIL_TO_MEASURE_LINE,
    dirtRail,
    dirtOuter: dirtRail - DIRT.width,
    steepleRail,
    steepleOuter: steepleRail - STEEPLE.width,
  }
})()

const smoothstep = (t) => {
  const c = Math.min(Math.max(t, 0), 1)
  return c * c * (3 - 2 * c)
}

/** 芝寬度：最後直線（含過終點一小段）41m，其餘 31m */
export function turfWidthAt(fraction) {
  const traveled = fraction * TURF.length
  const fromStretchStart = traveled - (TURF.length - TURF.straight)
  const pastGoal = traveled
  const enter = smoothstep(fromStretchStart / HOME_STRETCH_TAPER)
  const exit = 1 - smoothstep((pastGoal - HOME_STRETCH_TAPER) / HOME_STRETCH_TAPER)
  const blend = Math.max(enter, exit)
  return TURF.widthMin + (TURF.widthMax - TURF.widthMin) * blend
}


function nearestIndex(points, target) {
  let best = 0
  let bestDist = Infinity
  points.forEach((p, i) => {
    const dist = Math.hypot(p.x - target.x, p.z - target.z)
    if (dist < bestDist) {
      best = i
      bestDist = dist
    }
  })
  return best
}

const SURFACES = {
  turf: { profile: TURF_PROFILE, official: TURF.length },
  dirt: { profile: DIRT_PROFILE, official: DIRT.length },
}

/** 終點前 remaining 公尺處的高度：以量測線一周的比例對應到官方斷面圖（含引込線與多於一周的情況） */
function surfaceElevation(surface, remaining, loopLength) {
  const { profile, official } = SURFACES[surface]
  return elevationAt(profile, remainingFromFraction(fractionFromRemaining(remaining, loopLength), official))
}

/** 'lap'（從終點連續繞圈）或 '<turf|dirt>-<距離>' */
export function parseRunId(id) {
  if (id === 'lap') return { surface: 'turf', distance: null }
  const [surface, distance] = id.split('-')
  return { surface, distance: Number(distance) }
}

/** 是否為可模擬的跑法 id（用於驗證 URL 參數） */
export function isValidRunId(id) {
  if (id === 'lap') return true
  if (typeof id !== 'string') return false
  const { surface, distance } = parseRunId(id)
  return RACE_DISTANCES[surface]?.includes(distance) ?? false
}

/** 起點處指向跑道外側的單位向量（行進方向的左法向量 × 內側符號，再取反） */
function outwardAtStart({ points }, inwardSign) {
  const [start, next] = points
  const len = Math.hypot(next.x - start.x, next.z - start.z) || 1
  const tx = (next.x - start.x) / len
  const tz = (next.z - start.z) / len
  return { x: tz * inwardSign, z: -tx * inwardSign }
}

export function createCourseModel() {
  const { points, normals, toWorld } = buildCenterline(TURF_INNER_TRACE, TURF.length, SAMPLE_COUNT)
  // 引込線點列由匯入點往外，與行進方向相反，法向量符號需反轉才指向內場側
  const inwardSign = inwardSignOf(points)
  const chuteNormalSign = -inwardSign
  const fractionOf = (i) => i / points.length

  const turfElevation = (i) => elevationAt(TURF_PROFILE, remainingFromFraction(fractionOf(i), TURF.length))
  const dirtElevation = (i) => elevationAt(DIRT_PROFILE, remainingFromFraction(fractionOf(i), DIRT.length))
  // 芝外緣（往外為負）：依直線／彎道寬度，但不超出官方場地外框（例如左上斜切的角落）
  const outlineWorld = VENUE_OUTLINE.map(toWorld)
  const turfOuterOffsets = points.map((p, i) => {
    const outward = { x: -normals[i].x, z: -normals[i].z }
    const toOutline = rayDistanceToRing(p, outward, outlineWorld) - OUTLINE_INSET
    const nominal = turfWidthAt(fractionOf(i)) - LAYOUT.turfRail
    return -Math.min(nominal, toOutline)
  })
  const turfOuter = (i) => turfOuterOffsets[i]

  /** 剩餘距離 → 中心線取樣索引（各コース以相同比例對應） */
  const indexForRemaining = (remaining, length) =>
    Math.round(fractionFromRemaining(remaining, length) * points.length) % points.length

  const baseLoop = createLoop(points)
  const junctionIndex = nearestIndex(points, toWorld(CHUTE_LAYOUT.junction))
  const junctionRemaining = baseLoop.length - baseLoop.cumulative[junctionIndex]
  const remainingAt = (i) => baseLoop.length - baseLoop.cumulative[i]
  const chute = buildChute({ points, junctionIndex, remainingAt, toWorld }, CHUTE_LAYOUT)
  const branchNormals = chute.branches.map(({ points: branch }) => computeNormals(branch, false, chuteNormalSign))
  /** 1,800m、2,000m 的出發引込線（點列由匯入點往外，法向量指向內場側），用來畫芝面 */
  const chuteBranches = chute.branches.map(({ points: branch }, k) => ({ points: branch, normals: branchNormals[k] }))

  // 邊緣重新取樣，讓草地頂面沿邊也能逐點貼合高度
  const venue = buildVenuePolygons({
    outline: outlineWorld,
    gaps: VENUE_GAPS.map((gap) => gap.map(toWorld)),
    ovalOuter: points.map((p, i) => offsetPoint(p, normals[i], turfOuter(i) + VENUE_OVERLAP)),
  }).map((polygon) => polygon.map((ring) => resampleRing(ring, EDGE_STEP)))
  /** 場地邊線：平面圖外框與空白三角地的輪廓，重新取樣以便沿線計算高度 */
  const venueEdges = [outlineWorld, ...VENUE_GAPS.map((gap) => gap.map(toWorld))].map((ring) => resampleRing(ring, EDGE_STEP))
  /** 場地草地的高度：取最近的芝本線取樣點 */
  const venueElevationAt = (x, z) => turfElevation(nearestIndex(points, { x, z }))

  /**
   * 建立一條跑法。芝依 A〜D 的量測線（往外移 railShift），ダート用ダート量測線。
   * @returns {{ surface: string, isLap: boolean, distance: number, path: import('./racePath').RacePath,
   *   elevations: number[], loopLength: number, startOutward: {x:number,z:number} }}
   */
  function createRun(runId, railShift) {
    const { surface, distance } = parseRunId(runId)
    const d = surface === 'turf' ? -railShift : offsetForLength(DIRT.length)
    const loop = createLoop(offsetLine(points, normals, d))
    const chuteLine =
      surface === 'turf'
        ? {
            branches: chute.branches.map(({ points: branch, junctionIndex: index }, k) => ({
              points: offsetLine(branch, branchNormals[k], d),
              junctionIndex: index,
            })),
          }
        : null
    const path = distance === null ? buildLapPath(loop) : buildRacePath(loop, distance, chuteLine)
    return {
      surface,
      isLap: distance === null,
      distance: path.length,
      path,
      // 引込線段與場地草地共用同一高度函式，發馬機與跑者才會貼在路面上
      elevations: path.points.map((p, k) =>
        k < path.chuteCount ? venueElevationAt(p.x, p.z) : surfaceElevation(surface, path.length - path.traveled[k], loop.length),
      ),
      loopLength: loop.length,
      startOutward: outwardAtStart(path, inwardSign),
    }
  }

  /** 量測線實際長度（驗證偏移模型與官方數據是否一致） */
  const measureLength = (d) => polylineLength(offsetLine(points, normals, d), true)

  return {
    points,
    normals,
    fractionOf,
    turfElevation,
    dirtElevation,
    turfOuter,
    indexForRemaining,
    junctionRemaining,
    venue,
    venueEdges,
    chuteBranches,
    venueElevationAt,
    createRun,
    measureLength,
  }
}
