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
const SLOTS_PER_DAY = MINUTES_PER_DAY / LOS_ANGELES_AUGUST_2026.intervalMinutes
// Broad summer operating envelope for the fixed Woodland Hills simulation inputs.
const MIN_TEMPERATURE_F = 40
const MAX_TEMPERATURE_F = 130

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
  categoryPhases: Record<LoadCategory, number>
  categoryAmplitudes: Record<LoadCategory, number>
}

const dailyPattern = (day: number): DailyPattern => {
  const random = mulberry32(seedFromString(`${LOS_ANGELES_AUGUST_2026.seedId}:home:${day}`))

  const pattern = {
    refrigerationPhase: random() * Math.PI * 2,
    morningWaterMinute: (6.5 + random() * 1.5) * 60,
    eveningWaterMinute: (19 + random() * 1.5) * 60,
    breakfastMinute: (6.7 + random() * 0.9) * 60,
    dinnerMinute: (18 + random() * 1.1) * 60,
    laundryMinute: (10 + random() * 5) * 60,
    laundryStrength: random() > 0.32 ? 0.8 + random() * 0.55 : 0,
    // Dishwasher load is assigned to laundry: both are intermittent appliance cycles.
    dishwasherMinute: (20 + random() * 1.4) * 60,
    categoryPhases: {} as Record<LoadCategory, number>,
    categoryAmplitudes: {} as Record<LoadCategory, number>,
  }

  categories.forEach((category) => {
    pattern.categoryPhases[category] = random() * Math.PI * 2
    pattern.categoryAmplitudes[category] = 0.04 + random() * 0.05
  })

  return pattern
}

const categoryVariation = (minute: number, phase: number, amplitude: number) =>
  1 +
  amplitude *
    (0.6 * Math.sin((Math.PI * 2 * minute) / MINUTES_PER_DAY + phase) +
      0.4 * Math.cos((Math.PI * 4 * minute) / MINUTES_PER_DAY + phase / 2))

const rawCategoryKw = (slot: ClockSlot, condition: Condition, pattern: DailyPattern): CategoryKw => {
  const minute = slot.minuteOfDay
  const occupied = condition.occupied ? 1 : 0
  const coolingExcess = Math.max(0, condition.temperatureF - 73)
  const coolingAvailability = 0.6 + 0.4 * pulse(minute, 17 * 60, 310)

  const baseKw: CategoryKw = {
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

  return categories.reduce<CategoryKw>((breakdown, category) => {
    breakdown[category] =
      baseKw[category] *
      categoryVariation(minute, pattern.categoryPhases[category], pattern.categoryAmplitudes[category])
    return breakdown
  }, {} as CategoryKw)
}

const validateInputs = (clock: ClockSlot[], conditions: Condition[]) => {
  if (
    clock.length !== LOS_ANGELES_AUGUST_2026.records ||
    conditions.length !== LOS_ANGELES_AUGUST_2026.records ||
    clock.length !== conditions.length
  ) {
    throw new Error(`Home input must contain ${LOS_ANGELES_AUGUST_2026.records} records`)
  }

  clock.forEach((slot, index) => {
    if (!Number.isFinite(slot.day) || !Number.isInteger(slot.day) || slot.day < 1 || slot.day > 31) {
      throw new Error(`Invalid clock day at index ${index}`)
    }
    if (
      !Number.isFinite(slot.minuteOfDay) ||
      !Number.isInteger(slot.minuteOfDay) ||
      slot.minuteOfDay < 0 ||
      slot.minuteOfDay >= MINUTES_PER_DAY ||
      slot.minuteOfDay % LOS_ANGELES_AUGUST_2026.intervalMinutes !== 0
    ) {
      throw new Error(`Invalid clock minute at index ${index}`)
    }
    if (!Number.isFinite(slot.dayOfWeek) || !Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
      throw new Error(`Invalid clock day of week at index ${index}`)
    }

    const expectedDay = Math.floor(index / SLOTS_PER_DAY) + 1
    const expectedMinute = (index % SLOTS_PER_DAY) * LOS_ANGELES_AUGUST_2026.intervalMinutes
    const expectedDayOfWeek = new Date(Date.UTC(2026, 7, expectedDay)).getUTCDay()
    if (
      slot.index !== index ||
      slot.day !== expectedDay ||
      slot.minuteOfDay !== expectedMinute ||
      slot.dayOfWeek !== expectedDayOfWeek
    ) {
      throw new Error(`Invalid clock slot at index ${index}`)
    }
  })

  conditions.forEach((condition, index) => {
    if (
      !Number.isFinite(condition.temperatureF) ||
      condition.temperatureF < MIN_TEMPERATURE_F ||
      condition.temperatureF > MAX_TEMPERATURE_F
    ) {
      throw new Error(`Invalid temperature at index ${index}`)
    }
    if (
      !Number.isFinite(condition.cloudFactor) ||
      condition.cloudFactor < 0 ||
      condition.cloudFactor > 1
    ) {
      throw new Error(`Invalid cloud factor at index ${index}`)
    }
    if (typeof condition.occupied !== 'boolean') {
      throw new Error(`Invalid occupied flag at index ${index}`)
    }
  })
}

export const generateHomeLoad = (clock: ClockSlot[], conditions: Condition[]): HomeLoadPoint[] => {
  validateInputs(clock, conditions)

  const patterns = new Map<number, DailyPattern>()
  for (let day = 1; day <= 31; day += 1) patterns.set(day, dailyPattern(day))

  const rawBreakdowns = clock.map((slot, index) =>
    rawCategoryKw(slot, conditions[index]!, patterns.get(slot.day)!),
  )
  const rawTotalKwh = rawBreakdowns.reduce(
    (total, breakdown) => total + categories.reduce((sum, category) => sum + breakdown[category], 0) * intervalHours,
    0,
  )
  if (!Number.isFinite(rawTotalKwh) || rawTotalKwh <= 0) {
    throw new Error('Home raw load must be finite and positive')
  }
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
