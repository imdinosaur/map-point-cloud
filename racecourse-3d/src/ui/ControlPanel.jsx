import { DIRT, STEEPLE, TURF, TURF_COURSES } from '../course/courseData'
import { COLORS } from '../scene/sceneConfig'
import ExaggerationSlider from './ExaggerationSlider'
import ProfileChart from './ProfileChart'
import RaceField from './RaceField'
import RaceSelector from './RaceSelector'
import './ControlPanel.css'

const VIEW_MODES = [
  { value: 'overview', label: '俯瞰' },
  { value: 'chase', label: '追跡' },
  { value: 'rider', label: '騎手目線' },
]

const SOURCE_URL = 'https://www.jra.go.jp/facilities/race/tokyo/course/index.html'

const LEGEND = [
  { color: COLORS.turf, label: '芝', detail: `${TURF.length}m・直線 ${TURF.straight}m・高低差 ${TURF.elevationRange}m` },
  { color: COLORS.dirt, label: 'ダート', detail: `${DIRT.length}m・直線 ${DIRT.straight}m・高低差 ${DIRT.elevationRange}m` },
  { color: COLORS.steeple, label: '障害', detail: `${STEEPLE.length}m・高低差 ${STEEPLE.elevationRange}m` },
]

/**
 * @param {{
 *   course: keyof typeof TURF_COURSES, onCourseChange: (c: string) => void,
 *   isRace: boolean, playerNumber: number, onPlayerNumberChange: (n: number) => void, rankingStore,
 *   runId: string, onRunChange: (id: string) => void, surface: 'turf' | 'dirt',
 *   modelLengths: Record<string, number>,
 *   exaggeration: number, onExaggerationChange: (v: number) => void,
 *   playing: boolean, onTogglePlaying: () => void,
 *   viewMode: 'overview' | 'chase' | 'rider', onViewModeChange: (m: string) => void,
 *   speedMultiplier: number, onSpeedChange: (v: number) => void,
 *   remainingRef, elevationRef, markerRef: 每幀由 Runner 直接寫入的 DOM 節點
 * }} props
 */
export default function ControlPanel({
  course,
  isRace,
  playerNumber,
  onPlayerNumberChange,
  rankingStore,
  onCourseChange,
  runId,
  onRunChange,
  surface,
  modelLengths,
  exaggeration,
  onExaggerationChange,
  playing,
  onTogglePlaying,
  viewMode,
  onViewModeChange,
  speedMultiplier,
  onSpeedChange,
  remainingRef,
  elevationRef,
  markerRef,
}) {
  const official = TURF_COURSES[course]

  return (
    <aside className="panel">
      <header className="panel__head">
        <p className="panel__eyebrow">TOKYO RACECOURSE · 左回り</p>
        <h1 className="panel__title">東京競馬場</h1>
      </header>

      <section className="panel__readout" aria-live="off">
        <div>
          <span className="panel__label">ゴールまで</span>
          <span className="panel__value">
            <span ref={remainingRef}>—</span>
            <small>m</small>
          </span>
        </div>
        <div>
          <span className="panel__label">高低（{surface === 'dirt' ? 'ダート' : '芝'}）</span>
          <span className="panel__value">
            <span ref={elevationRef}>—</span>
            <small>m</small>
          </span>
        </div>
      </section>
      <ProfileChart markerRef={markerRef} />
      <RaceSelector runId={runId} onRunChange={onRunChange} />
      {isRace && (
        <RaceField playerNumber={playerNumber} onPlayerNumberChange={onPlayerNumberChange} rankingStore={rankingStore} />
      )}

      <section className="panel__group">
        <span className="panel__label">芝コース（仮柵位置）</span>
        <div className="panel__segmented" role="radiogroup" aria-label="芝コース">
          {Object.keys(TURF_COURSES).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={course === key}
              className={course === key ? 'is-active' : ''}
              onClick={() => onCourseChange(key)}
            >
              {key}
            </button>
          ))}
        </div>
        <p className="panel__note">
          1周 官方 {official.length}m ／ 模型 {modelLengths[course].toFixed(1)}m・幅員 {official.width}
        </p>
      </section>

      <ExaggerationSlider exaggeration={exaggeration} onExaggerationChange={onExaggerationChange} />

      <section className="panel__group">
        <span className="panel__label">視角</span>
        <div className="panel__segmented panel__segmented--3" role="radiogroup" aria-label="視角">
          {VIEW_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={viewMode === value}
              className={viewMode === value ? 'is-active' : ''}
              onClick={() => onViewModeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel__group panel__row">
        <button type="button" className="panel__play" onClick={onTogglePlaying}>
          {playing ? '❚❚ 暫停' : '▶ 播放'}
        </button>
        <label className="panel__label panel__grow" htmlFor="speed">
          速度 ×{speedMultiplier}
          <input
            id="speed"
            type="range"
            min="1"
            max="20"
            value={speedMultiplier}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
          />
        </label>
      </section>

      <ul className="panel__legend">
        {LEGEND.map(({ color, label, detail }) => (
          <li key={label}>
            <i style={{ background: color }} />
            <b>{label}</b>
            <span>{detail}</span>
          </li>
        ))}
      </ul>

      <a className="panel__source" href={SOURCE_URL} target="_blank" rel="noreferrer">
        資料來源：JRA コース紹介
      </a>
    </aside>
  )
}
