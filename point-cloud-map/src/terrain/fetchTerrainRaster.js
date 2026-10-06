import { tilesForRaster } from './area'
import { terrariumTileUrl } from './terrarium'

async function fetchTileBitmap(tile, signal) {
  const response = await fetch(terrariumTileUrl(tile), { signal })
  if (!response.ok) {
    throw new Error(`圖磚 ${tile.z}/${tile.x}/${tile.y} 下載失敗（HTTP ${response.status}）`)
  }
  // 關閉色彩轉換與預乘 alpha，避免 RGB 編碼的高程值被改動
  return createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  })
}

/**
 * 平行下載範圍內的 Terrarium 圖磚，拼接並裁切成單一 RGBA 像素陣列
 * @param {import('./area').RasterRequest} request
 * @param {AbortSignal} [signal]
 * @returns {Promise<Uint8ClampedArray>} 長度為 width * height * 4
 */
export async function fetchTerrainRaster(request, signal) {
  const canvas = document.createElement('canvas')
  canvas.width = request.width
  canvas.height = request.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  await Promise.all(
    tilesForRaster(request).map(async (tile) => {
      const bitmap = await fetchTileBitmap(tile, signal)
      try {
        ctx.drawImage(bitmap, tile.offsetX, tile.offsetY)
      } finally {
        bitmap.close()
      }
    }),
  )

  return ctx.getImageData(0, 0, request.width, request.height).data
}
