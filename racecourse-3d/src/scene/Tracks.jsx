import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei'
import { DoubleSide } from 'three'
import { STEEPLE, TURF } from '../course/courseData'
import { LAYOUT } from '../course/courseModel'
import { buildBandGeometry, offsetPoint } from '../course/geometry'
import { COLORS, HEIGHTS, turfSurfaceY } from './sceneConfig'

const STEEPLE_SCALE = STEEPLE.elevationRange / TURF.elevationRange

function Band({ model, inner, outer, top, base, color, closed = true, points, normals, layer = 0 }) {
  const geometry = useMemo(
    () =>
      buildBandGeometry({
        points: points ?? model.points,
        normals: normals ?? model.normals,
        closed,
        inner,
        outer,
        top,
        base,
      }),
    [model, inner, outer, top, base, closed, points, normals],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} receiveShadow>
      {/* 引込線點列與本線方向相反，三角形繞向也相反；雙面渲染避免頂面被剔除 */}
      <meshStandardMaterial
        color={color}
        roughness={0.95}
        side={DoubleSide}
        polygonOffset
        polygonOffsetFactor={layer}
        polygonOffsetUnits={layer}
      />
    </mesh>
  )
}

function Rail({ model, d, top }) {
  const points = useMemo(() => {
    const line = model.points.map((p, i) => {
      const q = offsetPoint(p, model.normals[i], typeof d === 'function' ? d(i) : d)
      return [q.x, top(i) + HEIGHTS.rail, q.z]
    })
    return [...line, line[0]]
  }, [model, d, top])
  return <Line points={points} color={COLORS.rail} lineWidth={1.5} />
}

/** 芝、ダート、障害三條跑道與引込線，以及內外欄 */
export default function Tracks({ model, railShift, exaggeration, base }) {
  const tops = useMemo(
    () => ({
      turf: (i) => turfSurfaceY(model, i, exaggeration),
      dirt: (i) => model.dirtElevation(i) * exaggeration + HEIGHTS.dirtLift,
      steeple: (i) => model.turfElevation(i) * STEEPLE_SCALE * exaggeration + HEIGHTS.turfLift,
    }),
    [model, exaggeration],
  )
  const edges = useMemo(
    () => ({
      turfInner: () => LAYOUT.turfRail,
      dirtInner: () => LAYOUT.dirtRail,
      dirtOuter: () => LAYOUT.dirtOuter,
      steepleInner: () => LAYOUT.steepleRail,
      steepleOuter: () => LAYOUT.steepleOuter,
    }),
    [],
  )

  return (
    <group>
      <Band model={model} inner={edges.turfInner} outer={model.turfOuter} top={tops.turf} base={base} color={COLORS.turf} />
      <Band model={model} inner={edges.dirtInner} outer={edges.dirtOuter} top={tops.dirt} base={base} color={COLORS.dirt} />
      <Band
        model={model}
        inner={edges.steepleInner}
        outer={edges.steepleOuter}
        top={tops.steeple}
        base={base}
        color={COLORS.steeple}
      />
      {model.chuteBands.map((band, k) => (
        <ChuteBand key={k} band={band} layer={k + 1} exaggeration={exaggeration} base={base} />
      ))}

      <Rail model={model} d={LAYOUT.turfRail - railShift} top={tops.turf} />
      <Rail model={model} d={model.turfOuter} top={tops.turf} />
      <Rail model={model} d={LAYOUT.dirtRail} top={tops.dirt} />
      <Rail model={model} d={LAYOUT.dirtOuter} top={tops.dirt} />
    </group>
  )
}

/** 引込線（ポケット／斜向支線），layer 越大越往後畫，避免與本線或彼此重疊處閃爍 */
function ChuteBand({ band, layer, exaggeration, base }) {
  const fns = useMemo(
    () => ({
      inner: () => band.inner,
      outer: () => band.outer,
      top: (k) => band.elevations[k] * exaggeration + HEIGHTS.turfLift,
    }),
    [band, exaggeration],
  )
  return (
    <Band
      closed={false}
      points={band.points}
      normals={band.normals}
      inner={fns.inner}
      outer={fns.outer}
      top={fns.top}
      base={base}
      layer={layer}
      color={COLORS.turfChute}
    />
  )
}
