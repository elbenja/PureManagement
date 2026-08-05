import type { DayType, EnergyInterval, LoadCategory, Transfer } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { accountInterval } from './accounting'
import { aggregateIntervals } from './aggregate'
import { buildAugustClock } from './time'

const scenario = LOS_ANGELES_AUGUST_2026
const tolerance = 1e-8
const intervalHours = scenario.intervalMinutes / 60
const slotsPerDay = (24 * 60) / scenario.intervalMinutes
const maximumErrors = 100
const daylightStart = 6 * 60 + 5
const daylightEnd = 19 * 60 + 45
const reserveKwh = scenario.battery.capacityKwh * scenario.battery.reservePercent / 100
const initialBatteryKwh = scenario.battery.capacityKwh * scenario.battery.initialPercent / 100
const initialVehicleKwh = scenario.ev.capacityKwh * scenario.ev.initialSocPercent / 100

const categories: LoadCategory[] = [
  'hvac',
  'waterHeating',
  'cooking',
  'laundry',
  'refrigeration',
  'lighting',
  'electronicsOther',
]
const dayTypes: DayType[] = ['weekday', 'weekend', 'heatwave', 'cloudy']
const approvedTransfers = new Set([
  'solar-home',
  'solar-ev',
  'solar-battery',
  'solar-grid',
  'battery-home',
  'battery-ev',
  'grid-home',
  'grid-ev',
])

const numericFields = [
  'index',
  'day',
  'dayOfWeek',
  'minuteOfDay',
  'temperatureF',
  'cloudFactor',
  'solarKw',
  'solarKwh',
  'homeKw',
  'homeKwh',
  'evKw',
  'evKwh',
  'vehicleSocStartKwh',
  'vehicleSocEndKwh',
  'tripKwh',
  'batteryChargeKw',
  'batteryChargeKwh',
  'batteryDischargeKw',
  'batteryDischargeKwh',
  'batterySocStartKwh',
  'batterySocEndKwh',
  'chargeLossKwh',
  'dischargeLossKwh',
  'gridImportKw',
  'gridImportKwh',
  'gridExportKw',
  'gridExportKwh',
  'importRate',
  'exportRate',
  'importCost',
  'exportCredit',
  'counterfactualCost',
  'savings',
  'avoidedCo2Kg',
] as const

const closeEnough = (left: number, right: number) =>
  Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const transferEnergy = (
  transfers: readonly Transfer[],
  predicate: (transfer: Transfer) => boolean,
) => transfers.reduce((total, transfer) => total + (predicate(transfer) ? transfer.kwh : 0), 0)

interface DailyEvTravel {
  tripKwh: number
  eventCount: number
  dayOfWeek: number
}

export const balanceError = (record: EnergyInterval): number => {
  const supply = record.solarKwh + record.batteryDischargeKwh + record.gridImportKwh
  const demand =
    record.homeKwh +
    record.evKwh +
    record.batteryChargeKwh +
    record.gridExportKwh +
    record.chargeLossKwh +
    record.dischargeLossKwh

  return Math.abs(supply - demand)
}

const validateClock = (
  record: Record<string, unknown>,
  index: number,
  expected: ReturnType<typeof buildAugustClock>[number],
  seenIso: Set<string>,
  error: (message: string) => void,
) => {
  const clockFields = ['iso', 'day', 'dayOfWeek', 'minuteOfDay', 'tou'] as const
  if (record.index !== expected.index) error(`index ${index}: clock index must be ${expected.index}`)
  clockFields.forEach((field) => {
    if (record[field] !== expected[field]) {
      error(`index ${index}: clock ${field} must match the canonical clock`)
    }
  })

  if (typeof record.iso === 'string') {
    if (seenIso.has(record.iso)) error(`index ${index}: duplicate timestamp/iso ${record.iso}`)
    seenIso.add(record.iso)
  }
}

const validatePowerRelation = (
  record: Record<string, unknown>,
  index: number,
  name: string,
  kwField: string,
  kwhField: string,
  error: (message: string) => void,
) => {
  const kw = record[kwField]
  const kwh = record[kwhField]
  if (typeof kw === 'number' && typeof kwh === 'number' && !closeEnough(kwh, kw * intervalHours)) {
    error(`index ${index}: ${name} kW/kWh interval relation is invalid`)
  }
}

