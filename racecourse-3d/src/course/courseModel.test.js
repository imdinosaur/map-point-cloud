import { describe, expect, it } from 'vitest'
import { CHUTE_STARTS } from './chute'
import { DIRT, RACE_DISTANCES, STEEPLE, TURF, TURF_COURSES } from './courseData'
import { createCourseModel, isValidRunId, LAYOUT, offsetForLength, parseRunId, turfWidthAt } from './courseModel'
import { FIELD } from './field'

const model = createCourseModel()
const distanceToLoop = (p) => Math.min(...model.points.map((q) => Math.hypot(p.x - q.x, p.z - q.z)))

describe('createCourseModel', () => {
  it('reproduces the official lap lengths of turf A〜D within 0.5%', () => {
    for (const { length, railShift } of Object.values(TURF_COURSES)) {
      expect(Math.abs(model.measureLength(-railShift) - length) / length).toBeLessThan(0.005)
    }
  })

  it('reproduces dirt and steeplechase lap lengths within 1%', () => {
    for (const { length } of [DIRT, STEEPLE]) {
      expect(Math.abs(model.measureLength(offsetForLength(length)) - length) / length).toBeLessThan(0.01)
    }
  })

  it('puts the goal at elevation 0 and the backstretch below it', () => {
    expect(model.turfElevation(0)).toBe(0)
    const backstretch = model.indexForRemaining(900, TURF.length)
    expect(model.turfElevation(backstretch)).toBeLessThan(-2)
  })

  it('keeps the dirt course inside the turf course without overlap', () => {
    expect(LAYOUT.dirtOuter).toBeGreaterThan(LAYOUT.turfRail)
    expect(LAYOUT.steepleOuter).toBeGreaterThan(LAYOUT.dirtRail)
  })

  it('joins the chute at the end of the backstretch, before the 1,600m start', () => {
    expect(model.junctionRemaining).toBeLessThan(CHUTE_STARTS.pocket)
    expect(model.junctionRemaining).toBeGreaterThan(CHUTE_STARTS.pocket - 150)
  })
})

describe('createRun', () => {
  it('runs every official distance from start to goal', () => {
    for (const [surface, distances] of Object.entries(RACE_DISTANCES)) {
      for (const distance of distances) {
        const run = model.createRun(`${surface}-${distance}`, 0)
        expect(Math.abs(run.distance - distance)).toBeLessThan(1)
        const goal = run.path.traveled.findIndex((t) => Math.abs(t - run.distance) < 1e-6)
        expect(run.elevations[goal]).toBeCloseTo(0)
      }
    }
  })

  it('continues past the goal so runners can slow down', () => {
    const run = model.createRun('turf-2400', 0)
    expect(run.path.length - run.distance).toBeGreaterThan(FIELD.runoutMax)
    expect(model.createRun('lap', 0).path.length).toBe(model.createRun('lap', 0).distance)
  })

  it('starts 1,600m / 1,800m / 2,000m on the chute and the rest on the oval', () => {
    const startOffset = (distance) => distanceToLoop(model.createRun(`turf-${distance}`, 0).path.points[0])
    // 1,600m 在直線延長上、距匯入點僅約 70m，偏離圓弧較少
    expect(startOffset(CHUTE_STARTS.pocket)).toBeGreaterThan(5)
    expect(startOffset(CHUTE_STARTS.diagonal)).toBeGreaterThan(40)
    expect(startOffset(CHUTE_STARTS.south)).toBeGreaterThan(40)
    for (const distance of [1400, 2300, 3400]) expect(startOffset(distance)).toBeLessThan(1)
  })

  it('runs 2,000m around the outside, away from the 1,800m gate', () => {
    const gate1800 = model.createRun('turf-1800', 0).path.points[0]
    const path2000 = model.createRun('turf-2000', 0).path.points
    const closest = Math.min(...path2000.map((p) => Math.hypot(p.x - gate1800.x, p.z - gate1800.z)))
    expect(closest).toBeGreaterThan(12)
  })

  it('points the start outward, away from the infield', () => {
    for (const id of ['turf-1400', 'turf-2300', 'dirt-1400', 'turf-1800']) {
      const { path, startOutward } = model.createRun(id, 0)
      const start = path.points[0]
      const moved = { x: start.x + startOutward.x * 10, z: start.z + startOutward.z * 10 }
      expect(Math.hypot(moved.x, moved.z)).toBeGreaterThan(Math.hypot(start.x, start.z))
    }
  })

  it('keeps the turf outer edge inside the official venue outline', () => {
    const outline = model.venueEdges[0]
    const inside = ({ x, z }) => {
      let crossings = 0
      outline.forEach((a, k) => {
        const b = outline[(k + 1) % outline.length]
        if (a.z > z !== b.z > z && x < a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z)) crossings += 1
      })
      return crossings % 2 === 1
    }
    const outsideCount = model.points.filter((p, i) => {
      const d = model.turfOuter(i)
      return !inside({ x: p.x + model.normals[i].x * d, z: p.z + model.normals[i].z * d })
    }).length
    expect(outsideCount).toBe(0)
  })

  it('uses the venue surface height on chute sections so the gate sits on the grass', () => {
    for (const id of ['turf-1800', 'turf-2000']) {
      const { path, elevations } = model.createRun(id, 0)
      expect(path.chuteCount).toBeGreaterThan(0)
      const start = path.points[0]
      expect(elevations[0]).toBeCloseTo(model.venueElevationAt(start.x, start.z))
    }
  })

  it('fills the venue outside the oval', () => {
    expect(model.venue.length).toBeGreaterThan(0)
  })

  it('moves turf runs outward with the B〜D rail', () => {
    const a = model.createRun('lap', 0)
    const d = model.createRun('lap', TURF_COURSES.D.railShift)
    expect(d.distance - a.distance).toBeCloseTo(TURF_COURSES.D.length - TURF_COURSES.A.length, 0)
  })
})

