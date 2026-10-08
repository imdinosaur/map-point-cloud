import { DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { COLORS } from './sceneConfig'

// 路面材質：幾何 UV 以公尺為單位（見 buildBandGeometry / buildSlabGeometry），貼圖依真實尺寸重複。
// 貼圖為 ambientCG 的 CC0 素材，見 public/textures/CREDITS.md。

const TEXTURE_DIR = `${import.meta.env.BASE_URL}textures/`
const ANISOTROPY = 8 // 低角度（騎手、追跡視角）看遠處路面時保持清晰

/**
 * tile：貼圖一張涵蓋幾公尺；tint：與貼圖相乘的色調；fallback：貼圖載入前或失敗時的純色；
 * emissive：補光色（暗處不至於全黑）；emissiveFromMap：補光也套用顏色貼圖，保留紋理。
 * stripes：割草條紋（沿跑道方向的深淺帶，寬度公尺）。
 */
const SURFACES = {
  turf: { set: 'turf', tile: 4, tint: '#e2f5cf', fallback: COLORS.turf, stripes: 4.5 },
  steeple: { set: 'turf', tile: 4, tint: '#f2ffdf', fallback: COLORS.steeple, stripes: 4.5 },
  venue: { set: 'turf', tile: 4, tint: '#d4ecc0', fallback: COLORS.turf },
  dirt: { set: 'sand', tile: 3, tint: '#ffcf9e', fallback: COLORS.dirt },
  // 側牆：深色土壤貼圖換到線性色彩空間後幾乎全黑，改用砂地貼圖染成土色。
  // 誇張後的側牆可達數公尺高，背光面只剩約四成光量，所以用同一張貼圖再加一層自發光補亮，背光時仍看得出是泥土
  wall: { set: 'sand', tile: 3, tint: '#c49470', fallback: '#8a6446', emissive: '#6e4a2e', emissiveFromMap: true },
}

const MACRO_SCALE = 1 / 37 // 大尺度明暗變化的取樣尺度（公尺⁻¹），打散遠看時的格子感
const STRIPE_CONTRAST = 0.07 // 割草條紋明暗差（±）

/**
 * 在 MeshStandardMaterial 的貼圖取樣後加入：
 * 1. 大尺度明暗：同一張貼圖放大 37 倍再取樣一次，遠看時不會出現規律的重複格子。
 * 2. 割草條紋：依橫向距離（uv.y，公尺）交替深淺，邊緣稍微柔化以免鋸齒。
 */
function addSurfaceDetail(material, stripes) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stripeWidth = { value: stripes ?? 0 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMeters;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMeters = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMeters;\nuniform float stripeWidth;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          float macro = dot(texture2D(map, vMeters * ${MACRO_SCALE.toFixed(5)}).rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb *= 0.7 + 0.75 * macro;
        #endif
        if (stripeWidth > 0.0) {
          float phase = fract(vMeters.y / (2.0 * stripeWidth));
          float band = smoothstep(0.45, 0.55, phase) - smoothstep(0.95, 1.0, phase);
          diffuseColor.rgb *= 1.0 + ${STRIPE_CONTRAST.toFixed(3)} * (band * 2.0 - 1.0);
        }`,
      )
  }
  // 不同 stripes 設定要編譯成不同程式，否則會共用快取的 shader
  material.customProgramCacheKey = () => `surface-${stripes ?? 0}`
}

function createMaterial({ fallback, stripes, emissive = '#000000' }) {
  const material = new MeshStandardMaterial({ color: fallback, emissive, roughness: 0.95, side: DoubleSide })
  addSurfaceDetail(material, stripes)
  return material
}

function loadSet(loader, set, tile) {
  const load = (name, isColor) =>
    loader.loadAsync(`${TEXTURE_DIR}${set}_${name}.jpg`).then((texture) => {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(1 / tile, 1 / tile)
      texture.anisotropy = ANISOTROPY
      if (isColor) texture.colorSpace = SRGBColorSpace
      return texture
    })
  return Promise.all([load('color', true), load('normal', false), load('rough', false)])
}

/**
 * 建立所有路面材質。材質先以純色出現，貼圖載入完成後再換上，不會讓整個場景等待下載。
 * @returns {{ materials: Record<keyof typeof SURFACES, MeshStandardMaterial>, ready: Promise<void>, dispose: () => void }}
 */
export function createSurfaceMaterials() {
  const materials = Object.fromEntries(Object.entries(SURFACES).map(([key, spec]) => [key, createMaterial(spec)]))
  const loader = new TextureLoader()
  const sets = {}
  const textures = []

  const ready = Promise.all(
    Object.entries(SURFACES).map(async ([key, { set, tile, tint, emissiveFromMap }]) => {
      // 同一組貼圖只下載一次；共用同一組的路面 tile 必須相同（貼圖的 repeat 是共用的）
      sets[set] ??= loadSet(loader, set, tile)
      const [map, normalMap, roughnessMap] = await sets[set]
      textures.push(map, normalMap, roughnessMap)
      Object.assign(materials[key], { map, normalMap, roughnessMap, roughness: 1 })
      if (emissiveFromMap) materials[key].emissiveMap = map
      materials[key].color.set(tint)
      materials[key].needsUpdate = true
    }),
  ).then(() => undefined)

  const dispose = () => {
    Object.values(materials).forEach((material) => material.dispose())
    new Set(textures).forEach((texture) => texture.dispose())
  }
  return { materials, ready, dispose }
}