const validateTransfers = (
  value: unknown,
  record: EnergyInterval,
  index: number,
  error: (message: string) => void,
) => {
  if (!Array.isArray(value)) {
    error(`index ${index}: transfers must be an array`)
    return
  }

  let structurallyValid = true
  for (let transferIndex = 0; transferIndex < value.length; transferIndex += 1) {
    const candidate: unknown = value[transferIndex]
    if (!isRecord(candidate)) {
      error(`index ${index}: transfer ${transferIndex} is missing or invalid`)
      structurallyValid = false
      continue
    }
    const kw = candidate.kw
    const kwh = candidate.kwh
    const pair = `${String(candidate.source)}-${String(candidate.destination)}`
    if (!approvedTransfers.has(pair)) {
      error(`index ${index}: transfer ${transferIndex} has an unapproved source/destination`)
      structurallyValid = false
    }
    if (typeof kw !== 'number' || !Number.isFinite(kw) || kw <= 0) {
      error(`index ${index}: transfer ${transferIndex} kw must be finite and positive`)
      structurallyValid = false
    }
    if (typeof kwh !== 'number' || !Number.isFinite(kwh) || kwh <= 0) {
      error(`index ${index}: transfer ${transferIndex} kwh must be finite and positive`)
      structurallyValid = false
    }
    if (typeof kw === 'number' && typeof kwh === 'number' && !closeEnough(kwh, kw * intervalHours)) {
      error(`index ${index}: transfer ${transferIndex} kW/kWh relation is invalid`)
      structurallyValid = false
    }
  }

  if (!structurallyValid) return
  const transfers = value as Transfer[]
  const solar = transferEnergy(transfers, (transfer) => transfer.source === 'solar')
  const home = transferEnergy(transfers, (transfer) => transfer.destination === 'home')
  const ev = transferEnergy(transfers, (transfer) => transfer.destination === 'ev')
  const gridImport = transferEnergy(transfers, (transfer) => transfer.source === 'grid')
  const gridExport = transferEnergy(
    transfers,
    (transfer) => transfer.source === 'solar' && transfer.destination === 'grid',
  )
  const batteryInput = transferEnergy(
    transfers,
    (transfer) => transfer.source === 'solar' && transfer.destination === 'battery',
  )
  const batteryOutput = transferEnergy(transfers, (transfer) => transfer.source === 'battery')

  const reconciliations: Array<[string, number, number]> = [
    ['solar source', solar, record.solarKwh],
    ['home destination', home, record.homeKwh],
    ['EV destination', ev, record.evKwh],
    ['grid import', gridImport, record.gridImportKwh],
    ['grid export', gridExport, record.gridExportKwh],
    ['battery charge and loss', batteryInput, record.batteryChargeKwh + record.chargeLossKwh],
    ['battery discharge and loss', batteryOutput, record.batteryDischargeKwh - record.dischargeLossKwh],
  ]
  reconciliations.forEach(([name, actual, expected]) => {
    if (!closeEnough(actual, expected)) error(`index ${index}: transfers do not reconcile ${name}`)
  })

  if (batteryInput / intervalHours > scenario.battery.maxPowerKw + tolerance) {
    error(`index ${index}: battery charge transfer exceeds the power limit`)
  }
  if (batteryOutput / intervalHours > scenario.battery.maxPowerKw + tolerance) {
    error(`index ${index}: battery discharge transfer exceeds the power limit`)
  }
}

const validateAccounting = (
  record: EnergyInterval,
  index: number,
  error: (message: string) => void,
) => {
  try {
    const expected = accountInterval({
      tou: record.tou,
      homeKwh: record.homeKwh,
      evKwh: record.evKwh,
      gridImportKwh: record.gridImportKwh,
      gridExportKwh: record.gridExportKwh,
    })
    ;(Object.keys(expected) as Array<keyof typeof expected>).forEach((field) => {
      if (!closeEnough(record[field], expected[field])) {
        error(`index ${index}: accounting ${field} does not match interval inputs`)
      }
    })
  } catch {
    error(`index ${index}: accounting inputs are invalid`)
  }
}

