import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import { buildSlabGeometry } from '../course/geometry'
import { COLORS, HEIGHTS } from './sceneConfig'

const GRID_STEP = 8 // 草地內部格點間距（m）
const BELOW_TURF = 0.03 // 略低於芝面：與芝重疊的窄帶由芝蓋住，又不會露出芝的側牆

/** 依平面圖外框補齊的場地草地（含各引込線、角落、走道），本線跑道另外畫在上方 */
export default function Venue({ model, exaggeration, base }) {
  const geometry = useMemo(
    () =>
      buildSlabGeometry(
        model.venue,
        (x, z) => model.venueElevationAt(x, z) * exaggeration + HEIGHTS.turfLift - BELOW_TURF,
        base,
        GRID_STEP,
      ),
    [model, exaggeration, base],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={COLORS.turf}
        roughness={1}
        side={DoubleSide}
      />
    </mesh>
  )
}
