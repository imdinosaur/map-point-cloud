// 場景配色：芝、ダート、障害取現場質感，而非平面圖的圖例色
export const COLORS = {
  sky: '#cfe0ea',
  ground: '#56794a',
  turf: '#3f8f3a',
  dirt: '#b7824f',
  steeple: '#6aa356',
  rail: '#f7f7f2',
  goal: '#d8322f',
  furlong: '#f2c230',
  runner: '#e2412f',
  route: '#ffe14d',
}

// 實際尺寸（公尺，不受高度誇張倍率影響）
export const HEIGHTS = {
  turfLift: 0.3,
  dirtLift: 0.15,
  rail: 1.0,
}

// 跑者角色放大 5 倍（約 8m 高），俯瞰整座競馬場時才看得到
const AVATAR_SCALE = 5
const AVATAR_MODEL_HEIGHT = 1.6 // 模型原尺寸身高（m）
export const AVATAR = { scale: AVATAR_SCALE, height: AVATAR_SCALE * AVATAR_MODEL_HEIGHT }

/** 芝面在取樣點 i 的場景高度 */
export const turfSurfaceY = (model, i, exaggeration) => model.turfElevation(i) * exaggeration + HEIGHTS.turfLift

/** 路面（turf / dirt）在高度 elevation（m）處的場景高度 */
export const surfaceY = (surface, elevation, exaggeration) =>
  elevation * exaggeration + (surface === 'dirt' ? HEIGHTS.dirtLift : HEIGHTS.turfLift)

/** 分頁切回時 delta 可能很大，限制單幀推進量（秒）；跑者移動與慣性計算共用 */
export const MAX_FRAME_DELTA = 0.1

/** 約 2400m 跑 2 分 24 秒的平均速度（m/s） */
export const RACE_SPEED = 16.7
