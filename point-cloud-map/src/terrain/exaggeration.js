// 高度誇張倍率
export const EXAGGERATION_MIN = 0.2
export const EXAGGERATION_MAX = 100
// 自動模式：讓最高的柱子約為場景長邊的這個比例
export const AUTO_TARGET_RATIO = 0.15

const clamp = (value) => Math.min(EXAGGERATION_MAX, Math.max(EXAGGERATION_MIN, value))

/** 顯示用的取整：小於 10 取一位小數，否則取整數 */
export const roundExaggeration = (value) => (value < 10 ? Math.round(value * 10) / 10 : Math.round(value))

/**
 * 依 1 倍時的最高柱高，算出讓起伏清楚可見的倍率。
 * 下限為 1 倍：小範圍真實比例已有明顯起伏時，不會被壓得比實際更平。
 * @param {number} maxHeightAtTrueScale 1 倍時最高柱子的場景高度
 * @param {number} sceneExtent 場景長邊長度
 * @returns {number}
 */
export function autoExaggeration(maxHeightAtTrueScale, sceneExtent) {
  if (!(maxHeightAtTrueScale > 0)) return 1
  const target = AUTO_TARGET_RATIO * sceneExtent
  return roundExaggeration(clamp(Math.max(1, target / maxHeightAtTrueScale)))
}

/**
 * @param {{ height: number }[]} points
 * @returns {number}
 */
export function maxPointHeight(points) {
  return points.reduce((max, p) => Math.max(max, p.height), 0)
}

/**
 * 回傳高度乘上倍率的新點陣列
 * @template {{ height: number }} T
 * @param {T[]} points
 * @param {number} factor
 * @returns {T[]}
 */
export function scaleHeights(points, factor) {
  return points.map((p) => ({ ...p, height: p.height * factor }))
}
