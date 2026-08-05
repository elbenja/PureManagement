import type { ClockSlot } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { mulberry32, seedFromString } from './random'
import { buildAugustClock } from './time'

export interface EvPoint {
  chargeKw: number
  chargeKwh: number
  available: boolean
  socStartKwh: number
  socEndKwh: number
  tripKwh: number
}

interface DailyTrip {
  departureMinute: number
  returnMinute: number
  tripKwh: number
}

const MINUTES_PER_DAY = 24 * 60
const WEEKDAY_DEPARTURE_MINUTE = 7 * 60 + 30
const WEEKDAY_RETURN_MINUTE = 18 * 60
const PREFERRED_CHARGING_MINUTE = 20 * 60
const EV_EFFICIENCY_KWH_PER_MILE = 0.32
const WEEKEND_MIN_MILES = 9
const WEEKEND_MILES_SPREAD = 16
const intervalHours = LOS_ANGELES_AUGUST_2026.intervalMinutes / 60
const slotsPerDay = MINUTES_PER_DAY / LOS_ANGELES_AUGUST_2026.intervalMinutes
// EV energy is modeled to the nearest nanokilowatt-hour; the final ledger entry carries its exact residual.
const EV_ENERGY_PRECISION_KWH = 1e-9

const isWeekday = (dayOfWeek: number) => dayOfWeek >= 1 && dayOfWeek <= 5

const roundEnergy = (kwh: number) => Number(kwh.toFixed(9))

const buildDailyTrips = (clock: ClockSlot[], seedId: string): DailyTrip[] => {
  const random = mulberry32(seedFromString(`${seedId}:ev`))
  const rawTrips = Array.from({ length: 31 }, (_, dayIndex) => {
    const dayStart = dayIndex * slotsPerDay
    const dayOfWeek = clock[dayStart]!.dayOfWeek

    if (isWeekday(dayOfWeek)) {
      const miles =
        LOS_ANGELES_AUGUST_2026.ev.weekdayMiles.min +
        random() * (LOS_ANGELES_AUGUST_2026.ev.weekdayMiles.max - LOS_ANGELES_AUGUST_2026.ev.weekdayMiles.min)
      return {
        departureMinute: WEEKDAY_DEPARTURE_MINUTE,
        returnMinute: WEEKDAY_RETURN_MINUTE,
        tripKwh: miles * EV_EFFICIENCY_KWH_PER_MILE,
      }
    }

    const miles = WEEKEND_MIN_MILES + random() * WEEKEND_MILES_SPREAD
    const departureMinute = (9 * 60 + 30) + Math.floor(random() * 4) * 30
    const returnMinute = departureMinute + (3 * 60 + 30) + Math.floor(random() * 5) * 30
    return { departureMinute, returnMinute, tripKwh: miles * EV_EFFICIENCY_KWH_PER_MILE }
  })
  const rawTotalKwh = rawTrips.reduce((total, trip) => total + trip.tripKwh, 0)

  if (!Number.isFinite(rawTotalKwh) || rawTotalKwh <= 0) {
    throw new Error('EV raw trip energy must be finite and positive')
  }

  const targetKwh = LOS_ANGELES_AUGUST_2026.ev.targetAugustKwh
  const scale = targetKwh / rawTotalKwh
  let accumulatedTripKwh = 0
  return rawTrips.map((trip, dayIndex) => {
    const tripKwh =
      dayIndex === rawTrips.length - 1 ? targetKwh - accumulatedTripKwh : roundEnergy(trip.tripKwh * scale)
    if (!Number.isFinite(tripKwh) || tripKwh <= 0 || tripKwh > LOS_ANGELES_AUGUST_2026.ev.capacityKwh) {
      throw new Error(`EV trip is infeasible on day ${dayIndex + 1}`)
    }
    accumulatedTripKwh += tripKwh
    return { ...trip, tripKwh }
  })
}

