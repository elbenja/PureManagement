import type { ClockSlot, LoadCategory } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import type { Condition } from './conditions'
import { mulberry32, seedFromString } from './random'
import { buildAugustClock } from './time'
import { buildYearClock } from './yearClock'

export interface HomeLoadPoint {
  kw: number
  kwh: number
  breakdownKwh: Record<LoadCategory, number>
}

export interface HomeLoadOptions {
  canonicalClock: readonly ClockSlot[]
  seedId: string
  monthlyTargetsKwh: readonly number[]
  includeHeating: boolean
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
// Operating envelopes for the legacy summer and explicit annual inputs.
const MIN_TEMPERATURE_F = 40
const MIN_ANNUAL_TEMPERATURE_F = 0
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

const dailyPattern = (dateKey: string, seedId: string): DailyPattern => {
  const random = mulberry32(seedFromString(`${seedId}:home:${dateKey}`))

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

const rawCategoryKw = (
  slot: ClockSlot,
  condition: Condition,
  pattern: DailyPattern,
  includeHeating: boolean,
): CategoryKw => {
  const minute = slot.minuteOfDay
  const occupied = condition.occupied ? 1 : 0
  const coolingExcess = Math.max(0, condition.temperatureF - 73)
  const coolingAvailability = 0.6 + 0.4 * pulse(minute, 17 * 60, 310)
  const coolingKw = coolingExcess * 0.115 * coolingAvailability * (0.72 + 0.28 * occupied)
  const heatingExcess = Math.max(0, 65 - condition.temperatureF)
  // Keep the approved, deliberately unclamped pulse sum; its 5-minute peak availability is ~1.005.
  const heatingAvailability =
    0.55 + 0.45 * (pulse(minute, 7 * 60, 210) + pulse(minute, 20 * 60, 260))
  const heatingKw = includeHeating
    ? heatingExcess * 0.085 * heatingAvailability * (0.75 + 0.25 * occupied)
    : 0

  const baseKw: CategoryKw = {
    hvac: coolingKw + heatingKw,
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

const clockFields: (keyof ClockSlot)[] = [
  'index',
  'iso',
  'year',
  'month',
  'day',
  'dayOfYear',
  'dayOfWeek',
  'minuteOfDay',
  'utcOffset',
  'tou',
]
const conditionFields: (keyof Condition)[] = [
  'dayType',
  'temperatureF',
  'cloudFactor',
  'weatherState',
  'precipitationInches',
  'occupied',
]
const optionFields: (keyof HomeLoadOptions)[] = [
  'canonicalClock',
  'seedId',
  'monthlyTargetsKwh',
  'includeHeating',
]
const dayTypes = new Set(['weekday', 'weekend', 'heatwave', 'cloudy'])
const weatherStates = new Set(['clear', 'partly-cloudy', 'overcast', 'rain'])

const hasExactEnumerableShape = (
  value: object,
  fields: readonly (string | symbol)[],
) => {
  const keys = Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key),
  )
  return keys.length === fields.length && fields.every((field) => keys.includes(field))
}

const defaultOptions = (): HomeLoadOptions => ({
  canonicalClock: buildAugustClock(),
  seedId: LOS_ANGELES_AUGUST_2026.seedId,
  monthlyTargetsKwh: [LOS_ANGELES_AUGUST_2026.home.targetAugustKwh],
  includeHeating: false,
})

let approvedAugustClock: readonly ClockSlot[] | undefined
let approvedAnnualClock: readonly ClockSlot[] | undefined

const approvedClockFor = (annualMode: boolean) => {
  if (annualMode) {
    approvedAnnualClock ??= buildYearClock()
    return approvedAnnualClock
  }
  approvedAugustClock ??= buildAugustClock()
  return approvedAugustClock
}

const isLegacyPatternMode = (options: HomeLoadOptions) =>
  options.monthlyTargetsKwh.length === 1 &&
  options.monthlyTargetsKwh[0] === LOS_ANGELES_AUGUST_2026.home.targetAugustKwh &&
  options.seedId === LOS_ANGELES_AUGUST_2026.seedId &&
  options.includeHeating === false

const validateOptions = (
  clock: readonly ClockSlot[],
  options: HomeLoadOptions,
): readonly ClockSlot[] => {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Invalid home options')
  }
  if (!hasExactEnumerableShape(options, optionFields)) {
    throw new Error('Invalid home options shape')
  }
  if (!Array.isArray(options.canonicalClock)) throw new Error('Invalid canonical clock')
  if (options.canonicalClock.length !== clock.length) {
    throw new Error('Canonical clock length mismatch')
  }
  if (typeof options.seedId !== 'string') throw new Error('Invalid home seed')
  if (typeof options.includeHeating !== 'boolean') {
    throw new Error('Invalid includeHeating option')
  }
  if (
    !Array.isArray(options.monthlyTargetsKwh) ||
    ![1, 12].includes(options.monthlyTargetsKwh.length) ||
    options.monthlyTargetsKwh.some((target) => !Number.isFinite(target) || target <= 0)
  ) {
    throw new Error('Invalid monthly targets: expected one or twelve positive finite values')
  }

  for (let index = 0; index < options.canonicalClock.length; index += 1) {
    const slot = options.canonicalClock[index]
    if (slot === null || typeof slot !== 'object' || Array.isArray(slot)) {
      throw new Error(`Invalid canonical clock slot at index ${index}`)
    }
    if (!hasExactEnumerableShape(slot, clockFields)) {
      throw new Error(`Invalid canonical clock slot shape at index ${index}`)
    }
  }

  const annualMode = options.monthlyTargetsKwh.length === 12
  const approvedCanonicalClock = approvedClockFor(annualMode)
  if (options.canonicalClock.length !== approvedCanonicalClock.length) {
    throw new Error(
      `Canonical clock length mismatch: expected ${approvedCanonicalClock.length}, received ${options.canonicalClock.length}`,
    )
  }
  for (let index = 0; index < approvedCanonicalClock.length; index += 1) {
    const supplied = options.canonicalClock[index]!
    const approved = approvedCanonicalClock[index]!
    if (clockFields.some((field) => supplied[field] !== approved[field])) {
      throw new Error(
        `Canonical clock differs from approved ${annualMode ? 'annual' : 'August'} clock at index ${index}`,
      )
    }
  }

  return approvedCanonicalClock
}

const validateInputs = (
  clock: readonly ClockSlot[],
  conditions: readonly Condition[],
  options: HomeLoadOptions,
  legacyDefaults: boolean,
) => {
  if (clock.length !== conditions.length) {
    if (legacyDefaults) {
      throw new Error(`Home input must contain ${LOS_ANGELES_AUGUST_2026.records} records`)
    }
    throw new Error('Home input length mismatch')
  }
  const approvedCanonicalClock = validateOptions(clock, options)

  for (let index = 0; index < clock.length; index += 1) {
    const slot = clock[index]
    if (slot === null || typeof slot !== 'object' || Array.isArray(slot)) {
      throw new Error(`Invalid clock slot at index ${index}`)
    }
    if (!hasExactEnumerableShape(slot, clockFields)) {
      throw new Error(`Invalid clock slot shape at index ${index}`)
    }
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
    if (
      !Number.isInteger(slot.index) ||
      typeof slot.iso !== 'string' ||
      !Number.isInteger(slot.year) ||
      !Number.isInteger(slot.month) || slot.month < 1 || slot.month > 12 ||
      !Number.isInteger(slot.dayOfYear) || slot.dayOfYear < 1 || slot.dayOfYear > 366 ||
      (slot.utcOffset !== '-08:00' && slot.utcOffset !== '-07:00') ||
      (slot.tou !== 'base' && slot.tou !== 'low' && slot.tou !== 'high')
    ) {
      throw new Error(`Invalid clock slot at index ${index}`)
    }
    const expected = options.canonicalClock[index]!
    if (clockFields.some((field) => slot[field] !== expected[field])) {
      throw new Error(
        legacyDefaults
          ? `Invalid clock slot at index ${index}`
          : `Clock differs from canonical clock at index ${index}`,
      )
    }
    const approved = approvedCanonicalClock[index]!
    if (clockFields.some((field) => slot[field] !== approved[field])) {
      throw new Error(`Clock differs from approved clock at index ${index}`)
    }
  }

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index]
    if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
      throw new Error(`Invalid condition at index ${index}`)
    }
    if (!hasExactEnumerableShape(condition, conditionFields)) {
      throw new Error(`Invalid condition shape at index ${index}`)
    }
    if (
      !Number.isFinite(condition.temperatureF) ||
      condition.temperatureF < (options.monthlyTargetsKwh.length === 12
        ? MIN_ANNUAL_TEMPERATURE_F
        : MIN_TEMPERATURE_F) ||
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
    if (!dayTypes.has(condition.dayType)) throw new Error(`Invalid day type at index ${index}`)
    if (!weatherStates.has(condition.weatherState)) {
      throw new Error(`Invalid weather state at index ${index}`)
    }
    if (!Number.isFinite(condition.precipitationInches) || condition.precipitationInches < 0) {
      throw new Error(`Invalid precipitation at index ${index}`)
    }
  }
}

