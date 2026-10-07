import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, MeshStandardMaterial, Object3D } from 'three'
import { buildRailGeometry, railPostPositions } from '../course/geometry'
import { COLORS, HEIGHTS } from './sceneConfig'

// 實際尺寸（公尺），不受高度誇張倍率影響
const RAIL = {
  halfWidth: 0.06, // 橫桿斷面約 12cm
  postSpacing: 2.5,
  postWidth: 0.09,
}

// 所有欄杆共用的幾何與材質（場景存在期間不釋放）
const POST_GEOMETRY = new BoxGeometry(RAIL.postWidth, HEIGHTS.rail, RAIL.postWidth)
const RAIL_MATERIAL = new MeshStandardMaterial({ color: COLORS.rail, roughness: 0.45 })
const placer = new Object3D()

/**
 * 立體護欄：沿 path 的白色橫桿＋每 2.5m 一根欄柱。
 * @param {{ path: Array<{x:number, y:number, z:number}>, closed: boolean }} props path 的 y 為橫桿高度（路面 + HEIGHTS.rail）
 */
export default function RailFence({ path, closed }) {
  const railGeometry = useMemo(() => buildRailGeometry(path, closed, RAIL.halfWidth), [path, closed])
  useEffect(() => () => railGeometry.dispose(), [railGeometry])

  const posts = useMemo(() => railPostPositions(path, closed, RAIL.postSpacing), [path, closed])
  const postsRef = useRef(null)

  // 欄柱從路面立到橫桿：中心在橫桿高度往下半根
  useLayoutEffect(() => {
    const mesh = postsRef.current
    posts.forEach(({ x, y, z }, k) => {
      placer.position.set(x, y - HEIGHTS.rail / 2, z)
      placer.updateMatrix()
      mesh.setMatrixAt(k, placer.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [posts])

  return (
    <group>
      {/* 不投影：陰影貼圖每像素約 34cm，12cm 的橫桿會變成一排方塊狀黑影 */}
      <mesh geometry={railGeometry} material={RAIL_MATERIAL} />
      {/* 欄柱數量隨長度改變時要重建 InstancedMesh */}
      <instancedMesh key={posts.length} ref={postsRef} args={[POST_GEOMETRY, RAIL_MATERIAL, posts.length]} />
    </group>
  )
}