const isAvailable = (slot: ClockSlot, trip: DailyTrip) =>
  slot.minuteOfDay < trip.departureMinute || slot.minuteOfDay >= trip.returnMinute

const isPreferredChargingSlot = (minuteOfDay: number) =>
  minuteOfDay >= PREFERRED_CHARGING_MINUTE || minuteOfDay < WEEKDAY_DEPARTURE_MINUTE

const nextDepartureIndex = (clock: ClockSlot[], trips: DailyTrip[], fromIndex: number) => {
  for (let index = fromIndex; index < clock.length; index += 1) {
    const slot = clock[index]!
    if (slot.minuteOfDay === trips[slot.day - 1]!.departureMinute) return index
  }
  return clock.length
}

const preferredChargeCapacityBeforeDeparture = (clock: ClockSlot[], trips: DailyTrip[], fromIndex: number) => {
  const departureIndex = nextDepartureIndex(clock, trips, fromIndex + 1)
  let capacityKwh = 0

  for (let index = fromIndex; index < departureIndex; index += 1) {
    const slot = clock[index]!
    if (isAvailable(slot, trips[slot.day - 1]!) && isPreferredChargingSlot(slot.minuteOfDay)) {
      capacityKwh += LOS_ANGELES_AUGUST_2026.ev.chargerKw * intervalHours
    }
  }

  return capacityKwh
}

const validateClock = (clock: ClockSlot[]) => {
  if (clock.length !== LOS_ANGELES_AUGUST_2026.records) {
    throw new Error(`EV clock must contain ${LOS_ANGELES_AUGUST_2026.records} records`)
  }

  const canonical = buildAugustClock()
  for (let index = 0; index < LOS_ANGELES_AUGUST_2026.records; index += 1) {
    const slot = clock[index]
    const expected = canonical[index]!
    if (
      !slot ||
      slot.index !== expected.index ||
      slot.iso !== expected.iso ||
      slot.day !== expected.day ||
      slot.dayOfWeek !== expected.dayOfWeek ||
      slot.minuteOfDay !== expected.minuteOfDay ||
      slot.tou !== expected.tou
    ) {
      throw new Error(`Invalid EV clock slot at index ${index}`)
    }
  }
}

const sumEnergy = (points: EvPoint[], key: 'chargeKwh' | 'tripKwh', endExclusive = points.length) => {
  let total = 0
  for (let index = 0; index < endExclusive; index += 1) total += points[index]![key]
  return total
}

const reconcileChargeLedger = (points: EvPoint[]) => {
  let lastChargeIndex = -1
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index]!.chargeKwh > 0) {
      lastChargeIndex = index
      break
    }
  }
  if (lastChargeIndex < 0) throw new Error('EV charging schedule has no physical charge interval')

  const reconciledChargeKwh = LOS_ANGELES_AUGUST_2026.ev.targetAugustKwh - sumEnergy(points, 'chargeKwh', lastChargeIndex)
  const lastCharge = points[lastChargeIndex]!
  if (
    !Number.isFinite(reconciledChargeKwh) ||
    reconciledChargeKwh < 0 ||
    reconciledChargeKwh > LOS_ANGELES_AUGUST_2026.ev.chargerKw * intervalHours
  ) {
    throw new Error('EV final charge ledger correction is infeasible')
  }

  lastCharge.chargeKwh = reconciledChargeKwh
  lastCharge.chargeKw = reconciledChargeKwh / intervalHours
}

const reconcileSocLedger = (points: EvPoint[]) => {
  const initialSocKwh = LOS_ANGELES_AUGUST_2026.ev.capacityKwh * (LOS_ANGELES_AUGUST_2026.ev.initialSocPercent / 100)
  let chargedKwh = 0
  let traveledKwh = 0

  points.forEach((point, index) => {
    point.socStartKwh = initialSocKwh + chargedKwh - traveledKwh
    if (point.tripKwh > point.socStartKwh + EV_ENERGY_PRECISION_KWH) {
      throw new Error(`EV departure cannot be served on day ${Math.floor(index / slotsPerDay) + 1}`)
    }
    traveledKwh += point.tripKwh
    chargedKwh += point.chargeKwh
    point.socEndKwh = initialSocKwh + chargedKwh - traveledKwh
  })
}

