import type { ClockSlot, TouPeriod } from '../domain/energy'

const AUGUST_DAYS = 31
const MINUTES_PER_DAY = 24 * 60
const INTERVAL_MINUTES = 5

const pad = (value: number) => value.toString().padStart(2, '0')

const formatAugustIso = (day: number, minuteOfDay: number) => {
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60

  return `2026-08-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000-07:00`
}

export const classifyTou = (dayOfWeek: number, minuteOfDay: number): TouPeriod => {
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'base'
  if (minuteOfDay >= 13 * 60 && minuteOfDay < 17 * 60) return 'high'
  if (minuteOfDay >= 12 * 60 && minuteOfDay < 20 * 60) return 'low'

  return 'base'
}

export const buildAugustClock = (): ClockSlot[] => {
  const slots: ClockSlot[] = []

  for (let day = 1; day <= AUGUST_DAYS; day += 1) {
    const dayOfWeek = new Date(Date.UTC(2026, 7, day)).getUTCDay()

    for (let minuteOfDay = 0; minuteOfDay < MINUTES_PER_DAY; minuteOfDay += INTERVAL_MINUTES) {
      slots.push({
        index: slots.length,
        iso: formatAugustIso(day, minuteOfDay),
        day,
        dayOfWeek,
        minuteOfDay,
        tou: classifyTou(dayOfWeek, minuteOfDay),
      })
    }
  }

  return slots
}
