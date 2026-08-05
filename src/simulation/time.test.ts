import { describe, expect, it } from 'vitest'
import { buildAugustClock, classifyTou } from './time'

describe('buildAugustClock', () => {
  it('creates every five-minute interval in August 2026', () => {
    const clock = buildAugustClock()

    expect(clock).toHaveLength(8_928)
    expect(new Set(clock.map((slot) => slot.iso)).size).toBe(clock.length)
    expect(clock[0]?.iso).toBe('2026-08-01T00:00:00.000-07:00')
    expect(clock.at(-1)?.iso).toBe('2026-08-31T23:55:00.000-07:00')
  })

  it('advances day and minute values at the midnight boundary', () => {
    const clock = buildAugustClock()
    const lastSlotOnFirstDay = clock[287]
    const firstSlotOnSecondDay = clock[288]

    expect(lastSlotOnFirstDay).toMatchObject({ day: 1, minuteOfDay: 1_435 })
    expect(firstSlotOnSecondDay).toMatchObject({ day: 2, minuteOfDay: 0 })
    expect(firstSlotOnSecondDay?.dayOfWeek).toBe(0)
  })
})

describe('classifyTou', () => {
  it('uses weekday LADWP period boundaries', () => {
    expect(classifyTou(1, 12 * 60 + 55)).toBe('low')
    expect(classifyTou(1, 13 * 60)).toBe('high')
    expect(classifyTou(1, 16 * 60 + 55)).toBe('high')
    expect(classifyTou(1, 17 * 60)).toBe('low')
    expect(classifyTou(1, 19 * 60 + 55)).toBe('low')
    expect(classifyTou(1, 20 * 60)).toBe('base')
  })

  it('uses base pricing on Saturdays', () => {
    expect(classifyTou(6, 14 * 60)).toBe('base')
  })
})
