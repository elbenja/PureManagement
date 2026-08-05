import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { generateEv } from './ev'
import { buildAugustClock } from './time'

const intervalHours = LOS_ANGELES_AUGUST_2026.intervalMinutes / 60
const departureMinute = 7 * 60 + 30

const monthlyTotal = (values: number[]) => values.reduce((total, value) => total + value, 0)

describe('generateEv', () => {
  it('generates a deterministic, seed-varying August driving and charging profile', () => {
    const clock = buildAugustClock()
    const first = generateEv(clock, LOS_ANGELES_AUGUST_2026.seedId)
    const second = generateEv(clock, LOS_ANGELES_AUGUST_2026.seedId)
    const alternate = generateEv(clock, 'a-different-driver')

    expect(first).toHaveLength(8_928)
    expect(first).toEqual(second)
    expect(first).not.toEqual(alternate)
    expect(
      first.filter((point) => point.tripKwh > 0).map((point) => point.tripKwh.toFixed(8)),
    ).not.toEqual(alternate.filter((point) => point.tripKwh > 0).map((point) => point.tripKwh.toFixed(8)))
  })

  it('normalizes driving and charging to the scenario target with consistent interval units', () => {
    const points = generateEv(buildAugustClock(), LOS_ANGELES_AUGUST_2026.seedId)

    expect(monthlyTotal(points.map((point) => point.tripKwh))).toBeCloseTo(LOS_ANGELES_AUGUST_2026.ev.targetAugustKwh, 10)
    expect(monthlyTotal(points.map((point) => point.chargeKwh))).toBeCloseTo(LOS_ANGELES_AUGUST_2026.ev.targetAugustKwh, 10)
    points.forEach((point) => {
      expect([point.chargeKw, point.chargeKwh, point.socStartKwh, point.socEndKwh, point.tripKwh].every(Number.isFinite)).toBe(true)
      expect(point.chargeKw).toBeGreaterThanOrEqual(0)
      expect(point.chargeKw).toBeLessThanOrEqual(LOS_ANGELES_AUGUST_2026.ev.chargerKw)
      expect(point.chargeKwh).toBeGreaterThanOrEqual(0)
      expect(point.tripKwh).toBeGreaterThanOrEqual(0)
      expect(point.chargeKwh).toBeCloseTo(point.chargeKw * intervalHours, 12)
    })
  })

  it('keeps a feasible chronological vehicle state and never charges while away', () => {
    const clock = buildAugustClock()
    const points = generateEv(clock, LOS_ANGELES_AUGUST_2026.seedId)

    expect(points[0]!.socStartKwh).toBeCloseTo(
      LOS_ANGELES_AUGUST_2026.ev.capacityKwh * (LOS_ANGELES_AUGUST_2026.ev.initialSocPercent / 100),
      12,
    )
    points.forEach((point, index) => {
      expect(point.socStartKwh).toBeGreaterThanOrEqual(0)
      expect(point.socEndKwh).toBeGreaterThanOrEqual(0)
      expect(point.socStartKwh).toBeLessThanOrEqual(LOS_ANGELES_AUGUST_2026.ev.capacityKwh)
      expect(point.socEndKwh).toBeLessThanOrEqual(LOS_ANGELES_AUGUST_2026.ev.capacityKwh)
      if (index > 0) expect(point.socStartKwh).toBeCloseTo(points[index - 1]!.socEndKwh, 12)
      if (point.tripKwh > 0) expect(point.socStartKwh).toBeGreaterThanOrEqual(point.tripKwh)
      if (!point.available) expect(point.chargeKwh).toBe(0)
      expect(point.tripKwh === 0 || point.chargeKwh === 0).toBe(true)
    })
    expect(points.at(-1)!.socEndKwh).toBeCloseTo(points[0]!.socStartKwh, 10)
  })

  it('uses weekday commute departures and reliable at-home evening charging', () => {
    const clock = buildAugustClock()
    const points = generateEv(clock, LOS_ANGELES_AUGUST_2026.seedId)
    let preferredCharge = 0
    let totalCharge = 0
    let weekendAwayWindows = 0

    clock.forEach((slot, index) => {
      const point = points[index]!
      if (slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5) {
        if (slot.minuteOfDay === departureMinute) expect(point.tripKwh).toBeGreaterThan(0)
        if (slot.minuteOfDay >= departureMinute && slot.minuteOfDay < 18 * 60) expect(point.available).toBe(false)
      }
      if ((slot.dayOfWeek === 0 || slot.dayOfWeek === 6) && !point.available) weekendAwayWindows += 1

      totalCharge += point.chargeKwh
      if (slot.minuteOfDay >= 20 * 60 || slot.minuteOfDay < departureMinute) preferredCharge += point.chargeKwh
    })

    expect(weekendAwayWindows).toBeGreaterThan(0)
    expect(preferredCharge / totalCharge).toBeGreaterThanOrEqual(0.9)
  })

  it('varies daily trip and charging behavior instead of repeating a daily loop', () => {
    const clock = buildAugustClock()
    const points = generateEv(clock, LOS_ANGELES_AUGUST_2026.seedId)
    const dailyTrips = Array.from({ length: 31 }, (_, dayIndex) =>
      monthlyTotal(points.slice(dayIndex * 288, (dayIndex + 1) * 288).map((point) => point.tripKwh)),
    )
    const dailyCharge = Array.from({ length: 31 }, (_, dayIndex) =>
      monthlyTotal(points.slice(dayIndex * 288, (dayIndex + 1) * 288).map((point) => point.chargeKwh)),
    )

    expect(new Set(dailyTrips.map((kwh) => kwh.toFixed(6))).size).toBeGreaterThan(15)
    expect(new Set(dailyCharge.map((kwh) => kwh.toFixed(6))).size).toBeGreaterThan(15)
  })

  it.each([
    ['a reversed pair', (clock: ReturnType<typeof buildAugustClock>) => [clock[1]!, clock[0]!, ...clock.slice(2)], 0],
    ['a duplicated slot', (clock: ReturnType<typeof buildAugustClock>) => clock.map((slot, index) => (index === 2 ? clock[1]! : slot)), 2],
    ['a corrupted ISO field', (clock: ReturnType<typeof buildAugustClock>) => clock.map((slot, index) => (index === 3 ? { ...slot, iso: 'bad' } : slot)), 3],
    ['a corrupted time field', (clock: ReturnType<typeof buildAugustClock>) => clock.map((slot, index) => (index === 4 ? { ...slot, minuteOfDay: 10 } : slot)), 4],
  ])('rejects %s with the offending index', (_case, corruptClock, index) => {
    expect(() => generateEv(corruptClock(buildAugustClock()), LOS_ANGELES_AUGUST_2026.seedId)).toThrow(
      `Invalid EV clock slot at index ${index}`,
    )
  })

  it('rejects a partial clock with a clear length error', () => {
    expect(() => generateEv(buildAugustClock().slice(0, -1), LOS_ANGELES_AUGUST_2026.seedId)).toThrow(
      'EV clock must contain 8928 records',
    )
  })

  it('rejects an absent clock slot with the offending index', () => {
    const malformed = buildAugustClock()
    malformed[5] = undefined as unknown as (typeof malformed)[number]

    expect(() => generateEv(malformed, LOS_ANGELES_AUGUST_2026.seedId)).toThrow('Invalid EV clock slot at index 5')
  })
})
