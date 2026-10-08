import { pointAlong } from '../course/racePath'
import { surfaceY } from './sceneConfig'

/**
 * 跑法上已跑 traveled 公尺、往外 lateral 公尺處的場景座標與實際高度（各跑者、跟隨鏡頭、太陽共用）。
 * 高度沿用路線上的高度：同一斷面的橫向高低差很小，忽略不計。
 */
export function runPositionAt(run, traveled, exaggeration, lateral = 0) {
  const { x, z, index, t } = pointAlong(run.path, traveled)
  const { elevations, outward } = run
  const elevation = elevations[index] + (elevations[index + 1] - elevations[index]) * t
  const a = outward[index]
  const b = outward[index + 1] ?? a
  const nx = a.x + (b.x - a.x) * t
  const nz = a.z + (b.z - a.z) * t
  return { x: x + nx * lateral, y: surfaceY(run.surface, elevation, exaggeration), z: z + nz * lateral, elevation }
}
