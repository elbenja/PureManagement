import { beforeAll, describe, expect, it } from 'vitest'
import type { ClockSlot, LoadCategory } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { buildAnnualConditions } from './annualConditions'
import type { Condition } from './conditions'
import { generateHomeLoad, type HomeLoadOptions } from './home'
import { buildYearClock } from './yearClock'

const categories: LoadCategory[] = [
  'hvac',
  'waterHeating',
  'cooking',
  'laundry',
  'refrigeration',
  'lighting',
  'electronicsOther',
]
const intervalHours = LOS_ANGELES_2026.intervalMinutes / 60

const annualOptions = (clock: readonly ClockSlot[]): HomeLoadOptions => ({
  canonicalClock: clock,
  seedId: LOS_ANGELES_2026.seedId,
  monthlyTargetsKwh: LOS_ANGELES_2026.months.map((month) => month.homeTargetKwh),
  includeHeating: true,
})

const averageHvacKw = (
  points: ReturnType<typeof generateHomeLoad>,
  indexes: number[],
) => indexes.reduce(
  (total, index) => total + points[index]!.breakdownKwh.hvac / intervalHours,
  0,
) / indexes.length

describe('annual generateHomeLoad', () => {
  let clock: ClockSlot[]
  let conditions: Condition[]
  let home: ReturnType<typeof generateHomeLoad>

  beforeAll(() => {
    clock = buildYearClock()
    conditions = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
    home = generateHomeLoad(clock, conditions, annualOptions(clock))
  })

  it('generates reconciled nonnegative annual points and every existing category remains active', () => {
    const totals = Object.fromEntries(categories.map((category) => [category, 0])) as Record<LoadCategory, number>

    expect(home).toHaveLength(105_120)
    let valid = true
    home.forEach((point) => {
      const values = [point.kw, point.kwh, ...Object.values(point.breakdownKwh)]
      valid &&= Object.keys(point.breakdownKwh).length === categories.length
      valid &&= categories.every((category) => Object.hasOwn(point.breakdownKwh, category))
      valid &&= values.every((value) => Number.isFinite(value) && value >= 0)
      valid &&= Math.abs(point.kwh - point.kw * intervalHours) < 1e-12
      valid &&= Math.abs(
        Object.values(point.breakdownKwh).reduce((sum, value) => sum + value, 0) - point.kwh,
      ) < 1e-12
      categories.forEach((category) => { totals[category] += point.breakdownKwh[category] })
    })
    expect(valid).toBe(true)
    expect(Object.values(totals).every((total) => total > 0)).toBe(true)
  })

  it('hits each configured calendar-month target and the 15,500 kWh annual target', () => {
    const totals = new Map<number, number>()
    home.forEach((point, index) => {
      const month = clock[index]!.month
      totals.set(month, (totals.get(month) ?? 0) + point.kwh)
    })

    LOS_ANGELES_2026.months.forEach((month) => {
      expect(totals.get(month.month)).toBeCloseTo(month.homeTargetKwh, 7)
    })
    expect(home.reduce((sum, point) => sum + point.kwh, 0)).toBeCloseTo(15_500, 7)
  })

  it('handles both DST days and month boundaries through calendar fields', () => {
    const counts = new Map<number, number>()
    clock.forEach((slot) => counts.set(slot.month, (counts.get(slot.month) ?? 0) + 1))

    expect(counts.get(3)).toBe(31 * 288 - 12)
    expect(counts.get(11)).toBe(30 * 288 + 12)
    expect(clock.some((slot) => slot.iso === '2026-03-08T03:00:00.000-07:00')).toBe(true)
    expect(clock.filter((slot) => slot.iso.startsWith('2026-11-01T01:')).map((slot) => slot.utcOffset)).toEqual([
      ...Array(12).fill('-07:00'),
      ...Array(12).fill('-08:00'),
    ])

    for (const iso of [
      '2026-01-31T23:55:00.000-08:00',
      '2026-02-01T00:00:00.000-08:00',
      '2026-08-31T23:55:00.000-07:00',
      '2026-09-01T00:00:00.000-07:00',
    ]) {
      const index = clock.findIndex((slot) => slot.iso === iso)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(home[index]!.kwh).toBeGreaterThan(0)
    }
  })

  it('adds winter heat-pump demand while retaining summer cooling', () => {
    const winter = clock.flatMap((slot, index) =>
      (slot.month === 1 || slot.month === 2 || slot.month === 12) &&
      conditions[index]!.occupied &&
      conditions[index]!.temperatureF < 60 &&
      (slot.minuteOfDay < 8 * 60 || slot.minuteOfDay >= 17 * 60)
        ? [index]
        : [],
    )
    const spring = clock.flatMap((slot, index) =>
      (slot.month === 4 || slot.month === 5) &&
      conditions[index]!.occupied &&
      conditions[index]!.temperatureF >= 65 &&
      conditions[index]!.temperatureF <= 72 &&
      (slot.minuteOfDay < 8 * 60 || slot.minuteOfDay >= 17 * 60)
        ? [index]
        : [],
    )
    const summer = clock.flatMap((slot, index) =>
      (slot.month === 7 || slot.month === 8 || slot.month === 9) && conditions[index]!.temperatureF > 80
        ? [index]
        : [],
    )

    expect(winter.length).toBeGreaterThan(0)
    expect(spring.length).toBeGreaterThan(0)
    expect(summer.length).toBeGreaterThan(0)
    expect(averageHvacKw(home, winter)).toBeGreaterThan(averageHvacKw(home, spring))
    expect(summer.some((index) => home[index]!.breakdownKwh.hvac > 0)).toBe(true)
  })

  it('increases HVAC monotonically as a controlled occupied interval gets colder', () => {
    const sourceIndex = clock.findIndex((slot) => slot.iso === '2026-01-15T07:00:00.000-08:00')
    const oneClock = [{ ...clock[sourceIndex]!, index: 0 }]
    const base = { ...conditions[sourceIndex]!, occupied: true, cloudFactor: 0.8 }
    const options: HomeLoadOptions = {
      canonicalClock: oneClock,
      seedId: LOS_ANGELES_2026.seedId,
      monthlyTargetsKwh: [1],
      includeHeating: true,
    }
    const hvacShareAt = (temperatureF: number) => {
      const point = generateHomeLoad(oneClock, [{ ...base, temperatureF }], options)[0]!
      return point.breakdownKwh.hvac / point.kwh
    }

    expect(hvacShareAt(55)).toBeGreaterThan(hvacShareAt(64))
    expect(hvacShareAt(45)).toBeGreaterThan(hvacShareAt(55))
  })

  it('is deterministic and does not mutate its clock, conditions, or options', () => {
    const inputClock = buildYearClock()
    const inputConditions = buildAnnualConditions(inputClock, LOS_ANGELES_2026.seedId)
    const options = annualOptions(inputClock)
    const beforeClock = structuredClone(inputClock)
    const beforeConditions = structuredClone(inputConditions)
    const beforeOptions = structuredClone(options)

    expect(generateHomeLoad(inputClock, inputConditions, options)).toEqual(home)
    expect(inputClock).toEqual(beforeClock)
    expect(inputConditions).toEqual(beforeConditions)
    expect(options).toEqual(beforeOptions)
  })

  it('isolates scaling changes to the configured calendar month', () => {
    const targets = LOS_ANGELES_2026.months.map((month) => month.homeTargetKwh)
    targets[0] *= 2
    const changed = generateHomeLoad(clock, conditions, {
      ...annualOptions(clock),
      monthlyTargetsKwh: targets,
    })

    expect(changed.every((point, index) => clock[index]!.month === 1 || JSON.stringify(point) === JSON.stringify(home[index]))).toBe(true)
    expect(changed.reduce((sum, point, index) => sum + (clock[index]!.month === 1 ? point.kwh : 0), 0)).toBeCloseTo(2_500, 7)
  })

  it('rejects malformed clocks, conditions, and options with indexed errors', () => {
    const shortOptions = { ...annualOptions(clock), canonicalClock: clock.slice(1) }
    const nonCanonical = clock.map((slot) => ({ ...slot }))
    nonCanonical[42] = { ...nonCanonical[42]!, minuteOfDay: 215 }
    const sparseCanonical = clock.map((slot) => ({ ...slot }))
    delete sparseCanonical[43]
    const malformedConditions = conditions.map((condition) => ({ ...condition }))
    malformedConditions[44] = null as unknown as Condition
    const sparseConditions = conditions.map((condition) => ({ ...condition }))
    delete sparseConditions[45]
    const extraOptions = { ...annualOptions(clock), extra: true } as HomeLoadOptions
    const missingOptions = { ...annualOptions(clock) } as Partial<HomeLoadOptions>
    delete missingOptions.includeHeating
    const extraClock = clock.map((slot) => ({ ...slot }))
    extraClock[47] = { ...extraClock[47]!, extra: true } as ClockSlot
    const missingClock = clock.map((slot) => ({ ...slot }))
    delete (missingClock[48] as Partial<ClockSlot>).iso
    const extraConditions = conditions.map((condition) => ({ ...condition }))
    extraConditions[49] = { ...extraConditions[49]!, extra: true } as Condition
    const missingConditions = conditions.map((condition) => ({ ...condition }))
    delete (missingConditions[50] as Partial<Condition>).weatherState

    expect(() => generateHomeLoad(null as unknown as ClockSlot[], conditions, annualOptions(clock))).toThrow('Invalid home clock')
    expect(() => generateHomeLoad(clock, null as unknown as Condition[], annualOptions(clock))).toThrow('Invalid home conditions')
    expect(() => generateHomeLoad(clock, conditions, null as unknown as HomeLoadOptions)).toThrow('Invalid home options')
    expect(() => generateHomeLoad(clock, conditions, shortOptions)).toThrow('Canonical clock length mismatch')
    expect(() => generateHomeLoad(nonCanonical, conditions, annualOptions(clock))).toThrow('Clock differs from canonical clock at index 42')
    expect(() => generateHomeLoad(clock, conditions, { ...annualOptions(clock), canonicalClock: sparseCanonical })).toThrow('Invalid canonical clock slot at index 43')
    expect(() => generateHomeLoad(clock, malformedConditions, annualOptions(clock))).toThrow('Invalid condition at index 44')
    expect(() => generateHomeLoad(clock, sparseConditions, annualOptions(clock))).toThrow('Invalid condition at index 45')
    expect(() => generateHomeLoad(clock, conditions, extraOptions)).toThrow('Invalid home options shape')
    expect(() => generateHomeLoad(clock, conditions, missingOptions as HomeLoadOptions)).toThrow('Invalid home options shape')
    expect(() => generateHomeLoad(extraClock, conditions, annualOptions(clock))).toThrow('Invalid clock slot shape at index 47')
    expect(() => generateHomeLoad(missingClock, conditions, annualOptions(clock))).toThrow('Invalid clock slot shape at index 48')
    expect(() => generateHomeLoad(clock, extraConditions, annualOptions(clock))).toThrow('Invalid condition shape at index 49')
    expect(() => generateHomeLoad(clock, missingConditions, annualOptions(clock))).toThrow('Invalid condition shape at index 50')

    for (const [field, value, error] of [
      ['temperatureF', -0.1, 'Invalid temperature at index 46'],
      ['dayType', 'holiday', 'Invalid day type at index 46'],
      ['cloudFactor', 1.01, 'Invalid cloud factor at index 46'],
      ['weatherState', 'snow', 'Invalid weather state at index 46'],
      ['precipitationInches', -0.01, 'Invalid precipitation at index 46'],
      ['occupied', 'yes', 'Invalid occupied flag at index 46'],
    ] as const) {
      const invalid = conditions.map((condition) => ({ ...condition }))
      invalid[46] = { ...invalid[46]!, [field]: value }
      expect(() => generateHomeLoad(clock, invalid, annualOptions(clock))).toThrow(error)
    }

    for (const targets of [[], [1, 2], Array(12).fill(1).map((value, index) => index === 4 ? 0 : value)]) {
      expect(() => generateHomeLoad(clock, conditions, { ...annualOptions(clock), monthlyTargetsKwh: targets })).toThrow('Invalid monthly targets')
    }
    expect(() => generateHomeLoad(clock, conditions, { ...annualOptions(clock), seedId: 42 as unknown as string })).toThrow('Invalid home seed')
    expect(() => generateHomeLoad(clock, conditions, { ...annualOptions(clock), includeHeating: 1 as unknown as boolean })).toThrow('Invalid includeHeating option')
  })

  it('rejects nonpositive raw totals and finite targets whose scale cannot produce finite points', () => {
    expect(() => generateHomeLoad([], [], {
      canonicalClock: [],
      seedId: 'empty-raw-load',
      monthlyTargetsKwh: [1],
      includeHeating: false,
    })).toThrow('Home raw load must be finite and positive')

    const oneClock = [{ ...clock[0]!, index: 0 }]
    expect(() => generateHomeLoad(oneClock, [{ ...conditions[0]!, temperatureF: 70 }], {
      canonicalClock: oneClock,
      seedId: 'unreachable-scale',
      monthlyTargetsKwh: [Number.MAX_VALUE],
      includeHeating: false,
    })).toThrow('Home target unreachable')
  })
})
