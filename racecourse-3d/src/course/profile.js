/**
 * 依剩餘距離在斷面圖上線性內插高度。
 * @param {Array<[number, number]>} profile 依剩餘距離由大到小排列
 * @param {number} remaining 距終點剩餘距離
 */
export function elevationAt(profile, remaining) {
  const first = profile[0]
  const last = profile[profile.length - 1]
  if (remaining >= first[0]) return first[1]
  if (remaining <= last[0]) return last[1]

  for (let k = 1; k < profile.length; k++) {
    const [r1, e1] = profile[k]
    if (remaining >= r1) {
      const [r0, e0] = profile[k - 1]
      const t = (r0 - remaining) / (r0 - r1)
      return e0 + (e1 - e0) * t
    }
  }
  return last[1]
}

/** 已跑比例（0 = 從終點出發，1 = 回到終點）→ 剩餘距離 */
export function remainingFromFraction(fraction, length) {
  const wrapped = ((fraction % 1) + 1) % 1
  return length * (1 - wrapped)
}

/** 剩餘距離 → 已跑比例，可接受負值（過終點後）與超過一周的值 */
export function fractionFromRemaining(remaining, length) {
  const fraction = 1 - remaining / length
  return ((fraction % 1) + 1) % 1
}
