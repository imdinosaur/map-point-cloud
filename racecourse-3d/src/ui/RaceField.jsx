import { useSyncExternalStore } from 'react'
import { FIELD, STYLES } from '../course/field'
import { WAKU_COLORS, wakuOf } from '../course/startingGate'

const SHOWN_LEADERS = 5
// 枠色上的數字顏色（依 JRA 出馬表：白、黃、橙、桃底用黑字）
const DARK_TEXT_WAKU = new Set([1, 5, 7, 8])
const NUMBERS = Array.from({ length: FIELD.runners }, (_, k) => k + 1)

const chipColors = (number) => {
  const waku = wakuOf(number, FIELD.runners)
  return { background: WAKU_COLORS[waku - 1], color: DARK_TEXT_WAKU.has(waku) ? '#1d2a1f' : '#fff' }
}

/**
 * 比賽模式：選擇自己的馬番（VRM 角色），並顯示即時名次。
 * 名次由 rankingStore 低頻率發布，這裡訂閱即可，不會讓 3D 場景重新渲染。
 */
export default function RaceField({ playerNumber, onPlayerNumberChange, rankingStore }) {
  const snapshot = useSyncExternalStore(rankingStore.subscribe, rankingStore.get)

  return (
    <section className="panel__group">
      <span className="panel__label">あなたの馬番（{FIELD.runners}頭立て）</span>
      <div className="field__numbers" role="radiogroup" aria-label="馬番">
        {NUMBERS.map((number) => (
          <button
            key={number}
            type="button"
            role="radio"
            aria-checked={number === playerNumber}
            className={number === playerNumber ? 'is-active' : ''}
            style={chipColors(number)}
            onClick={() => onPlayerNumberChange(number)}
          >
            {number}
          </button>
        ))}
      </div>
      {snapshot && <Ranking snapshot={snapshot} playerNumber={playerNumber} />}
    </section>
  )
}

function Ranking({ snapshot, playerNumber }) {
  const { order, runners } = snapshot
  const leader = runners[order[0] - 1]
  const playerRank = order.indexOf(playerNumber)
  const rows = order.slice(0, SHOWN_LEADERS).map((number, k) => ({ number, rank: k + 1 }))
  if (playerRank >= SHOWN_LEADERS) rows.push({ number: playerNumber, rank: playerRank + 1 })

  return (
    <ol className="field__ranking">
      {rows.map(({ number, rank }) => {
        const runner = runners[number - 1]
        const behind = leader.traveled - runner.traveled
        return (
          <li key={number} className={number === playerNumber ? 'is-player' : ''}>
            <span className="field__rank">{rank}</span>
            <span className="field__number" style={chipColors(number)}>
              {number}
            </span>
            <span className="field__style">{STYLES[runner.style].label}</span>
            <span className="field__gap">
              {runner.finishedAt !== null ? 'ゴール' : rank === 1 ? '先頭' : `-${behind.toFixed(1)}m`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
