import { describe, expect, it } from 'vitest'
import { EXAGGERATION, exaggerationFromSlider, isMemeSlope, slopeRise, sliderFromExaggeration } from './exaggerationScale'

describe('exaggerationFromSlider', () => {
  it('maps the slider ends to ×1 and ×100', () => {
    expect(exaggerationFromSlider(0)).toBe(1)
    expect(exaggerationFromSlider(EXAGGERATION.sliderSteps)).toBe(100)
  })

  it('grows logarithmically so the low end keeps fine control', () => {
    expect(exaggerationFromSlider(EXAGGERATION.sliderSteps / 2)).toBe(10)
  })

  it('clamps out-of-range slider values', () => {
    expect(exaggerationFromSlider(-50)).toBe(1)
    expect(exaggerationFromSlider(99999)).toBe(100)
  })
})

describe('sliderFromExaggeration', () => {
  it('round-trips integer exaggerations', () => {
    for (const value of [1, 2, 8, 30, 57, 100]) {
      expect(exaggerationFromSlider(sliderFromExaggeration(value))).toBe(value)
    }
  })
})

describe('slopeRise', () => {
  it('scales the official 2m goal slope', () => {
    expect(slopeRise(1)).toBe(2)
    expect(slopeRise(100)).toBe(200)
  })
})

describe('isMemeSlope', () => {
  it('is true only once the slope reaches 200m', () => {
    expect(isMemeSlope(99)).toBe(false)
    expect(isMemeSlope(100)).toBe(true)
  })
})
