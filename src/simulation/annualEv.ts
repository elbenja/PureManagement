import type { ClockSlot } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import type { EvPoint } from './ev'
import { mulberry32, seedFromString } from './random'
import { buildYearClock } from './yearClock'

interface RawDayPlan {
  date: string
  month: number
  dayOfWeek: number
  indexes: number[]
  departureMinute: number
  returnMinute: number
  minMiles: number
  maxMiles: number
  rawMiles: number
}

interface DayPlan extends RawDayPlan {
  departureIndex: number
  tripKwh: number
}

const intervalHours = LOS_ANGELES_2026.intervalMinutes / 60
const initialSocKwh = LOS_ANGELES_2026.ev.capacityKwh * LOS_ANGELES_2026.ev.initialSocPercent / 100
const maxChargePerSlotKwh = LOS_ANGELES_2026.ev.chargerKw * intervalHours
const weekdayDepartureMinute = 7 * 60 + 30
const weekdayReturnMinute = 18 * 60
const preferredChargingMinute = 20 * 60
const toleranceKwh = 1e-9
// A binary grid keeps all monthly and annual trip sums exactly representable.
const tripEnergyUnitKwh = 2 ** -20

const clockFields: readonly (keyof ClockSlot)[] = [
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

const pointFields: readonly (keyof EvPoint)[] = [
  'chargeKw',
  'chargeKwh',
  'available',
  'socStartKwh',
  'socEndKwh',
  'tripKwh',
]

const isWeekday = (dayOfWeek: number) => dayOfWeek >= 1 && dayOfWeek <= 5

const mileageBounds = (dayOfWeek: number) => isWeekday(dayOfWeek)
  ? LOS_ANGELES_2026.ev.weekdayMiles
  : LOS_ANGELES_2026.ev.weekendMiles

const hasExactShape = (value: object, fields: readonly (string | symbol)[]) => {
  const keys = Reflect.ownKeys(value)
  return keys.length === fields.length && fields.every((field) => keys.includes(field))
}

const validateClock = (clock: ClockSlot[]) => {
  if (!Array.isArray(clock)) throw new Error('Invalid annual EV clock')
  if (clock.length !== LOS_ANGELES_2026.records) {
    throw new Error(`Annual EV clock must contain ${LOS_ANGELES_2026.records} records`)
  }

  const canonical = buildYearClock()
  for (let index = 0; index < canonical.length; index += 1) {
    const slot = clock[index]
    if (slot === null || typeof slot !== 'object' || Array.isArray(slot)) {
      throw new Error(`Invalid annual EV clock slot at index ${index}`)
    }
    if (!hasExactShape(slot, clockFields)) {
      throw new Error(`Invalid annual EV clock slot shape at index ${index}`)
    }

    const expected = canonical[index]!
    if (clockFields.some((field) => slot[field] !== expected[field])) {
      throw new Error(`Annual EV clock differs from canonical clock at index ${index}`)
    }
  }
}

const assertSeed = (seedId: string) => {
  if (typeof seedId !== 'string' || seedId.trim().length === 0) {
    throw new Error('Invalid annual EV seed')
  }
}

const dateKey = (slot: ClockSlot) => `${slot.year}-${slot.month}-${slot.day}`

const buildRawDayPlans = (clock: ClockSlot[], seedId: string): RawDayPlan[] => {
  const indexesByDate = new Map<string, number[]>()
  for (let index = 0; index < clock.length; index += 1) {
    const key = dateKey(clock[index]!)
    const indexes = indexesByDate.get(key) ?? []
    indexes.push(index)
    indexesByDate.set(key, indexes)
  }

  const random = mulberry32(seedFromString(`${seedId}:ev`))
  return [...indexesByDate].map(([date, indexes]) => {
    const firstSlot = clock[indexes[0]!]!
    const bounds = mileageBounds(firstSlot.dayOfWeek)
    const rawMiles = bounds.min + random() * (bounds.max - bounds.min)

    if (isWeekday(firstSlot.dayOfWeek)) {
      return {
        date,
        month: firstSlot.month,
        dayOfWeek: firstSlot.dayOfWeek,
        indexes,
        departureMinute: weekdayDepartureMinute,
        returnMinute: weekdayReturnMinute,
        minMiles: bounds.min,
        maxMiles: bounds.max,
        rawMiles,
      }
    }

    const departureMinute = 9 * 60 + 30 + Math.floor(random() * 4) * 30
    const returnMinute = departureMinute + 3 * 60 + 30 + Math.floor(random() * 5) * 30
    return {
      date,
      month: firstSlot.month,
      dayOfWeek: firstSlot.dayOfWeek,
      indexes,
      departureMinute,
      returnMinute,
      minMiles: bounds.min,
      maxMiles: bounds.max,
      rawMiles,
    }
  })
}

const feasibleEnergyBounds = (dayOfWeeks: readonly number[]) => dayOfWeeks.reduce(
  (totals, dayOfWeek) => {
    const bounds = mileageBounds(dayOfWeek)
    totals.minimum += bounds.min * LOS_ANGELES_2026.ev.efficiencyKwhPerMile
    totals.maximum += bounds.max * LOS_ANGELES_2026.ev.efficiencyKwhPerMile
    return totals
  },
  { minimum: 0, maximum: 0 },
)

const assertMonthFeasible = (
  dayOfWeeks: readonly number[],
  targetKwh: number,
  month: number,
) => {
  const { minimum, maximum } = feasibleEnergyBounds(dayOfWeeks)
  if (
    !Number.isFinite(targetKwh) ||
    targetKwh <= 0 ||
    targetKwh < minimum - toleranceKwh ||
    targetKwh > maximum + toleranceKwh
  ) {
    throw new Error(`Annual EV travel target is infeasible for month ${month}`)
  }
}

/** @internal Narrow test seam for the otherwise scenario-fixed feasibility guard. */
export const __assertAnnualEvMonthFeasible = (
  dayOfWeeks: readonly number[],
  targetKwh: number,
  month: number,
) => assertMonthFeasible(dayOfWeeks, targetKwh, month)

const allocateMonthTripEnergy = (plans: RawDayPlan[], month: number): number[] => {
  const targetKwh = LOS_ANGELES_2026.ev.targetMonthlyKwh
  assertMonthFeasible(plans.map((plan) => plan.dayOfWeek), targetKwh, month)

  const efficiency = LOS_ANGELES_2026.ev.efficiencyKwhPerMile
  const targetMiles = targetKwh / efficiency
  const rawMilesTotal = plans.reduce((total, plan) => total + plan.rawMiles, 0)
  const adjustment = targetMiles - rawMilesTotal
  const adjustmentCapacity = plans.reduce((total, plan) => total + (
    adjustment >= 0 ? plan.maxMiles - plan.rawMiles : plan.rawMiles - plan.minMiles
  ), 0)
  if (Math.abs(adjustment) > toleranceKwh && adjustmentCapacity <= 0) {
    throw new Error(`Annual EV travel target is infeasible for month ${month}`)
  }

  const proportionalKwh = plans.map((plan) => {
    if (Math.abs(adjustment) <= toleranceKwh) return plan.rawMiles * efficiency
    const headroom = adjustment >= 0
      ? plan.maxMiles - plan.rawMiles
      : plan.rawMiles - plan.minMiles
    return (plan.rawMiles + adjustment * headroom / adjustmentCapacity) * efficiency
  })

  const minimumUnits = plans.map((plan) => Math.ceil(plan.minMiles * efficiency / tripEnergyUnitKwh))
  const maximumUnits = plans.map((plan) => Math.floor(plan.maxMiles * efficiency / tripEnergyUnitKwh))
  const targetUnits = Math.round(targetKwh / tripEnergyUnitKwh)
  const units = proportionalKwh.map((kwh, index) => Math.max(
    minimumUnits[index]!,
    Math.min(maximumUnits[index]!, Math.round(kwh / tripEnergyUnitKwh)),
  ))

  let correction = targetUnits - units.reduce((total, value) => total + value, 0)
  for (let index = plans.length - 1; correction !== 0 && index >= 0; index -= 1) {
    const availableUnits = correction > 0
      ? maximumUnits[index]! - units[index]!
      : units[index]! - minimumUnits[index]!
    const adjustmentUnits = Math.sign(correction) * Math.min(Math.abs(correction), availableUnits)
    units[index]! += adjustmentUnits
    correction -= adjustmentUnits
  }
  if (correction !== 0) {
    throw new Error(`Annual EV travel target is infeasible for month ${month}`)
  }

  return units.map((value) => value * tripEnergyUnitKwh)
}

const buildDayPlans = (clock: ClockSlot[], seedId: string): DayPlan[] => {
  const rawPlans = buildRawDayPlans(clock, seedId)
  const plansByMonth = new Map<number, RawDayPlan[]>()
  rawPlans.forEach((plan) => {
    const monthlyPlans = plansByMonth.get(plan.month) ?? []
    monthlyPlans.push(plan)
    plansByMonth.set(plan.month, monthlyPlans)
  })

  const tripEnergyByDate = new Map<string, number>()
  for (let month = 1; month <= 12; month += 1) {
    const monthlyPlans = plansByMonth.get(month) ?? []
    const tripEnergy = allocateMonthTripEnergy(monthlyPlans, month)
    monthlyPlans.forEach((plan, index) => tripEnergyByDate.set(plan.date, tripEnergy[index]!))
  }

  return rawPlans.map((plan) => {
    const departureIndex = plan.indexes.find((index) => clock[index]!.minuteOfDay === plan.departureMinute)
    if (departureIndex === undefined) {
      throw new Error(`Annual EV departure time is missing for ${plan.date}`)
    }
    return { ...plan, departureIndex, tripKwh: tripEnergyByDate.get(plan.date)! }
  })
}

const isAvailable = (slot: ClockSlot, plan: DayPlan) =>
  slot.minuteOfDay < plan.departureMinute || slot.minuteOfDay >= plan.returnMinute

const isPreferredChargingSlot = (minuteOfDay: number) =>
  minuteOfDay >= preferredChargingMinute || minuteOfDay < weekdayDepartureMinute

const preferredCapacityBeforeNextDeparture = (
  clock: ClockSlot[],
  planByIndex: readonly DayPlan[],
  departureIndexes: ReadonlySet<number>,
  fromIndex: number,
) => {
  let capacityKwh = 0
  for (let index = fromIndex; index < clock.length; index += 1) {
    if (index > fromIndex && departureIndexes.has(index)) break
    const slot = clock[index]!
    if (
      isAvailable(slot, planByIndex[index]!) &&
      isPreferredChargingSlot(slot.minuteOfDay)
    ) {
      capacityKwh += maxChargePerSlotKwh
    }
  }
  return capacityKwh
}

const sumEnergy = (points: readonly EvPoint[], field: 'chargeKwh' | 'tripKwh', end = points.length) => {
  let total = 0
  for (let index = 0; index < end; index += 1) total += points[index]![field]
  return total
}

const reconcileFinalCharge = (points: EvPoint[]) => {
  let lastChargeIndex = -1
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index]!.chargeKwh > 0) {
      lastChargeIndex = index
      break
    }
  }
  if (lastChargeIndex < 0) throw new Error('Annual EV charging schedule has no physical charge interval')

  const reconciledKwh = LOS_ANGELES_2026.ev.targetAnnualKwh - sumEnergy(points, 'chargeKwh', lastChargeIndex)
  const point = points[lastChargeIndex]!
  if (
    !Number.isFinite(reconciledKwh) ||
    reconciledKwh < 0 ||
    reconciledKwh > maxChargePerSlotKwh ||
    reconciledKwh > LOS_ANGELES_2026.ev.capacityKwh - point.socStartKwh + toleranceKwh ||
    !point.available ||
    point.tripKwh > 0
  ) {
    throw new Error(`Annual EV final charge correction is infeasible at index ${lastChargeIndex}`)
  }
  point.chargeKwh = reconciledKwh
  point.chargeKw = reconciledKwh / intervalHours
}

