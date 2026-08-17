import { beforeAll, describe, expect, it } from 'vitest'
import type { ClockSlot } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { buildAnnualConditions } from './annualConditions'
import { generateAnnualSolar, rawAnnualSolarKw } from './annualSolar'
import type { Condition } from './conditions'
import { buildYearClock } from './yearClock'

const intervalHours = LOS_ANGELES_2026.intervalMinutes / 60

const daylightWindow = (slot: ClockSlot) => {
  const dayLengthHours = 12 + 2.2 * Math.sin((2 * Math.PI * (slot.dayOfYear - 80)) / 365)
  const solarNoonMinute = slot.utcOffset === '-07:00' ? 12 * 60 + 55 : 11 * 60 + 55

  return {
    start: solarNoonMinute - dayLengthHours * 30,
    end: solarNoonMinute + dayLengthHours * 30,
  }
}

const pointAt = (clock: ClockSlot[], iso: string) => {
  const index = clock.findIndex((slot) => slot.iso === iso)
  expect(index).toBeGreaterThanOrEqual(0)
  return { index, slot: clock[index]! }
}

describe('generateAnnualSolar', () => {
  let clock: ClockSlot[]
  let conditions: Condition[]
  let solar: ReturnType<typeof generateAnnualSolar>

  beforeAll(() => {
    clock = buildYearClock()
    conditions = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    solar = generateAnnualSolar(clock, conditions)
  })

  it('generates a finite, capacity-bounded point for every annual interval', () => {
    expect(solar).toHaveLength(105_120)
    expect(solar).toHaveLength(LOS_ANGELES_2026.records)
    expect(solar.every(({ kw, kwh }) =>
      Number.isFinite(kw) &&
      Number.isFinite(kwh) &&
      kw >= 0 &&
      kwh >= 0 &&
      kw <= LOS_ANGELES_2026.solar.capacityKw &&
      Math.abs(kwh - kw * intervalHours) < 1e-12,
    )).toBe(true)
  })

  it('hits every configured month target and the annual reference exactly', () => {
    const totalByMonth = new Map<number, number>()
    for (const [index, point] of solar.entries()) {
      const month = clock[index]!.month
      totalByMonth.set(month, (totalByMonth.get(month) ?? 0) + point.kwh)
    }

    for (const month of LOS_ANGELES_2026.months) {
      expect(totalByMonth.get(month.month)).toBeCloseTo(month.solarTargetKwh, 6)
    }
    expect(solar.reduce((total, point) => total + point.kwh, 0)).toBeCloseTo(13_581.49, 6)
  })

  it('is dark strictly outside each calendar day daylight window', () => {
    expect(solar.every((point, index) => {
      const window = daylightWindow(clock[index]!)
      const minute = clock[index]!.minuteOfDay
      return minute >= window.start && minute < window.end || point.kw === 0
    })).toBe(true)
  })

  it('uses longer summer daylight than winter daylight', () => {
    const winter = daylightWindow(pointAt(clock, '2026-01-15T12:00:00.000-08:00').slot)
    const summer = daylightWindow(pointAt(clock, '2026-06-15T12:00:00.000-07:00').slot)

    expect(summer.end - summer.start).toBeGreaterThan(winter.end - winter.start)
    expect(rawAnnualSolarKw(pointAt(clock, '2026-06-15T06:30:00.000-07:00').slot, 1)).toBeGreaterThan(0)
    expect(rawAnnualSolarKw(pointAt(clock, '2026-01-15T06:30:00.000-08:00').slot, 1)).toBe(0)
  })

  it('switches the DST-adjacent daylight window using the slot offset', () => {
    const beforeDstDark = pointAt(clock, '2026-03-07T06:05:00.000-08:00').slot
    const beforeDstLight = pointAt(clock, '2026-03-07T06:15:00.000-08:00').slot
    const afterDstDark = pointAt(clock, '2026-03-08T07:05:00.000-07:00').slot
    const afterDstLight = pointAt(clock, '2026-03-08T07:10:00.000-07:00').slot

    expect(rawAnnualSolarKw(beforeDstDark, 1)).toBe(0)
    expect(rawAnnualSolarKw(beforeDstLight, 1)).toBeGreaterThan(0)
    expect(rawAnnualSolarKw(afterDstDark, 1)).toBe(0)
    expect(rawAnnualSolarKw(afterDstLight, 1)).toBeGreaterThan(0)
  })

  it('keeps month calibration isolated at configured calendar boundaries', () => {
    const january = pointAt(clock, '2026-01-31T12:00:00.000-08:00')
    const february = pointAt(clock, '2026-02-01T12:00:00.000-08:00')
    const august = pointAt(clock, '2026-08-31T12:00:00.000-07:00')
    const september = pointAt(clock, '2026-09-01T12:00:00.000-07:00')

    expect(solar[january.index]!.kwh).toBeGreaterThan(0)
    expect(solar[february.index]!.kwh).toBeGreaterThan(0)
    expect(solar[august.index]!.kwh).toBeGreaterThan(0)
    expect(solar[september.index]!.kwh).toBeGreaterThan(0)
    expect(clock[january.index]!.month).toBe(1)
    expect(clock[february.index]!.month).toBe(2)
    expect(clock[august.index]!.month).toBe(8)
    expect(clock[september.index]!.month).toBe(9)
  })

  it('reduces raw midday production for rainy conditions', () => {
    const clear = pointAt(clock, '2026-06-15T12:55:00.000-07:00').slot
    const rainy = pointAt(clock, '2026-01-15T11:55:00.000-08:00').slot

    expect(rawAnnualSolarKw(clear, 0.95)).toBeGreaterThan(rawAnnualSolarKw(rainy, 0.35))
  })

  it('is deterministic and leaves its inputs unchanged', () => {
    const beforeClock = structuredClone(clock)
    const beforeConditions = structuredClone(conditions)

    expect(generateAnnualSolar(clock, conditions)).toEqual(solar)
    expect(clock).toEqual(beforeClock)
    expect(conditions).toEqual(beforeConditions)
  })

  it('rejects malformed annual solar inputs with clear errors', () => {
    const nonCanonicalClock = clock.map((slot) => ({ ...slot }))
    nonCanonicalClock[42] = { ...nonCanonicalClock[42]!, minuteOfDay: 999 }
    const zeroCloud = conditions.map((condition) => ({ ...condition, cloudFactor: 0 }))
    const malformedConditions = conditions.map((condition) => ({ ...condition }))
    malformedConditions[42] = null as unknown as Condition

    expect(() => generateAnnualSolar(clock, conditions.slice(1))).toThrow('Solar input length mismatch')
    expect(() => generateAnnualSolar(nonCanonicalClock, conditions)).toThrow(
      'Clock differs from canonical annual clock at index 42',
    )
    expect(() => generateAnnualSolar(clock, zeroCloud)).toThrow('Solar target unreachable for month 1')
    expect(() => generateAnnualSolar(clock, malformedConditions)).toThrow('Invalid condition at index 42')

    for (const cloudFactor of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01]) {
      const invalidConditions = conditions.map((condition) => ({ ...condition }))
      invalidConditions[42] = { ...invalidConditions[42]!, cloudFactor }
      expect(() => generateAnnualSolar(clock, invalidConditions)).toThrow(
        'Invalid cloud factor at index 42',
      )
    }
  })
})
