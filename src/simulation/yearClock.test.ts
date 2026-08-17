import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { classifyTou } from './time'
import { buildYearClock } from './yearClock'

const STEP_MS = 5 * 60_000
const DST_START_MS = Date.parse('2026-03-08T02:00:00-08:00')
const DST_END_MS = Date.parse('2026-11-01T02:00:00-07:00')

const expectedOffset = (instantMs: number) =>
  instantMs >= DST_START_MS && instantMs < DST_END_MS ? '-07:00' : '-08:00'

const expectedLocalFields = (instantMs: number) => {
  const utcOffsetHours = expectedOffset(instantMs) === '-07:00' ? -7 : -8
  const localDate = new Date(instantMs + utcOffsetHours * 60 * 60_000)
  const year = localDate.getUTCFullYear()
  const month = localDate.getUTCMonth() + 1
  const day = localDate.getUTCDate()

  return {
    year,
    month,
    day,
    dayOfYear: Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000) + 1,
    dayOfWeek: localDate.getUTCDay(),
    minuteOfDay: localDate.getUTCHours() * 60 + localDate.getUTCMinutes(),
    utcOffset: expectedOffset(instantMs),
  }
}

describe('buildYearClock', () => {
  it('creates every five-minute instant in 2026 with unique ISO values and sequential indexes', () => {
    const clock = buildYearClock()

    expect(clock).toHaveLength(105_120)
    expect(clock).toHaveLength(LOS_ANGELES_2026.records)
    expect(clock[0]?.iso).toBe('2026-01-01T00:00:00.000-08:00')
    expect(clock.at(-1)?.iso).toBe('2026-12-31T23:55:00.000-08:00')
    expect(new Set(clock.map((slot) => slot.iso)).size).toBe(clock.length)
    expect(clock.map((slot) => slot.index)).toEqual([...clock.keys()])
  })

  it('skips the spring-forward hour and repeats the autumn hour with the new offsets', () => {
    const clock = buildYearClock()
    const springBoundary = clock.findIndex((slot) => slot.iso === '2026-03-08T01:55:00.000-08:00')
    const autumnBoundary = clock.findIndex((slot) => slot.iso === '2026-11-01T01:55:00.000-07:00')

    expect(clock[springBoundary + 1]?.iso).toBe('2026-03-08T03:00:00.000-07:00')
    expect(clock[autumnBoundary + 1]?.iso).toBe('2026-11-01T01:00:00.000-08:00')
  })

  it('has DST-adjusted local-day record counts', () => {
    const clock = buildYearClock()
    const recordCounts = new Map<string, number>()

    for (const slot of clock) {
      const date = slot.iso.slice(0, 10)
      recordCounts.set(date, (recordCounts.get(date) ?? 0) + 1)
    }

    expect(recordCounts.get('2026-03-08')).toBe(276)
    expect(recordCounts.get('2026-11-01')).toBe(300)
    for (const [date, count] of recordCounts) {
      if (date !== '2026-03-08' && date !== '2026-11-01') expect(count).toBe(288)
    }
  })

  it('derives every local field and TOU period from the scenario-fixed instant', () => {
    const clock = buildYearClock()

    for (const slot of clock) {
      const instantMs = Date.parse(slot.iso)
      const expected = expectedLocalFields(instantMs)

      expect(slot).toMatchObject({
        ...expected,
        tou: classifyTou(expected.dayOfWeek, expected.minuteOfDay),
      })
    }
  })

  it('advances absolute instants by exactly five minutes through DST', () => {
    const clock = buildYearClock()

    for (let index = 1; index < clock.length; index += 1) {
      expect(Date.parse(clock[index]!.iso) - Date.parse(clock[index - 1]!.iso)).toBe(STEP_MS)
    }
  })
})
