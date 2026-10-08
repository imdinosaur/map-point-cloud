import { isValidRunId, parseRunId } from '../courseModel'
import { parseCornerOrder, parseTime } from '../replay'

// 手動輸入比賽資料的檢查。回傳錯誤訊息陣列（空陣列 = 沒問題），訊息用成績表上的用語，方便對照修正。

const TIME_FORMAT = /^(\d+:)?\d{1,2}\.\d$/ // 2:21.8 或 59.4
const MARGIN_FORMAT = /^(\d+|\d+\/\d+|\d+\.\d+\/\d+)$/ // 4、3/4、1.1/2
const MARGIN_WORDS = new Set(['', '同着', 'ハナ', 'アタマ', 'クビ', '大'])
const LAP_TOLERANCE = 0.3 // ハロンタイム合計與勝ち時計容許的誤差（秒）
const MAX_RUNNERS = 18

/**
 * @param {typeof import('./japanCup2023').JAPAN_CUP_2023} race
 * @returns {string[]}
 */
export function validateRace(race) {
  const errors = []
  const where = `${race.id ?? '(沒有 id)'}`
  const fail = (message) => errors.push(`${where}: ${message}`)

  for (const key of ['id', 'label', 'name']) if (!race[key]) fail(`缺少 ${key}`)

  if (!isValidRunId(race.runId)) {
    fail(`runId「${race.runId}」不是可用的距離（格式 turf-2400 或 dirt-1600，距離須在 courseData.js 的 RACE_DISTANCES 內）`)
    return errors
  }
  const { distance } = parseRunId(race.runId)

  const horses = race.horses ?? []
  if (horses.length < 2 || horses.length > MAX_RUNNERS) fail(`出走頭數 ${horses.length}，須為 2〜${MAX_RUNNERS} 頭`)

  // 馬番：1〜N 各一次
  const numbers = horses.map((horse) => horse.number)
  const expected = Array.from({ length: horses.length }, (_, k) => k + 1)
  const sorted = [...numbers].sort((a, b) => a - b)
  if (sorted.join() !== expected.join()) fail(`馬番須為 1〜${horses.length} 各一次，目前是 ${sorted.join(',')}`)

  horses.forEach((horse, k) => {
    const label = `第 ${k + 1} 列（${horse.number} 番 ${horse.name ?? ''}）`
    if (!horse.name) fail(`${label} 缺少馬名`)
    if (!TIME_FORMAT.test(horse.time ?? '')) fail(`${label} タイム「${horse.time}」格式應為 2:21.8`)
    const margin = horse.margin ?? ''
    if (!MARGIN_WORDS.has(margin) && !MARGIN_FORMAT.test(margin)) {
      fail(`${label} 着差「${margin}」無法辨識（可用：ハナ、アタマ、クビ、1/2、3/4、1、1.1/4、大、同着…）`)
    }
    if (k === 0 && margin !== '') fail(`${label} 是 1 着，着差應留空 ''`)
    if (!(horse.last3F > 0) || (TIME_FORMAT.test(horse.time ?? '') && horse.last3F >= parseTime(horse.time))) {
      fail(`${label} 上がり3F「${horse.last3F}」應為秒數，例如 33.5`)
    }
  })

  // 依着順列出：タイム不可倒退
  horses.slice(1).forEach((horse, k) => {
    const previous = horses[k]
    if (TIME_FORMAT.test(horse.time) && TIME_FORMAT.test(previous.time) && parseTime(horse.time) < parseTime(previous.time)) {
      fail(`horses 須依着順排列：${horse.number} 番的タイム比上一列（${previous.number} 番）快，請確認順序`)
    }
  })

  // ハロンタイム：段數與距離相符、合計約等於勝ち時計
  const laps = race.laps ?? []
  const lapCount = Math.ceil(distance / 200)
  if (laps.length !== lapCount) fail(`ハロンタイム有 ${laps.length} 段，${distance}m 應為 ${lapCount} 段`)
  const winner = horses[0]
  if (winner && TIME_FORMAT.test(winner.time) && laps.length > 0) {
    const total = laps.reduce((sum, lap) => sum + lap, 0)
    if (Math.abs(total - parseTime(winner.time)) > LAP_TOLERANCE) {
      fail(`ハロンタイム合計 ${total.toFixed(1)} 秒，與 1 着タイム ${winner.time} 不符`)
    }
  }

  // コーナー通過順位：每條都要恰好包含每頭馬一次
  const corners = race.corners ?? []
  if (corners.length === 0) fail('缺少 corners（コーナー通過順位）')
  corners.forEach((line, c) => {
    const listed = parseCornerOrder(line).map((entry) => entry.number)
    const duplicated = [...new Set(listed.filter((n, k) => listed.indexOf(n) !== k))]
    const missing = numbers.filter((n) => !listed.includes(n))
    const unknown = listed.filter((n) => !numbers.includes(n))
    if (duplicated.length) fail(`コーナー ${c + 1} 重複出現：${duplicated.join(',')} 番`)
    if (missing.length) fail(`コーナー ${c + 1} 缺少：${missing.join(',')} 番`)
    if (unknown.length) fail(`コーナー ${c + 1} 有不存在的馬番：${unknown.join(',')}`)
  })

  return errors
}
