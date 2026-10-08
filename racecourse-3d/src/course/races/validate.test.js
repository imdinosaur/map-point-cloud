import { describe, expect, it } from 'vitest'
import { ALL_RACES } from './index'
import { JAPAN_CUP_2023 } from './japanCup2023'
import { validateRace } from './validate'

describe('validateRace', () => {
  it.each(ALL_RACES.map((race) => [race.id, race]))('accepts the registered race %s', (_, race) => {
    expect(validateRace(race)).toEqual([])
  })

  const broken = (changes) => validateRace({ ...JAPAN_CUP_2023, ...changes })
  const withHorse = (k, changes) => ({
    horses: JAPAN_CUP_2023.horses.map((horse, index) => (index === k ? { ...horse, ...changes } : horse)),
  })

  it('reports an unknown distance', () => {
    expect(broken({ runId: 'turf-2401' }).join()).toMatch(/runId/)
  })

  it('reports duplicated or missing horse numbers', () => {
    expect(broken(withHorse(1, { number: 2 })).join()).toMatch(/馬番/)
  })

  it('reports an unreadable time or margin', () => {
    expect(broken(withHorse(3, { time: '2.22.7' })).join()).toMatch(/タイム/)
    expect(broken(withHorse(3, { margin: '半馬身' })).join()).toMatch(/着差/)
  })

  it('reports horses listed out of finishing order', () => {
    const horses = [...JAPAN_CUP_2023.horses]
    ;[horses[0], horses[5]] = [horses[5], horses[0]]
    expect(broken({ horses }).join()).toMatch(/順序/)
  })

  it('reports lap times that do not add up to the winning time', () => {
    expect(broken({ laps: JAPAN_CUP_2023.laps.slice(0, -1) }).join()).toMatch(/ハロンタイム/)
  })

  it('reports a corner line that misses or repeats a horse', () => {
    const corners = [...JAPAN_CUP_2023.corners]
    corners[2] = corners[2].replace('(1,17)', '(1,1)')
    const errors = broken({ corners }).join()
    expect(errors).toMatch(/コーナー 3/)
  })
})
