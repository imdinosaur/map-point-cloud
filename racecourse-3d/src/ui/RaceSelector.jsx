import { RACE_DISTANCES } from '../course/courseData'
import { RACES } from '../course/races'

const GROUPS = [
  { surface: 'turf', label: '芝' },
  { surface: 'dirt', label: 'ダート' },
]

function Chip({ label, active, onClick }) {
  return (
    <button type="button" className={`panel__chip${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  )
}

/** 連續繞圈、芝／ダート各距離的模擬比賽，或依公布成績重播的レース再現 */
export default function RaceSelector({ runId, onRunChange, replayId, onReplayChange }) {
  const isActive = (id) => !replayId && runId === id
  return (
    <section className="panel__group">
      <span className="panel__label">模擬跑法</span>
      <div className="panel__chips">
        <Chip label="連続周回" active={isActive('lap')} onClick={() => onRunChange('lap')} />
      </div>
      {GROUPS.map(({ surface, label }) => (
        <div key={surface} className="panel__chips" role="group" aria-label={`${label}距離`}>
          <span className="panel__chips-label">{label}</span>
          {RACE_DISTANCES[surface].map((distance) => {
            const id = `${surface}-${distance}`
            return <Chip key={distance} label={distance.toLocaleString()} active={isActive(id)} onClick={() => onRunChange(id)} />
          })}
        </div>
      ))}
      <div className="panel__chips" role="group" aria-label="レース再現">
        <span className="panel__chips-label">再現</span>
        {RACES.map((race) => (
          <Chip key={race.id} label={race.label} active={replayId === race.id} onClick={() => onReplayChange(race.id)} />
        ))}
      </div>
    </section>
  )
}
