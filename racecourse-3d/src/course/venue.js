import polygonClipping from 'polygon-clipping'

const toPair = (p) => [p.x, p.z]
const closeRing = (ring) => [...ring.map(toPair), toPair(ring[0])]

/**
 * 場地中跑道以外的草地：平面圖外框 − 本線（芝外緣往內 overlap 公尺，讓邊緣藏在芝面下）− 空白三角地。
 * @param {{ outline: Array<{x,z}>, gaps: Array<Array<{x,z}>>, ovalOuter: Array<{x,z}> }} shapes 皆為世界座標
 * @returns {Array<Array<Array<{x:number,z:number}>>>} 多個多邊形，每個為 [外框, ...洞]，環線不重複首點
 */
export function buildVenuePolygons({ outline, gaps, ovalOuter }) {
  const result = polygonClipping.difference(
    [closeRing(outline)],
    [closeRing(ovalOuter)],
    ...gaps.map((gap) => [closeRing(gap)]),
  )
  return result.map((polygon) => polygon.map((ring) => ring.slice(0, -1).map(([x, z]) => ({ x, z }))))
}
