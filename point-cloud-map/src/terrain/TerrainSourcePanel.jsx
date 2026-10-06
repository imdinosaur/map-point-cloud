import AreaForm from './AreaForm'
import { EXAGGERATION_MAX, EXAGGERATION_MIN, roundExaggeration } from './exaggeration'
import { buttonStyle, rowStyle } from './panelStyles'

// 高度誇張使用對數拉桿：單點約 1x、國家級需要數十倍
const SLIDER_STEPS = 100
const LOG_RANGE = Math.log(EXAGGERATION_MAX / EXAGGERATION_MIN)

const toSlider = (value) => Math.round((Math.log(value / EXAGGERATION_MIN) / LOG_RANGE) * SLIDER_STEPS)
const fromSlider = (position) => roundExaggeration(EXAGGERATION_MIN * Math.exp((position / SLIDER_STEPS) * LOG_RANGE))

function TerrainStatus({ status, error, summary }) {
  if (status === 'loading') return <span style={{ fontSize: '12px' }}>圖磚載入中…</span>
  if (status === 'error') return <span style={{ color: '#ff6b6b', fontSize: '12px' }}>{error}</span>
  if (status !== 'success' || !summary) return null
  if (summary.pointCount === 0) return <span style={{ fontSize: '12px' }}>此範圍沒有陸地</span>

  const baseline = summary.baseElevation === 0 ? '海平面' : '最低點'
  return (
    <span style={{ fontSize: '12px', lineHeight: 1.5 }}>
      海拔 {Math.round(summary.minElevation)} – {Math.round(summary.maxElevation)} m（以{baseline}為基準）
      <br />
      層級 z{summary.zoom} · {summary.tileCount} 張圖磚 · {summary.pointCount.toLocaleString()} 根柱子
    </span>
  )
}

function ExaggerationControl({ isAuto, onAutoChange, value, onManualChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={rowStyle}>
        <label>高度誇張:</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={isAuto} onChange={(e) => onAutoChange(e.target.checked)} />
          自動
        </label>
      </div>
      <div style={rowStyle}>
        <input
          type="range"
          min="0"
          max={SLIDER_STEPS}
          value={toSlider(value)}
          onChange={(e) => onManualChange(fromSlider(Number(e.target.value)))}
          style={{ flex: 1, opacity: isAuto ? 0.5 : 1 }}
          aria-label="高度誇張倍率"
        />
        <span style={{ minWidth: '40px' }}>{value}x</span>
      </div>
    </div>
  )
}

/**
 * 地形資料來源切換：模擬資料 / Terrarium 真實地形
 */
export default function TerrainSourcePanel({
  source,
  onSourceChange,
  area,
  onAreaChange,
  isAutoExaggeration,
  onAutoExaggerationChange,
  exaggeration,
  onManualExaggerationChange,
  status,
  error,
  summary,
}) {
  const isReal = source === 'terrarium'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button onClick={() => onSourceChange(isReal ? 'simulated' : 'terrarium')} style={buttonStyle}>
        {isReal ? '切換至模擬地形' : '切換至真實地形'}
      </button>

      {isReal && (
        <>
          <AreaForm area={area} onSubmit={onAreaChange} />
          <ExaggerationControl
            isAuto={isAutoExaggeration}
            onAutoChange={onAutoExaggerationChange}
            value={exaggeration}
            onManualChange={onManualExaggerationChange}
          />
          <TerrainStatus status={status} error={error} summary={summary} />
        </>
      )}
    </div>
  )
}