export const generateHomeLoad = (
  clock: readonly ClockSlot[],
  conditions: readonly Condition[],
  suppliedOptions?: HomeLoadOptions,
): HomeLoadPoint[] => {
  if (!Array.isArray(clock)) throw new Error('Invalid home clock')
  if (!Array.isArray(conditions)) throw new Error('Invalid home conditions')
  const legacyDefaults = suppliedOptions === undefined
  const options = legacyDefaults ? defaultOptions() : suppliedOptions as HomeLoadOptions
  if (legacyDefaults && (
    clock.length !== LOS_ANGELES_AUGUST_2026.records ||
    conditions.length !== LOS_ANGELES_AUGUST_2026.records
  )) {
    throw new Error(`Home input must contain ${LOS_ANGELES_AUGUST_2026.records} records`)
  }
  validateInputs(clock, conditions, options, legacyDefaults)

  const legacyPatternMode = isLegacyPatternMode(options)
  const patterns = new Map<string, DailyPattern>()
  for (const slot of clock) {
    const patternKey = legacyPatternMode ? `${slot.day}` : `${slot.year}-${slot.month}-${slot.day}`
    if (!patterns.has(patternKey)) {
      patterns.set(patternKey, dailyPattern(patternKey, options.seedId))
    }
  }

  const rawBreakdowns = clock.map((slot, index) => {
    const patternKey = legacyPatternMode ? `${slot.day}` : `${slot.year}-${slot.month}-${slot.day}`
    return rawCategoryKw(slot, conditions[index]!, patterns.get(patternKey)!, options.includeHeating)
  })
  const annualTargets = options.monthlyTargetsKwh.length === 12
  const rawTotals = new Map<number, number>()
  rawBreakdowns.forEach((breakdown, index) => {
    const scaleGroup = annualTargets ? clock[index]!.month : 0
    const intervalKwh = categories.reduce((sum, category) => sum + breakdown[category], 0) * intervalHours
    rawTotals.set(scaleGroup, (rawTotals.get(scaleGroup) ?? 0) + intervalKwh)
  })

  const scales = new Map<number, number>()
  const scaleGroups = annualTargets ? Array.from({ length: 12 }, (_, index) => index + 1) : [0]
  for (const scaleGroup of scaleGroups) {
    const rawTotalKwh = rawTotals.get(scaleGroup) ?? 0
    if (!Number.isFinite(rawTotalKwh) || rawTotalKwh <= 0) {
      throw new Error(
        annualTargets
          ? `Home raw load must be finite and positive for month ${scaleGroup}`
          : 'Home raw load must be finite and positive',
      )
    }
    const target = options.monthlyTargetsKwh[annualTargets ? scaleGroup - 1 : 0]!
    const scale = target / rawTotalKwh
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new Error(annualTargets ? `Home target unreachable for month ${scaleGroup}` : 'Home target unreachable')
    }
    scales.set(scaleGroup, scale)
  }

  return rawBreakdowns.map((rawBreakdown, index) => {
    const scaleGroup = annualTargets ? clock[index]!.month : 0
    const scale = scales.get(scaleGroup)!
    const breakdownKwh = categories.reduce<Record<LoadCategory, number>>(
      (breakdown, category) => {
        breakdown[category] = rawBreakdown[category] * scale * intervalHours
        return breakdown
      },
      {} as Record<LoadCategory, number>,
    )
    const kwh = categories.reduce((total, category) => total + breakdownKwh[category], 0)
    const kw = kwh / intervalHours
    if (![kw, kwh, ...Object.values(breakdownKwh)].every(Number.isFinite)) {
      throw new Error(annualTargets ? `Home target unreachable for month ${scaleGroup}` : 'Home target unreachable')
    }

    return { kw, kwh, breakdownKwh }
  })
}