const validatePoints = (points: EvPoint[]) => {
  const capacityKwh = LOS_ANGELES_AUGUST_2026.ev.capacityKwh
  const chargerKw = LOS_ANGELES_AUGUST_2026.ev.chargerKw

  points.forEach((point, index) => {
    if (
      !Number.isFinite(point.chargeKw) ||
      !Number.isFinite(point.chargeKwh) ||
      !Number.isFinite(point.socStartKwh) ||
      !Number.isFinite(point.socEndKwh) ||
      !Number.isFinite(point.tripKwh) ||
      point.chargeKw < 0 ||
      point.chargeKw > chargerKw ||
      point.chargeKwh < 0 ||
      point.tripKwh < 0 ||
      point.socStartKwh < 0 ||
      point.socStartKwh > capacityKwh ||
      point.socEndKwh < 0 ||
      point.socEndKwh > capacityKwh ||
      (!point.available && point.chargeKwh !== 0) ||
      (point.tripKwh > 0 && point.chargeKwh > 0) ||
      Math.abs(point.chargeKwh - point.chargeKw * intervalHours) > 1e-10
    ) {
      throw new Error(`Invalid EV output at index ${index}`)
    }
  })
}

export const generateEv = (clock: ClockSlot[], seedId: string): EvPoint[] => {
  validateClock(clock)

  const dailyTrips = buildDailyTrips(clock, seedId)
  const capacityKwh = LOS_ANGELES_AUGUST_2026.ev.capacityKwh
  const maxChargePerSlotKwh = LOS_ANGELES_AUGUST_2026.ev.chargerKw * intervalHours
  let socKwh = capacityKwh * (LOS_ANGELES_AUGUST_2026.ev.initialSocPercent / 100)
  let pendingChargeKwh = 0

  const points = clock.map((slot, index) => {
    const trip = dailyTrips[slot.day - 1]!
    const departing = slot.minuteOfDay === trip.departureMinute
    const available = !departing && isAvailable(slot, trip)
    const socStartKwh = socKwh
    const tripKwh = departing ? trip.tripKwh : 0

    if (tripKwh > socKwh + 1e-10) {
      throw new Error(`EV departure cannot be served on day ${slot.day}`)
    }
    socKwh -= tripKwh
    pendingChargeKwh += tripKwh

    const mustStartBeforePreferredWindow =
      available &&
      pendingChargeKwh > 0 &&
      pendingChargeKwh > preferredChargeCapacityBeforeDeparture(clock, dailyTrips, index)
    const shouldCharge = available && pendingChargeKwh > 0 && (isPreferredChargingSlot(slot.minuteOfDay) || mustStartBeforePreferredWindow)
    const chargeKwh = shouldCharge ? Math.min(maxChargePerSlotKwh, pendingChargeKwh, capacityKwh - socKwh) : 0
    const chargeKw = chargeKwh / intervalHours

    socKwh += chargeKwh
    pendingChargeKwh -= chargeKwh
    return { chargeKw, chargeKwh, available, socStartKwh, socEndKwh: socKwh, tripKwh }
  })

  if (Math.abs(pendingChargeKwh) > 1e-9) {
    throw new Error('EV charging schedule cannot restore monthly trip energy')
  }

  reconcileChargeLedger(points)
  reconcileSocLedger(points)
  if (
    sumEnergy(points, 'tripKwh') !== LOS_ANGELES_AUGUST_2026.ev.targetAugustKwh ||
    sumEnergy(points, 'chargeKwh') !== LOS_ANGELES_AUGUST_2026.ev.targetAugustKwh ||
    points.at(-1)!.socEndKwh !== points[0]!.socStartKwh
  ) {
    throw new Error('EV ledger does not reconcile exactly')
  }

  validatePoints(points)
  return points
}
