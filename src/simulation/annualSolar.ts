import type { ClockSlot, DayType, WeatherState } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import type { Condition } from './conditions'
import type { SolarPoint } from './solar'
import { buildYearClock } from './yearClock'

const intervalHours = LOS_ANGELES_2026.intervalMinutes / 60
const capacityKw = LOS_ANGELES_2026.solar.capacityKw

const dayTypes: DayType[] = ['weekday', 'weekend', 'heatwave', 'cloudy']
const weatherStates: WeatherState[] = ['clear', 'partly-cloudy', 'overcast', 'rain']

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

const validCondition = (condition: unknown): condition is Condition => {
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) return false

  const candidate = condition as Condition
  return (
    dayTypes.includes(candidate.dayType) &&
    Number.isFinite(candidate.temperatureF) &&
    weatherStates.includes(candidate.weatherState) &&
    Number.isFinite(candidate.precipitationInches) &&
    candidate.precipitationInches >= 0 &&
    typeof candidate.occupied === 'boolean'
  )
}

const assertConditions = (conditions: Condition[]) => {
  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index]
    if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
      throw new Error(`Invalid condition at index ${index}`)
    }
    if (
      !Number.isFinite(condition.cloudFactor) ||
      condition.cloudFactor < 0 ||
      condition.cloudFactor > 1
    ) {
      throw new Error(`Invalid cloud factor at index ${index}`)
    }
    if (!validCondition(condition)) throw new Error(`Invalid condition at index ${index}`)
  }
}

const daylightWindow = (slot: ClockSlot) => {
  const dayLengthHours = 12 + 2.2 * Math.sin((2 * Math.PI * (slot.dayOfYear - 80)) / 365)
  const solarNoonMinute = slot.utcOffset === '-07:00' ? 12 * 60 + 55 : 11 * 60 + 55

  return {
    daylightStart: solarNoonMinute - dayLengthHours * 30,
    daylightEnd: solarNoonMinute + dayLengthHours * 30,
  }
}

const rawSolarKw = (slot: ClockSlot, cloudFactor: number): number => {
  const { daylightStart, daylightEnd } = daylightWindow(slot)
  if (slot.minuteOfDay < daylightStart || slot.minuteOfDay >= daylightEnd) return 0

  const daylightProgress = (slot.minuteOfDay - daylightStart) / (daylightEnd - daylightStart)
  return capacityKw * Math.sin(Math.PI * daylightProgress) * cloudFactor
}

const energyAtScale = (rawKw: number[], scale: number) =>
  rawKw.reduce((total, kw) => total + Math.min(capacityKw, kw * scale) * intervalHours, 0)

const maximumReachableEnergy = (rawKw: number[]) =>
  rawKw.reduce((total, kw) => total + (kw > 0 ? capacityKw * intervalHours : 0), 0)

const scaleForTarget = (rawKw: number[], targetKwh: number, month: number) => {
  if (targetKwh > maximumReachableEnergy(rawKw)) {
    throw new Error(`Solar target unreachable for month ${month}`)
  }

  let lower = 0
  let upper = 1
  while (energyAtScale(rawKw, upper) < targetKwh && upper < Number.MAX_VALUE) {
    upper = Math.min(Number.MAX_VALUE, upper * 2)
  }
  if (energyAtScale(rawKw, upper) < targetKwh) {
    throw new Error(`Solar target unreachable for month ${month}`)
  }

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const middle = lower + (upper - lower) / 2
    if (energyAtScale(rawKw, middle) < targetKwh) lower = middle
    else upper = middle
  }
  return lower + (upper - lower) / 2
}

export const generateAnnualSolar = (
  clock: ClockSlot[],
  conditions: Condition[],
): SolarPoint[] => {
  if (clock.length !== conditions.length) throw new Error('Solar input length mismatch')
  assertCanonicalClock(clock)
  assertConditions(conditions)

  const rawKw = clock.map((slot, index) => rawSolarKw(slot, conditions[index]!.cloudFactor))
  const rawKwByMonth = new Map<number, number[]>()
  for (const [index, kw] of rawKw.entries()) {
    const month = clock[index]!.month
    const monthlyRawKw = rawKwByMonth.get(month) ?? []
    monthlyRawKw.push(kw)
    rawKwByMonth.set(month, monthlyRawKw)
  }

  const scalesByMonth = new Map<number, number>()
  for (const profile of LOS_ANGELES_2026.months) {
    scalesByMonth.set(
      profile.month,
      scaleForTarget(rawKwByMonth.get(profile.month)!, profile.solarTargetKwh, profile.month),
    )
  }

  return rawKw.map((kw, index) => {
    const normalizedKw = Math.min(capacityKw, kw * scalesByMonth.get(clock[index]!.month)!)
    return { kw: normalizedKw, kwh: normalizedKw * intervalHours }
  })
}
