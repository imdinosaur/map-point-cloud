import * as THREE from 'three'

/** 鞋帶公式；在 (x, z) 視為數學座標 (x, y) 時，逆時針為正 */
export function signedArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.z - b.x * a.z
  }
  return sum / 2
}

export function polylineLength(points, closed) {
  const segments = closed ? points.length : points.length - 1
  let length = 0
  for (let i = 0; i < segments; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    length += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return length
}

/** 沿線累積距離；封閉時多一筆回到起點的總長 */
export function cumulativeLengths(points, closed) {
  const result = [0]
  const segments = closed ? points.length : points.length - 1
  for (let i = 0; i < segments; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    result.push(result[i] + Math.hypot(b.x - a.x, b.z - a.z))
  }
  return result
}

/** 封閉曲線左法向量要乘上的符號，使結果指向內側 */
export const inwardSignOf = (loop) => (signedArea(loop) < 0 ? -1 : 1)

/**
 * 每點的單位法向量（左法向量 × sign）。
 * 封閉曲線預設指向內側（d > 0 即往內偏移）；開放折線可傳入 sign 以沿用所屬環線的內側方向。
 */
export function computeNormals(points, closed, sign) {
  const n = points.length
  const inwardSign = sign ?? (closed ? inwardSignOf(points) : 1)
  return points.map((_, i) => {
    const prev = points[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)]
    const next = points[closed ? (i + 1) % n : Math.min(i + 1, n - 1)]
    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.hypot(tx, tz) || 1
    return { x: (-tz / len) * inwardSign, z: (tx / len) * inwardSign }
  })
}

export function offsetPoint(point, normal, d) {
  return { x: point.x + normal.x * d, z: point.z + normal.z * d }
}

export function offsetLine(points, normals, d) {
  return points.map((p, i) => offsetPoint(p, normals[i], d))
}

const ARC_STEP = 2 // 圓角取樣間距（m）

/**
 * 把開放折線的轉角改成圓弧（切線長不超過相鄰邊的一半）。
 * @param {Array<{x:number,z:number}>} corners
 * @param {number | number[]} radius 單一半徑，或依序對應每個轉角的半徑
 */
export function roundCorners(corners, radius) {
  const radiusAt = (k) => (Array.isArray(radius) ? radius[k - 1] : radius)
  const result = [corners[0]]
  for (let k = 1; k < corners.length - 1; k++) {
    const [prev, at, next] = [corners[k - 1], corners[k], corners[k + 1]]
    const inLen = Math.hypot(at.x - prev.x, at.z - prev.z)
    const outLen = Math.hypot(next.x - at.x, next.z - at.z)
    const u = { x: (at.x - prev.x) / inLen, z: (at.z - prev.z) / inLen }
    const v = { x: (next.x - at.x) / outLen, z: (next.z - at.z) / outLen }
    const turn = Math.acos(Math.min(Math.max(u.x * v.x + u.z * v.z, -1), 1))
    if (turn < 1e-6) {
      result.push(at)
      continue
    }
    const tangent = Math.min(radiusAt(k) * Math.tan(turn / 2), inLen / 2, outLen / 2)
    const p0 = { x: at.x - u.x * tangent, z: at.z - u.z * tangent }
    const p2 = { x: at.x + v.x * tangent, z: at.z + v.z * tangent }
    // 二次 Bézier 以轉角為控制點，近似圓弧且兩端切線連續
    const steps = Math.max(2, Math.ceil((tangent * 2) / ARC_STEP))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const a = (1 - t) * (1 - t)
      const b = 2 * (1 - t) * t
      const c = t * t
      result.push({ x: a * p0.x + b * at.x + c * p2.x, z: a * p0.z + b * at.z + c * p2.z })
    }
  }
  result.push(corners[corners.length - 1])
  return result
}

/**
 * 以描點建立閉合中心線，等弧長取樣並縮放到 targetLength 公尺、以質心為原點。
 * @returns {{ points, normals, toWorld }} toWorld 可把其他描點（如引込線）轉到同一座標系
 */
export function buildCenterline(trace, targetLength, sampleCount) {
  const curve = new THREE.CatmullRomCurve3(
    trace.map(([x, y]) => new THREE.Vector3(x, 0, y)),
    true,
    'centripetal',
  )
  curve.arcLengthDivisions = sampleCount * 4
  const raw = curve.getSpacedPoints(sampleCount).slice(0, sampleCount)
  const rawPoints = raw.map((p) => ({ x: p.x, z: p.z }))
  const scale = targetLength / polylineLength(rawPoints, true)
  const cx = rawPoints.reduce((s, p) => s + p.x, 0) / sampleCount
  const cz = rawPoints.reduce((s, p) => s + p.z, 0) / sampleCount

  const toWorld = ([x, y]) => ({ x: (x - cx) * scale, z: (y - cz) * scale })
  const points = rawPoints.map((p) => toWorld([p.x, p.z]))
  return { points, normals: computeNormals(points, true), toWorld }
}

/**
 * 沿中心線擠出帶狀實體（頂面＋兩側牆，開放時加端蓋），牆面向下延伸到 base。
 * inner / outer / top 皆為 (index) => number；inner、outer 為沿法向量的偏移量。
 */