const rebuildSocLedger = (points: EvPoint[]) => {
  let chargedKwh = 0
  let traveledKwh = 0

  points.forEach((point, index) => {
    point.socStartKwh = initialSocKwh + chargedKwh - traveledKwh
    if (point.tripKwh > point.socStartKwh + toleranceKwh) {
      throw new Error(`Annual EV departure cannot be served at index ${index}`)
    }
    traveledKwh += point.tripKwh
    chargedKwh += point.chargeKwh
    point.socEndKwh = initialSocKwh + chargedKwh - traveledKwh
  })
}

const outputError = (index: number, message: string): never => {
  throw new Error(`Invalid annual EV output at index ${index}: ${message}`)
}

const validatePoints = (
  clock: ClockSlot[],
  points: EvPoint[],
  planByIndex: readonly DayPlan[],
) => {
  if (points.length !== clock.length) throw new Error('Annual EV output length mismatch')

  const tripsByDate = new Map<string, number>()
  const tripEnergyByMonth = new Map<number, number>()
  const chargeEnergyByMonth = new Map<number, number>()
  let pendingKwh = 0

  points.forEach((point, index) => {
    if (point === null || typeof point !== 'object' || Array.isArray(point) || !hasExactShape(point, pointFields)) {
      outputError(index, 'invalid point shape')
    }
    const slot = clock[index]!
    const plan = planByIndex[index]!
    const expectedAvailable = index !== plan.departureIndex && isAvailable(slot, plan)
    const numeric = [point.chargeKw, point.chargeKwh, point.socStartKwh, point.socEndKwh, point.tripKwh]
    if (!numeric.every(Number.isFinite)) outputError(index, 'non-finite energy value')
    if (typeof point.available !== 'boolean' || point.available !== expectedAvailable) {
      outputError(index, 'availability does not match the travel window')
    }
    if (point.chargeKw < 0 || point.chargeKw > LOS_ANGELES_2026.ev.chargerKw) {
      outputError(index, 'charge power is outside charger bounds')
    }
    if (point.chargeKwh < 0 || Math.abs(point.chargeKwh - point.chargeKw * intervalHours) > 1e-12) {
      outputError(index, 'charge interval energy is invalid')
    }
    if (point.tripKwh < 0 || (index === plan.departureIndex ? point.tripKwh !== plan.tripKwh : point.tripKwh !== 0)) {
      outputError(index, 'trip event does not match the daily plan')
    }
    if (!point.available && point.chargeKwh !== 0) outputError(index, 'charged while unavailable')
    if (point.tripKwh > 0 && point.chargeKwh !== 0) outputError(index, 'charged during departure')
    if (
      point.socStartKwh < 0 ||
      point.socStartKwh > LOS_ANGELES_2026.ev.capacityKwh ||
      point.socEndKwh < 0 ||
      point.socEndKwh > LOS_ANGELES_2026.ev.capacityKwh
    ) {
      outputError(index, 'SOC is outside battery bounds')
    }
    if (index > 0 && point.socStartKwh !== points[index - 1]!.socEndKwh) {
      outputError(index, 'SOC is not continuous')
    }
    if (Math.abs(point.socEndKwh - (point.socStartKwh - point.tripKwh + point.chargeKwh)) > 1e-9) {
      outputError(index, 'SOC energy relation is invalid')
    }
    if (point.tripKwh > point.socStartKwh + toleranceKwh) {
      outputError(index, 'departure cannot be served')
    }

    pendingKwh += point.tripKwh
    if (point.chargeKwh > 0 && !isPreferredChargingSlot(slot.minuteOfDay)) {
      const departureIndexes = new Set(planByIndex.map((dayPlan) => dayPlan.departureIndex))
      const preferredCapacity = preferredCapacityBeforeNextDeparture(
        clock,
        planByIndex,
        departureIndexes,
        index,
      )
      if (pendingKwh <= preferredCapacity + toleranceKwh) {
        outputError(index, 'charged early without physical necessity')
      }
    }
    pendingKwh -= point.chargeKwh

    if (point.tripKwh > 0) {
      const key = dateKey(slot)
      tripsByDate.set(key, (tripsByDate.get(key) ?? 0) + 1)
      const miles = point.tripKwh / LOS_ANGELES_2026.ev.efficiencyKwhPerMile
      const bounds = mileageBounds(slot.dayOfWeek)
      if (miles < bounds.min || miles > bounds.max) outputError(index, 'trip mileage is outside daily bounds')
    }
    tripEnergyByMonth.set(slot.month, (tripEnergyByMonth.get(slot.month) ?? 0) + point.tripKwh)
    chargeEnergyByMonth.set(slot.month, (chargeEnergyByMonth.get(slot.month) ?? 0) + point.chargeKwh)
  })

  if (tripsByDate.size !== 365 || [...tripsByDate.values()].some((count) => count !== 1)) {
    throw new Error('Annual EV output must contain one departure per local calendar date')
  }
  for (let month = 1; month <= 12; month += 1) {
    if (tripEnergyByMonth.get(month) !== LOS_ANGELES_2026.ev.targetMonthlyKwh) {
      throw new Error(`Annual EV trip ledger does not reconcile for month ${month}`)
    }
    const monthlyCharge = chargeEnergyByMonth.get(month) ?? 0
    if (monthlyCharge < 250 || monthlyCharge > 450) {
      throw new Error(`Annual EV charge ledger is outside bounds for month ${month}`)
    }
  }
  if (
    sumEnergy(points, 'tripKwh') !== LOS_ANGELES_2026.ev.targetAnnualKwh ||
    sumEnergy(points, 'chargeKwh') !== LOS_ANGELES_2026.ev.targetAnnualKwh ||
    points[0]!.socStartKwh !== initialSocKwh ||
    points.at(-1)!.socEndKwh !== initialSocKwh
  ) {
    throw new Error('Annual EV ledger does not reconcile exactly')
  }
}

