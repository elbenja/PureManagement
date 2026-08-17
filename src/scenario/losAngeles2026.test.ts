import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from './losAngeles2026'

const expectDeepFrozen = (value: unknown) => {
  expect(Object.isFrozen(value)).toBe(true)

  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(expectDeepFrozen)
  }
}

describe('LOS_ANGELES_2026', () => {
  it('defines the deeply frozen annual Woodland Hills simulation contract', () => {
    expectDeepFrozen(LOS_ANGELES_2026)
    expect(LOS_ANGELES_2026).toMatchObject({
      id: 'woodland-hills-2026-v1',
      records: 105_120,
      intervalMinutes: 5,
      year: 2026,
    })
  })

  it('defines exact monthly solar targets totaling the annual reference', () => {
    const solarTargets = LOS_ANGELES_2026.months.map(({ solarTargetKwh }) => solarTargetKwh)

    expect(solarTargets).toEqual([
      791,
      867,
      1_155,
      1_300,
      1_380,
      1_440,
      1_470,
      1_414.65,
      1_205,
      1_050,
      780,
      728.84,
    ])
    expect(solarTargets.reduce((total, target) => total + target, 0)).toBe(13_581.49)
  })
})
