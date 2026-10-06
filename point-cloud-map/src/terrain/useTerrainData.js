import { useMemo } from 'react'
import { baseSamplingFor, rasterRequestFor, tilesForRaster } from './area'
import { autoExaggeration, maxPointHeight, scaleHeights } from './exaggeration'
import { generateHeightMapData } from './simulatedTerrain'
import { buildTerrainGrid } from './terrarium'
import { useTerrainRaster } from './useTerrainRaster'

// 場景中地形長邊的長度（模擬資料為 60×60 格、格距 1）
const SCENE_EXTENT = 60

function useSimulatedTerrain(isEnabled, isCircular, sampling) {
  return useMemo(() => {
    if (!isEnabled) return null
    return {
      points: generateHeightMapData(SCENE_EXTENT, SCENE_EXTENT, isCircular, sampling),
      cols: SCENE_EXTENT,
      rows: SCENE_EXTENT,
      spacing: 1,
    }
  }, [isEnabled, isCircular, sampling])
}

// 真實地形一律先以 1 倍（真實比例）計算；調整倍率時只需縮放高度，不必重新掃描像素
function useTrueScaleTerrain(pixels, area, request, isCircular, sampling) {
  return useMemo(() => {
    if (!pixels) return null
    const pixelSampling = baseSamplingFor(area, request) * sampling
    const cols = Math.ceil(request.width / pixelSampling)
    const rows = Math.ceil(request.height / pixelSampling)
    const spacing = SCENE_EXTENT / Math.max(cols, rows)
    const grid = buildTerrainGrid(pixels, {
      ...request,
      sampling: pixelSampling,
      isCircular,
      hideSea: area.type === 'region',
      cellSize: spacing,
    })
    return { ...grid, spacing, autoExaggeration: autoExaggeration(maxPointHeight(grid.points), SCENE_EXTENT) }
  }, [pixels, area, request, isCircular, sampling])
}

/**
 * 依資料來源產生 TerrainMap 所需的格點資料
 * @param {{
 *   source: 'simulated' | 'terrarium',
 *   area: import('./area').Area,
 *   isCircular: boolean,
 *   sampling: number,
 *   isAutoExaggeration: boolean,
 *   manualExaggeration: number,
 * }} params
 */
export function useTerrainData({ source, area, isCircular, sampling, isAutoExaggeration, manualExaggeration }) {
  const isReal = source === 'terrarium'
  const request = useMemo(() => (isReal ? rasterRequestFor(area) : null), [isReal, area])
  const raster = useTerrainRaster(request)
  const simulated = useSimulatedTerrain(!isReal, isCircular, sampling)
  const trueScale = useTrueScaleTerrain(isReal ? raster.pixels : null, area, request, isCircular, sampling)

  const exaggeration = trueScale && isAutoExaggeration ? trueScale.autoExaggeration : manualExaggeration

  const terrain = useMemo(() => {
    if (!isReal) return simulated
    if (!trueScale) return null
    return { ...trueScale, points: scaleHeights(trueScale.points, exaggeration) }
  }, [isReal, simulated, trueScale, exaggeration])

  const summary = isReal && trueScale
    ? {
        minElevation: trueScale.minElevation,
        maxElevation: trueScale.maxElevation,
        baseElevation: trueScale.baseElevation,
        pointCount: trueScale.points.length,
        zoom: request.zoom,
        tileCount: tilesForRaster(request).length,
        exaggeration,
      }
    : null

  const terrainKey = [source, JSON.stringify(area), isCircular, sampling, exaggeration].join('|')
  return { terrain, terrainKey, status: raster.status, error: raster.error, summary }
}
