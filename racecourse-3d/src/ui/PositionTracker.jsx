import { useEffect, useRef } from 'react'
import { WAKU_COLORS, WAKU_TEXT_COLORS } from '../course/startingGate'
import { trackerLayout } from './trackerLayout'
import './PositionTracker.css'

const PADDING_X = 26 // 左右留白（px），讓最前與最後的徽章不貼邊
const PADDING_Y = 22
const BADGE = 28 // 與 CSS --badge 相同（px）
const BADGE_GAP_X = BADGE + 8 // 箭頭也算進去，避免徽章左右重疊

/**
 * 轉播式位置追蹤條（全員往右跑的版本）：每頭馬一個枠色圓形徽章＋背號＋行進方向箭頭。
 * 由 Field 每幀呼叫 trackerRef.current(field, playerNumber)；徽章位置直接改 DOM，不經 React 重新渲染。
 */
export default function PositionTracker({ trackerRef, visible }) {
  const barRef = useRef(null)

  useEffect(() => {
    const badges = new Map() // 馬番 → DOM

    const badgeFor = (runner) => {
      const existing = badges.get(runner.number)
      if (existing && existing.dataset.waku === String(runner.waku)) return existing
      existing?.remove()
      const badge = document.createElement('span')
      badge.className = 'tracker__badge'
      badge.dataset.waku = String(runner.waku)
      badge.textContent = String(runner.number)
      badge.style.setProperty('--waku', WAKU_COLORS[runner.waku - 1])
      badge.style.color = WAKU_TEXT_COLORS[runner.waku - 1]
      barRef.current.append(badge)
      badges.set(runner.number, badge)
      return badge
    }

    trackerRef.current = (field, playerNumber) => {
      const bar = barRef.current
      if (!bar || bar.hidden) return
      const width = bar.clientWidth - PADDING_X * 2
      const height = bar.clientHeight - PADDING_Y * 2
      const present = new Set()
      const spacing = { minGapX: BADGE_GAP_X / width, rowStep: BADGE / height }
      for (const { number, x, y } of trackerLayout(field.runners, spacing)) {
        const runner = field.runners.find((r) => r.number === number)
        const badge = badgeFor(runner)
        badge.style.transform = `translate(${PADDING_X + x * width}px, ${PADDING_Y + y * height}px)`
        badge.classList.toggle('is-player', number === playerNumber)
        present.add(number)
      }
      // 換比賽頭數變少時移除多餘的徽章
      for (const [number, badge] of badges) {
        if (present.has(number)) continue
        badge.remove()
        badges.delete(number)
      }
    }

    return () => {
      trackerRef.current = null
      badges.forEach((badge) => badge.remove())
    }
  }, [trackerRef])

  return <div ref={barRef} className="tracker" hidden={!visible} aria-hidden="true" />
}
