import type { ClockSlot } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { classifyTou } from './time'

const START_MS = Date.parse('2026-01-01T00:00:00-08:00')
const END_MS = Date.parse('2027-01-01T00:00:00-08:00')
const DST_START_MS = Date.parse('2026-03-08T02:00:00-08:00')
const DST_END_MS = Date.parse('2026-11-01T02:00:00-07:00')
const STEP_MS = 5 * 60_000
const DAY_MS = 24 * 60 * 60_000

const pad = (value: number) => value.toString().padStart(2, '0')

const offsetFor = (instantMs: number): ClockSlot['utcOffset'] =>
  instantMs >= DST_START_MS && instantMs < DST_END_MS ? '-07:00' : '-08:00'

const offsetMilliseconds = (utcOffset: ClockSlot['utcOffset']) =>
  (utcOffset === '-07:00' ? -7 : -8) * 60 * 60_000

export const buildYearClock = (): ClockSlot[] => {
  const slots: ClockSlot[] = []

  for (let instantMs = START_MS; instantMs < END_MS; instantMs += STEP_MS) {
    const utcOffset = offsetFor(instantMs)
    const localDate = new Date(instantMs + offsetMilliseconds(utcOffset))
    const year = localDate.getUTCFullYear()
    const month = localDate.getUTCMonth() + 1
    const day = localDate.getUTCDate()
    const dayOfWeek = localDate.getUTCDay()
    const minuteOfDay = localDate.getUTCHours() * 60 + localDate.getUTCMinutes()
    const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS) + 1
    const hour = Math.floor(minuteOfDay / 60)
    const minute = minuteOfDay % 60

    slots.push({
      index: slots.length,
      iso: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000${utcOffset}`,
      year,
      month,
      day,
      dayOfYear,
      dayOfWeek,
      minuteOfDay,
      utcOffset,
      tou: classifyTou(dayOfWeek, minuteOfDay),
    })
  }

  if (slots.length !== LOS_ANGELES_2026.records) {
    throw new Error(`Expected ${LOS_ANGELES_2026.records} clock records, received ${slots.length}`)
  }

  return slots
}
