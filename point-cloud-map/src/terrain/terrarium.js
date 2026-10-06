// Terrarium 高程圖磚（AWS Open Data，免金鑰、支援 CORS）
// 格式說明：https://github.com/tilezen/joerd/blob/master/docs/formats.md#terrarium
import { metersPerPixel, pixelYToLat } from './mercator'

export const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'

/**
 * @param {{ x: number, y: number, z: number }} tile
 * @returns {string}
 */
export function terrariumTileUrl({ x, y, z }) {
  return `${TERRARIUM_URL}/${z}/${x}/${y}.png`
}

/**
 * RGB 像素解碼為海拔（公尺）
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
export function decodeTerrarium(r, g, b) {
  return r * 256 + g + b / 256 - 32768
}

// 區塊內最高海拔：大範圍時保留山峰，不會因取樣間隔而漏掉
function blockMaxElevation(pixels, width, x0, y0, x1, y1) {
  let max = -Infinity
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * width + px) * 4
      max = Math.max(max, decodeTerrarium(pixels[i], pixels[i + 1], pixels[i + 2]))
    }
  }
  return max
}

function sampleRaster(pixels, { width, height, top, zoom, sampling, isCircular, hideSea }) {
  const cols = Math.ceil(width / sampling)
  const rows = Math.ceil(height / sampling)
  const radius = Math.min(cols, rows) / 2
  const samples = []

  for (let y = 0; y < rows; y++) {
    const y0 = y * sampling
    const y1 = Math.min(y0 + sampling, height)
    // Mercator 每列比例尺不同，依該格中心的緯度換算
    const rowMetersPerPixel = metersPerPixel(pixelYToLat(top + (y0 + y1) / 2, zoom), zoom)
    for (let x = 0; x < cols; x++) {
      if (isCircular && Math.hypot(x - cols / 2, y - rows / 2) > radius) continue

      const x0 = x * sampling
      const meters = blockMaxElevation(pixels, width, x0, y0, Math.min(x0 + sampling, width), y1)
      if (hideSea && meters <= 0) continue
      samples.push({ x, y, meters: Math.max(0, meters), rowMetersPerPixel })
    }
  }
  return { samples, cols, rows }
}

/**
 * 將拼接後的 RGBA 像素轉為 TerrainMap 使用的格點資料。
 * - 每格取區塊內最高海拔
 * - 海拔低於 0 一律視為 0；hideSea 時直接略過海面（≤ 0 m）
 * - 基準高度：hideSea 時為海平面，否則為範圍內最低點（只呈現起伏）
 * - 水平與垂直使用相同比例尺，再乘上 exaggeration
 * @param {Uint8ClampedArray} pixels 長度為 width * height * 4
 * @param {{
 *   width: number, height: number, top: number, zoom: number,
 *   sampling?: number, isCircular?: boolean, hideSea?: boolean,
 *   cellSize: number, exaggeration?: number,
 * }} options top 為畫布第一列的全域像素 y；cellSize 為每格的場景單位
 * @returns {{
 *   points: { x: number, y: number, height: number }[],
 *   cols: number, rows: number,
 *   minElevation: number, maxElevation: number, baseElevation: number,
 * }}
 */
export function buildTerrainGrid(pixels, options) {
  const { sampling = 1, isCircular = false, hideSea = false, cellSize, exaggeration = 1 } = options
  const { samples, cols, rows } = sampleRaster(pixels, { ...options, sampling, isCircular, hideSea })

  if (samples.length === 0) {
    return { points: [], cols, rows, minElevation: 0, maxElevation: 0, baseElevation: 0 }
  }

  const { minElevation, maxElevation } = samples.reduce(
    (acc, s) => ({
      minElevation: Math.min(acc.minElevation, s.meters),
      maxElevation: Math.max(acc.maxElevation, s.meters),
    }),
    { minElevation: Infinity, maxElevation: -Infinity },
  )
  const baseElevation = hideSea ? 0 : minElevation

  const points = samples.map(({ x, y, meters, rowMetersPerPixel }) => ({
    x,
    y,
    height: ((meters - baseElevation) * cellSize * exaggeration) / (rowMetersPerPixel * sampling),
  }))

  return { points, cols, rows, minElevation, maxElevation, baseElevation }
}
