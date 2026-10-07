import { Vector3 } from 'three'

const WORLD_UP = new Vector3(0, 1, 0)

/**
 * 把點對齊到陰影貼圖的像素格（在光源座標的兩個橫向軸上取整數格，沿光線方向不動）。
 * 陰影範圍跟著跑者移動時若不對齊，邊緣會每幀落在不同像素上而閃爍；對齊後只會整格跳動。
 * @param {Vector3} point 世界座標
 * @param {Vector3} lightDirection 指向光源的單位向量
 * @param {number} texel 陰影貼圖一個像素在世界中的寬度（公尺）
 * @returns {Vector3} 新的向量，不修改輸入
 */
export function snapToShadowTexel(point, lightDirection, texel) {
  const right = new Vector3().crossVectors(WORLD_UP, lightDirection).normalize()
  const up = new Vector3().crossVectors(lightDirection, right)
  const snap = (value) => Math.round(value / texel) * texel
  return right
    .clone()
    .multiplyScalar(snap(point.dot(right)))
    .addScaledVector(up, snap(point.dot(up)))
    .addScaledVector(lightDirection, point.dot(lightDirection))
}
