import { pointAlong } from '../course/racePath'
import { surfaceY } from './sceneConfig'

/** 跑法上已跑 traveled 公尺處的場景座標與實際高度（Runner 與騎手視角共用） */
export function runPositionAt(run, traveled, exaggeration) {
  const { x, z, index, t } = pointAlong(run.path, traveled)
  const { elevations } = run
  const elevation = elevations[index] + (elevations[index + 1] - elevations[index]) * t
  return { x, y: surfaceY(run.surface, elevation, exaggeration), z, elevation }
}
