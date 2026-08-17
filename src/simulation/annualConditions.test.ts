import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { buildAnnualConditions, selectAnnualWeatherAttempt } from './annualConditions'
import { buildYearClock } from './yearClock'

const DAY_TYPES = ['weekday', 'weekend', 'heatwave', 'cloudy'] as const
const WEATHER_STATES = ['clear', 'partly-cloudy', 'overcast', 'rain'] as const

interface DailySummary {
  dayOfYear: number
  month: number
  day: number
  dayType: (typeof DAY_TYPES)[number]
  minimumTemperatureF: number
  maximumTemperatureF: number
  rainy: boolean
}

const summarizeDays = (
  clock: ReturnType<typeof buildYearClock>,
  conditions: ReturnType<typeof buildAnnualConditions>,
) => {
  const days = new Map<number, DailySummary>()

  for (const [index, slot] of clock.entries()) {
    const condition = conditions[index]!
    const existing = days.get(slot.dayOfYear)

    if (existing) {
      existing.minimumTemperatureF = Math.min(existing.minimumTemperatureF, condition.temperatureF)
      existing.maximumTemperatureF = Math.max(existing.maximumTemperatureF, condition.temperatureF)
      existing.rainy ||= condition.precipitationInches > 0
    } else {
      days.set(slot.dayOfYear, {
        dayOfYear: slot.dayOfYear,
        month: slot.month,
        day: slot.day,
        dayType: condition.dayType,
        minimumTemperatureF: condition.temperatureF,
        maximumTemperatureF: condition.temperatureF,
        rainy: condition.precipitationInches > 0,
      })
    }
  }

  return [...days.values()]
}

const hasConsecutiveRun = (days: DailySummary[], minimumLength: number) => {
  let runLength = 0
  let previousDayOfYear = -1

  for (const day of days) {
    runLength = day.dayOfYear === previousDayOfYear + 1 ? runLength + 1 : 1
    if (runLength >= minimumLength) return true
    previousDayOfYear = day.dayOfYear
  }

  return false
}

const expectedTemperatureEnvelope = (day: Pick<DailySummary, 'month' | 'day'>) => {
  const profile = LOS_ANGELES_2026.months[day.month - 1]!
  const nextProfile = LOS_ANGELES_2026.months[day.month % 12]!
  const daysInMonth = new Date(Date.UTC(LOS_ANGELES_2026.year, day.month, 0)).getUTCDate()
  const progress = (day.day - 1) / daysInMonth

  return {
    lowF: profile.lowF + (nextProfile.lowF - profile.lowF) * progress,
    highF: profile.highF + (nextProfile.highF - profile.highF) * progress,
  }
}

const expectAnnualEventInvariants = (
  clock: ReturnType<typeof buildYearClock>,
  conditions: ReturnType<typeof buildAnnualConditions>,
) => {
  const days = summarizeDays(clock, conditions)
  const winterRainDays = days.filter((day) => [12, 1, 2].includes(day.month) && day.rainy)
  const heatWaveDays = days.filter(
    (day) => day.month >= 7 && day.month <= 9 && day.dayType === 'heatwave',
  )
  const coldSnapDays = days.filter((day) => {
    const envelope = expectedTemperatureEnvelope(day)
    return [12, 1, 2].includes(day.month) && day.maximumTemperatureF < envelope.highF - 5
  })
  const wetSeasonRainIntervals = conditions.filter(
    (condition, index) =>
      [11, 12, 1, 2, 3].includes(clock[index]!.month) && condition.precipitationInches > 0,
  ).length
  const drySeasonRainIntervals = conditions.filter(
    (condition, index) =>
      clock[index]!.month >= 6 && clock[index]!.month <= 9 && condition.precipitationInches > 0,
  ).length

  expect(hasConsecutiveRun(winterRainDays, 2)).toBe(true)
  expect(hasConsecutiveRun(heatWaveDays, 3)).toBe(true)
  expect(hasConsecutiveRun(coldSnapDays, 2)).toBe(true)
  expect(wetSeasonRainIntervals).toBeGreaterThan(drySeasonRainIntervals)

  expect(
    conditions.some(
      (condition, index) =>
        condition.precipitationInches > 0 &&
        (index === 0 || conditions[index - 1]!.precipitationInches === 0) &&
        (index === conditions.length - 1 || conditions[index + 1]!.precipitationInches === 0),
    ),
  ).toBe(false)
}

