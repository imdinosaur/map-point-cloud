import { describe, expect, it } from 'vitest'
import { Object3D, Vector3 } from 'three'
import {
  WIND,
  chainKey,
  chainPresetFor,
  chainWindGain,
  externalForce,
  jointPairs,
  scaledSettings,
  seedFor,
  swayNoise,
  swayRateFor,
  windGainFor,
} from './avatarPhysics'

describe('chainPresetFor', () => {
  it('matches each sway chain by bone name', () => {
    expect(chainPresetFor('Sp_Hi_MSkirt0_FL_01').name).toBe('skirt')
    expect(chainPresetFor('Sp_Hi_Tail0_B_00').name).toBe('tail')
    expect(chainPresetFor('Sp_He_Hair4_L_03').name).toBe('longHair')
    expect(chainPresetFor('Sp_He_Hair0_C_00').name).toBe('hair')
  })

  it('leaves bust bones and non-sway bones static', () => {
    expect(chainPresetFor('Sp_Ch_Bust0_L_00')).toBeNull()
    expect(chainPresetFor('Thigh_L')).toBeNull()
  })
})

describe('scaledSettings', () => {
  it('scales world-space quantities with the avatar scale', () => {
    const settings = scaledSettings({ stiffness: 1, gravityPower: 0.2, dragForce: 0.4, hitRadius: 0.02 }, 5)
    expect(settings.stiffness).toBeCloseTo(5)
    expect(settings.gravityPower).toBeCloseTo(1)
    expect(settings.hitRadius).toBeCloseTo(0.1)
    expect(settings.dragForce).toBe(0.4) // 阻尼是比例，不隨尺寸變
  })
})

describe('jointPairs', () => {
  const node = (name, ...children) => {
    const object = new Object3D()
    object.name = name
    children.forEach((child) => object.add(child))
    return object
  }

  it('pairs each sway bone with its next sway bone down every chain', () => {
    const root = node('Hip', node('Sp_Hi_Tail0_B_00', node('Sp_Hi_Tail0_B_01', node('Sp_Hi_Tail0_B_02'))), node('Thigh_L'))
    const pairs = jointPairs(root).map(([bone, child]) => `${bone.name}>${child.name}`)
    expect(pairs).toEqual(['Sp_Hi_Tail0_B_00>Sp_Hi_Tail0_B_01', 'Sp_Hi_Tail0_B_01>Sp_Hi_Tail0_B_02'])
  })

  it('follows only the first branch so a bone never gets two joints', () => {
    const root = node('Head', node('Sp_He_Ear0_L_00', node('Sp_He_Ear0_L_01'), node('Sp_He_Ear0_L_01b')))
    expect(jointPairs(root)).toHaveLength(1)
  })
})

describe('externalForce', () => {
  const back = new Vector3(0, 0, -1)

  it('is plain gravity when there is no wind', () => {
    const { dir, power } = externalForce(1.5, back, 0)
    expect(power).toBeCloseTo(1.5)
    expect(dir.y).toBeCloseTo(-1)
  })

  it('tilts the pull backwards as the wind grows', () => {
    const { dir, power } = externalForce(1, back, 1)
    expect(power).toBeCloseTo(Math.SQRT2)
    expect(dir.z).toBeCloseTo(-Math.SQRT1_2)
    expect(dir.y).toBeCloseTo(-Math.SQRT1_2)
  })

  it('adds inertia as extra apparent gravity, scaled by the chain weight', () => {
    const outward = new Vector3(1, 0, 0) // 過彎時往外甩（以 g 為單位）
    const { dir, power } = externalForce(2, back, 0, outward)
    expect(power).toBeCloseTo(2 * Math.SQRT2)
    expect(dir.x).toBeCloseTo(Math.SQRT1_2)
    expect(dir.y).toBeCloseTo(-Math.SQRT1_2)
  })

  it('leaves weightless chains (ears) unaffected by inertia', () => {
    const { power } = externalForce(0, back, 0, new Vector3(1, 0, 0))
    expect(power).toBeCloseTo(0)
  })

  it('still blows chains that have no gravity (ears)', () => {
    const { dir, power } = externalForce(0, back, 0.5)
    expect(power).toBeCloseTo(0.5)
    expect(dir.z).toBeCloseTo(-1)
  })
})

