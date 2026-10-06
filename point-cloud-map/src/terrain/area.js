// 地形範圍（單點／區域）→ 要下載的全域像素範圍與圖磚清單
import { MAX_MERCATOR_LAT, TILE_SIZE, lonLatToPixel } from './mercator'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 15
// 單點模式：以該點為中心取 256×256 像素
export const POINT_RASTER_SIZE = 256
// 區域模式：自動挑選讓長邊不超過此像素數的最大縮放層級（最多 5×5 張圖磚）
export const MAX_REGION_RASTER_SIDE = 1024
const MIN_REGION_RASTER_SIDE = 16
// 場景網格長邊的目標格數（稀疏度 1 時）
const TARGET_CELLS = { point: 64, region: 256 }

/**
 * @typedef {{ type: 'point', lon: number, lat: number, zoom: number }} PointArea
 * @typedef {{ type: 'region', west: number, south: number, east: number, north: number }} RegionArea
 * @typedef {PointArea | RegionArea} Area
 * @typedef {{ zoom: number, left: number, top: number, width: number, height: number }} RasterRequest
 *   left/top 為全域像素座標；left 可能超出 [0, 世界寬) 以處理換日線
 */

function regionPixelRect({ west, south, east, north }, zoom) {
  const nw = lonLatToPixel(west, north, zoom)
  const se = lonLatToPixel(east, south, zoom)
  const left = Math.floor(nw.px)
  const top = Math.floor(nw.py)
  return { zoom, left, top, width: Math.ceil(se.px) - left, height: Math.ceil(se.py) - top }
}

/**
 * @param {Area} area
 * @returns {RasterRequest}
 */
export function rasterRequestFor(area) {
  if (area.type === 'point') {
    const { px, py } = lonLatToPixel(area.lon, area.lat, area.zoom)
    const worldSize = TILE_SIZE * 2 ** area.zoom
    const half = POINT_RASTER_SIZE / 2
    return {
      zoom: area.zoom,
      left: Math.round(px - half),
      top: Math.min(Math.max(Math.round(py - half), 0), worldSize - POINT_RASTER_SIZE),
      width: POINT_RASTER_SIZE,
      height: POINT_RASTER_SIZE,
    }
  }

  for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom--) {
    const rect = regionPixelRect(area, zoom)
    if (Math.max(rect.width, rect.height) <= MAX_REGION_RASTER_SIDE) return rect
  }
  return regionPixelRect(area, MIN_ZOOM)
}

/**
 * 覆蓋像素範圍所需的圖磚，以及各自在拼接畫布上的位置
 * @param {RasterRequest} request
 * @returns {{ x: number, y: number, z: number, offsetX: number, offsetY: number }[]}
 */
export function tilesForRaster({ zoom, left, top, width, height }) {
  const n = 2 ** zoom
  const x0 = Math.floor(left / TILE_SIZE)
  const x1 = Math.floor((left + width - 1) / TILE_SIZE)
  const y0 = Math.max(0, Math.floor(top / TILE_SIZE))
  const y1 = Math.min(n - 1, Math.floor((top + height - 1) / TILE_SIZE))

  const tiles = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      tiles.push({
        x: ((tx % n) + n) % n, // 跨越換日線時繞回
        y: ty,
        z: zoom,
        offsetX: tx * TILE_SIZE - left,
        offsetY: ty * TILE_SIZE - top,
      })
    }
  }
  return tiles
}

/**
 * 稀疏度 1 時每格包含的像素數，使網格長邊接近目標格數
 * @param {Area} area
 * @param {RasterRequest} request
 * @returns {number}
 */
export function baseSamplingFor(area, request) {
  return Math.max(1, Math.floor(Math.max(request.width, request.height) / TARGET_CELLS[area.type]))
}

const isLon = (v) => Number.isFinite(v) && v >= -180 && v <= 180
const isLat = (v) => Number.isFinite(v) && v >= -MAX_MERCATOR_LAT && v <= MAX_MERCATOR_LAT
const LAT_RANGE_TEXT = `-${MAX_MERCATOR_LAT} ~ ${MAX_MERCATOR_LAT}`

/**
 * @param {Area} area
 * @returns {string | null} 錯誤訊息，合法時為 null
 */
export function validateArea(area) {
  if (area.type === 'point') {
    if (!isLon(area.lon)) return '經度需介於 -180 ~ 180'
    if (!isLat(area.lat)) return `緯度需介於 ${LAT_RANGE_TEXT}`
    if (!Number.isInteger(area.zoom) || area.zoom < MIN_ZOOM || area.zoom > MAX_ZOOM) {
      return `縮放層級需為 ${MIN_ZOOM} ~ ${MAX_ZOOM} 的整數`
    }
    return null
  }

  const { west, south, east, north } = area
  if (!isLon(west) || !isLon(east)) return '經度需介於 -180 ~ 180'
  if (!isLat(south) || !isLat(north)) return `緯度需介於 ${LAT_RANGE_TEXT}`
  if (west >= east) return '西界需小於東界'
  if (south >= north) return '南界需小於北界'
  const rect = regionPixelRect(area, MAX_ZOOM)
  if (Math.min(rect.width, rect.height) < MIN_REGION_RASTER_SIDE) return '範圍太小，請改用單點模式'
  return null
}
