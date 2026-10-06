import { useEffect, useState } from 'react'
import { fetchTerrainRaster } from './fetchTerrainRaster'

const IDLE = { status: 'idle', pixels: null, error: null }
const LOADING = { status: 'loading', pixels: null, error: null }

const requestKey = (r) => (r ? `${r.zoom}/${r.left}/${r.top}/${r.width}x${r.height}` : null)

/**
 * 載入指定像素範圍的地形；request 為 null 時不載入
 * @param {import('./area').RasterRequest | null} request
 * @returns {{ status: 'idle' | 'loading' | 'success' | 'error', pixels: Uint8ClampedArray | null, error: string | null }}
 */
export function useTerrainRaster(request) {
  const key = requestKey(request)
  // 結果附上對應的 key；key 不符代表新的請求尚未完成，視為 loading
  const [result, setResult] = useState({ key: null, ...IDLE })

  useEffect(() => {
    if (!key) return undefined

    const [zoom, left, top, size] = key.split('/')
    const [width, height] = size.split('x').map(Number)
    const controller = new AbortController()

    fetchTerrainRaster({ zoom: Number(zoom), left: Number(left), top: Number(top), width, height }, controller.signal)
      .then((pixels) => setResult({ key, status: 'success', pixels, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : '未知錯誤'
        setResult({ key, status: 'error', pixels: null, error: message })
      })

    return () => controller.abort()
  }, [key])

  if (!key) return IDLE
  if (result.key !== key) return LOADING
  return { status: result.status, pixels: result.pixels, error: result.error }
}
