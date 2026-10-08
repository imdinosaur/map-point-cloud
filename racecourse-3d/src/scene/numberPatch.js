import { SphereGeometry } from 'three'

const LIFT = 1.006 // 比球面略大一點，避免與球面互相閃爍
const SEGMENTS = 12

/**
 * 貼在球面正前方（+Z）的曲面小片，用來印背號：整張貼圖剛好鋪滿這一片，且從前方看是正的、不左右顛倒。
 * SphereGeometry 的 u 隨經度 phi、v 隨緯度 theta 變化；以 phi = theta = π/2（+Z 方向）為中心取一塊。
 * @param {number} radius 球的半徑
 * @param {number} span 這一片在經、緯方向各涵蓋的角度（弧度）
 */
export function numberPatchGeometry(radius, span) {
  const start = Math.PI / 2 - span / 2
  return new SphereGeometry(radius * LIFT, SEGMENTS, SEGMENTS, start, span, start, span)
}
