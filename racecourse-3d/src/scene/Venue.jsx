import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import { buildSlabGeometry } from '../course/geometry'
import { COLORS, HEIGHTS } from './sceneConfig'

const BELOW_TURF = 0.1 // 草地略低於芝面，交界處以芝為準

/** 依平面圖外框補齊的場地草地（ポケット周邊、角落、走道），跑道本身另外畫在上方 */
export default function Venue({ model, exaggeration, base }) {
  const geometry = useMemo(
    () =>
      buildSlabGeometry(
        model.venue,
        (x, z) => model.venueElevationAt(x, z) * exaggeration + HEIGHTS.turfLift - BELOW_TURF,
        base,
      ),
    [model, exaggeration, base],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={COLORS.venue}
        roughness={1}
        side={DoubleSide}
        polygonOffset
        polygonOffsetFactor={4}
        polygonOffsetUnits={4}
      />
    </mesh>
  )
}
