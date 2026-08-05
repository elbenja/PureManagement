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
  })

  it('rejects mismatched or invalid weather inputs with indexed errors', () => {
    const clock = buildAugustClock()
    const conditions = buildConditions(clock, LOS_ANGELES_AUGUST_2026.seedId)

    expect(() => generateHomeLoad(clock, conditions.slice(1))).toThrow('Home input length mismatch')
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
  })
})
