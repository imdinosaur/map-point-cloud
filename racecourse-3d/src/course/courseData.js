// 東京競馬場官方數據
// 出處：JRA コース紹介 https://www.jra.go.jp/facilities/race/tokyo/course/index.html
// 單位一律為公尺。左回り（俯視為逆時針）。

/** 芝コース A〜D：內欄（仮柵）往外移 railShift 公尺，1 周距離隨之增加 2π·railShift */
export const TURF_COURSES = {
  A: { length: 2083.1, railShift: 0, width: '31〜41m' },
  B: { length: 2101.9, railShift: 3, width: '28〜38m' },
  C: { length: 2120.8, railShift: 6, width: '25〜35m' },
  D: { length: 2139.6, railShift: 9, width: '22〜32m' },
}

export const TURF = { length: 2083.1, straight: 525.9, widthMin: 31, widthMax: 41, elevationRange: 2.7 }
export const DIRT = { length: 1899, straight: 501.6, width: 25, elevationRange: 2.5 }
export const STEEPLE = { length: 1674.7, width: 25, elevationRange: 3.4 }

/**
 * 高低斷面圖（從 JRA 斷面圖目測描點）
 * 每筆為 [距終點剩餘距離, 相對終點高度]；剩餘距離 = 1 周距離時即從終點出發。
 */
export const TURF_PROFILE = [
  [2083.1, 0],
  [2000, 0.1],
  [1275, -1.7],
  [1182, -0.3],
  [1126, -0.3],
  [893, -2.5],
  [468, -2.0],
  [298, -0.1],
  [0, 0],
]

export const DIRT_PROFILE = [
  [1899, 0],
  [1194, -1.9],
  [1077, -1.0],
  [1019, -1.2],
  [853, -2.6],
  [485, -2.6],
  [194, -0.2],
  [0, 0],
]

/** 平地競走的施行距離（JRA コース紹介）。ダ1,600m 由芝ポケット發走、需橫越到ダート，未模擬 */
export const RACE_DISTANCES = {
  turf: [1400, 1600, 1800, 2000, 2300, 2400, 2500, 2600, 3400],
  dirt: [1200, 1300, 1400, 2100, 2400],
}
