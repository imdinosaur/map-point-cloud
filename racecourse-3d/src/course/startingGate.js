// 發馬機（ゲート）尺寸與配置。局部座標：x 由內欄往外側（1 番在內），z 為行進方向，前門位於 z = 0。

export const GATE = {
  stalls: 18, // 東京芝的最大出走頭數
  pitch: 1.1, // 每格中心距（m）
  depth: 3.2, // 機身前後長度
  height: 2.8, // 頂部框架高度
  endFrame: 0.4, // 兩端外框厚度
  partition: 0.12,
  doorHeight: 1.7,
  doorLift: 0.4, // 閘門離地高度
  doorThickness: 0.08,
}

export const GATE_WIDTH = GATE.stalls * GATE.pitch + GATE.endFrame * 2

/** 出閘後撤走發馬機：跑者離開閘門多遠後開始拖走、往外側拖多遠（越過最寬的芝）、花幾秒 */
export const GATE_DEPARTURE = { after: 100, distance: 45, duration: 3 }

/**
 * 撤走進度 progress（0〜1）時發馬機往外側的位移；頭尾放慢，像牽引車起步與停下。到 1 時隱藏。
 * @returns {{ offset: number, visible: boolean }}
 */
export function gateDeparture(progress) {
  const p = Math.min(Math.max(progress, 0), 1)
  return { offset: GATE_DEPARTURE.distance * p * p * (3 - 2 * p), visible: p < 1 }
}

/** 枠番顏色（1 白 2 黒 3 赤 4 青 5 黄 6 緑 7 橙 8 桃） */
export const WAKU_COLORS = ['#f5f5f5', '#222222', '#d8322f', '#2a5fbf', '#f2c230', '#2f8f3a', '#ef8a1e', '#f29bb7']

/** 枠色上的數字顏色（依 JRA 出馬表：白、黃、橙、桃底用黑字，其餘白字） */
export const WAKU_TEXT_COLORS = ['#1d2a1f', '#ffffff', '#ffffff', '#ffffff', '#1d2a1f', '#ffffff', '#1d2a1f', '#1d2a1f']

/**
 * 馬番 → 枠番（1〜8）。依 JRA 規則：頭數超過 8 時平均分配，餘數由外側（大枠）各多 1 頭。
 * @param {number} horse 1 起算的馬番
 * @param {number} runners 出走頭數
 */
export function wakuOf(horse, runners) {
  if (runners <= 8) return horse
  const base = Math.floor(runners / 8)
  const extra = runners % 8
  let upper = 0
  for (let waku = 1; waku <= 8; waku++) {
    upper += base + (waku > 8 - extra ? 1 : 0)
    if (horse <= upper) return waku
  }
  return 8
}

/**
 * 各構件在局部座標的中心 x。
 * @returns {{ partitions: number[], stalls: Array<{ number: number, x: number, waku: number }> }}
 */
export function gateLayout() {
  const first = GATE.endFrame
  const partitions = Array.from({ length: GATE.stalls + 1 }, (_, k) => first + k * GATE.pitch)
  const stalls = Array.from({ length: GATE.stalls }, (_, k) => ({
    number: k + 1,
    x: first + (k + 0.5) * GATE.pitch,
    waku: wakuOf(k + 1, GATE.stalls),
  }))
  return { partitions, stalls }
}
