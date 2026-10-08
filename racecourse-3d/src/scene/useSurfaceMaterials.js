import { useEffect, useMemo } from 'react'
import { createSurfaceMaterials } from './surfaceMaterials'

/** 建立一次路面材質，元件卸載時釋放；貼圖下載失敗時保留純色並記錄警告 */
export function useSurfaceMaterials() {
  const surfaces = useMemo(() => createSurfaceMaterials(), [])
  useEffect(() => {
    surfaces.ready.catch((error) => console.warn('路面貼圖載入失敗，改用純色：', error))
    return () => surfaces.dispose()
  }, [surfaces])
  return surfaces.materials
}
