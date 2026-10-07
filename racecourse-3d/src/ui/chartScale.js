// 高低斷面圖的座標換算（ProfileChart 與跑者標記共用）
export const CHART = {
  width: 280,
  height: 92,
  pad: { top: 8, right: 6, bottom: 16, left: 26 },
  elevationMin: -3,
  elevationMax: 1,
}

/** 已跑比例（0〜1）→ SVG x */
export const chartX = (fraction) => CHART.pad.left + fraction * (CHART.width - CHART.pad.left - CHART.pad.right)

/** 相對終點高度（m）→ SVG y */
export const chartY = (elevation) =>
  CHART.pad.top +
  ((CHART.elevationMax - elevation) / (CHART.elevationMax - CHART.elevationMin)) *
    (CHART.height - CHART.pad.top - CHART.pad.bottom)
