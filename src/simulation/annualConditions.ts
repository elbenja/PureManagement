import type { ClockSlot, DayType } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import type { Condition } from './conditions'
import { mulberry32, seedFromString } from './random'
import { buildYearClock } from './yearClock'

const MINUTES_PER_DAY = 24 * 60
const MAX_WEATHER_ATTEMPTS = 32

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const randomValue = (seed: string) => mulberry32(seedFromString(seed))()

const isWinterMonth = (month: number) => month === 12 || month <= 2

interface DailyDescriptor {
  dayOfYear: number
  month: number
  lowF: number
  highF: number
  dailyOffsetF: number
  cloudBaseline: number
  cloudPhase: number
  rainIntensity: number
  rainy: boolean
  heatWave: boolean
  coldSnap: boolean
  dayType: DayType
}

const assertCanonicalClock = (clock: ClockSlot[]) => {
  if (clock.length !== LOS_ANGELES_2026.records) {
    throw new Error(`Expected ${LOS_ANGELES_2026.records} clock records, received ${clock.length}`)
  }

  const canonical = buildYearClock()
  const mismatch = clock.findIndex((slot, index) => {
    const expected = canonical[index]!
    const expectedKeys = Object.keys(expected)
    return Object.keys(slot).length !== expectedKeys.length || expectedKeys.some(
      (key) => slot[key as keyof ClockSlot] !== expected[key as keyof ClockSlot],
    )
  })

  if (mismatch >= 0) throw new Error(`Clock differs from canonical annual clock at index ${mismatch}`)
}

const hasConsecutiveDays = (
  descriptors: DailyDescriptor[],
  minimumLength: number,
  predicate: (descriptor: DailyDescriptor) => boolean,
) => {
  let runLength = 0

  for (const descriptor of descriptors) {
    runLength = predicate(descriptor) ? runLength + 1 : 0
    if (runLength >= minimumLength) return true
  }

  return false
}

const hasRequiredEvents = (descriptors: DailyDescriptor[]) =>
  hasConsecutiveDays(descriptors, 2, (day) => isWinterMonth(day.month) && day.rainy) &&
  hasConsecutiveDays(
    descriptors,
    3,
    (day) => day.month >= 7 && day.month <= 9 && day.heatWave,
  ) &&
  hasConsecutiveDays(descriptors, 2, (day) => isWinterMonth(day.month) && day.coldSnap)

const generateDailyDescriptors = (clock: ClockSlot[], weatherSeed: string) => {
  const firstSlotsByDay = new Map<number, ClockSlot>()
  for (const slot of clock) {
    if (!firstSlotsByDay.has(slot.dayOfYear)) firstSlotsByDay.set(slot.dayOfYear, slot)
  }

  let rainDaysRemaining = 0
  let heatWaveDaysRemaining = 0
  let coldSnapDaysRemaining = 0

  return [...firstSlotsByDay.values()].map((slot): DailyDescriptor => {
    const profile = LOS_ANGELES_2026.months[slot.month - 1]!
    const nextProfile = LOS_ANGELES_2026.months[slot.month % 12]!
    const daysInMonth = new Date(Date.UTC(LOS_ANGELES_2026.year, slot.month, 0)).getUTCDate()
    const monthProgress = (slot.day - 1) / daysInMonth
    const lowF = profile.lowF + (nextProfile.lowF - profile.lowF) * monthProgress
    const highF = profile.highF + (nextProfile.highF - profile.highF) * monthProgress
    const daySeed = `${weatherSeed}:day:${slot.dayOfYear}`

    if (
      rainDaysRemaining === 0 &&
      randomValue(`${daySeed}:rain:start`) < profile.rainStartProbability
    ) {
      rainDaysRemaining = 1 + Math.floor(randomValue(`${daySeed}:rain:duration`) * 3)
    }
    if (
      heatWaveDaysRemaining === 0 &&
      slot.month >= 7 &&
      slot.month <= 9 &&
      randomValue(`${daySeed}:heat:start`) < 0.05
    ) {
      heatWaveDaysRemaining = 3 + Math.floor(randomValue(`${daySeed}:heat:duration`) * 2)
    }
    if (
      coldSnapDaysRemaining === 0 &&
      isWinterMonth(slot.month) &&
      randomValue(`${daySeed}:cold:start`) < 0.04
    ) {
      coldSnapDaysRemaining = 2 + Math.floor(randomValue(`${daySeed}:cold:duration`) * 2)
    }

    const rainy = rainDaysRemaining > 0
    const heatWave = heatWaveDaysRemaining > 0
    const coldSnap = coldSnapDaysRemaining > 0
    const weekend = slot.dayOfWeek === 0 || slot.dayOfWeek === 6
    const dayType: DayType = heatWave
      ? 'heatwave'
      : rainy
        ? 'cloudy'
        : weekend
          ? 'weekend'
          : 'weekday'
    const dailyOffsetF =
      (randomValue(`${daySeed}:temperature`) - 0.5) * 3 +
      (heatWave ? 10 : 0) -
      (coldSnap ? 8 : 0)
    const cloudBaseline = rainy
      ? 0.28 + randomValue(`${daySeed}:cloud:baseline`) * 0.13
      : 0.81 + randomValue(`${daySeed}:cloud:baseline`) * 0.17

    if (rainy) rainDaysRemaining -= 1
    if (heatWave) heatWaveDaysRemaining -= 1
    if (coldSnap) coldSnapDaysRemaining -= 1

    return {
      dayOfYear: slot.dayOfYear,
      month: slot.month,
      lowF,
      highF,
      dailyOffsetF,
      cloudBaseline,
      cloudPhase: randomValue(`${daySeed}:cloud:phase`) * Math.PI * 2,
      rainIntensity: 0.015 + randomValue(`${daySeed}:rain:intensity`) * 0.04,
      rainy,
      heatWave,
      coldSnap,
      dayType,
    }
  })
}