export function buildBandGeometry({ points, normals, closed, inner, outer, top, base }) {
  const n = points.length
  const segments = closed ? n : n - 1
  const positions = []
  const indices = []

  const at = (i, d, y) => {
    const p = offsetPoint(points[i], normals[i], d)
    return [p.x, y, p.z]
  }
  const pushVertex = (v) => {
    positions.push(...v)
    return positions.length / 3 - 1
  }
  const strip = (edgeA, edgeB) => {
    const start = positions.length / 3
    for (let i = 0; i < n; i++) {
      pushVertex(edgeA(i))
      pushVertex(edgeB(i))
    }
    for (let s = 0; s < segments; s++) {
      const a = start + 2 * s
      const b = start + 2 * ((s + 1) % n)
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const innerTop = (i) => at(i, inner(i), top(i))
  const outerTop = (i) => at(i, outer(i), top(i))
  const innerBase = (i) => at(i, inner(i), base)
  const outerBase = (i) => at(i, outer(i), base)

  strip(innerTop, outerTop)
  strip(innerBase, innerTop)
  strip(outerTop, outerBase)

  if (!closed) {
    for (const i of [0, n - 1]) {
      const [a, b, c, d] = [innerTop(i), outerTop(i), outerBase(i), innerBase(i)].map(pushVertex)
      indices.push(a, b, c, a, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** 沿開放折線取前 length 公尺（超過全長則原樣返回） */
export function truncatePolyline(points, length) {
  const result = [points[0]]
  let covered = 0
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]
    const b = points[k]
    const segment = Math.hypot(b.x - a.x, b.z - a.z)
    if (covered + segment >= length) {
      const t = (length - covered) / segment
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      return result
    }
    covered += segment
    result.push(b)
  }
  return result
}

/** 點是否在封閉環線內（射線法） */
export function pointInRing({ x, z }, ring) {
  let inside = false
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length]
    if (a.z > z !== b.z > z && x < a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z)) inside = !inside
  })
  return inside
}

function distanceToRing({ x, z }, ring) {
  let best = Infinity
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length]
    const ex = b.x - a.x
    const ez = b.z - a.z
    const len2 = ex * ex + ez * ez || 1
    const t = Math.min(Math.max(((x - a.x) * ex + (z - a.z) * ez) / len2, 0), 1)
    best = Math.min(best, Math.hypot(x - (a.x + ex * t), z - (a.z + ez * t)))
  })
  return best
}

/** 多邊形內部的規則格點（離各邊至少半格），作為三角化的內部頂點，讓頂面能細緻地跟著 topAt 起伏 */
function interiorGrid([contour, ...holes], step) {
  const xs = contour.map((p) => p.x)
  const zs = contour.map((p) => p.z)
  const result = []
  for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
    for (let z = Math.min(...zs) + step / 2; z < Math.max(...zs); z += step) {
      const p = { x, z }
      if (!pointInRing(p, contour) || holes.some((hole) => pointInRing(p, hole))) continue
      if ([contour, ...holes].every((ring) => distanceToRing(p, ring) > step / 2)) result.push(p)
    }
  }
  return result
}

/**
 * 平面多邊形（可含洞）擠出成實體：頂面依 topAt(x, z) 決定高度，外框與洞的邊牆向下延伸到 base。
 * gridStep > 0 時於內部加入格點（earcut 以單點洞作為內部頂點），避免大三角形把高度拉成平面而與其他物件交錯。
 * @param {Array<Array<Array<{x:number,z:number}>>>} polygons 每個多邊形為 [外框, ...洞]，環線不重複首點
 */
export function buildSlabGeometry(polygons, topAt, base, gridStep = 0) {
  const positions = []
  const indices = []
  const pushVertex = (x, y, z) => {
    positions.push(x, y, z)
    return positions.length / 3 - 1
  }

  for (const polygon of polygons) {
    const [contour, ...holes] = polygon
    const steiner = gridStep > 0 ? interiorGrid(polygon, gridStep).map((p) => [p]) : []
    const start = positions.length / 3
    ;[contour, ...holes, ...steiner].flat().forEach((p) => pushVertex(p.x, topAt(p.x, p.z), p.z))
    const toVec2 = (ring) => ring.map((p) => new THREE.Vector2(p.x, p.z))
    THREE.ShapeUtils.triangulateShape(toVec2(contour), [...holes, ...steiner].map(toVec2)).forEach(([a, b, c]) =>
      indices.push(start + a, start + b, start + c),
    )

    for (const ring of [contour, ...holes]) {
      ring.forEach((p, k) => {
        const q = ring[(k + 1) % ring.length]
        const a = pushVertex(p.x, topAt(p.x, p.z), p.z)
        const b = pushVertex(q.x, topAt(q.x, q.z), q.z)
        const c = pushVertex(q.x, base, q.z)
        const d = pushVertex(p.x, base, p.z)
        indices.push(a, d, b, b, d, c)
      })
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** 封閉環線等距重新取樣（每段切成不超過 step 公尺），讓沿線高度能逐點計算 */
export function resampleRing(ring, step) {
  return ring.flatMap((a, k) => {
    const b = ring[(k + 1) % ring.length]
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step))
    return Array.from({ length: count }, (_, s) => ({
      x: a.x + ((b.x - a.x) * s) / count,
      z: a.z + ((b.z - a.z) * s) / count,
    }))
  })
}

/** 從 origin 沿單位向量 dir 射出，與封閉環線最近交點的距離；沒有交點時為 Infinity */
export function rayDistanceToRing(origin, dir, ring) {
  let nearest = Infinity
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length]
    const ex = b.x - a.x
    const ez = b.z - a.z
    const denom = dir.x * ez - dir.z * ex
    if (Math.abs(denom) < 1e-12) return
    const wx = a.x - origin.x
    const wz = a.z - origin.z
    const t = (wx * ez - wz * ex) / denom
    const s = (wx * dir.z - wz * dir.x) / denom
    if (t > 0 && s >= 0 && s <= 1) nearest = Math.min(nearest, t)
  })
  return nearest
}
