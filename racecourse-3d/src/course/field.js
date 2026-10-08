import { GATE, wakuOf } from './startingGate'

// 多頭數比賽的模擬（純函式，不依賴 three）。
// 每頭馬的位置 = 沿路線的已跑距離 traveled ＋ 離量測線往外的橫向距離 lateral（公尺，往外為正）。
// 時間單位為「比賽時間」秒，播放倍速由呼叫端換算。

const RACE_SPEED = 16.7 // 與 sceneConfig.RACE_SPEED 相同（2400m 約 2 分 24 秒）
const RAIL_TO_MEASURE_LINE = 1 // 內欄在量測線往內 1m（與 courseModel 一致）

export const FIELD = {
  runners: GATE.stalls,
  minLateral: -RAIL_TO_MEASURE_LINE + 0.45, // 貼著內欄時身體中心離量測線的位置
  lane: 1.1, // 並排時兩頭馬中心至少相隔的橫向距離
  aheadGap: 3, // 前方多遠內同一條線上有馬就算被擋住
  followGap: 1.5, // 被擋住時跟在前馬後方保持的距離
  followGain: 2, // 跟車距離的修正強度（1/s）：比 followGap 近就比前馬慢、遠就稍快
  sideGap: 2.2, // 前後多近算並排（換線時要讓開）
  lateralSpeed: 1.6, // 換線速度（m/s）
  passLanes: 4, // 超車時最多往外找幾條線
  accel: 3, // 起跑與加速（m/s²）
  decel: 4,
  lateBlend: 200, // 由道中速度漸變到末腳速度的距離
  substep: 0.05, // 模擬步長上限（秒），高倍速時分段計算避免穿越
  runoutMin: 60, // 過終點後減速停下的距離（m）：每頭馬在此範圍內隨機，才不會停在同一條線上
  runoutMax: 180,
}

/**
 * 跑法：early = 道中速度倍率、late = 最後衝刺倍率。逃げ前快後鈍、追込前慢後猛。
 * 單獨跑時四種跑法完成時間相同；但差し、追込在馬群中會被擋、得繞外側，
 * 所以末腳給得比「單獨跑剛好打平」更強，讓它們在東京的長直線有機會追上。
 * swing：進入末段時往外側移出的距離（公尺）——後方的馬「外を回す」，避開內側的馬群。
 * kickAt：剩餘多少公尺開始末腳；後方的馬要更早發動（約在最後彎道）才追得上。
 */
export const STYLES = {
  nige: { label: '逃げ', early: 1.018, late: 0.98, swing: 0, kickAt: 600 },
  senko: { label: '先行', early: 1.007, late: 1.012, swing: 0, kickAt: 600 },
  sashi: { label: '差し', early: 0.996, late: 1.06, swing: 3, kickAt: 700 },
  oikomi: { label: '追込', early: 0.991, late: 1.085, swing: 6, kickAt: 800 },
}
const STYLE_KEYS = Object.keys(STYLES)
const STYLE_WEIGHTS = [0.15, 0.35, 0.35, 0.15] // 逃げ、追込較少
const STOP_SEED_SALT = 0x9e3779b9 // 停止距離用另一組亂數，加入時不改變既有的出走馬組成
const STOPPED = 0.05 // 離停止點這麼近（m）就算停下

/** 可重現的亂數（mulberry32） */
export function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickStyle(random) {
  let r = random()
  for (let k = 0; k < STYLE_KEYS.length; k++) {
    r -= STYLE_WEIGHTS[k]
    if (r <= 0) return STYLE_KEYS[k]
  }
  return STYLE_KEYS.at(-1)
}

/** 馬番 n 的閘門格中心離量測線的橫向距離（發馬機原點在內欄，格子由內往外排） */
export const stallLateral = (number) => GATE.endFrame + (number - 0.5) * GATE.pitch - RAIL_TO_MEASURE_LINE

