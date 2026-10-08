import { useEffect, useState } from 'react'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { retargetMixamoClip } from './mixamoRetarget'

const ANIMATION_DIR = `${import.meta.env.BASE_URL}animations/`
// slow：低速時的跑法，fast：速度 ×3 以上（見 runAnimator 的 FAST_RUN_FROM）
const CLIP_URLS = { slow: `${ANIMATION_DIR}fast-run.fbx`, fast: `${ANIMATION_DIR}sprint.fbx` }

/** 同一個 vrm 只載入、retarget 一次（useLoader 會快取 vrm，重新掛載時拿到同一個） */
const cache = new WeakMap()

async function loadClips(vrm) {
  const loader = new FBXLoader()
  const entries = await Promise.all(
    Object.entries(CLIP_URLS).map(async ([key, url]) => [key, retargetMixamoClip(await loader.loadAsync(url), vrm)]),
  )
  return Object.fromEntries(entries)
}

/**
 * 背景載入 Mixamo 跑步動作。載入中或失敗時回傳 null，由呼叫端改用程序式動作，
 * 所以動作檔（不進版控）缺少時角色仍會跑。
 * @returns {{ slow: import('three').AnimationClip, fast: import('three').AnimationClip } | null}
 */
export default function useRunClips(vrm) {
  const [clips, setClips] = useState(null)

  useEffect(() => {
    let active = true
    if (!cache.has(vrm)) cache.set(vrm, loadClips(vrm))
    cache.get(vrm).then(
      (loaded) => active && setClips(loaded),
      (error) => console.warn('跑步動作載入失敗，改用程序式動作', error),
    )
    return () => {
      active = false
    }
  }, [vrm])

  return clips
}
