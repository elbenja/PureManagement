import { beforeAll, describe, expect, it } from 'vitest'
import type { ClockSlot } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { __assertAnnualEvMonthFeasible, generateAnnualEv } from './annualEv'
import type { EvPoint } from './ev'
import { buildYearClock } from './yearClock'

const intervalHours = LOS_ANGELES_2026.intervalMinutes / 60
const initialSocKwh = LOS_ANGELES_2026.ev.capacityKwh * LOS_ANGELES_2026.ev.initialSocPercent / 100
const weekdayDepartureMinute = 7 * 60 + 30
const preferredChargingMinute = 20 * 60

const dateKey = (slot: ClockSlot) => `${slot.year}-${slot.month}-${slot.day}`

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

const totalsByMonth = (clock: readonly ClockSlot[], points: readonly EvPoint[], field: 'tripKwh' | 'chargeKwh') => {
  const totals = new Map<number, number>()
  points.forEach((point, index) => {
    const month = clock[index]!.month
    totals.set(month, (totals.get(month) ?? 0) + point[field])
  })
  return totals
}

describe('generateAnnualEv', () => {
  let clock: ClockSlot[]
  let points: EvPoint[]
  let alternate: EvPoint[]

  beforeAll(() => {
    clock = buildYearClock()
    points = generateAnnualEv(clock, LOS_ANGELES_2026.seedId)
    alternate = generateAnnualEv(clock, 'annual-driver-alternate')
  })

  it('is deterministic, seed-varying, and returns one exact-shape point per annual interval', () => {
    expect(points).toHaveLength(105_120)
    expect(generateAnnualEv(clock, LOS_ANGELES_2026.seedId)).toEqual(points)
    expect(alternate).not.toEqual(points)
    expect(points.map((point) => point.tripKwh)).not.toEqual(alternate.map((point) => point.tripKwh))
    expect(
      points.flatMap((point, index) =>
        point.tripKwh > 0 && [0, 6].includes(clock[index]!.dayOfWeek) ? [index] : [],
      ),
    ).not.toEqual(alternate.flatMap((point, index) =>
      point.tripKwh > 0 && [0, 6].includes(clock[index]!.dayOfWeek) ? [index] : [],
    ))
    expect(points.every((point) => {
      const keys = Reflect.ownKeys(point)
      return keys.length === 6 && [
        'chargeKw',
        'chargeKwh',
        'available',
        'socStartKwh',
        'socEndKwh',
        'tripKwh',
      ].every((key) => keys.includes(key))
    })).toBe(true)
  })

  it('creates exactly one departure on every full local calendar date, including DST days', () => {
    const indexesByDate = new Map<string, number[]>()
    clock.forEach((slot, index) => {
      const indexes = indexesByDate.get(dateKey(slot)) ?? []
      indexes.push(index)
      indexesByDate.set(dateKey(slot), indexes)
    })

    expect(indexesByDate.size).toBe(365)
    expect(indexesByDate.get('2026-3-8')).toHaveLength(276)
    expect(indexesByDate.get('2026-11-1')).toHaveLength(300)

    for (const [date, indexes] of indexesByDate) {
      const departureIndexes = indexes.filter((index) => points[index]!.tripKwh > 0)
      expect(departureIndexes, date).toHaveLength(1)
    }
    expect(points.filter((point) => point.tripKwh > 0)).toHaveLength(365)
  })

  it('allocates exactly 340 kWh of travel per calendar month and 4,080 kWh annually', () => {
    const tripsByMonth = totalsByMonth(clock, points, 'tripKwh')
    const chargesByMonth = totalsByMonth(clock, points, 'chargeKwh')

    for (let month = 1; month <= 12; month += 1) {
      expect(tripsByMonth.get(month)).toBe(LOS_ANGELES_2026.ev.targetMonthlyKwh)
      expect(chargesByMonth.get(month)).toBeGreaterThanOrEqual(250)
      expect(chargesByMonth.get(month)).toBeLessThanOrEqual(450)
    }
    expect(sum(points.map((point) => point.tripKwh))).toBe(LOS_ANGELES_2026.ev.targetAnnualKwh)
    expect(sum(points.map((point) => point.chargeKwh))).toBe(LOS_ANGELES_2026.ev.targetAnnualKwh)
  })

  it('respects daily mileage bounds and the approved weekday/weekend travel windows', () => {
    let valid = true
    points.forEach((point, index) => {
      const slot = clock[index]!
      const weekday = slot.dayOfWeek >= 1 && slot.dayOfWeek <= 5
      if (point.tripKwh > 0) {
        const miles = point.tripKwh / LOS_ANGELES_2026.ev.efficiencyKwhPerMile
        const bounds = weekday ? LOS_ANGELES_2026.ev.weekdayMiles : LOS_ANGELES_2026.ev.weekendMiles
        valid &&= miles >= bounds.min && miles <= bounds.max
        valid &&= weekday
          ? slot.minuteOfDay === weekdayDepartureMinute
          : [570, 600, 630, 660].includes(slot.minuteOfDay)
      }

      if (weekday) {
        valid &&= point.available === (
          slot.minuteOfDay < weekdayDepartureMinute || slot.minuteOfDay >= 18 * 60
        )
      }
    })
    expect(valid).toBe(true)
  })

  it('maintains a finite continuous physical ledger and finishes at the initial SOC', () => {
    expect(points[0]!.socStartKwh).toBe(initialSocKwh)
    let valid = true
    points.forEach((point, index) => {
      valid &&= [
        point.chargeKw,
        point.chargeKwh,
        point.socStartKwh,
        point.socEndKwh,
        point.tripKwh,
      ].every(Number.isFinite)
      valid &&= point.chargeKw >= 0 && point.chargeKw <= LOS_ANGELES_2026.ev.chargerKw
      valid &&= Math.abs(point.chargeKwh - point.chargeKw * intervalHours) < 1e-12
      valid &&= point.socStartKwh >= 0 && point.socStartKwh <= LOS_ANGELES_2026.ev.capacityKwh
      valid &&= point.socEndKwh >= 0 && point.socEndKwh <= LOS_ANGELES_2026.ev.capacityKwh
      valid &&= Math.abs(point.socEndKwh - (point.socStartKwh - point.tripKwh + point.chargeKwh)) < 1e-9
      if (index > 0) valid &&= point.socStartKwh === points[index - 1]!.socEndKwh
      if (!point.available) valid &&= point.chargeKwh === 0
      if (point.tripKwh > 0) {
        valid &&= !point.available && point.chargeKwh === 0 && point.socStartKwh >= point.tripKwh
      }
    })
    expect(valid).toBe(true)
    expect(points.at(-1)!.socEndKwh).toBe(initialSocKwh)
  })

  it('stays continuous across every month boundary and completes the December 31 trip', () => {
    for (let index = 1; index < clock.length; index += 1) {
      if (clock[index]!.month !== clock[index - 1]!.month) {
        expect(clock[index]!.day).toBe(1)
        expect(points[index]!.socStartKwh).toBe(points[index - 1]!.socEndKwh)
      }
    }

    const januaryEnd = clock.findIndex((slot) => slot.iso === '2026-01-31T23:55:00.000-08:00')
    const februaryStart = clock.findIndex((slot) => slot.iso === '2026-02-01T00:00:00.000-08:00')
    expect(februaryStart).toBe(januaryEnd + 1)
    expect(points[februaryStart]!.socStartKwh).toBe(points[januaryEnd]!.socEndKwh)

    const december31 = clock.flatMap((slot, index) => dateKey(slot) === '2026-12-31' ? [index] : [])
    expect(december31.filter((index) => points[index]!.tripKwh > 0)).toHaveLength(1)
    expect(points.at(-1)!.socEndKwh).toBe(initialSocKwh)
  })

  it('charges in preferred hours unless earlier charging is physically necessary', () => {
    let pendingKwh = 0
    let earlyChargeCount = 0

    points.forEach((point, index) => {
      pendingKwh += point.tripKwh
      const minute = clock[index]!.minuteOfDay
      const preferred = minute >= preferredChargingMinute || minute < weekdayDepartureMinute

      if (point.chargeKwh > 0 && !preferred) {
        earlyChargeCount += 1
        const nextDeparture = points.findIndex((candidate, candidateIndex) =>
          candidateIndex > index && candidate.tripKwh > 0,
        )
        const end = nextDeparture < 0 ? points.length : nextDeparture
        let preferredCapacityKwh = 0
        for (let future = index; future < end; future += 1) {
          const futureMinute = clock[future]!.minuteOfDay
          if (
            points[future]!.available &&
            (futureMinute >= preferredChargingMinute || futureMinute < weekdayDepartureMinute)
          ) {
            preferredCapacityKwh += LOS_ANGELES_2026.ev.chargerKw * intervalHours
          }
        }
        expect(pendingKwh).toBeGreaterThan(preferredCapacityKwh)
      }
      pendingKwh -= point.chargeKwh
    })

    expect(earlyChargeCount).toBe(0)
  })

  it('rejects malformed clocks and seeds with clear indexed errors', () => {
    expect(() => generateAnnualEv(null as unknown as ClockSlot[], 'seed')).toThrow('Invalid annual EV clock')
    expect(() => generateAnnualEv(clock.slice(0, -1), 'seed')).toThrow('Annual EV clock must contain 105120 records')

    const sparse = clock.map((slot) => ({ ...slot }))
    delete sparse[41]
    expect(() => generateAnnualEv(sparse, 'seed')).toThrow('Invalid annual EV clock slot at index 41')

    const nullSlot = clock.map((slot) => ({ ...slot }))
    nullSlot[42] = null as unknown as ClockSlot
    expect(() => generateAnnualEv(nullSlot, 'seed')).toThrow('Invalid annual EV clock slot at index 42')

    const extraField = clock.map((slot) => ({ ...slot }))
    extraField[43] = { ...extraField[43]!, extra: true } as ClockSlot
    expect(() => generateAnnualEv(extraField, 'seed')).toThrow('Invalid annual EV clock slot shape at index 43')

    const missingField = clock.map((slot) => ({ ...slot }))
    delete (missingField[44] as Partial<ClockSlot>).iso
    expect(() => generateAnnualEv(missingField, 'seed')).toThrow('Invalid annual EV clock slot shape at index 44')

    const swapped = clock.map((slot) => ({ ...slot }))
    ;[swapped[45], swapped[46]] = [swapped[46]!, swapped[45]!]
    expect(() => generateAnnualEv(swapped, 'seed')).toThrow('Annual EV clock differs from canonical clock at index 45')

    const duplicated = clock.map((slot) => ({ ...slot }))
    duplicated[47] = { ...duplicated[46]! }
    expect(() => generateAnnualEv(duplicated, 'seed')).toThrow('Annual EV clock differs from canonical clock at index 47')

    const dstCorruption = clock.map((slot) => ({ ...slot }))
    const dstIndex = dstCorruption.findIndex((slot) => slot.iso === '2026-03-08T03:00:00.000-07:00')
    dstCorruption[dstIndex] = { ...dstCorruption[dstIndex]!, utcOffset: '-08:00' }
    expect(() => generateAnnualEv(dstCorruption, 'seed')).toThrow(
      `Annual EV clock differs from canonical clock at index ${dstIndex}`,
    )

    for (const seed of ['', '   ', null, 42]) {
      expect(() => generateAnnualEv(clock, seed as string)).toThrow('Invalid annual EV seed')
    }
  })

  it('rejects infeasible monthly travel targets through its narrow test seam', () => {
    expect(() => __assertAnnualEvMonthFeasible(Array(31).fill(0), 340, 1)).toThrow(
      'Annual EV travel target is infeasible for month 1',
    )
  })

  it('does not mutate its clock input', () => {
    const input = buildYearClock()
    const before = structuredClone(input)

    generateAnnualEv(input, 'immutability-driver')

    expect(input).toEqual(before)
  })
})