/**
 * @param {{ seed: number, count?: number }} options
 * @returns {{ seed: number, time: number, runners: Runner[], finishOrder: number[] }}
 * @typedef {{ number: number, waku: number, style: string, label: string, ability: number, preferredLateral: number,
 *   traveled: number, lateral: number, speed: number, finishedAt: number | null, stopAfter: number }} Runner
 */
export function createField({ seed, count = FIELD.runners }) {
  const random = createRandom(seed)
  const stopRandom = createRandom(seed ^ STOP_SEED_SALT)
  const runners = Array.from({ length: count }, (_, k) => {
    const style = pickStyle(random)
    return {
      number: k + 1,
      waku: wakuOf(k + 1, count),
      style,
      label: STYLES[style].label,
      ability: 0.99 + random() * 0.02, // ±1%：兩分鐘的比賽累積下來，首尾約差 2〜3 秒
      preferredLateral: FIELD.minLateral + random() * 0.8,
      traveled: 0,
      lateral: stallLateral(k + 1),
      speed: 0,
      finishedAt: null,
      stopAfter: pickStopAfter(stopRandom),
    }
  })
  return { seed, time: 0, runners, finishOrder: [] }
}

/** 過終點後減速停下的距離（m） */
export const pickStopAfter = (random) => FIELD.runoutMin + random() * (FIELD.runoutMax - FIELD.runoutMin)

/**
 * 以等減速度 v²/(2s) 在 s 公尺內停下：過終點 elapsed 秒後多跑的距離與當時速度。
 * @param {number} speed 過終點時的速度（m/s）
 * @param {number} stopAfter s
 */
export function coastAfterFinish(speed, stopAfter, elapsed) {
  if (speed <= 0 || stopAfter <= 0) return { distance: 0, speed: 0 }
  const decel = (speed * speed) / (2 * stopAfter)
  const t = Math.min(elapsed, speed / decel)
  return { distance: speed * t - (decel * t * t) / 2, speed: speed - decel * t }
}

/** 末段進度：0 = 道中、1 = 已完全進入末腳 */
const lateProgress = (runner, remaining) =>
  Math.min(Math.max((STYLES[runner.style].kickAt - remaining) / FIELD.lateBlend, 0), 1)

/** 依剩餘距離取道中／末腳之間的目標速度 */
function targetSpeed(runner, remaining) {
  const { early, late } = STYLES[runner.style]
  return RACE_SPEED * runner.ability * (early + (late - early) * lateProgress(runner, remaining))
}

const isRunning = (runner) => runner.finishedAt === null

/** 這條橫向位置在 runner 身旁（前後 sideGap 內）是否空著 */
function laneIsFree(runner, lateral, others) {
  return others.every(
    (other) =>
      other === runner ||
      !isRunning(other) ||
      Math.abs(other.traveled - runner.traveled) >= FIELD.sideGap ||
      Math.abs(other.lateral - lateral) >= FIELD.lane,
  )
}

/** 正前方最近、會擋住去路的馬 */
function blockerAhead(runner, others) {
  let nearest = null
  for (const other of others) {
    if (other === runner || !isRunning(other)) continue
    const gap = other.traveled - runner.traveled
    if (gap <= 0 || gap >= FIELD.aheadGap || Math.abs(other.lateral - runner.lateral) >= FIELD.lane) continue
    if (!nearest || gap < nearest.traveled - runner.traveled) nearest = other
  }
  return nearest
}

const approach = (value, target, maxStep) => value + Math.min(Math.max(target - value, -maxStep), maxStep)