const acceptedDailyDescriptors = (clock: ClockSlot[], seedId: string) => {
  for (let attempt = 0; attempt < MAX_WEATHER_ATTEMPTS; attempt += 1) {
    const weatherSeed = attempt === 0 ? `${seedId}:weather` : `${seedId}:weather:${attempt}`
    const descriptors = generateDailyDescriptors(clock, weatherSeed)
    if (hasRequiredEvents(descriptors)) return descriptors
  }

  throw new Error(
    `Unable to generate required annual weather event families for seed "${seedId}" after ${MAX_WEATHER_ATTEMPTS} attempts`,
  )
}

export const buildAnnualConditions = (clock: ClockSlot[], seedId: string): Condition[] => {
  assertCanonicalClock(clock)
  const descriptors = acceptedDailyDescriptors(clock, seedId)

  return clock.map((slot) => {
    const descriptor = descriptors[slot.dayOfYear - 1]!
    const dayFraction = slot.minuteOfDay / MINUTES_PER_DAY
    const temperatureF =
      descriptor.lowF +
      (descriptor.highF - descriptor.lowF) *
        (0.5 + 0.5 * Math.cos(Math.PI * 2 * (dayFraction - 16 / 24))) +
      descriptor.dailyOffsetF
    const rainProgress = clamp((dayFraction - 0.12) / 0.78, 0, 1)
    const rainPulse = descriptor.rainy ? Math.max(0, Math.sin(Math.PI * rainProgress)) : 0
    const precipitationInches = descriptor.rainy
      ? descriptor.rainIntensity * rainPulse / 12
      : 0
    const intradayCloudVariation =
      0.035 * Math.sin(Math.PI * 2 * dayFraction + descriptor.cloudPhase) +
      0.018 * Math.sin(Math.PI * 4 * dayFraction + descriptor.cloudPhase / 2)
    const rainSuppression = descriptor.rainy ? 0.08 * rainPulse : 0
    const cloudFactor = clamp(
      descriptor.cloudBaseline + intradayCloudVariation - rainSuppression,
      0,
      1,
    )
    const roundedCloudFactor = Number(cloudFactor.toFixed(4))
    const roundedPrecipitation = Number(precipitationInches.toFixed(6))

    return {
      dayType: descriptor.dayType,
      temperatureF: Number(temperatureF.toFixed(3)),
      cloudFactor: roundedCloudFactor,
      weatherState:
        roundedPrecipitation > 0
          ? 'rain'
          : descriptor.rainy
            ? 'overcast'
            : roundedCloudFactor < 0.82
              ? 'partly-cloudy'
              : 'clear',
      precipitationInches: roundedPrecipitation,
      occupied:
        slot.dayOfWeek === 0 ||
        slot.dayOfWeek === 6 ||
        slot.minuteOfDay < 8 * 60 ||
        slot.minuteOfDay >= 17 * 60,
    }
  })
}
