import { RACE_DISTANCES } from '../course/courseData'

const GROUPS = [
  { surface: 'turf', label: '芝' },
  { surface: 'dirt', label: 'ダート' },
]

function Chip({ id, label, runId, onRunChange }) {
  const active = runId === id
  return (
    <button
      type="button"
      className={`panel__chip${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={() => onRunChange(id)}
    >
      {label}
    </button>
  )
}

/** 連續繞圈，或選擇芝／ダート各距離從起點跑到終點 */
export default function RaceSelector({ runId, onRunChange }) {
  return (
    <section className="panel__group">
      <span className="panel__label">模擬跑法</span>
      <div className="panel__chips">
        <Chip id="lap" label="連続周回" runId={runId} onRunChange={onRunChange} />
      </div>
      {GROUPS.map(({ surface, label }) => (
        <div key={surface} className="panel__chips" role="group" aria-label={`${label}距離`}>
          <span className="panel__chips-label">{label}</span>
          {RACE_DISTANCES[surface].map((distance) => (
            <Chip
              key={distance}
              id={`${surface}-${distance}`}
              label={distance.toLocaleString()}
              runId={runId}
              onRunChange={onRunChange}
            />
          ))}
        </div>
      ))}
    </section>
  )
}