const validateEvTravel = (
  dailyTravel: readonly DailyEvTravel[],
  monthlyTripKwh: number,
  totalsValid: boolean,
  records: readonly EnergyInterval[],
  error: (message: string) => void,
) => {
  dailyTravel.forEach((travel, dayIndex) => {
    const day = dayIndex + 1
    if (travel.eventCount !== 1) {
      error(`day ${day}: expected exactly one positive EV trip event; found ${travel.eventCount}`)
    }

    const miles = travel.tripKwh / scenario.ev.efficiencyKwhPerMile
    const range = travel.dayOfWeek >= 1 && travel.dayOfWeek <= 5
      ? scenario.ev.weekdayMiles
      : scenario.ev.weekendMiles
    if (!Number.isFinite(miles) || miles < range.min - tolerance || miles > range.max + tolerance) {
      error(`day ${day}: daily EV trip mileage is outside configured bounds`)
    }
  })

  if (!totalsValid || !closeEnough(monthlyTripKwh, scenario.ev.targetAugustKwh)) {
    error('monthly EV trip energy does not reconcile to the scenario target')
  }

  const finalRecord: unknown = records[scenario.records - 1]
  if (
    !isRecord(finalRecord) ||
    typeof finalRecord.vehicleSocEndKwh !== 'number' ||
    !closeEnough(finalRecord.vehicleSocEndKwh, initialVehicleKwh)
  ) {
    error('final vehicle state does not return to the scenario initial state')
  }
}