describe('parseRunId', () => {
  it('parses lap and race ids', () => {
    expect(parseRunId('lap')).toEqual({ surface: 'turf', distance: null })
    expect(parseRunId('dirt-1400')).toEqual({ surface: 'dirt', distance: 1400 })
  })

  it('accepts only official distances', () => {
    expect(isValidRunId('lap')).toBe(true)
    expect(isValidRunId('turf-1800')).toBe(true)
    expect(isValidRunId('dirt-1600')).toBe(false)
    expect(isValidRunId('steeple-3000')).toBe(false)
    expect(isValidRunId(null)).toBe(false)
  })
})

describe('turfWidthAt', () => {
  it('is widest on the home stretch and narrowest on the backstretch', () => {
    expect(turfWidthAt(0.9)).toBeCloseTo(TURF.widthMax)
    expect(turfWidthAt(0.5)).toBeCloseTo(TURF.widthMin)
  })
})

describe('chuteBranches', () => {
  const model = createCourseModel()

  it('exposes the 1,800m and 2,000m start chutes with a normal per point', () => {
    expect(model.chuteBranches).toHaveLength(2)
    for (const { points, normals } of model.chuteBranches) {
      expect(points.length).toBeGreaterThan(10)
      expect(normals).toHaveLength(points.length)
    }
  })

  it('starts each chute on the main turf course', () => {
    for (const { points } of model.chuteBranches) {
      const [junction] = points
      const nearest = Math.min(...model.points.map((p) => Math.hypot(p.x - junction.x, p.z - junction.z)))
      expect(nearest).toBeLessThan(1)
    }
  })
})

describe('run lane frame', () => {
  const run = model.createRun('turf-2000', 0)

  it('gives an outward normal per point that matches the starting gate direction at the start', () => {
    expect(run.outward).toHaveLength(run.path.points.length)
    const [first] = run.outward
    expect(first.x * run.startOutward.x + first.z * run.startOutward.z).toBeGreaterThan(0.9)
  })

  it('reports positive curvature on the bends and almost none on the home straight', () => {
    const bend = Math.max(...Array.from({ length: 50 }, (_, k) => run.curvatureAt(run.distance * 0.6 + k * 4)))
    expect(bend).toBeGreaterThan(1 / 200)
    expect(Math.abs(run.curvatureAt(run.distance - 150))).toBeLessThan(1 / 2000)
  })
})
