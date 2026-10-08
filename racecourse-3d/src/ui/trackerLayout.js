import { FIELD } from '../course/field'

// 轉播式位置追蹤條的版面計算（純函式）：先做「全員往右跑」的版本。
// x：比賽中的前後位置（0 = 最後方、1 = 先頭）；y：內外（0 = 內欄、1 = 外側），對應從觀眾席看去內欄在遠側（上方）。

export const TRACKER = {
  minSpan: 25, // 馬群前後不到這個距離（m）時不拉滿整條，避免緊密的馬群被放大到看不出遠近
  laneRange: 6, // 由內欄往外幾公尺對應到最下方（實際馬群多在內欄 6m 內）
}

const clamp = (value) => Math.min(Math.max(value, 0), 1)

/**
 * 依內外位置找一個不與已擺好的徽章重疊的列：先試原本的位置，再往外（下）、往內（上）逐列找；
 * 都被佔滿時選重疊最少的列，至少不會整排疊在同一點。
 */
function freeRow(x, laneY, placed, { minGapX, rowStep }) {
  const rows = Math.max(1, Math.floor(1 / rowStep) + 1)
  const candidates = [laneY]
  for (let k = 1; k < rows * 2; k++) candidates.push(laneY + k * rowStep, laneY - k * rowStep)
  const inside = candidates.filter((y) => y >= -1e-9 && y <= 1 + 1e-9).map(clamp)
  const overlaps = (y) => placed.filter((p) => Math.abs(p.x - x) < minGapX && Math.abs(p.y - y) < rowStep - 1e-9).length
  return inside.find((y) => overlaps(y) === 0) ?? inside.reduce((best, y) => (overlaps(y) < overlaps(best) ? y : best), laneY)
}

/**
 * @param {Array<{ number: number, traveled: number, lateral: number }>} runners
 * @param {{ minGapX?: number, rowStep?: number }} [spacing] 徽章的寬、高（以整條的比例表示）；不給時不處理重疊
 * @returns {Array<{ number: number, x: number, y: number }>} x、y 皆為 0〜1，順序與 runners 相同
 */
export function trackerLayout(runners, { minGapX = 0, rowStep = 0 } = {}) {
  const front = Math.max(...runners.map((r) => r.traveled))
  const back = Math.min(...runners.map((r) => r.traveled))
  const span = Math.max(front - back, TRACKER.minSpan)
  const badges = runners.map(({ number, traveled, lateral }) => ({
    number,
    x: 1 - (front - traveled) / span,
    y: clamp((lateral - FIELD.minLateral) / TRACKER.laneRange),
  }))
  if (!(minGapX > 0 && rowStep > 0)) return badges

  // 由先頭往後依序擺放，前面的馬優先保有自己的內外位置
  const placed = []
  const resolved = new Map()
  for (const badge of [...badges].sort((a, b) => b.x - a.x || a.y - b.y)) {
    const y = freeRow(badge.x, badge.y, placed, { minGapX, rowStep })
    placed.push({ x: badge.x, y })
    resolved.set(badge.number, y)
  }
  return badges.map((badge) => ({ ...badge, y: resolved.get(badge.number) }))
}
