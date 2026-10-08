import { FIELD, coastAfterFinish, createRandom, pickStopAfter, stallLateral } from './field'
import { wakuOf } from './startingGate'

// レース再現：由 JRA 公布的成績還原每頭馬在每個時間點的位置。
// 確定的資料點：出閘（0 秒、0m）、各馬「走破タイム − 上がり 3F」時位於剩 600m、走破タイム時位於終點。
// 絕對位置以各馬自己的時間為準：每頭馬的道中配速沿用先頭馬ハロンタイム的形狀，並縮放到剛好在自己的時刻通過剩 600m。
// コーナー通過順位只用來微調相對位置：「=」（5 馬身以上）沒有上限，無法換成絕對距離，
// 所以把每條順位依「=」切成數群，各群以群內平均對齊配速曲線後，只取群內的前後差做修正（並設上限）。
// 控制點之間以單調三次插值補出平滑、不後退的距離曲線。橫向位置由括號內的內外順序推得。

const METERS_PER_LENGTH = 2.4 // 1 馬身
const SECONDS_PER_LENGTH = METERS_PER_LENGTH / 17 // 終點附近 1 馬身約 0.14 秒
const LAST_3F = 600
const MAX_CORNER_CORRECTION = 8 // コーナー順位對配速曲線的修正上限（m），避免速度忽快忽慢
const PACE_SAMPLE = 10 // 道中配速曲線每隔幾秒取一個控制點
const SPEED_SAMPLE = 0.1 // 以前後多少秒的距離差估速度
const STOP_SEED = 20231126 // 過終點後的停止距離：每頭馬不同，但每次重播都一樣

// コーナー通過順位的間隔記號（JRA 定義），換算成馬身取區間中間值
const GAP = {
  adjacent: 0.7, // 記號之間無符號：1 馬身未滿
  ',': 1.5, // 1 馬身以上 2 馬身未滿
  '-': 3.5, // 2 馬身以上 5 馬身未滿
  '=': 5, // 5 馬身以上：沒有上限，群與群之間只保證至少這個距離
}

const MARGIN_WORDS = { 同着: 0, ハナ: 0.05, アタマ: 0.1, クビ: 0.25, 大: 10 }

/** '2:21.8' → 141.8 秒 */
export function parseTime(text) {
  const [minutes, seconds] = text.includes(':') ? text.split(':') : ['0', text]
  return Number(minutes) * 60 + Number(seconds)
}

/** JRA 着差 → 馬身（'1.1/2' = 1 又 1/2） */
export function parseMargin(text) {
  if (!text) return 0
  if (text in MARGIN_WORDS) return MARGIN_WORDS[text]
  if (!text.includes('/')) return Number(text)
  const [whole, fraction] = text.includes('.') ? text.split('.') : ['0', text]
  const [numerator, denominator] = fraction.split('/').map(Number)
  return Number(whole) + numerator / denominator
}

/**
 * 解析一條コーナー通過順位。
 * @returns {Array<{ number: number, behind: number, lane: number, cluster: number }>}
 *   behind：距先頭幾馬身；lane：並走群中由內往外第幾頭；cluster：以「=」分隔的第幾群
 */
export function parseCornerOrder(text) {
  const entries = []
  const tokens = text.match(/\d+|[()=,-]/g) ?? []
  let behind = 0
  let pending = null
  let isFirst = true
  let group = null // { behind, lane, cluster }
  let cluster = 0 // 每遇到「=」換一群：群與群之間的距離不可信

  const advance = () => {
    if (pending === GAP['=']) cluster += 1
    behind += isFirst ? 0 : (pending ?? GAP.adjacent)
    isFirst = false
    pending = null
  }

  for (const token of tokens) {
    if (/\d/.test(token)) {
      if (group) {
        entries.push({ number: Number(token), behind: group.behind, lane: group.lane++, cluster: group.cluster })
      } else {
        advance()
        entries.push({ number: Number(token), behind, lane: 0, cluster })
      }
    } else if (token === '(') {
      advance()
      group = { behind, lane: 0, cluster }
    } else if (token === ')') {
      group = null
    } else if (!group) {
      pending = GAP[token]
    }
  }
  return entries
}

/**
 * 由路線的曲率找出各コーナー位置：每段彎道（左回り東京一段彎道含兩個コーナー）取 1/4、3/4 處。
 * @param {(distance: number) => number} curvatureAt
 * @param {number} length
 */
export function findCornerDistances(curvatureAt, length, { step = 5, threshold = 1 / 400, minBend = 60, mergeGap = 40 } = {}) {
  const bends = []
  for (let d = 0; d <= length; d += step) {
    if (curvatureAt(d) <= threshold) continue
    const last = bends.at(-1)
    if (last && d - last.end <= mergeGap) last.end = d
    else bends.push({ start: d, end: d })
  }
  return bends
    .filter(({ start, end }) => end - start >= minBend)
    .flatMap(({ start, end }) => [start + (end - start) * 0.25, start + (end - start) * 0.75])
}

