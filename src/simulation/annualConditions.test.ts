import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { buildAnnualConditions } from './annualConditions'
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

  it('rejects clocks that are incomplete or differ from the canonical annual clock', () => {
    const clock = buildYearClock()
    const malformed = [...clock]
    const extraField = [...clock]
    malformed[42] = { ...malformed[42]!, minuteOfDay: 999 }
    extraField[43] = { ...extraField[43]!, unexpected: true } as (typeof clock)[number]

    expect(() => buildAnnualConditions(clock.slice(0, -1), LOS_ANGELES_2026.seedId)).toThrow(
      /Expected 105120 clock records/,
    )
    expect(() => buildAnnualConditions(malformed, LOS_ANGELES_2026.seedId)).toThrow(
      /Clock differs from canonical annual clock at index 42/,
    )
    expect(() => buildAnnualConditions(extraField, LOS_ANGELES_2026.seedId)).toThrow(
      /Clock differs from canonical annual clock at index 43/,
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
      expect(day.maximumTemperatureF - day.minimumTemperatureF).toBeCloseTo(
        expected.highF - expected.lowF,
        2,
      )
    }

    const monthBoundaryRangeChanges = days
      .slice(1)
      .filter((day, index) => day.month !== days[index]!.month)
      .map((day) => {
        const previousDay = days[day.dayOfYear - 2]!
        const previousRange = previousDay.maximumTemperatureF - previousDay.minimumTemperatureF
        const currentRange = day.maximumTemperatureF - day.minimumTemperatureF
        return Math.abs(currentRange - previousRange)
      })

    expect(Math.min(...conditions.map((condition) => condition.temperatureF))).toBeGreaterThanOrEqual(35)
    expect(Math.max(...conditions.map((condition) => condition.temperatureF))).toBeLessThanOrEqual(112)
    expect(Math.max(...monthBoundaryRangeChanges)).toBeLessThan(0.2)
    expect(maximumIntradayTemperatureStep).toBeLessThan(0.35)
    expect(maximumIntradayCloudStep).toBeLessThan(0.01)
  })

  it('shapes each rainy day as one continuous daytime pulse', () => {
    const clock = buildYearClock()
    const conditions = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    const rainyDayOfYear = clock.find(
      (_, index) => conditions[index]!.precipitationInches > 0,
    )!.dayOfYear
    const precipitationAt = (minuteOfDay: number) =>
      conditions[
        clock.findIndex(
          (slot) => slot.dayOfYear === rainyDayOfYear && slot.minuteOfDay === minuteOfDay,
        )
      ]!.precipitationInches

    expect(precipitationAt(2 * 60 + 50)).toBe(0)
    expect(precipitationAt(2 * 60 + 55)).toBeGreaterThan(0)
    expect(precipitationAt(12 * 60 + 15)).toBeGreaterThan(precipitationAt(9 * 60))
    expect(precipitationAt(12 * 60 + 15)).toBeGreaterThan(precipitationAt(18 * 60))
    expect(precipitationAt(21 * 60 + 40)).toBe(0)
  })
})