describe('windGainFor', () => {
  it('keeps growing roughly with speed instead of levelling off', () => {
    expect(windGainFor(5)).toBeGreaterThan(windGainFor(1) * 3)
    expect(windGainFor(20)).toBeGreaterThan(windGainFor(5) * 3)
  })

  it('is zero when standing and bounded at absurd speeds', () => {
    expect(windGainFor(0)).toBe(0)
    expect(windGainFor(1000)).toBeLessThanOrEqual(WIND.maxGain)
  })
})

describe('chainWindGain', () => {
  it('lets the twin tails take the full high-speed wind', () => {
    expect(chainWindGain(windGainFor(20), chainPresetFor('Sp_He_Hair4_L_00'))).toBe(windGainFor(20))
  })

  it('caps the skirt so it flutters but is never blown up', () => {
    const skirt = chainPresetFor('Sp_Hi_MSkirt0_F_00')
    expect(chainWindGain(windGainFor(20), skirt)).toBe(skirt.windCap)
    expect(chainWindGain(windGainFor(1), skirt)).toBe(windGainFor(1))
  })
})

describe('swayRateFor', () => {
  it('flaps faster at higher speed, within a limit', () => {
    expect(swayRateFor(0)).toBe(1)
    expect(swayRateFor(20)).toBeGreaterThan(swayRateFor(5))
    expect(swayRateFor(1000)).toBeLessThanOrEqual(WIND.maxSwayRate)
  })
})

describe('chainKey', () => {
  it('groups every joint of one strand under the same key', () => {
    expect(chainKey('Sp_He_Hair4_L_03')).toBe(chainKey('Sp_He_Hair4_L_00'))
    expect(chainKey('Sp_He_Hair4_L_03')).not.toBe(chainKey('Sp_He_Hair4_R_03'))
  })
})

describe('swayNoise', () => {
  const seed = 1.234
  const samples = Array.from({ length: 600 }, (_, i) => swayNoise(i / 60, seed))

  it('stays within -1..1', () => {
    expect(Math.max(...samples)).toBeLessThanOrEqual(1)
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(-1)
  })

  it('swings both ways so the hair moves forward and back', () => {
    expect(Math.max(...samples)).toBeGreaterThan(0.5)
    expect(Math.min(...samples)).toBeLessThan(-0.5)
  })

  it('is smooth from frame to frame (no jitter)', () => {
    const jumps = samples.slice(1).map((v, i) => Math.abs(v - samples[i]))
    expect(Math.max(...jumps)).toBeLessThan(0.15)
  })

  it('differs between strands so the twin tails do not move in lockstep', () => {
    const other = Array.from({ length: 600 }, (_, i) => swayNoise(i / 60, seed + 5))
    const same = samples.filter((v, i) => Math.abs(v - other[i]) < 0.05).length
    expect(same).toBeLessThan(300)
  })
})

describe('seedFor', () => {
  it('gives the left and right twin tails clearly different seeds (names differ by one letter)', () => {
    const left = seedFor(chainKey('Sp_He_Hair4_L_00'))
    const right = seedFor(chainKey('Sp_He_Hair4_R_00'))
    const gap = Math.abs(left - right)
    expect(Math.min(gap, 2 * Math.PI - gap)).toBeGreaterThan(0.5)
  })

  it('is stable across reloads and stays within 0..2π', () => {
    const seed = seedFor('Sp_Hi_Tail0_B')
    expect(seedFor('Sp_Hi_Tail0_B')).toBe(seed)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 * Math.PI)
  })
})
