import { cumulativeLengths } from './geometry'

/**
 * 賽道量測線（封閉、第 0 點為終點）。
 * @typedef {{ points: Array<{x:number,z:number}>, cumulative: number[], length: number }} Loop
 *
 * 一條跑法：points 依行進順序排列，traveled[k] 為自起點起算的距離，最後一點即終點；
 * 前 chuteCount 個點位於引込線上。
 * @typedef {{ points: Array<{x:number,z:number}>, traveled: number[], length: number, chuteCount: number }} RacePath
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
  return { points, traveled, length: traveled[traveled.length - 1], chuteCount: prefix.length }
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
