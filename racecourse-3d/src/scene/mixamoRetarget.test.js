import { describe, expect, it } from 'vitest'
import { AnimationClip, Bone, Euler, Group, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { MIXAMO_TO_VRM, removeRootDrift, retargetMixamoClip } from './mixamoRetarget'

const HIPS_HEIGHT = 100 // Mixamo 以公分為單位
const VRM_HIPS_HEIGHT = 0.8

/** 最小的假 VRM：每根 humanoid 骨骼一個 normalized 節點 */
function fakeVrm(metaVersion = '1') {
  const scene = new Group()
  const nodes = Object.fromEntries(
    Object.values(MIXAMO_TO_VRM).map((bone) => {
      const node = new Group()
      node.name = `Normalized_${bone}`
      scene.add(node)
      return [bone, node]
    }),
  )
  return {
    scene,
    meta: { metaVersion },
    humanoid: {
      getNormalizedBoneNode: (bone) => nodes[bone] ?? null,
      normalizedRestPose: { hips: { position: [0, VRM_HIPS_HEIGHT, 0] } },
    },
  }
}

/** Mixamo 骨架：hips → spine，spine 的靜止姿勢帶有旋轉（非 T-pose） */
function fakeMixamoAsset(spineRest, tracks) {
  const asset = new Group()
  const hips = new Bone()
  hips.name = 'mixamorigHips'
  hips.position.set(0, HIPS_HEIGHT, 0)
  const spine = new Bone()
  spine.name = 'mixamorigSpine'
  spine.quaternion.copy(spineRest)
  hips.add(spine)
  asset.add(hips)
  asset.animations = [new AnimationClip('Take 001', 0, []), new AnimationClip('mixamo.com', 1, tracks)]
  return asset
}

const quaternionAt = (track, i) => new Quaternion().fromArray(track.values, i * 4)

describe('MIXAMO_TO_VRM', () => {
  it('maps every Mixamo bone to a distinct VRM bone', () => {
    const vrmBones = Object.values(MIXAMO_TO_VRM)
    expect(new Set(vrmBones).size).toBe(vrmBones.length)
    expect(MIXAMO_TO_VRM.mixamorigLeftUpLeg).toBe('leftUpperLeg')
    expect(MIXAMO_TO_VRM.mixamorigRightHandPinky3).toBe('rightLittleDistal')
    expect(MIXAMO_TO_VRM.mixamorigLeftHandThumb1).toBe('leftThumbMetacarpal')
  })
})

describe('removeRootDrift', () => {
  it('removes forward travel but keeps height and in-stride sway', () => {
    const times = [0, 0.5, 1]
    const values = [0, 90, 0, 3, 95, 52, 0, 90, 100]
    const out = removeRootDrift(values, times)
    expect(out.slice(6)).toEqual([0, 90, 0]) // 循環終點回到起點
    expect(out[1]).toBe(90)
    expect(out[4]).toBe(95)
    expect(out[3]).toBe(3)
    expect(out[5]).toBeCloseTo(2) // 52 − 中點應有的 50
  })
})

describe('retargetMixamoClip', () => {
  const spineRest = new Quaternion().setFromEuler(new Euler(0.3, 0.2, -0.1))

  it('turns the Mixamo rest pose into a zero rotation on the VRM bone', () => {
    const track = new QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0], spineRest.toArray())
    const clip = retargetMixamoClip(fakeMixamoAsset(spineRest, [track]), fakeVrm())
    const out = clip.tracks.find((t) => t.name === 'Normalized_spine.quaternion')
    expect(quaternionAt(out, 0).angleTo(new Quaternion())).toBeCloseTo(0)
  })

  it('mirrors rotations for VRM 0.x models', () => {
    const bend = new Quaternion().setFromEuler(new Euler(0.4, 0, 0)).premultiply(spineRest)
    const track = new QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0], bend.toArray())
    const [v1] = retargetMixamoClip(fakeMixamoAsset(spineRest, [track]), fakeVrm('1')).tracks
    const [v0] = retargetMixamoClip(fakeMixamoAsset(spineRest, [track]), fakeVrm('0')).tracks
    const [x1, y1, z1, w1] = v1.values
    expect([...v0.values].map((v) => +v.toFixed(6))).toEqual([-x1, y1, -z1, w1].map((v) => +v.toFixed(6)))
  })

  it('scales hips height to the VRM and drops root travel', () => {
    const track = new VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 100, 0, 0, 100, 300])
    const [hips] = retargetMixamoClip(fakeMixamoAsset(new Quaternion(), [track]), fakeVrm()).tracks
    expect(hips.name).toBe('Normalized_hips.position')
    expect([...hips.values].map((v) => +v.toFixed(6))).toEqual([0, VRM_HIPS_HEIGHT, 0, 0, VRM_HIPS_HEIGHT, 0])
  })

  it('skips bones the VRM does not have', () => {
    const track = new QuaternionKeyframeTrack('mixamorigUnknown.quaternion', [0], [0, 0, 0, 1])
    expect(retargetMixamoClip(fakeMixamoAsset(new Quaternion(), [track]), fakeVrm()).tracks).toEqual([])
  })

  it('fails clearly when the FBX has no Mixamo clip', () => {
    const asset = fakeMixamoAsset(new Quaternion(), [])
    asset.animations = []
    expect(() => retargetMixamoClip(asset, fakeVrm())).toThrow('mixamo.com')
  })
})
