import type { ClockSlot } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import type { Condition } from './conditions'

export interface SolarPoint {
  kw: number
  kwh: number
}

const DAYLIGHT_START = 6 * 60 + 5
const DAYLIGHT_END = 19 * 60 + 45
const MAX_SCALE_ITERATIONS = 64
const intervalHours = LOS_ANGELES_AUGUST_2026.intervalMinutes / 60

const rawSolarKw = (slot: ClockSlot, condition: Condition): number => {
  if (slot.minuteOfDay < DAYLIGHT_START || slot.minuteOfDay >= DAYLIGHT_END) return 0

  const daylightProgress =
    (slot.minuteOfDay - DAYLIGHT_START) / (DAYLIGHT_END - DAYLIGHT_START)
  return LOS_ANGELES_AUGUST_2026.solar.capacityKw * Math.sin(Math.PI * daylightProgress) * condition.cloudFactor
}

const energyAtScale = (rawKw: number[], scale: number): number =>
  rawKw.reduce(
    (total, kw) => total + Math.min(LOS_ANGELES_AUGUST_2026.solar.capacityKw, kw * scale) * intervalHours,
    0,
  )

const maximumReachableEnergy = (rawKw: number[]): number =>
  rawKw.reduce(
    (total, kw) =>
      total + (kw > 0 ? LOS_ANGELES_AUGUST_2026.solar.capacityKw * intervalHours : 0),
    0,
  )

const unreachableTarget = (): never => {
  throw new Error('Solar target unreachable within the configured capacity')
}

const scaleForTarget = (rawKw: number[]): number => {
  const target = LOS_ANGELES_AUGUST_2026.solar.targetAugustKwh
  let lower = 0
  let upper = 1

  if (target > maximumReachableEnergy(rawKw)) unreachableTarget()

  for (let iteration = 0; iteration < MAX_SCALE_ITERATIONS; iteration += 1) {
    if (energyAtScale(rawKw, upper) >= target) break
    upper *= 2
  }

  if (energyAtScale(rawKw, upper) < target) unreachableTarget()

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const middle = (lower + upper) / 2
    if (energyAtScale(rawKw, middle) < target) lower = middle
    else upper = middle
  }

  return (lower + upper) / 2
}

export const generateSolar = (clock: ClockSlot[], conditions: Condition[]): SolarPoint[] => {
  if (clock.length !== conditions.length) {
    throw new Error('Solar input length mismatch')
  }

  conditions.forEach((condition, index) => {
    if (
      !Number.isFinite(condition.cloudFactor) ||
      condition.cloudFactor < 0 ||
      condition.cloudFactor > 1
    ) {
      throw new Error(`Invalid cloud factor at index ${index}`)
    }
  })

  const rawKw = clock.map((slot, index) => rawSolarKw(slot, conditions[index]!))
  const scale = scaleForTarget(rawKw)

  return rawKw.map((kw) => {
    const normalizedKw = Math.min(LOS_ANGELES_AUGUST_2026.solar.capacityKw, kw * scale)
    return { kw: normalizedKw, kwh: normalizedKw * intervalHours }
  })
}
