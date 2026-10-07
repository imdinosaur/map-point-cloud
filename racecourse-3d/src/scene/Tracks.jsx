import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei'
import { STEEPLE, TURF } from '../course/courseData'
import { LAYOUT } from '../course/courseModel'
import { buildBandGeometry, offsetPoint } from '../course/geometry'
import RailFence from './RailFence'
import { COLORS, HEIGHTS, turfSurfaceY } from './sceneConfig'

const STEEPLE_SCALE = STEEPLE.elevationRange / TURF.elevationRange
const CHUTE_WIDTH = 25 // 出發引込線的芝寬度（m）
// 引込線芝面略低於本線芝面：匯入處兩者重疊，條紋方向不同，同高會互相閃爍，讓本線蓋在上面
const CHUTE_BELOW_TURF = 0.015

function Band({ model, inner, outer, top, base, material, wallMaterial, closed = true, points, normals }) {
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
    // 材質群組：0 = 頂面、1 = 側牆。材質為雙面（引込線點列方向相反，三角形繞向也相反）
    <mesh geometry={geometry} material={[material, wallMaterial]} receiveShadow />
  )
}

/**
 * 護欄：俯瞰時欄杆只有幾個像素，畫成細線；近距離視角（detailed）才畫立體欄杆。
 * @param {{ path: Array<{x:number, y:number, z:number}>, detailed: boolean }} props 封閉環線，y 為欄杆頂
 */
function Fence({ path, detailed }) {
  const linePoints = useMemo(() => [...path, path[0]].map(({ x, y, z }) => [x, y, z]), [path])
  return detailed ? <RailFence path={path} closed /> : <Line points={linePoints} color={COLORS.rail} lineWidth={1.5} />
}

function Rail({ model, d, top, detailed }) {
  const path = useMemo(
    () =>
      model.points.map((p, i) => {
        const q = offsetPoint(p, model.normals[i], typeof d === 'function' ? d(i) : d)
        return { x: q.x, y: top(i) + HEIGHTS.rail, z: q.z }
      }),
    [model, d, top],
  )
  return <Fence path={path} detailed={detailed} />
}

/**
 * 1,800m、2,000m 出發引込線的芝面：沿引込線由內欄往外鋪 CHUTE_WIDTH 寬，高度與場地草地相同（跑者在引込線上也用這個高度）。
 */
function ChuteTurf({ model, exaggeration, base, materials }) {
  return model.chuteBranches.map(({ points, normals }, k) => (
    <ChuteBand key={k} model={model} points={points} normals={normals} exaggeration={exaggeration} base={base} materials={materials} />
  ))
}

function ChuteBand({ model, points, normals, exaggeration, base, materials }) {
  const top = useMemo(() => {
    const heights = points.map((p) => model.venueElevationAt(p.x, p.z) * exaggeration + HEIGHTS.turfLift - CHUTE_BELOW_TURF)
    return (i) => heights[i]
  }, [model, points, exaggeration])
  return (
    <Band
      model={model}
      points={points}
      normals={normals}
      closed={false}
      inner={chuteInner}
      outer={chuteOuter}
      top={top}
      base={base}
      material={materials.turf}
      wallMaterial={materials.wall}
    />
  )
}

const chuteInner = () => LAYOUT.turfRail
const chuteOuter = () => LAYOUT.turfRail - CHUTE_WIDTH

/** 場地外框與空白三角地的邊線（取代舊的芝外欄，涵蓋各ポケット與走道） */
function VenueEdges({ model, exaggeration, detailed }) {
  const paths = useMemo(
    () =>
      model.venueEdges.map((ring) =>
        ring.map((p) => ({ x: p.x, y: model.venueElevationAt(p.x, p.z) * exaggeration + HEIGHTS.turfLift + HEIGHTS.rail, z: p.z })),
      ),
    [model, exaggeration],
  )
  return paths.map((path, k) => <Fence key={k} path={path} detailed={detailed} />)
}

/** 芝、ダート、障害三條跑道與引込線，以及各邊線 */
export default function Tracks({ model, railShift, exaggeration, base, materials, detailedRails }) {
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
      <Band model={model} inner={edges.turfInner} outer={model.turfOuter} top={tops.turf} base={base} material={materials.turf} wallMaterial={materials.wall} />
      <Band model={model} inner={edges.dirtInner} outer={edges.dirtOuter} top={tops.dirt} base={base} material={materials.dirt} wallMaterial={materials.wall} />
      <Band
        model={model}
        inner={edges.steepleInner}
        outer={edges.steepleOuter}
        top={tops.steeple}
        base={base}
        material={materials.steeple}
        wallMaterial={materials.wall}
      />

      <ChuteTurf model={model} exaggeration={exaggeration} base={base} materials={materials} />

      <Rail model={model} d={LAYOUT.turfRail - railShift} top={tops.turf} detailed={detailedRails} />
      <Rail model={model} d={LAYOUT.dirtRail} top={tops.dirt} detailed={detailedRails} />
      <Rail model={model} d={LAYOUT.dirtOuter} top={tops.dirt} detailed={detailedRails} />
      <Rail model={model} d={LAYOUT.steepleRail} top={tops.steeple} detailed={detailedRails} />
      <Rail model={model} d={LAYOUT.steepleOuter} top={tops.steeple} detailed={detailedRails} />
      <VenueEdges model={model} exaggeration={exaggeration} detailed={detailedRails} />
    </group>
  )
}

