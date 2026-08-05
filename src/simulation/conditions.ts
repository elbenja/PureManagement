import type { ClockSlot, DayType } from '../domain/energy'
import { mulberry32, seedFromString } from './random'

export interface Condition {
  dayType: DayType
  temperatureF: number
  cloudFactor: number
  occupied: boolean
}

const MINUTES_PER_DAY = 24 * 60

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const dayTypeFor = (slot: ClockSlot): DayType => {
  if (slot.day === 6 || slot.day === 22) return 'cloudy'
  if (slot.day >= 12 && slot.day <= 15) return 'heatwave'
  return slot.dayOfWeek === 0 || slot.dayOfWeek === 6 ? 'weekend' : 'weekday'
}

interface DailyWeather {
  temperatureOffset: number
  cloudBaseline: number
  cloudPhase: number
}

const dailyWeather = (seedId: string, day: number, dayType: DayType): DailyWeather => {
  const random = mulberry32(seedFromString(`${seedId}:august:${day}`))
  const temperatureOffset = (random() - 0.5) * 3 + Math.sin((day - 1) / 5) * 1.5
  const cloudPhase = random() * Math.PI * 2
  const cloudBaseline = dayType === 'cloudy' ? 0.38 + random() * 0.12 : 0.82 + random() * 0.14

  return { temperatureOffset, cloudBaseline, cloudPhase }
}

export const buildConditions = (clock: ClockSlot[], seedId: string): Condition[] =>
  clock.map((slot) => {
    const dayType = dayTypeFor(slot)
    const weather = dailyWeather(seedId, slot.day, dayType)
    const dayFraction = slot.minuteOfDay / MINUTES_PER_DAY
    const dailyTemperature = 77 + weather.temperatureOffset + (dayType === 'heatwave' ? 10 : 0)
    const temperatureF = dailyTemperature + 12 * Math.cos(Math.PI * 2 * (dayFraction - 16 / 24))
    const intradayCloudVariation =
      0.045 * Math.sin(Math.PI * 2 * dayFraction + weather.cloudPhase) +
      (dayType === 'cloudy' ? 0.06 * Math.sin(Math.PI * 4 * dayFraction + weather.cloudPhase) : 0)

    return {
      dayType,
      temperatureF: Number(temperatureF.toFixed(3)),
      cloudFactor: Number(clamp(weather.cloudBaseline + intradayCloudVariation, 0, 1).toFixed(4)),
      occupied:
        slot.dayOfWeek === 0 ||
        slot.dayOfWeek === 6 ||
        slot.minuteOfDay < 8 * 60 ||
        slot.minuteOfDay >= 17 * 60,
    }
  })