const runValidation = (records: readonly EnergyInterval[]): string[] => {
  const errors: string[] = []
  const error = (message: string) => {
    if (errors.length < maximumErrors) errors.push(message)
  }
  const canonicalClock = buildAugustClock()
  const seenIso = new Set<string>()
  const seenDayTypes = new Set<DayType>()
  const monthly = { solarKwh: 0, homeKwh: 0, evKwh: 0 }
  let monthlyTotalsValid = true
  let monthlyTripKwh = 0
  let tripTotalsValid = true
  const dailyTravel: DailyEvTravel[] = Array.from({ length: 31 }, (_, dayIndex) => ({
    tripKwh: 0,
    eventCount: 0,
    dayOfWeek: canonicalClock[dayIndex * slotsPerDay]!.dayOfWeek,
  }))

  if (!Array.isArray(records)) return ['records must be an array']
  if (records.length !== scenario.records) {
    error(`record count must be ${scenario.records}; received ${records.length}`)
  }

  const checkedLength = Math.max(records.length, Math.min(scenario.records, records.length + 1))
  for (let index = 0; index < checkedLength; index += 1) {
    const candidate: unknown = records[index]
    if (!isRecord(candidate)) {
      error(`index ${index}: missing or invalid record`)
      monthlyTotalsValid = false
      tripTotalsValid = false
      continue
    }
    const record = candidate as unknown as EnergyInterval
    const expectedClock = canonicalClock[index]
    if (expectedClock) validateClock(candidate, index, expectedClock, seenIso, error)
    else error(`index ${index}: record is outside the canonical clock`)

    numericFields.forEach((field) => {
      const value = candidate[field]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        error(`index ${index}: ${field} must be a finite number`)
      } else if (field !== 'savings' && value < 0) {
        error(`index ${index}: ${field} must be nonnegative`)
      }
    })
    if (typeof candidate.evAvailable !== 'boolean') {
      error(`index ${index}: evAvailable must be boolean`)
    }
    if (dayTypes.includes(candidate.dayType as DayType)) seenDayTypes.add(candidate.dayType as DayType)
    else error(`index ${index}: invalid dayType`)
    if (typeof candidate.cloudFactor === 'number' && (candidate.cloudFactor < 0 || candidate.cloudFactor > 1)) {
      error(`index ${index}: cloudFactor must be within 0..1`)
    }

    const breakdown = candidate.homeBreakdownKwh
    if (!isRecord(breakdown)) {
      error(`index ${index}: homeBreakdownKwh is missing or invalid`)
    } else {
      let breakdownTotal = 0
      let breakdownValid = true
      categories.forEach((category) => {
        const value = breakdown[category]
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          error(`index ${index}: home breakdown ${category} must be finite and nonnegative`)
          breakdownValid = false
        } else breakdownTotal += value
      })
      if (breakdownValid && !closeEnough(breakdownTotal, record.homeKwh)) {
        error(`index ${index}: home breakdown does not sum to homeKwh`)
      }
    }

    ;[
      ['solar', 'solarKw', 'solarKwh'],
      ['home', 'homeKw', 'homeKwh'],
      ['EV', 'evKw', 'evKwh'],
      ['battery charge', 'batteryChargeKw', 'batteryChargeKwh'],
      ['battery discharge', 'batteryDischargeKw', 'batteryDischargeKwh'],
      ['grid import', 'gridImportKw', 'gridImportKwh'],
      ['grid export', 'gridExportKw', 'gridExportKwh'],
    ].forEach(([name, kw, kwh]) => validatePowerRelation(candidate, index, name!, kw!, kwh!, error))

    if (Number.isFinite(record.solarKw) && record.solarKw > scenario.solar.capacityKw + tolerance) {
      error(`index ${index}: solar exceeds configured capacity`)
    }
    if (
      Number.isFinite(record.minuteOfDay) &&
      (record.minuteOfDay < daylightStart || record.minuteOfDay >= daylightEnd) &&
      (record.solarKw !== 0 || record.solarKwh !== 0)
    ) {
      error(`index ${index}: solar must be zero at night`)
    }

    if (
      Number.isFinite(record.batterySocStartKwh) &&
      (record.batterySocStartKwh < reserveKwh - tolerance ||
        record.batterySocStartKwh > scenario.battery.capacityKwh + tolerance)
    ) {
      error(`index ${index}: battery start is outside reserve/capacity bounds`)
    }
    if (
      Number.isFinite(record.batterySocEndKwh) &&
      (record.batterySocEndKwh < reserveKwh - tolerance ||
        record.batterySocEndKwh > scenario.battery.capacityKwh + tolerance)
    ) {
      error(`index ${index}: battery end is outside reserve/capacity bounds`)
    }
    if (index === 0 && Number.isFinite(record.batterySocStartKwh) && !closeEnough(record.batterySocStartKwh, initialBatteryKwh)) {
      error('index 0: battery initial state does not match the scenario')
    }
    const previous = index > 0 ? records[index - 1] : undefined
    if (
      index > 0 &&
      isRecord(previous) &&
      Number.isFinite(record.batterySocStartKwh) &&
      Number.isFinite(previous.batterySocEndKwh) &&
      !closeEnough(record.batterySocStartKwh, previous.batterySocEndKwh as number)
    ) {
      error(`index ${index}: battery state continuity is broken`)
    }
    if (
      !closeEnough(
        record.batterySocEndKwh,
        record.batterySocStartKwh + record.batteryChargeKwh - record.batteryDischargeKwh,
      )
    ) {
      error(`index ${index}: battery state equation is invalid`)
    }
    if (record.batteryChargeKwh > tolerance && record.batteryDischargeKwh > tolerance) {
      error(`index ${index}: simultaneous battery charge and discharge`)
    }
    if (record.gridImportKwh > tolerance && record.gridExportKwh > tolerance) {
      error(`index ${index}: simultaneous grid import and export`)
    }

    if (
      Number.isFinite(record.vehicleSocStartKwh) &&
      (record.vehicleSocStartKwh < -tolerance || record.vehicleSocStartKwh > scenario.ev.capacityKwh + tolerance)
    ) {
      error(`index ${index}: vehicle start state is outside capacity bounds`)
    }
    if (
      Number.isFinite(record.vehicleSocEndKwh) &&
      (record.vehicleSocEndKwh < -tolerance || record.vehicleSocEndKwh > scenario.ev.capacityKwh + tolerance)
    ) {
      error(`index ${index}: vehicle end state is outside capacity bounds`)
    }
    if (index === 0 && Number.isFinite(record.vehicleSocStartKwh) && !closeEnough(record.vehicleSocStartKwh, initialVehicleKwh)) {
      error('index 0: vehicle initial state does not match the scenario')
    }
    if (
      index > 0 &&
      isRecord(previous) &&
      Number.isFinite(record.vehicleSocStartKwh) &&
      Number.isFinite(previous.vehicleSocEndKwh) &&
      !closeEnough(record.vehicleSocStartKwh, previous.vehicleSocEndKwh as number)
    ) {
      error(`index ${index}: vehicle state continuity is broken`)
    }
    if (!closeEnough(record.vehicleSocEndKwh, record.vehicleSocStartKwh + record.evKwh - record.tripKwh)) {
      error(`index ${index}: vehicle state equation is invalid`)
    }
    if (record.tripKwh > record.vehicleSocStartKwh + tolerance) {
      error(`index ${index}: EV trip is not feasible from the starting state`)
    }
    if (record.evKw > scenario.ev.chargerKw + tolerance) {
      error(`index ${index}: EV charge exceeds charger capacity`)
    }
    if (!record.evAvailable && record.evKwh !== 0) {
      error(`index ${index}: EV cannot charge while unavailable`)
    }
    if (record.tripKwh > tolerance && record.evAvailable !== false) {
      error(`index ${index}: EV trip requires the vehicle to be unavailable`)
    }
    if (record.tripKwh > tolerance && record.evKwh > tolerance) {
      error(`index ${index}: EV trip and charging occur together`)
    }
    if (record.tripKwh > tolerance && Number.isFinite(record.tripKwh)) {
      const miles = record.tripKwh / scenario.ev.efficiencyKwhPerMile
      const range = record.dayOfWeek >= 1 && record.dayOfWeek <= 5
        ? scenario.ev.weekdayMiles
        : scenario.ev.weekendMiles
      if (miles < range.min - tolerance || miles > range.max + tolerance) {
        error(`index ${index}: EV trip mileage is outside feasible daily bounds`)
      }
    }

    if (expectedClock && Number.isFinite(record.tripKwh) && record.tripKwh >= 0) {
      const travel = dailyTravel[expectedClock.day - 1]!
      travel.tripKwh += record.tripKwh
      monthlyTripKwh += record.tripKwh
      if (record.tripKwh > 0) travel.eventCount += 1
      if (!Number.isFinite(travel.tripKwh) || !Number.isFinite(monthlyTripKwh)) {
        tripTotalsValid = false
      }
    } else tripTotalsValid = false

    if (Number.isFinite(balanceError(record)) && balanceError(record) > tolerance) {
      error(`index ${index}: energy balance error exceeds tolerance`)
    }
    validateTransfers(candidate.transfers, record, index, error)
    validateAccounting(record, index, error)

    if ([record.solarKwh, record.homeKwh, record.evKwh].every(Number.isFinite)) {
      monthly.solarKwh += record.solarKwh
      monthly.homeKwh += record.homeKwh
      monthly.evKwh += record.evKwh
      if (!Object.values(monthly).every(Number.isFinite)) monthlyTotalsValid = false
    } else monthlyTotalsValid = false
  }

  dayTypes.forEach((dayType) => {
    if (!seenDayTypes.has(dayType)) error(`month is missing required day type ${dayType}`)
  })
  validateEvTravel(dailyTravel, monthlyTripKwh, tripTotalsValid, records, error)
  if (monthlyTotalsValid) {
    const solarTarget = scenario.solar.targetAugustKwh
    if (Math.abs(monthly.solarKwh - solarTarget) > solarTarget * 0.02) {
      error('monthly solar total is outside the ±2% target envelope')
    }
    if (monthly.homeKwh < 1_700 || monthly.homeKwh > 1_950) {
      error('monthly home total is outside the 1700–1950 kWh envelope')
    }
    if (monthly.evKwh < 300 || monthly.evKwh > 420) {
      error('monthly EV total is outside the 300–420 kWh envelope')
    }
  } else error('monthly energy totals must be finite')

  try {
    const aggregate = aggregateIntervals(records)
    if (
      !Object.values(aggregate).every(Number.isFinite) ||
      !closeEnough(aggregate.solarKwh, monthly.solarKwh) ||
      !closeEnough(aggregate.homeKwh, monthly.homeKwh) ||
      !closeEnough(aggregate.evKwh, monthly.evKwh) ||
      !closeEnough(aggregate.energyConsumedKwh, monthly.homeKwh + monthly.evKwh)
    ) {
      error('aggregate totals are not finite or do not match interval sums')
    }
  } catch {
    error('aggregate totals could not be computed from malformed records')
  }

  return errors
}

export const validateMonth = (records: readonly EnergyInterval[]): string[] => {
  try {
    return runValidation(records)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return [`validation could not inspect malformed records: ${message}`]
  }
}
