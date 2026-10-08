import { useSyncExternalStore } from 'react'
import { FIELD } from '../course/field'
import { WAKU_COLORS, wakuOf } from '../course/startingGate'

const SHOWN_LEADERS = 5
// 枠色上的數字顏色（依 JRA 出馬表：白、黃、橙、桃底用黑字）
const DARK_TEXT_WAKU = new Set([1, 5, 7, 8])

const chipColors = (number, count) => {
  const waku = wakuOf(number, count)
  return { background: WAKU_COLORS[waku - 1], color: DARK_TEXT_WAKU.has(waku) ? '#1d2a1f' : '#fff' }
}

/**
 * 比賽與レース再現：選擇自己的馬番（VRM 角色），並顯示即時名次。
 * 名次由 rankingStore 低頻率發布，這裡訂閱即可，不會讓 3D 場景重新渲染。
 */
export default function RaceField({ title, playerNumber, onPlayerNumberChange, rankingStore }) {
  const snapshot = useSyncExternalStore(rankingStore.subscribe, rankingStore.get)
  const count = snapshot?.runners.length ?? FIELD.runners
  const numbers = Array.from({ length: count }, (_, k) => k + 1)

  return (
    <section className="panel__group">
      {title && <p className="field__title">{title}</p>}
      <span className="panel__label">あなたの馬番（{count}頭立て）</span>
      <div className="field__numbers" role="radiogroup" aria-label="馬番">
        {numbers.map((number) => (
          <button
            key={number}
            type="button"
            role="radio"
            aria-checked={number === playerNumber}
            className={number === playerNumber ? 'is-active' : ''}
            style={chipColors(number, count)}
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
  const byNumber = (number) => runners.find((runner) => runner.number === number)
  const leader = byNumber(order[0])
  const playerRank = order.indexOf(playerNumber)
  const rows = order.slice(0, SHOWN_LEADERS).map((number, k) => ({ number, rank: k + 1 }))
  if (playerRank >= SHOWN_LEADERS) rows.push({ number: playerNumber, rank: playerRank + 1 })

  return (
    <ol className="field__ranking">
      {rows.map(({ number, rank }) => {
        const runner = byNumber(number)
        const behind = leader.traveled - runner.traveled
        return (
          <li key={number} className={number === playerNumber ? 'is-player' : ''}>
            <span className="field__rank">{rank}</span>
            <span className="field__number" style={chipColors(number, runners.length)}>
              {number}
            </span>
            <span className="field__style">{runner.label}</span>
            <span className="field__gap">
              {runner.finishedAt !== null ? 'ゴール' : rank === 1 ? '先頭' : `-${behind.toFixed(1)}m`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
