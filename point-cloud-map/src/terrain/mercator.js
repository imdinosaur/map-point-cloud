// Web Mercator（EPSG:3857）圖磚／像素座標換算

export const TILE_SIZE = 256
export const MAX_MERCATOR_LAT = 85.0511

const EARTH_CIRCUMFERENCE_M = 40075016.686

const clampLat = (lat) => Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat))

/**
 * 經緯度轉指定縮放層級下的全域像素座標（浮點數）
 * @param {number} lon
 * @param {number} lat
 * @param {number} zoom
 * @returns {{ px: number, py: number }}
 */
export function lonLatToPixel(lon, lat, zoom) {
  const worldSize = TILE_SIZE * 2 ** zoom
  const latRad = (clampLat(lat) * Math.PI) / 180
  return {
    px: ((lon + 180) / 360) * worldSize,
    py: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * worldSize,
  }
}

/**
 * 經緯度轉圖磚座標
 * @param {number} lon
 * @param {number} lat
 * @param {number} zoom
 * @returns {{ x: number, y: number, z: number }}
 */
export function lonLatToTile(lon, lat, zoom) {
  const n = 2 ** zoom
  const { px, py } = lonLatToPixel(lon, lat, zoom)
  return {
    x: Math.min(Math.max(Math.floor(px / TILE_SIZE), 0), n - 1),
    y: Math.min(Math.max(Math.floor(py / TILE_SIZE), 0), n - 1),
    z: zoom,
  }
}

/**
 * 全域像素 y 座標轉緯度
 * @param {number} py
 * @param {number} zoom
 * @returns {number}
 */
export function pixelYToLat(py, zoom) {
  const worldSize = TILE_SIZE * 2 ** zoom
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / worldSize))) * 180) / Math.PI
}

/**
 * 指定緯度與縮放層級下，一個像素代表的地面距離（公尺）
 * @param {number} lat
 * @param {number} zoom
 * @returns {number}
 */
export function metersPerPixel(lat, zoom) {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom)
}
