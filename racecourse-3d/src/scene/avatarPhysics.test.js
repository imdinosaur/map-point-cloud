import { describe, expect, it } from 'vitest'
import { Object3D, Vector3 } from 'three'
import { chainPresetFor, jointPairs, scaledSettings, windForce } from './avatarPhysics'

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

describe('windForce', () => {
  const back = new Vector3(0, 0, -1)

  it('is plain gravity when there is no wind', () => {
    const { dir, power } = windForce(1.5, back, 0)
    expect(power).toBeCloseTo(1.5)
    expect(dir.y).toBeCloseTo(-1)
  })

  it('tilts the pull backwards as the wind grows', () => {
    const { dir, power } = windForce(1, back, 1)
    expect(power).toBeCloseTo(Math.SQRT2)
    expect(dir.z).toBeCloseTo(-Math.SQRT1_2)
    expect(dir.y).toBeCloseTo(-Math.SQRT1_2)
  })

  it('still blows chains that have no gravity (ears)', () => {
    const { dir, power } = windForce(0, back, 0.5)
    expect(power).toBeCloseTo(0.5)
    expect(dir.z).toBeCloseTo(-1)
  })
})
