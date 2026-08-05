import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { buildConditions } from './conditions'
import { generateSolar } from './solar'
import { buildAugustClock } from './time'

const dailyAverageCloudFactor = (
  conditions: ReturnType<typeof buildConditions>,
  day: number,
) => {
  const slots = conditions.filter((condition, index) => index / 288 >= day - 1 && index / 288 < day)
  return slots.reduce((total, condition) => total + condition.cloudFactor, 0) / slots.length
}

describe('August conditions and solar generation', () => {
  it('is deterministic for a seeded August clock', () => {
    const clock = buildAugustClock()
    const firstConditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)
    const secondConditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)

    expect(secondConditions).toEqual(firstConditions)
    expect(generateSolar(clock, secondConditions)).toEqual(generateSolar(clock, firstConditions))
  })

  it('generates every August condition and solar point within the anchored target', () => {
    const clock = buildAugustClock()
    const conditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)
    const solar = generateSolar(clock, conditions)
    const totalKwh = solar.reduce((total, point) => total + point.kwh, 0)

    expect(conditions).toHaveLength(8_928)
    expect(solar).toHaveLength(8_928)
    expect(totalKwh).toBeCloseTo(LOS_ANGELES_AUGUST_2026.solar.targetAugustKwh, 6)
    expect(Math.max(...solar.map((point) => point.kw))).toBeLessThanOrEqual(
      LOS_ANGELES_AUGUST_2026.solar.capacityKw,
    )
    expect([...conditions.map((point) => point.temperatureF), ...conditions.map((point) => point.cloudFactor), ...solar.flatMap((point) => [point.kw, point.kwh])].every(Number.isFinite)).toBe(true)
    expect(solar.every((point) => point.kw >= 0 && point.kwh >= 0)).toBe(true)
  })

  it('keeps solar dark outside fixed daylight and varies noon production by day', () => {
    const clock = buildAugustClock()
    const solar = generateSolar(clock, buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId))
    const daylightStart = 6 * 60 + 5
    const daylightEnd = 19 * 60 + 45
    const noonValues = clock.flatMap((slot, index) => (slot.minuteOfDay === 12 * 60 ? [solar[index]!.kw] : []))

    expect(solar.every((point, index) => {
      const minute = clock[index]!.minuteOfDay
      return minute >= daylightStart && minute < daylightEnd || point.kw === 0
    })).toBe(true)
    expect(new Set(noonValues.map((value) => value.toFixed(2))).size).toBeGreaterThanOrEqual(10)
  })

  it('sets the required day types and correlated cloud profiles', () => {
    const clock = buildAugustClock()
    const conditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)
    const dayType = (day: number) => conditions[(day - 1) * 288]!.dayType

    expect(new Set(conditions.map((condition) => condition.dayType))).toEqual(
      new Set(['weekday', 'weekend', 'heatwave', 'cloudy']),
    )
    expect([12, 13, 14, 15].map(dayType)).toEqual(['heatwave', 'heatwave', 'heatwave', 'heatwave'])
    expect([6, 22].map(dayType)).toEqual(['cloudy', 'cloudy'])
    expect(conditions.every((condition) => condition.cloudFactor >= 0 && condition.cloudFactor <= 1)).toBe(true)
    expect(dailyAverageCloudFactor(conditions, 6)).toBeLessThan(dailyAverageCloudFactor(conditions, 3) - 0.2)
    expect(dailyAverageCloudFactor(conditions, 22)).toBeLessThan(dailyAverageCloudFactor(conditions, 3) - 0.2)
  })
})
