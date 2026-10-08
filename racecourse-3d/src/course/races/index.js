import { JAPAN_CUP_2023 } from './japanCup2023'
import { validateRace } from './validate'

/**
 * 所有比賽資料。新增比賽：照 docs/adding-races.md 建立資料檔，import 後加進這個陣列。
 * 測試會逐一檢查這裡的每一場（pnpm --filter racecourse-3d test）。
 */
export const ALL_RACES = [JAPAN_CUP_2023]

/** 介面上可選的比賽：資料有誤的比賽不列出，並在瀏覽器 console 說明原因，避免整個頁面壞掉 */
export const RACES = ALL_RACES.filter((race) => {
  const errors = validateRace(race)
  if (errors.length > 0) console.warn(`レース再現「${race.id}」資料有誤，已略過：\n${errors.join('\n')}`)
  return errors.length === 0
})

export const raceById = (id) => RACES.find((race) => race.id === id) ?? null
