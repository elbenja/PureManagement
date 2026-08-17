import type { ClockSlot, DayType } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import type { Condition } from './conditions'
import { mulberry32, seedFromString } from './random'
import { buildYearClock } from './yearClock'

const MINUTES_PER_DAY = 24 * 60
const MAX_WEATHER_ATTEMPTS = 32
const DESCRIPTOR_BLEND_SLOTS = 36

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const interpolate = (start: number, end: number, progress: number) =>
  start + (end - start) * progress

const interpolatePhase = (start: number, end: number, progress: number) => {
  const shortestDelta = ((end - start + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return start + shortestDelta * progress
}

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
  rainEvent: RainEvent | null
  heatWaveEvent: TemperatureEvent | null
  coldSnapEvent: TemperatureEvent | null
  dayType: DayType
}

interface WeatherEvent {
  startDayOfYear: number
  durationDays: number
}

interface TemperatureEvent extends WeatherEvent {
  temperatureOffsetF: number
  cloudBaseline: number
  cloudPhase: number
}

interface RainEvent extends TemperatureEvent {
  rainIntensity: number
}

const assertCanonicalClock = (clock: ClockSlot[]) => {
  if (clock.length !== LOS_ANGELES_2026.records) {
    throw new Error(`Expected ${LOS_ANGELES_2026.records} clock records, received ${clock.length}`)
  }

  const canonical = buildYearClock()
  const mismatch = clock.findIndex((slot, index) => {
    if (slot === null || typeof slot !== 'object' || Array.isArray(slot)) {
      throw new Error(`Invalid annual clock slot at index ${index}`)
    }

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
  let rainEvent: RainEvent | null = null
  let heatWaveEvent: TemperatureEvent | null = null
  let coldSnapEvent: TemperatureEvent | null = null

  return [...firstSlotsByDay.values()].map((slot): DailyDescriptor => {
    const profile = LOS_ANGELES_2026.months[slot.month - 1]!
    const nextProfile = LOS_ANGELES_2026.months[slot.month % 12]!
    const daysInMonth = new Date(Date.UTC(LOS_ANGELES_2026.year, slot.month, 0)).getUTCDate()
    const monthProgress = (slot.day - 1) / daysInMonth
    const lowF = profile.lowF + (nextProfile.lowF - profile.lowF) * monthProgress
    const highF = profile.highF + (nextProfile.highF - profile.highF) * monthProgress
    const daySeed = `${weatherSeed}:day:${slot.dayOfYear}`
    const calendarDaysRemaining = 366 - slot.dayOfYear

    if (
      rainDaysRemaining === 0 &&
      randomValue(`${daySeed}:rain:start`) < profile.rainStartProbability
    ) {
      const durationDays = 1 + Math.floor(randomValue(`${daySeed}:rain:duration`) * 3)
      if (durationDays <= calendarDaysRemaining) {
        rainDaysRemaining = durationDays
        rainEvent = {
          startDayOfYear: slot.dayOfYear,
          durationDays,
          temperatureOffsetF: (randomValue(`${daySeed}:temperature`) - 0.5) * 3,
          cloudBaseline: 0.28 + randomValue(`${daySeed}:cloud:baseline`) * 0.13,
          cloudPhase: randomValue(`${daySeed}:cloud:phase`) * Math.PI * 2,
          rainIntensity: 0.015 + randomValue(`${daySeed}:rain:intensity`) * 0.04,
        }
      }
    }
    if (
      heatWaveDaysRemaining === 0 &&
      slot.month >= 7 &&
      slot.month <= 9 &&
      randomValue(`${daySeed}:heat:start`) < 0.05
    ) {
      const durationDays = 3 + Math.floor(randomValue(`${daySeed}:heat:duration`) * 2)
      if (durationDays <= calendarDaysRemaining) {
        heatWaveDaysRemaining = durationDays
        heatWaveEvent = {
          startDayOfYear: slot.dayOfYear,
          durationDays,
          temperatureOffsetF: (randomValue(`${daySeed}:temperature`) - 0.5) * 3,
          cloudBaseline: 0.81 + randomValue(`${daySeed}:cloud:baseline`) * 0.17,
          cloudPhase: randomValue(`${daySeed}:cloud:phase`) * Math.PI * 2,
        }
      }
    }
    if (
      coldSnapDaysRemaining === 0 &&
      isWinterMonth(slot.month) &&
      randomValue(`${daySeed}:cold:start`) < 0.04
    ) {
      const durationDays = 2 + Math.floor(randomValue(`${daySeed}:cold:duration`) * 2)
      if (durationDays <= calendarDaysRemaining) {
        coldSnapDaysRemaining = durationDays
        coldSnapEvent = {
          startDayOfYear: slot.dayOfYear,
          durationDays,
          temperatureOffsetF: (randomValue(`${daySeed}:temperature`) - 0.5) * 3,
          cloudBaseline: 0.81 + randomValue(`${daySeed}:cloud:baseline`) * 0.17,
          cloudPhase: randomValue(`${daySeed}:cloud:phase`) * Math.PI * 2,
        }
      }
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
    const dailyTemperatureOffsetF = (randomValue(`${daySeed}:temperature`) - 0.5) * 3
    const dailyOffsetF = heatWave
      ? heatWaveEvent!.temperatureOffsetF + 10
      : coldSnap
        ? coldSnapEvent!.temperatureOffsetF - 8
        : rainy
          ? rainEvent!.temperatureOffsetF
          : dailyTemperatureOffsetF
    const cloudBaseline = rainy
      ? rainEvent!.cloudBaseline
      : heatWave
        ? heatWaveEvent!.cloudBaseline
        : coldSnap
          ? coldSnapEvent!.cloudBaseline
          : 0.81 + randomValue(`${daySeed}:cloud:baseline`) * 0.17
    const cloudPhase = rainy
      ? rainEvent!.cloudPhase
      : heatWave
        ? heatWaveEvent!.cloudPhase
        : coldSnap
          ? coldSnapEvent!.cloudPhase
          : randomValue(`${daySeed}:cloud:phase`) * Math.PI * 2

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
      cloudPhase,
      rainIntensity: rainy
        ? rainEvent!.rainIntensity
        : 0.015 + randomValue(`${daySeed}:rain:intensity`) * 0.04,
      rainy,
      heatWave,
      coldSnap,
      rainEvent: rainy ? rainEvent : null,
      heatWaveEvent: heatWave ? heatWaveEvent : null,
      coldSnapEvent: coldSnap ? coldSnapEvent : null,
      dayType,
    }
  })
}

type DailyDescriptorGenerator = (clock: ClockSlot[], weatherSeed: string) => DailyDescriptor[]

/** @internal Test seam for deterministic retry selection. */
export const selectAnnualWeatherAttempt = (
  clock: ClockSlot[],
  seedId: string,
  generate: DailyDescriptorGenerator = generateDailyDescriptors,
) => {
  for (let attempt = 0; attempt < MAX_WEATHER_ATTEMPTS; attempt += 1) {
    const weatherSeed = attempt === 0 ? `${seedId}:weather` : `${seedId}:weather:${attempt}`
    const descriptors = generate(clock, weatherSeed)
    if (hasRequiredEvents(descriptors)) return { attempt, descriptors }
  }

  throw new Error(
    `Unable to generate required annual weather event families for seed "${seedId}" after ${MAX_WEATHER_ATTEMPTS} attempts`,
  )
}

export const buildAnnualConditions = (clock: ClockSlot[], seedId: string): Condition[] => {
  assertCanonicalClock(clock)
  const { descriptors } = selectAnnualWeatherAttempt(clock, seedId)
  const firstIndexByDay = new Map<number, number>()
  for (const [index, slot] of clock.entries()) {
    if (!firstIndexByDay.has(slot.dayOfYear)) firstIndexByDay.set(slot.dayOfYear, index)
  }

  return clock.map((slot, index) => {
    const descriptor = descriptors[slot.dayOfYear - 1]!
    const previousDescriptor = descriptors[slot.dayOfYear - 2] ?? descriptor
    const dayStartIndex = firstIndexByDay.get(slot.dayOfYear)!
    const descriptorProgress =
      slot.dayOfYear === 1
        ? 1
        : clamp((index - dayStartIndex) / DESCRIPTOR_BLEND_SLOTS, 0, 1)
    const lowF = interpolate(previousDescriptor.lowF, descriptor.lowF, descriptorProgress)
    const highF = interpolate(previousDescriptor.highF, descriptor.highF, descriptorProgress)
    const dailyOffsetF = interpolate(
      previousDescriptor.dailyOffsetF,
      descriptor.dailyOffsetF,
      descriptorProgress,
    )
    const cloudBaseline = interpolate(
      previousDescriptor.cloudBaseline,
      descriptor.cloudBaseline,
      descriptorProgress,
    )
    const cloudPhase = interpolatePhase(
      previousDescriptor.cloudPhase,
      descriptor.cloudPhase,
      descriptorProgress,
    )
    const dayFraction = slot.minuteOfDay / MINUTES_PER_DAY
    const temperatureF =
      lowF +
      (highF - lowF) *
        (0.5 + 0.5 * Math.cos(Math.PI * 2 * (dayFraction - 16 / 24))) +
      dailyOffsetF
    const rainProgress = clamp((dayFraction - 0.12) / 0.78, 0, 1)
    const rainPulse = descriptor.rainy ? Math.max(0, Math.sin(Math.PI * rainProgress)) : 0
    const precipitationInches = descriptor.rainy
      ? descriptor.rainIntensity * rainPulse / 12
      : 0
    const intradayCloudVariation =
      0.035 * Math.sin(Math.PI * 2 * dayFraction + cloudPhase) +
      0.018 * Math.sin(Math.PI * 4 * dayFraction + cloudPhase / 2)
    const rainSuppression = descriptor.rainy ? 0.08 * rainPulse : 0
    const cloudFactor = clamp(
      cloudBaseline + intradayCloudVariation - rainSuppression,
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
