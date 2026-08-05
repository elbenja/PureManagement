import { describe, expect, it } from 'vitest'
import type { LoadCategory } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { buildConditions } from './conditions'
import { generateHomeLoad } from './home'
import { buildAugustClock } from './time'

const categories: LoadCategory[] = [
  'hvac',
  'waterHeating',
  'cooking',
  'laundry',
  'refrigeration',
  'lighting',
  'electronicsOther',
]

const energyFor = (
  points: ReturnType<typeof generateHomeLoad>,
  clock: ReturnType<typeof buildAugustClock>,
  day: number,
  startMinute: number,
  endMinute: number,
) =>
  points.reduce(
    (total, point, index) => {
      const slot = clock[index]!
      return slot.day === day && slot.minuteOfDay >= startMinute && slot.minuteOfDay < endMinute
        ? total + point.kwh
        : total
    },
    0,
  )

const lagOneCorrelation = (values: number[]) => {
  const left = values.slice(0, -1)
  const right = values.slice(1)
  const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length
  const leftMean = mean(left)
  const rightMean = mean(right)
  const numerator = left.reduce((total, value, index) => total + (value - leftMean) * (right[index]! - rightMean), 0)
  const denominator = Math.sqrt(
    left.reduce((total, value) => total + (value - leftMean) ** 2, 0) *
      right.reduce((total, value) => total + (value - rightMean) ** 2, 0),
  )

  return numerator / denominator
}