/** 單調三次插值（Fritsch–Carlson）：xs 遞增、ys 不遞減時，結果平滑且不會往回 */
function monotoneCubic(xs, ys) {
  const n = xs.length
  const slopes = xs.slice(0, -1).map((x, k) => (ys[k + 1] - ys[k]) / (xs[k + 1] - x))
  const tangents = xs.map((_, k) => {
    if (k === 0) return slopes[0]
    if (k === n - 1) return slopes[n - 2]
    return slopes[k - 1] * slopes[k] <= 0 ? 0 : (slopes[k - 1] + slopes[k]) / 2
  })
  slopes.forEach((slope, k) => {
    if (slope === 0) {
      tangents[k] = 0
      tangents[k + 1] = 0
      return
    }
    const a = tangents[k] / slope
    const b = tangents[k + 1] / slope
    const h = Math.hypot(a, b)
    if (h > 3) {
      tangents[k] = (3 * a * slope) / h
      tangents[k + 1] = (3 * b * slope) / h
    }
  })
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let k = 0
    while (x > xs[k + 1]) k++
    const h = xs[k + 1] - xs[k]
    const t = (x - xs[k]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * ys[k] +
      (t3 - 2 * t2 + t) * h * tangents[k] +
      (-2 * t3 + 3 * t2) * ys[k + 1] +
      (t3 - t2) * h * tangents[k + 1]
    )
  }
}

/**
 * 先頭馬的配速曲線（ハロンタイム累計，線性內插）。第一段為 length 除以 200 的餘數（或 200m）。
 * @returns {{ timeAt: (distance: number) => number, distanceAt: (time: number) => number }}
 */
function frontProfile(laps, length) {
  const first = length - 200 * (laps.length - 1)
  const distances = [0, ...laps.map((_, k) => first + 200 * k)]
  const times = laps.reduce((acc, lap) => [...acc, acc.at(-1) + lap], [0])
  const lerp = (xs, ys, x) => {
    if (x <= xs[0]) return ys[0]
    for (let k = 1; k < xs.length; k++) {
      if (x <= xs[k]) return ys[k - 1] + ((ys[k] - ys[k - 1]) * (x - xs[k - 1])) / (xs[k] - xs[k - 1])
    }
    return ys.at(-1)
  }
  return { timeAt: (d) => lerp(distances, times, d), distanceAt: (t) => lerp(times, distances, t) }
}

/** 走破タイム只到 0.1 秒，同一秒數依着差拉開，確保到達順序與官方一致 */
function finishTimesOf(horses) {
  const result = {}
  let previous = -Infinity
  for (const { number, time, margin } of horses) {
    const official = parseTime(time)
    const finish = Math.max(official, previous + Math.max(0.01, parseMargin(margin) * SECONDS_PER_LENGTH))
    result[number] = finish
    previous = finish
  }
  return result
}

/**
 * 各コーナー各馬的位置修正（m）：每群（以「=」分隔）以群內平均對齊到配速曲線，只保留群內的前後差。
 * 修正後若某群離前一群不到 5 馬身（違反「=」的定義），整群往後退到剛好 5 馬身。
 * @returns {Map<number, number>[]} 每個コーナー一個 Map：馬番 → 修正量
 */
function cornerCorrections(orders, cornerTimes, basePosition) {
  const clamp = (value) => Math.max(-MAX_CORNER_CORRECTION, Math.min(MAX_CORNER_CORRECTION, value))
  return orders.map((order, c) => {
    const corrections = new Map()
    const clusters = new Map()
    for (const entry of order) clusters.set(entry.cluster, [...(clusters.get(entry.cluster) ?? []), entry])
    let previousTail = Infinity // 前一群最後一頭修正後的位置
    for (const members of clusters.values()) {
      const relative = members.map((entry) => ({
        number: entry.number,
        base: basePosition(entry.number, cornerTimes[c]),
        data: -entry.behind * METERS_PER_LENGTH,
      }))
      const shift = relative.reduce((sum, r) => sum + r.base - r.data, 0) / relative.length
      const deltas = relative.map((r) => clamp(shift + r.data - r.base))
      const positions = relative.map((r, k) => r.base + deltas[k])
      const deficit = Math.max(0, Math.max(...positions) - (previousTail - GAP['='] * METERS_PER_LENGTH))
      relative.forEach((r, k) => corrections.set(r.number, clamp(deltas[k] - deficit)))
      previousTail = Math.min(...relative.map((r) => r.base + corrections.get(r.number)))
    }
    return corrections
  })
}

/** 一頭馬的 (時間, 距離) 控制點：道中配速取樣＋コーナー修正，接上確定的剩 600m 與終點 */
function distanceKnots({ pace, t600, finish, length, cornerKnots }) {
  const knots = [{ t: 0, d: 0 }]
  for (let t = PACE_SAMPLE; t < t600 - PACE_SAMPLE / 2; t += PACE_SAMPLE) knots.push({ t, d: pace(t) })
  knots.push({ t: t600, d: length - LAST_3F }, { t: finish, d: length })
  for (const corner of cornerKnots) {
    if (corner.t >= t600 - 1) continue
    // コーナー點取代時間最接近的配速取樣點，並維持時間、距離都遞增
    const nearest = knots.findIndex((knot) => knot.t > 0 && knot.t < t600 && Math.abs(knot.t - corner.t) < PACE_SAMPLE / 2)
    if (nearest >= 0) knots.splice(nearest, 1)
    const at = knots.findIndex((knot) => knot.t > corner.t)
    if (corner.d > knots[at - 1].d + 0.5 && corner.d < knots[at].d - 0.5) knots.splice(at, 0, corner)
  }
  return knots
}

