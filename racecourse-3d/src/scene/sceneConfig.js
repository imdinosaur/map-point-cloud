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

/** 芝面在取樣點 i 的場景高度 */
export const turfSurfaceY = (model, i, exaggeration) => model.turfElevation(i) * exaggeration + HEIGHTS.turfLift

/** 路面（turf / dirt）在高度 elevation（m）處的場景高度 */
export const surfaceY = (surface, elevation, exaggeration) =>
  elevation * exaggeration + (surface === 'dirt' ? HEIGHTS.dirtLift : HEIGHTS.turfLift)

/** 約 2400m 跑 2 分 24 秒的平均速度（m/s） */
export const RACE_SPEED = 16.7
