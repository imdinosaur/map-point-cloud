import { GOAL_SLOPE } from '../course/courseData'

// 高度誇張滑桿：對數刻度，低倍率可細調，最右端 ×100 剛好讓 2m 的坂變成「高低差200Mの坂」
export const EXAGGERATION = {
  min: 1,
  max: 100,
  initial: 8,
  sliderSteps: 1000,
}

const LOG_RANGE = Math.log(EXAGGERATION.max / EXAGGERATION.min)
const MEME_RISE = 200

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/** 滑桿位置（0〜sliderSteps）→ 整數誇張倍率 */
export function exaggerationFromSlider(position) {
  const t = clamp(position, 0, EXAGGERATION.sliderSteps) / EXAGGERATION.sliderSteps
  return Math.round(EXAGGERATION.min * Math.exp(t * LOG_RANGE))
}

/** 誇張倍率 → 滑桿位置 */
export function sliderFromExaggeration(exaggeration) {
  const value = clamp(exaggeration, EXAGGERATION.min, EXAGGERATION.max)
  return Math.round((Math.log(value / EXAGGERATION.min) / LOG_RANGE) * EXAGGERATION.sliderSteps)
}

/** 誇張後，ゴール前の坂看起來的高低差（m） */
export const slopeRise = (exaggeration) => GOAL_SLOPE.rise * exaggeration

/** 是否已達「高低差200Mの坂」 */
export const isMemeSlope = (exaggeration) => slopeRise(exaggeration) >= MEME_RISE
