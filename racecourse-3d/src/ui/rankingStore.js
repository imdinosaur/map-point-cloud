/**
 * 名次的極簡外部 store：3D 場景每幀推進比賽，但只以低頻率發布名次給面板，
 * 面板用 useSyncExternalStore 訂閱，不會讓整個 App（含 Canvas）跟著重新渲染。
 */
export function createRankingStore() {
  let snapshot = null
  const listeners = new Set()
  return {
    get: () => snapshot,
    set(next) {
      snapshot = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
