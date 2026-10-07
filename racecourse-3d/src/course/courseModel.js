import { buildChute } from './chute'
import { DIRT, DIRT_PROFILE, RACE_DISTANCES, STEEPLE, TURF, TURF_PROFILE } from './courseData'
import {
  buildCenterline,
  computeNormals,
  cumulativeLengths,
  inwardSignOf,
  offsetLine,
  offsetPoint,
  polylineLength,
} from './geometry'
import { elevationAt, fractionFromRemaining, remainingFromFraction } from './profile'
import { buildLapPath, buildRacePath, createLoop } from './racePath'
import { CHUTE_LAYOUT, TURF_INNER_TRACE, VENUE_GAPS, VENUE_OUTLINE } from './tracing'
import { buildVenuePolygons } from './venue'

const SAMPLE_COUNT = 1200
const RAIL_TO_MEASURE_LINE = 1 // 假設距離量測線在內欄外 1m
const BRANCH_HALF_WIDTH = 10
const BRANCH_CENTER = -3 // 支線中心往外偏，讓 B〜D コース的跑法也落在路面上
const VENUE_OVERLAP = 2 // 場地草地伸入芝外緣下方的寬度，避免接縫
const BRANCH_OVERLAP = 35 // 斜向支線往匯入點方向多畫一段，與ポケット重疊
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

/** 路面帶狀實體所需資料：點列、內側法向量、內外緣偏移與每點高度（m） */
function chuteBand(points, normalSign, inner, outer, remainingAt) {
  const cumulative = cumulativeLengths(points, false)
  return {
    points,
    normals: computeNormals(points, false, normalSign),
    inner,
    outer,
    elevations: cumulative.map((along) => remainingAt(along)),
  }
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
  const turfOuter = (i) => LAYOUT.turfRail - turfWidthAt(fractionOf(i))

  /** 剩餘距離 → 中心線取樣索引（各コース以相同比例對應） */
  const indexForRemaining = (remaining, length) =>
    Math.round(fractionFromRemaining(remaining, length) * points.length) % points.length

  const baseLoop = createLoop(points)
  const junctionIndex = nearestIndex(points, toWorld(CHUTE_LAYOUT.junction))
  const junctionRemaining = baseLoop.length - baseLoop.cumulative[junctionIndex]
  const chute = buildChute({ points, junctionIndex, junctionRemaining, toWorld }, CHUTE_LAYOUT)
  const chuteElevationAt = (along) => surfaceElevation('turf', junctionRemaining + along, baseLoop.length)

  // 各支線只畫匯入處以外的部分（往回多畫一段與ポケット重疊），ポケット本身另外畫成芝寬
  const branchBands = chute.branches.map(({ points: branch, mergeDistance }) => {
    const cumulative = cumulativeLengths(branch, false)
    const from = mergeDistance - BRANCH_OVERLAP
    return chuteBand(
      branch.filter((_, k) => cumulative[k] >= from),
      chuteNormalSign,
      BRANCH_CENTER + BRANCH_HALF_WIDTH,
      BRANCH_CENTER - BRANCH_HALF_WIDTH,
      (along) => chuteElevationAt(along + from),
    )
  })
  const chuteBands = [
    chuteBand(chute.pocket, chuteNormalSign, LAYOUT.turfRail, LAYOUT.turfRail - TURF.widthMin, chuteElevationAt),
    ...branchBands,
  ]
  const branchNormals = chute.branches.map(({ points: branch }) => computeNormals(branch, false, chuteNormalSign))

  const venue = buildVenuePolygons({
    outline: VENUE_OUTLINE.map(toWorld),
    gaps: VENUE_GAPS.map((gap) => gap.map(toWorld)),
    ovalOuter: points.map((p, i) => offsetPoint(p, normals[i], turfOuter(i) + VENUE_OVERLAP)),
  })
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
        ? { junctionIndex, branches: chute.branches.map(({ points: branch }, k) => offsetLine(branch, branchNormals[k], d)) }
        : null
    const path = distance === null ? buildLapPath(loop) : buildRacePath(loop, distance, chuteLine)
    return {
      surface,
      isLap: distance === null,
      distance: path.length,
      path,
      elevations: path.traveled.map((t) => surfaceElevation(surface, path.length - t, loop.length)),
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
    chuteBands,
    venue,
    venueElevationAt,
    createRun,
    measureLength,
  }
}