describe('buildAnnualConditions', () => {
  it('reproduces a complete finite annual condition series from the same seed', () => {
    const clock = buildYearClock()
    const first = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    const second = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)

    expect(first).toEqual(second)
    expect(first).toHaveLength(105_120)
    expect(first).toHaveLength(LOS_ANGELES_2026.records)

    expect(first.every((condition) => Number.isFinite(condition.temperatureF))).toBe(true)
    expect(first.every((condition) => condition.cloudFactor >= 0 && condition.cloudFactor <= 1)).toBe(true)
    expect(
      first.every(
        (condition) =>
          Number.isFinite(condition.precipitationInches) && condition.precipitationInches >= 0,
      ),
    ).toBe(true)
    expect(first.every((condition) => typeof condition.occupied === 'boolean')).toBe(true)
    expect(first.every((condition) => DAY_TYPES.includes(condition.dayType))).toBe(true)
    expect(first.every((condition) => WEATHER_STATES.includes(condition.weatherState))).toBe(true)
  })

  it('changes the generated weather when the seed changes', () => {
    const clock = buildYearClock()

    expect(buildAnnualConditions(clock, 'annual-weather-a')).not.toEqual(
      buildAnnualConditions(clock, 'annual-weather-b'),
    )
  })

  it('selects the first accepted weather retry and fails after exactly 32 rejected attempts', () => {
    const clock = buildYearClock()
    const retried = selectAnnualWeatherAttempt(clock, 'probe-3')
    const rejectedSeeds: string[] = []

    expect(retried.attempt).toBe(1)
    expect(() =>
      selectAnnualWeatherAttempt(clock, 'never-accepted', (_clock, weatherSeed) => {
        rejectedSeeds.push(weatherSeed)
        return []
      }),
    ).toThrow(/after 32 attempts/)
    expect(rejectedSeeds).toHaveLength(32)
    expect(rejectedSeeds[0]).toBe('never-accepted:weather')
    expect(rejectedSeeds.at(-1)).toBe('never-accepted:weather:31')
  })

  it('emits complete declared event spans without wrapping or truncating the calendar year', () => {
    const clock = buildYearClock()
    const januaryStart = selectAnnualWeatherAttempt(clock, 'start-0').descriptors
    const rejectedYearEndRain = selectAnnualWeatherAttempt(clock, 'edge-21').descriptors
    const rejectedYearEndColdSnap = selectAnnualWeatherAttempt(clock, 'edge-51').descriptors
    const descriptorSets = [
      januaryStart,
      rejectedYearEndRain,
      rejectedYearEndColdSnap,
      selectAnnualWeatherAttempt(clock, LOS_ANGELES_2026.seedId).descriptors,
    ]
    const eventFields = [
      ['rainEvent', 1, 3],
      ['heatWaveEvent', 3, 4],
      ['coldSnapEvent', 2, 3],
    ] as const

    expect(januaryStart[0]?.rainEvent).toMatchObject({ startDayOfYear: 1, durationDays: 2 })
    expect(januaryStart[1]?.rainEvent).toEqual(januaryStart[0]?.rainEvent)
    expect(buildAnnualConditions(clock, 'start-0')[0]!.temperatureF).toBe(
      Number(
        (
          januaryStart[0]!.lowF +
          (januaryStart[0]!.highF - januaryStart[0]!.lowF) * 0.25 +
          januaryStart[0]!.dailyOffsetF
        ).toFixed(3),
      ),
    )
    expect(rejectedYearEndRain[364]?.rainEvent).toBeNull()
    expect(rejectedYearEndColdSnap[363]?.coldSnapEvent).toBeNull()
    expect(rejectedYearEndColdSnap[364]?.coldSnapEvent).toBeNull()

    for (const descriptors of descriptorSets) {
      for (const [field, minimumDuration, maximumDuration] of eventFields) {
        const events = descriptors
          .map((descriptor) => descriptor[field])
          .filter(
            (event, index, all) =>
              event !== null &&
              all.findIndex(
                (candidate) => candidate?.startDayOfYear === event.startDayOfYear,
              ) === index,
          )

        for (const event of events) {
          expect(event).not.toBeNull()
          expect(event!.durationDays).toBeGreaterThanOrEqual(minimumDuration)
          expect(event!.durationDays).toBeLessThanOrEqual(maximumDuration)
          expect(event!.startDayOfYear + event!.durationDays - 1).toBeLessThanOrEqual(365)
          expect(
            descriptors.filter(
              (descriptor) =>
                descriptor[field]?.startDayOfYear === event!.startDayOfYear,
            ),
          ).toHaveLength(event!.durationDays)
        }
      }
    }
  })

  it('rejects clocks that are incomplete or differ from the canonical annual clock', () => {
    const clock = buildYearClock()
    const malformed = [...clock]
    const extraField = [...clock]
    const sparse = [...clock]
    const nullSlot = [...clock]
    const primitiveSlot = [...clock]
    malformed[42] = { ...malformed[42]!, minuteOfDay: 999 }
    extraField[43] = { ...extraField[43]!, unexpected: true } as (typeof clock)[number]
    delete sparse[44]
    nullSlot[45] = null as unknown as (typeof clock)[number]
    primitiveSlot[46] = 7 as unknown as (typeof clock)[number]

    expect(() => buildAnnualConditions(clock.slice(0, -1), LOS_ANGELES_2026.seedId)).toThrow(
      /Expected 105120 clock records/,
    )
    expect(() => buildAnnualConditions(malformed, LOS_ANGELES_2026.seedId)).toThrow(
      /Clock differs from canonical annual clock at index 42/,
    )
    expect(() => buildAnnualConditions(extraField, LOS_ANGELES_2026.seedId)).toThrow(
      /Clock differs from canonical annual clock at index 43/,
    )
    expect(() => buildAnnualConditions(sparse, LOS_ANGELES_2026.seedId)).toThrow(
      /Invalid annual clock slot at index 44/,
    )
    expect(() => buildAnnualConditions(nullSlot, LOS_ANGELES_2026.seedId)).toThrow(
      /Invalid annual clock slot at index 45/,
    )
    expect(() => buildAnnualConditions(primitiveSlot, LOS_ANGELES_2026.seedId)).toThrow(
      /Invalid annual clock slot at index 46/,
    )
  })

  it.each([LOS_ANGELES_2026.seedId, 'annual-weather-a', 'annual-weather-b']) (
    'generates coherent seasonal event families for seed %s',
    (seedId) => {
      const clock = buildYearClock()
      const conditions = buildAnnualConditions(clock, seedId)

      expectAnnualEventInvariants(clock, conditions)
    },
  )

  it('derives weather labels, rain suppression, and occupancy from correlated local conditions', () => {
    const clock = buildYearClock()
    const conditions = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    const rainyDays = new Set(
      clock
        .filter((_, index) => conditions[index]!.precipitationInches > 0)
        .map((slot) => slot.dayOfYear),
    )
    const middayRainCloudFactors: number[] = []
    const middayDryCloudFactors: number[] = []
    let weatherStateMismatch = -1
    let occupancyMismatch = -1

    for (const [index, slot] of clock.entries()) {
      const condition = conditions[index]!
      const expectedWeatherState =
        condition.precipitationInches > 0
          ? 'rain'
          : rainyDays.has(slot.dayOfYear)
            ? 'overcast'
            : condition.cloudFactor < 0.82
              ? 'partly-cloudy'
              : 'clear'
      const expectedOccupied =
        slot.dayOfWeek === 0 ||
        slot.dayOfWeek === 6 ||
        slot.minuteOfDay < 8 * 60 ||
        slot.minuteOfDay >= 17 * 60

      if (weatherStateMismatch < 0 && condition.weatherState !== expectedWeatherState) {
        weatherStateMismatch = index
      }
      if (occupancyMismatch < 0 && condition.occupied !== expectedOccupied) {
        occupancyMismatch = index
      }

      if (slot.minuteOfDay === 12 * 60) {
        ;(rainyDays.has(slot.dayOfYear) ? middayRainCloudFactors : middayDryCloudFactors).push(
          condition.cloudFactor,
        )
      }
    }

    const average = (values: number[]) =>
      values.reduce((total, value) => total + value, 0) / values.length

    expect(weatherStateMismatch).toBe(-1)
    expect(occupancyMismatch).toBe(-1)
    expect(average(middayRainCloudFactors)).toBeLessThan(average(middayDryCloudFactors) * 0.6)
  })

  it('uses gradual seasonal envelopes and smooth bounded intraday curves', () => {
    const clock = buildYearClock()
    const conditions = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    const days = summarizeDays(clock, conditions)
    const conditionIndexByDayAndMinute = new Map(
      clock.map((slot, index) => [`${slot.dayOfYear}:${slot.minuteOfDay}`, index]),
    )
    let maximumIntradayTemperatureStep = 0
    let maximumIntradayCloudStep = 0

    for (let index = 1; index < conditions.length; index += 1) {
      const slot = clock[index]!
      const previousSlot = clock[index - 1]!

      if (
        slot.dayOfYear === previousSlot.dayOfYear &&
        slot.minuteOfDay === previousSlot.minuteOfDay + LOS_ANGELES_2026.intervalMinutes
      ) {
        maximumIntradayTemperatureStep = Math.max(
          maximumIntradayTemperatureStep,
          Math.abs(conditions[index]!.temperatureF - conditions[index - 1]!.temperatureF),
        )
        maximumIntradayCloudStep = Math.max(
          maximumIntradayCloudStep,
          Math.abs(conditions[index]!.cloudFactor - conditions[index - 1]!.cloudFactor),
        )
      }
    }

    for (const day of days) {
      const expected = expectedTemperatureEnvelope(day)
      const lowIndex = conditionIndexByDayAndMinute.get(`${day.dayOfYear}:${4 * 60}`)!
      const highIndex = conditionIndexByDayAndMinute.get(`${day.dayOfYear}:${16 * 60}`)!

      expect(conditions[highIndex]!.temperatureF - conditions[lowIndex]!.temperatureF).toBeCloseTo(
        expected.highF - expected.lowF,
        2,
      )
      // Daily noise is ±1.5 °F, cold snaps subtract 8 °F, and heat waves add 10 °F.
      // The 0.25 °F margin covers rounded seasonal interpolation during a blend.
      expect(day.minimumTemperatureF).toBeGreaterThanOrEqual(expected.lowF - 9.75)
      expect(day.minimumTemperatureF).toBeLessThanOrEqual(expected.lowF + 11.75)
      expect(day.maximumTemperatureF).toBeGreaterThanOrEqual(expected.highF - 9.75)
      expect(day.maximumTemperatureF).toBeLessThanOrEqual(expected.highF + 11.75)
    }

    expect(Math.min(...conditions.map((condition) => condition.temperatureF))).toBeGreaterThanOrEqual(35)
    expect(Math.max(...conditions.map((condition) => condition.temperatureF))).toBeLessThanOrEqual(112)
    expect(maximumIntradayTemperatureStep).toBeLessThan(0.6)
    expect(maximumIntradayCloudStep).toBeLessThan(0.025)
  })

  it('keeps every adjacent absolute interval coherent through event boundaries and DST', () => {
    const clock = buildYearClock()

    for (const seedId of [LOS_ANGELES_2026.seedId, 'boundary-4']) {
      const conditions = buildAnnualConditions(clock, seedId)
      let maximumTemperatureStep = 0
      let maximumCloudStep = 0
      let maximumPrecipitationStep = 0

      for (let index = 1; index < conditions.length; index += 1) {
        maximumTemperatureStep = Math.max(
          maximumTemperatureStep,
          Math.abs(conditions[index]!.temperatureF - conditions[index - 1]!.temperatureF),
        )
        maximumCloudStep = Math.max(
          maximumCloudStep,
          Math.abs(conditions[index]!.cloudFactor - conditions[index - 1]!.cloudFactor),
        )
        maximumPrecipitationStep = Math.max(
          maximumPrecipitationStep,
          Math.abs(
            conditions[index]!.precipitationInches -
              conditions[index - 1]!.precipitationInches,
          ),
        )
      }

      // The temperature allowance covers the 55/65-minute local-clock jumps at DST.
      // Heat-wave and cold-snap offsets are blended over 36 absolute five-minute slots.
      expect(maximumTemperatureStep).toBeLessThan(4.25)
      expect(maximumCloudStep).toBeLessThan(0.08)
      expect(maximumPrecipitationStep).toBeLessThan(0.00015)
    }
  })

  it('preserves shared rain-system parameters across a month boundary', () => {
    const clock = buildYearClock()
    const conditions = buildAnnualConditions(clock, 'boundary-4')
    const october31 = 304
    const november1 = 305
    const conditionAt = (dayOfYear: number, minuteOfDay: number) =>
      conditions[
        clock.findIndex(
          (slot) => slot.dayOfYear === dayOfYear && slot.minuteOfDay === minuteOfDay,
        )
      ]!

    expect(conditionAt(october31, 12 * 60).weatherState).toBe('rain')
    expect(conditionAt(november1, 12 * 60).weatherState).toBe('rain')
    expect(conditionAt(november1, 0).cloudFactor).toBeCloseTo(
      conditionAt(october31, 23 * 60 + 55).cloudFactor,
      2,
    )
    expect(conditionAt(november1, 12 * 60).precipitationInches).toBe(
      conditionAt(october31, 12 * 60).precipitationInches,
    )
    expect(conditionAt(november1, 12 * 60).cloudFactor).toBe(
      conditionAt(october31, 12 * 60).cloudFactor,
    )
  })

  it('persists temperature and cloud parameters through dry heat waves and cold snaps', () => {
    const descriptors = selectAnnualWeatherAttempt(
      buildYearClock(),
      LOS_ANGELES_2026.seedId,
    ).descriptors

    for (const eventField of ['heatWaveEvent', 'coldSnapEvent'] as const) {
      const event = descriptors.find(
        (descriptor) => descriptor[eventField] !== null && descriptor.rainEvent === null,
      )![eventField]!
      const eventDays = descriptors.filter(
        (descriptor) =>
          descriptor[eventField]?.startDayOfYear === event.startDayOfYear &&
          descriptor.rainEvent === null,
      )

      expect(eventDays.length).toBeGreaterThan(1)
      expect(new Set(eventDays.map((day) => day.dailyOffsetF)).size).toBe(1)
      expect(new Set(eventDays.map((day) => day.cloudBaseline)).size).toBe(1)
      expect(new Set(eventDays.map((day) => day.cloudPhase)).size).toBe(1)
    }
  })

  it('shapes every rainy local day as one bounded continuous daytime pulse', () => {
    const clock = buildYearClock()
    const conditions = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    const rainyDayNumbers = new Set(
      clock
        .filter((_, index) => conditions[index]!.precipitationInches > 0)
        .map((slot) => slot.dayOfYear),
    )

    for (const dayOfYear of rainyDayNumbers) {
      const dayIndexes = clock
        .map((slot, index) => (slot.dayOfYear === dayOfYear ? index : -1))
        .filter((index) => index >= 0)
      const positivePositions = dayIndexes
        .map((index, position) =>
          conditions[index]!.precipitationInches > 0 ? position : -1,
        )
        .filter((position) => position >= 0)
      const precipitationAt = (minuteOfDay: number) =>
        conditions[
          dayIndexes.find((index) => clock[index]!.minuteOfDay === minuteOfDay)!
        ]!.precipitationInches

      expect(positivePositions.length).toBeGreaterThan(1)
      expect(positivePositions.at(-1)! - positivePositions[0]! + 1).toBe(positivePositions.length)
      expect(precipitationAt(12 * 60 + 15)).toBeGreaterThan(precipitationAt(9 * 60))
      expect(precipitationAt(12 * 60 + 15)).toBeGreaterThan(precipitationAt(18 * 60))
      expect(conditions[dayIndexes[0]!]!.precipitationInches).toBe(0)
      expect(conditions[dayIndexes.at(-1)!]!.precipitationInches).toBe(0)
    }

    expect(
      conditions.every(
        (condition) =>
          condition.precipitationInches <= 0.0046 &&
          condition.precipitationInches === Number(condition.precipitationInches.toFixed(6)),
      ),
    ).toBe(true)
  })

  it('groups DST local days into 276 and 300 conditions with weekend occupancy intact', () => {
    const clock = buildYearClock()
    const conditions = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    const indexesByDate = new Map<string, number[]>()

    for (const [index, slot] of clock.entries()) {
      const date = slot.iso.slice(0, 10)
      indexesByDate.set(date, [...(indexesByDate.get(date) ?? []), index])
    }

    const springIndexes = indexesByDate.get('2026-03-08')!
    const autumnIndexes = indexesByDate.get('2026-11-01')!

    expect(springIndexes).toHaveLength(276)
    expect(autumnIndexes).toHaveLength(300)
    expect(springIndexes.every((index) => conditions[index]!.occupied)).toBe(true)
    expect(autumnIndexes.every((index) => conditions[index]!.occupied)).toBe(true)
  })
})