/** 一頭馬前進一小步；others 為這一步開始時的快照，所有馬依同一快照決策，結果與順序無關 */
function stepRunner(runner, others, dt, course, time) {
  if (!isRunning(runner)) return coastToStop(runner, dt, course)

  const desired = targetSpeed(runner, course.length - runner.traveled)
  const blocker = blockerAhead(runner, others)
  const remaining = course.length - runner.traveled
  let lateralTarget = runner.preferredLateral + STYLES[runner.style].swing * lateProgress(runner, remaining)
  let speedLimit = desired

  if (blocker) {
    // 被擋住：保持跟車距離（只能靠換線超車，不能直接往前擠）；想更快時嘗試往外側繞過
    const gap = blocker.traveled - runner.traveled
    speedLimit = Math.min(desired, blocker.speed + FIELD.followGain * (gap - FIELD.followGap))
    if (desired > blocker.speed) {
      // 由近到遠找外側第一條空著的線（緊鄰的線被佔時，繞到更外側；差し、追込才不會整場被包住）
      const lanes = Array.from({ length: FIELD.passLanes }, (_, k) => blocker.lateral + (k + 1) * FIELD.lane)
      const open = lanes.find((lateral) => laneIsFree(runner, lateral, others))
      if (open !== undefined) lateralTarget = Math.max(lateralTarget, open)
    }
  }

  // 往內靠或往外移都要確認途中沒有並排的馬，否則維持原位
  const step = Math.sign(lateralTarget - runner.lateral) * Math.min(Math.abs(lateralTarget - runner.lateral), FIELD.lateralSpeed * dt)
  const nextLateral = Math.max(FIELD.minLateral, laneIsFree(runner, runner.lateral + step, others) ? runner.lateral + step : runner.lateral)

  const speed = approach(runner.speed, Math.max(0, speedLimit), (speedLimit > runner.speed ? FIELD.accel : FIELD.decel) * dt)
  // 彎道外側要跑比較長：沿量測線的推進量除以 (1 + 曲率 × 橫向距離)
  const stretch = Math.max(0.5, 1 + course.curvatureAt(runner.traveled) * nextLateral)
  const traveled = Math.min(runner.traveled + (speed * dt) / stretch, course.length)
  const finishedAt = traveled >= course.length ? time + dt : null
  return { ...runner, traveled, lateral: nextLateral, speed, finishedAt }
}

/** 過終點後沿原本的線往前減速，停在終點後 stopAfter 公尺；每步依剩餘距離重算減速度，誤差會自行收斂 */
function coastToStop(runner, dt, course) {
  const stopAt = course.length + runner.stopAfter
  const left = stopAt - runner.traveled
  if (left <= STOPPED || runner.speed <= 0) return runner.speed === 0 ? runner : { ...runner, speed: 0 }
  const { distance, speed } = coastAfterFinish(runner.speed, left, dt)
  const stretch = Math.max(0.5, 1 + course.curvatureAt(runner.traveled) * runner.lateral)
  return { ...runner, traveled: Math.min(runner.traveled + distance / stretch, stopAt), speed }
}

/** 全員都已過終點並停下（可以開始下一場） */
export const isSettled = (field) =>
  field.finishOrder.length === field.runners.length && field.runners.every((runner) => runner.speed < 1e-6)

/**
 * 推進整個馬群。dt 大於 FIELD.substep 時分段計算。
 * @param {ReturnType<typeof createField>} field
 * @param {number} dt 比賽時間（秒）
 * @param {{ length: number, curvatureAt: (traveled: number) => number }} course
 */
export function stepField(field, dt, course) {
  const steps = Math.max(1, Math.ceil(dt / FIELD.substep))
  let current = field
  for (let s = 0; s < steps; s++) current = substep(current, dt / steps, course)
  return current
}

function substep(field, dt, course) {
  const runners = field.runners.map((runner) => stepRunner(runner, field.runners, dt, course, field.time))
  const newlyFinished = runners
    .filter((runner, k) => runner.finishedAt !== null && field.runners[k].finishedAt === null)
    .sort((a, b) => b.traveled - a.traveled || a.number - b.number)
    .map((runner) => runner.number)
  return { ...field, time: field.time + dt, runners, finishOrder: [...field.finishOrder, ...newlyFinished] }
}

/** 目前名次（馬番陣列）：已到終點依到達順序，其餘依已跑距離 */
export function rankings(field) {
  const finished = field.finishOrder
  const rest = field.runners
    .filter((runner) => !finished.includes(runner.number))
    .sort((a, b) => b.traveled - a.traveled)
    .map((runner) => runner.number)
  return [...finished, ...rest]
}
