import { describe, expect, expectTypeOf, it } from 'vitest'
import { deepFreeze } from './deepFreeze'
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
      location: {
        standardUtcOffset: '-08:00',
        daylightUtcOffset: '-07:00',
      },
      home: {
        targetAnnualKwh: 15_500,
      },
      ev: {
        targetMonthlyKwh: 340,
        targetAnnualKwh: 4_080,
      },
      solar: {
        capacityKw: 8,
        equipment: 'premium',
      },
      tariff: {
        plan: 'R-1B',
        energyRatesUsdPerKwh: { high: 0.35124 },
      },
      emissions: {
        kgCo2ePerKwh: 0.229,
        sourceYear: 2024,
      },
    })
  })

  it('defines the complete monthly profile totaling the annual solar reference', () => {
    expect(LOS_ANGELES_2026.months).toEqual([
      { month: 1, solarTargetKwh: 791, homeTargetKwh: 1_250, lowF: 47, highF: 67, rainStartProbability: 0.18 },
      { month: 2, solarTargetKwh: 867, homeTargetKwh: 1_150, lowF: 49, highF: 68, rainStartProbability: 0.18 },
      { month: 3, solarTargetKwh: 1_155, homeTargetKwh: 1_050, lowF: 51, highF: 71, rainStartProbability: 0.12 },
      { month: 4, solarTargetKwh: 1_300, homeTargetKwh: 950, lowF: 54, highF: 75, rainStartProbability: 0.07 },
      { month: 5, solarTargetKwh: 1_380, homeTargetKwh: 1_000, lowF: 57, highF: 78, rainStartProbability: 0.03 },
      { month: 6, solarTargetKwh: 1_440, homeTargetKwh: 1_200, lowF: 61, highF: 84, rainStartProbability: 0.01 },
      { month: 7, solarTargetKwh: 1_470, homeTargetKwh: 1_650, lowF: 65, highF: 91, rainStartProbability: 0.005 },
      { month: 8, solarTargetKwh: 1_414.65, homeTargetKwh: 1_825, lowF: 65, highF: 92, rainStartProbability: 0.005 },
      { month: 9, solarTargetKwh: 1_205, homeTargetKwh: 1_550, lowF: 63, highF: 89, rainStartProbability: 0.01 },
      { month: 10, solarTargetKwh: 1_050, homeTargetKwh: 1_250, lowF: 58, highF: 82, rainStartProbability: 0.04 },
      { month: 11, solarTargetKwh: 780, homeTargetKwh: 1_100, lowF: 51, highF: 73, rainStartProbability: 0.1 },
      { month: 12, solarTargetKwh: 728.84, homeTargetKwh: 1_525, lowF: 47, highF: 67, rainStartProbability: 0.16 },
    ])
    const solarTargets = LOS_ANGELES_2026.months.map(({ solarTargetKwh }) => solarTargetKwh)
    expect(solarTargets.reduce((total, target) => total + target, 0)).toBe(13_581.49)
  })

  it('exposes deep readonly scenario types without mutating at runtime', () => {
    const mutableProfile = { months: [{ solarTargetKwh: 1 }] }
    const profile = deepFreeze(mutableProfile)

    expectTypeOf<typeof LOS_ANGELES_2026.id>().toEqualTypeOf<'woodland-hills-2026-v1'>()
    expectTypeOf<typeof LOS_ANGELES_2026.location.standardUtcOffset>().toEqualTypeOf<'-08:00'>()
    expectTypeOf(profile.months).toMatchTypeOf<readonly { readonly solarTargetKwh: number }[]>()

    if (false) {
      // @ts-expect-error Deep-frozen arrays cannot be mutated.
      profile.months.push({ solarTargetKwh: 2 })
      // @ts-expect-error Deep-frozen profiles cannot be mutated.
      profile.months[0].solarTargetKwh = 2
    }
  })
})