/** 時間方向的平滑內插（smoothstep），用於橫向位置 */
function smoothTimeline(knots) {
  return (t) => {
    const k = knots.findIndex((knot) => knot.t > t)
    if (k === -1) return knots.at(-1).value
    if (k === 0) return knots[0].value
    const a = knots[k - 1]
    const b = knots[k]
    const ratio = (t - a.t) / (b.t - a.t)
    return a.value + (b.value - a.value) * ratio * ratio * (3 - 2 * ratio)
  }
}

/**
 * @param {typeof import('./races/japanCup2023').JAPAN_CUP_2023} race
 * @param {{ length: number, cornerDistances: number[] }} course cornerDistances：路線上各コーナー位置（取最後 N 個對應資料）
 */
export function buildReplay(race, { length, cornerDistances }) {
  const count = race.horses.length
  const finishTimes = finishTimesOf(race.horses)
  const front = frontProfile(race.laps, length)
  const cornerAt = cornerDistances.slice(-race.corners.length)
  const cornerTimes = cornerAt.map(front.timeAt)
  const orders = race.corners.map(parseCornerOrder)

  // 各馬道中配速：先頭的曲線形狀，時間縮放成剛好在自己的時刻通過剩 600m
  const frontT600 = front.timeAt(length - LAST_3F)
  const paces = new Map(
    race.horses.map(({ number, last3F }) => {
      const t600 = finishTimes[number] - last3F
      return [number, { t600, pace: (t) => front.distanceAt((t * frontT600) / t600) }]
    }),
  )
  const corrections = cornerCorrections(orders, cornerTimes, (number, t) => paces.get(number).pace(t))

  const stopRandom = createRandom(STOP_SEED)
  const tracks = race.horses.map(({ number, name }) => {
    const finish = finishTimes[number]
    const { t600, pace } = paces.get(number)
    const seen = orders.map((order, c) => ({ c, entry: order.find((e) => e.number === number) })).filter(({ entry }) => entry)
    const cornerKnots = seen.map(({ c }) => ({ t: cornerTimes[c], d: pace(cornerTimes[c]) + corrections[c].get(number) }))
    const knots = distanceKnots({ pace, t600, finish, length, cornerKnots })
    const distanceAt = monotoneCubic(
      knots.map((k) => k.t),
      knots.map((k) => k.d),
    )
    // 橫向：閘門格 → 各コーナー的內外位置（括號內由內往外排）
    const lateralAt = smoothTimeline([
      { t: 0, value: stallLateral(number) },
      ...seen.map(({ c, entry }) => ({ t: cornerTimes[c], value: FIELD.minLateral + entry.lane * FIELD.lane })),
    ])
    const finishSpeed = (length - distanceAt(finish - SPEED_SAMPLE)) / SPEED_SAMPLE
    return { number, name, finish, distanceAt, lateralAt, finishSpeed, stopAfter: pickStopAfter(stopRandom) }
  })

  const duration = Math.max(...Object.values(finishTimes))
  // 最後一頭過終點後減速停下的時刻（等減速度停下所需時間為 2s/v）
  const settledAt = Math.max(
    ...tracks.map(({ finish, finishSpeed, stopAfter }) => finish + (finishSpeed > 0 ? (2 * stopAfter) / finishSpeed : 0)),
  )

  /** 一頭馬在時間 t 的已跑距離與速度；過終點後依 coastAfterFinish 減速 */
  const motionAt = ({ finish, distanceAt, finishSpeed, stopAfter }, t) => {
    if (t < finish) {
      const traveled = distanceAt(t)
      return { traveled, speed: (distanceAt(t + SPEED_SAMPLE) - traveled) / SPEED_SAMPLE }
    }
    const coast = coastAfterFinish(finishSpeed, stopAfter, t - finish)
    return { traveled: length + coast.distance, speed: coast.speed }
  }

  /** 時間 t（比賽時間，秒）時的馬群狀態，格式與 field.js 相同，可直接交給 Field 畫面使用 */
  const at = (t) => {
    const runners = tracks
      .map((track) => {
        const { number, name, finish, lateralAt } = track
        return {
          number,
          waku: wakuOf(number, count),
          label: name,
          ...motionAt(track, t),
          lateral: lateralAt(t),
          finishedAt: t >= finish ? finish : null,
        }
      })
      .sort((a, b) => a.number - b.number)
    const finishOrder = tracks
      .filter(({ finish }) => t >= finish)
      .sort((a, b) => a.finish - b.finish)
      .map(({ number }) => number)
    return { time: t, runners, finishOrder }
  }

  return { at, duration, settledAt, finishTimes, cornerTimes, count }
}