export const generateAnnualEv = (clock: ClockSlot[], seedId: string): EvPoint[] => {
  validateClock(clock)
  assertSeed(seedId)

  const dayPlans = buildDayPlans(clock, seedId)
  const planByIndex = new Array<DayPlan>(clock.length)
  dayPlans.forEach((plan) => plan.indexes.forEach((index) => { planByIndex[index] = plan }))
  const departureIndexes = new Set(dayPlans.map((plan) => plan.departureIndex))

  let socKwh = initialSocKwh
  let pendingChargeKwh = 0
  const points = clock.map((slot, index) => {
    const plan = planByIndex[index]!
    const departing = index === plan.departureIndex
    const available = !departing && isAvailable(slot, plan)
    const socStartKwh = socKwh
    const tripKwh = departing ? plan.tripKwh : 0
    if (tripKwh > socKwh + toleranceKwh) {
      throw new Error(`Annual EV departure cannot be served at index ${index}`)
    }
    socKwh -= tripKwh
    pendingChargeKwh += tripKwh

    let chargeKwh = 0
    if (available && pendingChargeKwh > 0) {
      const preferred = isPreferredChargingSlot(slot.minuteOfDay)
      const preferredCapacity = preferred ? 0 : preferredCapacityBeforeNextDeparture(
        clock,
        planByIndex,
        departureIndexes,
        index,
      )
      if (preferred || pendingChargeKwh > preferredCapacity + toleranceKwh) {
        chargeKwh = Math.min(
          maxChargePerSlotKwh,
          pendingChargeKwh,
          LOS_ANGELES_2026.ev.capacityKwh - socKwh,
        )
      }
    }

    socKwh += chargeKwh
    pendingChargeKwh -= chargeKwh
    return {
      chargeKw: chargeKwh / intervalHours,
      chargeKwh,
      available,
      socStartKwh,
      socEndKwh: socKwh,
      tripKwh,
    }
  })

  if (Math.abs(pendingChargeKwh) > toleranceKwh) {
    throw new Error('Annual EV charging schedule cannot restore annual travel energy')
  }

  reconcileFinalCharge(points)
  rebuildSocLedger(points)
  validatePoints(clock, points, planByIndex)
  return points
}
