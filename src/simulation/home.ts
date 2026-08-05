import type { ClockSlot, LoadCategory } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import type { Condition } from './conditions'
import { mulberry32, seedFromString } from './random'

export interface HomeLoadPoint {
  kw: number
  kwh: number
  breakdownKwh: Record<LoadCategory, number>
}

type CategoryKw = Record<LoadCategory, number>

const categories: LoadCategory[] = [
  'hvac',
  'waterHeating',
  'cooking',
  'laundry',
  'refrigeration',
  'lighting',
  'electronicsOther',
]
const intervalHours = LOS_ANGELES_AUGUST_2026.intervalMinutes / 60
const MINUTES_PER_DAY = 24 * 60

const pulse = (minute: number, center: number, width: number) =>
  Math.exp(-0.5 * ((minute - center) / width) ** 2)

const occupiedDarkness = (minute: number) =>
  pulse(minute, 6.5 * 60, 80) + pulse(minute, 20 * 60, 150)

interface DailyPattern {
  refrigerationPhase: number
  morningWaterMinute: number
  eveningWaterMinute: number
  breakfastMinute: number
  dinnerMinute: number
  laundryMinute: number
  laundryStrength: number
  dishwasherMinute: number
}

const dailyPattern = (day: number): DailyPattern => {
  const random = mulberry32(seedFromString(`${LOS_ANGELES_AUGUST_2026.seedId}:home:${day}`))

  return {
    refrigerationPhase: random() * Math.PI * 2,
    morningWaterMinute: (6.5 + random() * 1.5) * 60,
    eveningWaterMinute: (19 + random() * 1.5) * 60,
    breakfastMinute: (6.7 + random() * 0.9) * 60,
    dinnerMinute: (18 + random() * 1.1) * 60,
    laundryMinute: (10 + random() * 5) * 60,
    laundryStrength: random() > 0.32 ? 0.8 + random() * 0.55 : 0,
    // Dishwasher load is assigned to laundry: both are intermittent appliance cycles.
    dishwasherMinute: (20 + random() * 1.4) * 60,
  }
}

const rawCategoryKw = (slot: ClockSlot, condition: Condition): CategoryKw => {
  const pattern = dailyPattern(slot.day)
  const minute = slot.minuteOfDay
  const occupied = condition.occupied ? 1 : 0
  const coolingExcess = Math.max(0, condition.temperatureF - 73)
  const coolingAvailability = 0.6 + 0.4 * pulse(minute, 17 * 60, 310)

  return {
    hvac: coolingExcess * 0.115 * coolingAvailability * (0.72 + 0.28 * occupied),
    waterHeating:
      0.025 +
      0.95 * pulse(minute, pattern.morningWaterMinute, 38) +
      0.75 * pulse(minute, pattern.eveningWaterMinute, 48),
    cooking:
      0.018 +
      1.35 * pulse(minute, pattern.breakfastMinute, 34) +
      1.85 * pulse(minute, pattern.dinnerMinute, 46) +
      0.28 * pulse(minute, 12.5 * 60, 40),
    laundry:
      pattern.laundryStrength * 0.72 * pulse(minute, pattern.laundryMinute, 48) +
      0.46 * pulse(minute, pattern.dishwasherMinute, 52),
    refrigeration: 0.15 + 0.035 * (1 + Math.sin((Math.PI * 2 * minute) / 105 + pattern.refrigerationPhase)),
    lighting: 0.012 + occupied * (0.075 * pulse(minute, 6.5 * 60, 75) + 0.29 * pulse(minute, 20 * 60, 135)),
    electronicsOther: 0.115 + occupied * (0.095 + 0.13 * occupiedDarkness(minute)),
  }
}

const validateInputs = (clock: ClockSlot[], conditions: Condition[]) => {
  if (clock.length !== conditions.length) throw new Error('Home input length mismatch')

  conditions.forEach((condition, index) => {
    if (!Number.isFinite(condition.temperatureF)) {
      throw new Error(`Invalid temperature at index ${index}`)
    }
    if (
      !Number.isFinite(condition.cloudFactor) ||
      condition.cloudFactor < 0 ||
      condition.cloudFactor > 1
    ) {
      throw new Error(`Invalid cloud factor at index ${index}`)
    }
  })
}

export const generateHomeLoad = (clock: ClockSlot[], conditions: Condition[]): HomeLoadPoint[] => {
  validateInputs(clock, conditions)

  const rawBreakdowns = clock.map((slot, index) => rawCategoryKw(slot, conditions[index]!))
  const rawTotalKwh = rawBreakdowns.reduce(
    (total, breakdown) => total + categories.reduce((sum, category) => sum + breakdown[category], 0) * intervalHours,
    0,
  )
  const scale = LOS_ANGELES_AUGUST_2026.home.targetAugustKwh / rawTotalKwh

  return rawBreakdowns.map((rawBreakdown) => {
    const breakdownKwh = categories.reduce<Record<LoadCategory, number>>(
      (breakdown, category) => {
        breakdown[category] = rawBreakdown[category] * scale * intervalHours
        return breakdown
      },
      {} as Record<LoadCategory, number>,
    )
    const kwh = categories.reduce((total, category) => total + breakdownKwh[category], 0)

    return { kw: kwh / intervalHours, kwh, breakdownKwh }
  })
}
