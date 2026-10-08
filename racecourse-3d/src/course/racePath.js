import { computeNormals, cumulativeLengths } from './geometry'

/**
 * 賽道量測線（封閉、第 0 點為終點）。
 * @typedef {{ points: Array<{x:number,z:number}>, cumulative: number[], length: number }} Loop
 *
 * 一條跑法：points 依行進順序排列，traveled[k] 為自起點起算的距離；finish 為終點的已跑距離，
 * 之後可能還接著過終點後減速用的一段（見 withRunout），所以 length ≥ finish。
 * 前 chuteCount 個點位於引込線上。
 * @typedef {{ points: Array<{x:number,z:number}>, traveled: number[], length: number, finish: number, chuteCount: number }} RacePath
 */

/** @returns {Loop} */
export function createLoop(points) {
  const cumulative = cumulativeLengths(points, true)
  return { points, cumulative, length: cumulative[cumulative.length - 1] }
}

const lerpPoint = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })

/** 已跑距離 s（自終點起算，0 ≤ s < length）落在哪一段 */
function locateOnLoop(loop, s) {
  const { cumulative, points } = loop
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cumulative[mid] <= s) lo = mid
    else hi = mid - 1
  }
  const segment = cumulative[lo + 1] - cumulative[lo]
  return { index: lo, t: segment > 0 ? (s - cumulative[lo]) / segment : 0 }
}

/** 終點前 remaining 公尺在環線上的距離（自終點起算） */
export const loopPositionFor = (loop, remaining) =>
  (((loop.length - remaining) % loop.length) + loop.length) % loop.length

/**
 * 從環線上 startPosition 出發，沿行進方向跑 distance 公尺（可超過一周）。
 * @param {Array<{x:number,z:number}>} prefix 接在環線之前的路徑（如引込線），最後一點應位於 startPosition
 * @returns {RacePath}
 */
function runAlongLoop(loop, startPosition, distance, prefix = []) {
  const n = loop.points.length
  const { index, t } = locateOnLoop(loop, startPosition)
  const points = [...prefix]
  if (points.length === 0) points.push(lerpPoint(loop.points[index], loop.points[(index + 1) % n], t))

  let covered = loop.cumulative[index + 1] - startPosition
  let k = index + 1
  while (covered < distance - 1e-6) {
    points.push(loop.points[k % n])
    covered += loop.cumulative[(k % n) + 1] - loop.cumulative[k % n]
    k += 1
  }
  points.push(loop.points[k % n])
  const traveled = cumulativeLengths(points, false)
  const length = traveled[traveled.length - 1]
  return { points, traveled, length, finish: length, chuteCount: prefix.length }
}

/**
 * 終點後沿環線再接約 runout 公尺，讓跑者過終點後有路可以減速停下。
 * 比賽跑法的最後一點即環線第 0 點（終點），從第 1 點接下去。
 * @param {RacePath} path
 * @returns {RacePath}
 */
export function withRunout(path, loop, runout) {
  const n = loop.points.length
  const points = [...path.points]
  let extra = 0
  for (let k = 1; extra < runout; k++) {
    const next = loop.points[k % n]
    const last = points[points.length - 1]
    extra += Math.hypot(next.x - last.x, next.z - last.z)
    points.push(next)
  }
  const traveled = cumulativeLengths(points, false)
  return { ...path, points, traveled, length: traveled[traveled.length - 1], finish: path.finish }
}

/** 從終點出發繞一周回到終點 */
export const buildLapPath = (loop) => runAlongLoop(loop, 0, loop.length)

/**
 * 距離 distance 的比賽跑法。依序檢查各引込線：起點若落在其範圍（junctionRemaining < distance ≤ junctionRemaining + 長度），
 * 先沿該引込線跑到匯入點再接環線；都不符合則直接在環線上起跑。
 * @param {{ branches: Array<{ points: Array<{x:number,z:number}>, junctionIndex: number }> } | null} chute
 *   每條 branch 依「由匯入點往外」排列，第 0 點即環線上該 branch 的 junctionIndex 點
 */