describe('generateHomeLoad', () => {
  it('generates a deterministic complete August household profile', () => {
    const clock = buildAugustClock()
    const conditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)

    const first = generateHomeLoad(clock, conditions)
    const second = generateHomeLoad(clock, conditions)

    expect(first).toHaveLength(8_928)
    expect(second).toEqual(first)
    expect(first.reduce((total, point) => total + point.kwh, 0)).toBeCloseTo(
      LOS_ANGELES_AUGUST_2026.home.targetAugustKwh,
      9,
    )
  })

  it('keeps interval units and the full category breakdown internally consistent', () => {
    const clock = buildAugustClock()
    const points = generateHomeLoad(clock, buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId))
    const monthlyByCategory = Object.fromEntries(categories.map((category) => [category, 0])) as Record<
      LoadCategory,
      number
    >

    points.forEach((point) => {
      expect(Object.keys(point.breakdownKwh).sort()).toEqual([...categories].sort())
      expect([point.kw, point.kwh, ...Object.values(point.breakdownKwh)].every(Number.isFinite)).toBe(true)
      expect(point.kw).toBeGreaterThanOrEqual(0)
      expect(point.kwh).toBeGreaterThanOrEqual(0)
      expect(point.kw).toBeCloseTo(
        (point.kwh * 60) / LOS_ANGELES_AUGUST_2026.intervalMinutes,
        12,
      )
      expect(Object.values(point.breakdownKwh).reduce((total, kwh) => total + kwh, 0)).toBeCloseTo(
        point.kwh,
        9,
      )
      categories.forEach((category) => {
        monthlyByCategory[category] += point.breakdownKwh[category]
      })
    })

    expect(Object.values(monthlyByCategory).every((kwh) => kwh > 0)).toBe(true)
  })

  it('raises heatwave afternoon demand and keeps occupied evenings above overnight baseline', () => {
    const clock = buildAugustClock()
    const points = generateHomeLoad(clock, buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId))

    expect(energyFor(points, clock, 13, 13 * 60, 17 * 60)).toBeGreaterThan(
      energyFor(points, clock, 10, 13 * 60, 17 * 60),
    )
    expect(energyFor(points, clock, 10, 18 * 60, 22 * 60)).toBeGreaterThan(
      energyFor(points, clock, 10, 1 * 60, 5 * 60),
    )
  })

  it('varies smoothly across days and intervals without implausible high-use peaks', () => {
    const clock = buildAugustClock()
    const points = generateHomeLoad(clock, buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId))
    const noonLoads = clock.flatMap((slot, index) => (slot.minuteOfDay === 12 * 60 ? [points[index]!.kw] : []))

    expect(new Set(noonLoads.map((kw) => kw.toFixed(3))).size).toBeGreaterThan(10)
    expect(new Set(points.slice(0, 288).map((point) => point.kw.toFixed(3))).size).toBeGreaterThan(20)
    expect(Math.max(...points.map((point) => point.kw))).toBeLessThanOrEqual(15)
    expect(
      Math.max(...points.slice(1).map((point, index) => Math.abs(point.kw - points[index]!.kw))),
    ).toBeLessThan(Math.max(...points.map((point) => point.kw)) * 0.2)
    expect(lagOneCorrelation(points.map((point) => point.kw))).toBeGreaterThan(0.99)
    const activeMinuteByCategory: Record<LoadCategory, number> = {
      hvac: 16 * 60,
      waterHeating: 7 * 60,
      cooking: 7 * 60,
      laundry: 21 * 60,
      refrigeration: 3 * 60,
      lighting: 20 * 60,
      electronicsOther: 20 * 60,
    }
    categories.forEach((category) => {
      const dailyCategoryLoads = clock.flatMap((slot, index) =>
        slot.minuteOfDay === activeMinuteByCategory[category]
          ? [points[index]!.breakdownKwh[category]]
          : [],
      )
      expect(new Set(dailyCategoryLoads.map((kwh) => kwh.toFixed(9))).size).toBeGreaterThan(10)
    })
  })

  it('rejects non-canonical clocks, invalid clock fields, and invalid conditions', () => {
    const clock = buildAugustClock()
    const conditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)

    expect(() => generateHomeLoad([], [])).toThrow('Home input must contain 8928 records')
    expect(() => generateHomeLoad(clock.slice(0, 1), conditions.slice(0, 1))).toThrow(
      'Home input must contain 8928 records',
    )
    expect(() => generateHomeLoad(clock, conditions.slice(1))).toThrow('Home input must contain 8928 records')
    expect(() =>
      generateHomeLoad(
        clock.map((slot, index) => (index === 41 ? { ...slot, minuteOfDay: Number.NaN } : slot)),
        conditions,
      ),
    ).toThrow('Invalid clock minute at index 41')
    expect(() =>
      generateHomeLoad(
        clock,
        conditions.map((condition, index) =>
          index === 42 ? { ...condition, temperatureF: Number.NaN } : condition,
        ),
      ),
    ).toThrow('Invalid temperature at index 42')
    expect(() =>
      generateHomeLoad(
        clock,
        conditions.map((condition, index) =>
          index === 43 ? { ...condition, cloudFactor: 1.01 } : condition,
        ),
      ),
    ).toThrow('Invalid cloud factor at index 43')
    expect(() =>
      generateHomeLoad(
        clock,
        conditions.map((condition, index) =>
          index === 44 ? { ...condition, occupied: 'yes' as unknown as boolean } : condition,
        ),
      ),
    ).toThrow('Invalid occupied flag at index 44')
  })

  it.each([
    ['a duplicated slot', (clock: ReturnType<typeof buildAugustClock>) =>
      clock.map((slot, index) => (index === 1 ? clock[0]! : slot)), 1],
    ['a corrupted index', (clock: ReturnType<typeof buildAugustClock>) =>
      clock.map((slot, index) => (index === 2 ? { ...slot, index: 12 } : slot)), 2],
    ['a wrong day', (clock: ReturnType<typeof buildAugustClock>) =>
      clock.map((slot, index) => (index === 288 ? { ...slot, day: 1 } : slot)), 288],
    ['a wrong minute', (clock: ReturnType<typeof buildAugustClock>) =>
      clock.map((slot, index) => (index === 3 ? { ...slot, minuteOfDay: 20 } : slot)), 3],
    ['a wrong day of week', (clock: ReturnType<typeof buildAugustClock>) =>
      clock.map((slot, index) => (index === 289 ? { ...slot, dayOfWeek: 2 } : slot)), 289],
  ])('rejects %s in the canonical clock sequence', (_case, corruptClock, index) => {
    const clock = buildAugustClock()
    const conditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)

    expect(() => generateHomeLoad(corruptClock(clock), conditions)).toThrow(
      `Invalid clock slot at index ${index}`,
    )
  })

  it.each([Number.MAX_VALUE, 39.9])('rejects implausible finite temperatures: %s', (temperatureF) => {
    const clock = buildAugustClock()
    const conditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId).map((condition, index) =>
      index === 45 ? { ...condition, temperatureF } : condition,
    )

    expect(() => generateHomeLoad(clock, conditions)).toThrow('Invalid temperature at index 45')
  })
})
