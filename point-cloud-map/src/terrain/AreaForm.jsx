import { useState } from 'react'
import { MAX_ZOOM, MIN_ZOOM, validateArea } from './area'
import { PRESET_AREAS } from './presets'
import { buttonStyle, inputStyle, rowStyle } from './panelStyles'

const FIELDS = {
  point: [
    { key: 'lon', label: '經度', step: 'any' },
    { key: 'lat', label: '緯度', step: 'any' },
    { key: 'zoom', label: '層級', step: 1, min: MIN_ZOOM, max: MAX_ZOOM },
  ],
  region: [
    { key: 'west', label: '西界', step: 'any' },
    { key: 'east', label: '東界', step: 'any' },
    { key: 'south', label: '南界', step: 'any' },
    { key: 'north', label: '北界', step: 'any' },
  ],
}

const DEFAULT_DRAFTS = {
  point: { lon: '120.957', lat: '23.47', zoom: '12' },
  region: { west: '119.9', south: '21.8', east: '122.1', north: '25.4' },
}

const toDraft = (area) =>
  Object.fromEntries(FIELDS[area.type].map(({ key }) => [key, String(area[key])]))

const toArea = (type, draft) => ({
  type,
  ...Object.fromEntries(FIELDS[type].map(({ key }) => [key, Number(draft[key])])),
})

const tabStyle = (isActive) => ({
  ...buttonStyle,
  flex: 1,
  padding: '4px 8px',
  background: isActive ? '#ffffff' : '#00d9ff',
})

/**
 * 地形範圍輸入：預設地點、單點（經緯度＋層級）、區域（經緯度邊界）
 */
export default function AreaForm({ area, onSubmit }) {
  const [mode, setMode] = useState(area.type)
  const [drafts, setDrafts] = useState({ ...DEFAULT_DRAFTS, [area.type]: toDraft(area) })
  const [error, setError] = useState(null)
  const draft = drafts[mode]

  const handleSubmit = (e) => {
    e.preventDefault()
    const next = toArea(mode, draft)
    const message = validateArea(next)
    setError(message)
    if (!message) onSubmit(next)
  }

  const handlePreset = (e) => {
    const preset = PRESET_AREAS[Number(e.target.value)]
    if (!preset) return
    setMode(preset.area.type)
    setDrafts({ ...drafts, [preset.area.type]: toDraft(preset.area) })
    setError(null)
    onSubmit(preset.area)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <select defaultValue="" onChange={handlePreset} style={inputStyle}>
        <option value="" disabled>選擇預設地點…</option>
        {PRESET_AREAS.map((p, i) => (
          <option key={p.name} value={i}>
            {p.name}{p.area.type === 'region' ? '（區域）' : ''}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button type="button" onClick={() => setMode('point')} style={tabStyle(mode === 'point')}>單點</button>
        <button type="button" onClick={() => setMode('region')} style={tabStyle(mode === 'region')}>區域</button>
      </div>

      {FIELDS[mode].map(({ key, label, ...inputProps }) => (
        <label key={key} style={{ ...rowStyle, gap: '6px' }}>
          <span style={{ minWidth: '40px' }}>{label}</span>
          <input
            type="number"
            value={draft[key]}
            onChange={(e) => setDrafts({ ...drafts, [mode]: { ...draft, [key]: e.target.value } })}
            style={inputStyle}
            {...inputProps}
          />
        </label>
      ))}

      <button type="submit" style={buttonStyle}>載入地形</button>
      {error && <span style={{ color: '#ff6b6b', fontSize: '12px' }}>{error}</span>}
    </form>
  )
}
