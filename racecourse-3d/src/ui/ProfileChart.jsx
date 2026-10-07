import { DIRT, DIRT_PROFILE, TURF, TURF_PROFILE } from '../course/courseData'
import { COLORS } from '../scene/sceneConfig'
import { CHART, chartX, chartY } from './chartScale'

const { width: WIDTH, height: HEIGHT, pad: PAD, elevationMin: ELEVATION_MIN } = CHART
const GRID = [0, -2]

const toPath = (profile, length) =>
  profile.map(([r, e], k) => `${k === 0 ? 'M' : 'L'}${chartX(1 - r / length).toFixed(1)},${chartY(e).toFixed(1)}`).join(' ')

const TURF_PATH = toPath(TURF_PROFILE, TURF.length)
const DIRT_PATH = toPath(DIRT_PROFILE, DIRT.length)
const BASELINE = chartY(ELEVATION_MIN)
const TURF_AREA = `${TURF_PATH} L${chartX(1)},${BASELINE} L${chartX(0)},${BASELINE} Z`

/** JRA 高低斷面圖重繪；左端為起跑（＝終點），右端為終點 */
export default function ProfileChart({ markerRef }) {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="芝與ダート高低斷面圖">
      {GRID.map((e) => (
        <g key={e}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={chartY(e)} y2={chartY(e)} stroke="#c9d3cb" strokeDasharray="2 3" />
          <text x={PAD.left - 4} y={chartY(e) + 3} textAnchor="end" fontSize="9" fill="#617066">
            {e > 0 ? `+${e}` : e}m
          </text>
        </g>
      ))}
      <path d={TURF_AREA} fill={COLORS.turf} opacity="0.18" />
      <path d={DIRT_PATH} fill="none" stroke={COLORS.dirt} strokeWidth="1.6" />
      <path d={TURF_PATH} fill="none" stroke={COLORS.turf} strokeWidth="2" />
      <text x={PAD.left} y={HEIGHT - 3} fontSize="9" fill="#617066">スタート</text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 3} fontSize="9" fill="#617066" textAnchor="end">ゴール</text>
      <circle ref={markerRef} r="4" cx={chartX(0)} cy={chartY(0)} fill={COLORS.runner} stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}