export function buildRacePath(loop, distance, chute = null) {
  if (chute) {
    for (const { points: branch, junctionIndex } of chute.branches) {
      const junctionPosition = loop.cumulative[junctionIndex]
      const onChute = distance - (loop.length - junctionPosition)
      const cumulative = cumulativeLengths(branch, false)
      if (onChute > 0 && onChute <= cumulative[cumulative.length - 1]) {
        const prefix = sliceFromStart(branch, cumulative, onChute)
        return runAlongLoop(loop, junctionPosition, loop.length - junctionPosition, prefix)
      }
    }
  }
  return runAlongLoop(loop, loopPositionFor(loop, distance), distance)
}

/** 取引込線上距匯入點 along 公尺處到匯入點的一段，並轉成行進順序 */
function sliceFromStart(points, cumulative, along) {
  let k = 1
  while (cumulative[k] < along) k += 1
  const t = (along - cumulative[k - 1]) / (cumulative[k] - cumulative[k - 1])
  const start = lerpPoint(points[k - 1], points[k], t)
  return [start, ...points.slice(0, k).reverse()]
}

/** 沿跑法已跑 t 公尺的位置與所在段 */
export function pointAlong(path, t) {
  const { traveled, points } = path
  const clamped = Math.min(Math.max(t, 0), path.length)
  let lo = 0
  let hi = points.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (traveled[mid] <= clamped) lo = mid
    else hi = mid - 1
  }
  const segment = traveled[lo + 1] - traveled[lo]
  const s = segment > 0 ? (clamped - traveled[lo]) / segment : 0
  return { ...lerpPoint(points[lo], points[lo + 1], s), index: lo, t: s }
}

/**
 * 視線方向取樣區間：由已跑距離 from 看向 to（前方 ahead 公尺）。
 * 連續繞圈時越過終點繞回起點；比賽跑法到終點時改取最後 ahead 公尺，視線維持直線方向。
 */
export function lookAheadSpan(length, traveled, isLap, ahead) {
  if (isLap) return { from: traveled, to: (traveled + ahead) % length }
  const to = Math.min(traveled + ahead, length)
  return { from: Math.max(0, to - ahead), to }
}

const MAX_CURVATURE = 0.05 // 引込線匯入本線等折點的上限（1/m），避免單一段落的尖峰

/**
 * 跑法的橫向座標系：每個點往外側的單位法向量，以及沿路線的曲率。
 * 曲率定義為「往外 1m 的平行線比路線長多少」：彎道為正，外側跑得比較遠。
 * @param {RacePath} path
 * @param {{x:number, z:number}} startOutward 起點處指向外側的方向（決定法向量正負）
 */
export function laneFrame(path, startOutward) {
  const { points, traveled } = path
  const normals = computeNormals(points, false, 1)
  const flip = normals[0].x * startOutward.x + normals[0].z * startOutward.z < 0 ? -1 : 1
  const outward = normals.map(({ x, z }) => ({ x: x * flip, z: z * flip }))

  const curvature = points.slice(0, -1).map((a, k) => {
    const b = points[k + 1]
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    if (length === 0) return 0
    const dx = b.x + outward[k + 1].x - (a.x + outward[k].x)
    const dz = b.z + outward[k + 1].z - (a.z + outward[k].z)
    return Math.min(Math.max(Math.hypot(dx, dz) / length - 1, -MAX_CURVATURE), MAX_CURVATURE)
  })

  /** 已跑距離處的曲率 */
  const curvatureAt = (distance) => {
    let lo = 0
    let hi = curvature.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (traveled[mid] <= distance) lo = mid
      else hi = mid - 1
    }
    return curvature[lo] ?? 0
  }
  return { outward, curvatureAt }
}
