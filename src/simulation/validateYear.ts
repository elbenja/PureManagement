import type {
  ClockSlot,
  DayType,
  EnergyInterval,
  LoadCategory,
  Transfer,
  WeatherState,
} from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { accountInterval } from './accounting'
import { aggregateIntervals, type EnergyTotals } from './aggregate'
import { buildYearClock } from './yearClock'

const scenario = LOS_ANGELES_2026
const tolerance = 1e-8
const intervalHours = scenario.intervalMinutes / 60
const maximumErrors = 100
const reserveKwh = scenario.battery.capacityKwh * scenario.battery.reservePercent / 100
const initialBatteryKwh = scenario.battery.capacityKwh * scenario.battery.initialPercent / 100
const initialVehicleKwh = scenario.ev.capacityKwh * scenario.ev.initialSocPercent / 100

const clockFields: readonly (keyof ClockSlot)[] = [
  'index', 'iso', 'year', 'month', 'day', 'dayOfYear', 'dayOfWeek', 'minuteOfDay',
  'utcOffset', 'tou',
]

const recordFields: readonly (keyof EnergyInterval)[] = [
  ...clockFields,
  'dayType', 'temperatureF', 'cloudFactor', 'weatherState', 'precipitationInches',
  'solarKw', 'solarKwh', 'homeKw', 'homeKwh', 'homeBreakdownKwh', 'evKw', 'evKwh',
  'evAvailable', 'vehicleSocStartKwh', 'vehicleSocEndKwh', 'tripKwh',
  'batteryChargeKw', 'batteryChargeKwh', 'batteryDischargeKw', 'batteryDischargeKwh',
  'batterySocStartKwh', 'batterySocEndKwh', 'chargeLossKwh', 'dischargeLossKwh',
  'gridImportKw', 'gridImportKwh', 'gridExportKw', 'gridExportKwh', 'transfers',
  'importRate', 'exportRate', 'importCost', 'exportCredit', 'counterfactualCost',
  'savings', 'avoidedCo2Kg',
]

const numericFields: readonly (keyof EnergyInterval)[] = [
  'index', 'year', 'month', 'day', 'dayOfYear', 'dayOfWeek', 'minuteOfDay',
  'temperatureF', 'cloudFactor', 'precipitationInches', 'solarKw', 'solarKwh',
  'homeKw', 'homeKwh', 'evKw', 'evKwh', 'vehicleSocStartKwh', 'vehicleSocEndKwh',
  'tripKwh', 'batteryChargeKw', 'batteryChargeKwh', 'batteryDischargeKw',
  'batteryDischargeKwh', 'batterySocStartKwh', 'batterySocEndKwh', 'chargeLossKwh',
  'dischargeLossKwh', 'gridImportKw', 'gridImportKwh', 'gridExportKw', 'gridExportKwh',
  'importRate', 'exportRate', 'importCost', 'exportCredit', 'counterfactualCost',
  'savings', 'avoidedCo2Kg',
]

const nonNegativeNumericFields = new Set<keyof EnergyInterval>(
  numericFields.filter((field) => field !== 'temperatureF' && field !== 'savings'),
)
const categories: readonly LoadCategory[] = [
  'hvac', 'waterHeating', 'cooking', 'laundry', 'refrigeration', 'lighting',
  'electronicsOther',
]
const dayTypes: readonly DayType[] = ['weekday', 'weekend', 'heatwave', 'cloudy']
const weatherStates: readonly WeatherState[] = ['clear', 'partly-cloudy', 'overcast', 'rain']
const transferFields: readonly (keyof Transfer)[] = ['source', 'destination', 'kw', 'kwh']
const approvedTransfers = new Set([
  'solar-home', 'solar-ev', 'solar-battery', 'solar-grid',
  'battery-home', 'battery-ev', 'grid-home', 'grid-ev',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactShape = (value: object, fields: readonly (string | symbol)[]) => {
  const keys = Reflect.ownKeys(value)
  return keys.length === fields.length && fields.every((field) => keys.includes(field))
}

const closeEnough = (left: number, right: number) =>
  Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance

const daylightWindow = (slot: ClockSlot) => {
  const dayLengthHours = 12 + 2.2 * Math.sin((2 * Math.PI * (slot.dayOfYear - 80)) / 365)
  const solarNoonMinute = slot.utcOffset === '-07:00' ? 12 * 60 + 55 : 11 * 60 + 55
  return {
    start: solarNoonMinute - dayLengthHours * 30,
    end: solarNoonMinute + dayLengthHours * 30,
  }
}

const transferEnergy = (
  transfers: readonly Transfer[],
  predicate: (transfer: Transfer) => boolean,
) => transfers.reduce((total, transfer) => total + (predicate(transfer) ? transfer.kwh : 0), 0)

interface MonthlyTotals {
  solarKwh: number
  homeKwh: number
  evKwh: number
  tripKwh: number
}

interface DailySummary {
  dayOfYear: number
  month: number
  rain: boolean
  heatwave: boolean
  minimumTemperatureF: number
  tripCount: number
}

const emptyAggregate = (): EnergyTotals => ({
  solarKwh: 0,
  homeKwh: 0,
  evKwh: 0,
  energyConsumedKwh: 0,
  batteryChargeKwh: 0,
  batteryDischargeKwh: 0,
  gridImportKwh: 0,
  gridExportKwh: 0,
  importCostUsd: 0,
  exportCreditUsd: 0,
  counterfactualCostUsd: 0,
  savingsUsd: 0,
  avoidedCo2Kg: 0,
})

const addAggregate = (totals: EnergyTotals, record: EnergyInterval) => {
  totals.solarKwh += record.solarKwh
  totals.homeKwh += record.homeKwh
  totals.evKwh += record.evKwh
  totals.energyConsumedKwh += record.homeKwh + record.evKwh
  totals.batteryChargeKwh += record.batteryChargeKwh
  totals.batteryDischargeKwh += record.batteryDischargeKwh
  totals.gridImportKwh += record.gridImportKwh
  totals.gridExportKwh += record.gridExportKwh
  totals.importCostUsd += record.importCost
  totals.exportCreditUsd += record.exportCredit
  totals.counterfactualCostUsd += record.counterfactualCost
  totals.savingsUsd += record.savings
  totals.avoidedCo2Kg += record.avoidedCo2Kg
}

const hasConsecutiveDays = (
  days: readonly DailySummary[],
  minimum: number,
  predicate: (day: DailySummary) => boolean,
) => {
  let run = 0
  for (const day of days) {
    run = predicate(day) ? run + 1 : 0
    if (run >= minimum) return true
  }
  return false
}

const runValidation = (records: readonly EnergyInterval[]): string[] => {
  const errors: string[] = []
  const error = (message: string) => {
    if (errors.length < maximumErrors) errors.push(message)
  }
  if (!Array.isArray(records)) return ['records must be an array']

  const clock = buildYearClock()
  const seenIso = new Set<string>()
  const monthly: MonthlyTotals[] = Array.from({ length: 12 }, () => ({
    solarKwh: 0,
    homeKwh: 0,
    evKwh: 0,
    tripKwh: 0,
  }))
  const annual = emptyAggregate()
  const categoryTotals = Object.fromEntries(categories.map((category) => [category, 0])) as Record<LoadCategory, number>
  const days: DailySummary[] = Array.from({ length: 365 }, (_, index) => ({
    dayOfYear: index + 1,
    month: new Date(Date.UTC(scenario.year, 0, index + 1)).getUTCMonth() + 1,
    rain: false,
    heatwave: false,
    minimumTemperatureF: Number.POSITIVE_INFINITY,
    tripCount: 0,
  }))
  let totalsValid = true

  if (records.length !== scenario.records) {
    error(`record count must be ${scenario.records}; received ${records.length}`)
  }

  const checkedLength = Math.max(records.length, clock.length)
  for (let index = 0; index < checkedLength && errors.length < maximumErrors; index += 1) {
    const candidate: unknown = records[index]
    if (!isRecord(candidate)) {
      error(`index ${index}: missing or invalid record`)
      totalsValid = false
      continue
    }
    if (!hasExactShape(candidate, recordFields)) error(`index ${index}: invalid record shape`)

    const expected = clock[index]
    if (expected === undefined) {
      error(`index ${index}: record is outside the canonical clock`)
    } else {
      clockFields.forEach((field) => {
        if (candidate[field] !== expected[field]) {
          error(`index ${index}: clock ${field} must match the canonical clock`)
        }
      })
    }
    if (typeof candidate.iso === 'string') {
      if (seenIso.has(candidate.iso)) error(`index ${index}: duplicate timestamp/iso ${candidate.iso}`)
      seenIso.add(candidate.iso)
    }

    const record = candidate as unknown as EnergyInterval
    let recordTotalsValid = true
    numericFields.forEach((field) => {
      const value = candidate[field]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        error(`index ${index}: ${field} must be a finite number`)
        recordTotalsValid = false
      } else if (nonNegativeNumericFields.has(field) && value < 0) {
        error(`index ${index}: ${field} must be nonnegative`)
        recordTotalsValid = false
      }
    })
    if (typeof candidate.evAvailable !== 'boolean') error(`index ${index}: evAvailable must be boolean`)
    if (!dayTypes.includes(candidate.dayType as DayType)) error(`index ${index}: invalid dayType`)
    if (!weatherStates.includes(candidate.weatherState as WeatherState)) error(`index ${index}: invalid weatherState`)
    if (
      typeof candidate.cloudFactor === 'number' &&
      (candidate.cloudFactor < 0 || candidate.cloudFactor > 1)
    ) {
      error(`index ${index}: cloudFactor must be within 0..1`)
    }
    if (
      typeof candidate.precipitationInches !== 'number' ||
      !Number.isFinite(candidate.precipitationInches) ||
      candidate.precipitationInches < 0
    ) {
      error(`index ${index}: precipitationInches must be finite and nonnegative`)
    }

    const breakdown = candidate.homeBreakdownKwh
    if (!isRecord(breakdown)) {
      error(`index ${index}: homeBreakdownKwh is missing or invalid`)
      recordTotalsValid = false
    } else {
      if (!hasExactShape(breakdown, categories)) error(`index ${index}: invalid home breakdown shape`)
      let breakdownTotal = 0
      let breakdownValid = true
      categories.forEach((category) => {
        const value = breakdown[category]
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          error(`index ${index}: home breakdown ${category} must be finite and nonnegative`)
          breakdownValid = false
        } else {
          breakdownTotal += value
          categoryTotals[category] += value
        }
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
    ].forEach(([name, kwField, kwhField]) => {
      const kw = candidate[kwField!]
      const kwh = candidate[kwhField!]
      if (typeof kw === 'number' && typeof kwh === 'number' && !closeEnough(kwh, kw * intervalHours)) {
        error(`index ${index}: ${name} kW/kWh interval relation is invalid`)
      }
    })

    if (record.solarKw > scenario.solar.capacityKw + tolerance) {
      error(`index ${index}: solar exceeds configured capacity`)
    }
    if (expected !== undefined) {
      const daylight = daylightWindow(expected)
      if (
        (expected.minuteOfDay < daylight.start || expected.minuteOfDay >= daylight.end) &&
        (record.solarKw !== 0 || record.solarKwh !== 0)
      ) {
        error(`index ${index}: solar must be zero outside the annual daylight window`)
      }
    }

    if (
      record.batterySocStartKwh < reserveKwh - tolerance ||
      record.batterySocStartKwh > scenario.battery.capacityKwh + tolerance
    ) error(`index ${index}: battery start is outside reserve/capacity bounds`)
    if (
      record.batterySocEndKwh < reserveKwh - tolerance ||
      record.batterySocEndKwh > scenario.battery.capacityKwh + tolerance
    ) error(`index ${index}: battery end is outside reserve/capacity bounds`)
    if (index === 0 && !closeEnough(record.batterySocStartKwh, initialBatteryKwh)) {
      error('index 0: battery initial state does not match the scenario')
    }
    const previous: unknown = index > 0 ? records[index - 1] : undefined
    if (
      index > 0 && isRecord(previous) &&
      !closeEnough(record.batterySocStartKwh, previous.batterySocEndKwh as number)
    ) error(`index ${index}: battery state continuity is broken`)
    if (!closeEnough(
      record.batterySocEndKwh,
      record.batterySocStartKwh + record.batteryChargeKwh - record.batteryDischargeKwh,
    )) error(`index ${index}: battery state equation is invalid`)
    if (record.batteryChargeKwh > tolerance && record.batteryDischargeKwh > tolerance) {
      error(`index ${index}: simultaneous battery charge and discharge`)
    }
    if (record.gridImportKwh > tolerance && record.gridExportKwh > tolerance) {
      error(`index ${index}: simultaneous grid import and export`)
    }

    if (
      record.vehicleSocStartKwh < -tolerance ||
      record.vehicleSocStartKwh > scenario.ev.capacityKwh + tolerance ||
      record.vehicleSocEndKwh < -tolerance ||
      record.vehicleSocEndKwh > scenario.ev.capacityKwh + tolerance
    ) error(`index ${index}: vehicle state is outside capacity bounds`)
    if (index === 0 && !closeEnough(record.vehicleSocStartKwh, initialVehicleKwh)) {
      error('index 0: vehicle initial state does not match the scenario')
    }
    if (
      index > 0 && isRecord(previous) &&
      !closeEnough(record.vehicleSocStartKwh, previous.vehicleSocEndKwh as number)
    ) error(`index ${index}: vehicle state continuity is broken`)
    if (!closeEnough(
      record.vehicleSocEndKwh,
      record.vehicleSocStartKwh + record.evKwh - record.tripKwh,
    )) error(`index ${index}: vehicle state equation is invalid`)
    if (record.tripKwh > record.vehicleSocStartKwh + tolerance) {
      error(`index ${index}: EV departure cannot be served`)
    }
    if (record.evKw > scenario.ev.chargerKw + tolerance) {
      error(`index ${index}: EV charge exceeds charger capacity`)
    }
    if (!record.evAvailable && record.evKwh !== 0) {
      error(`index ${index}: EV cannot charge while away`)
    }
    if (record.tripKwh > 0 && record.evKwh > 0) {
      error(`index ${index}: EV trip and charging occur together`)
    }

    const supply = record.solarKwh + record.batteryDischargeKwh + record.gridImportKwh
    const demand = record.homeKwh + record.evKwh + record.batteryChargeKwh +
      record.gridExportKwh + record.chargeLossKwh + record.dischargeLossKwh
    if (!closeEnough(supply, demand)) error(`index ${index}: energy balance error exceeds tolerance`)

    const transferValue = candidate.transfers
    if (!Array.isArray(transferValue)) {
      error(`index ${index}: transfers must be an array`)
    } else {
      let validTransfers = true
      transferValue.forEach((value: unknown, transferIndex) => {
        if (!isRecord(value)) {
          error(`index ${index}: transfer ${transferIndex} is missing or invalid`)
          validTransfers = false
          return
        }
        if (!hasExactShape(value, transferFields)) {
          error(`index ${index}: transfer ${transferIndex} has invalid shape`)
          validTransfers = false
        }
        if (!approvedTransfers.has(`${String(value.source)}-${String(value.destination)}`)) {
          error(`index ${index}: transfer ${transferIndex} has an unapproved source/destination`)
          validTransfers = false
        }
        if (typeof value.kw !== 'number' || !Number.isFinite(value.kw) || value.kw <= 0) {
          error(`index ${index}: transfer ${transferIndex} kw must be finite and positive`)
          validTransfers = false
        }
        if (typeof value.kwh !== 'number' || !Number.isFinite(value.kwh) || value.kwh <= 0) {
          error(`index ${index}: transfer ${transferIndex} kwh must be finite and positive`)
          validTransfers = false
        }
        if (
          typeof value.kw === 'number' && typeof value.kwh === 'number' &&
          !closeEnough(value.kwh, value.kw * intervalHours)
        ) {
          error(`index ${index}: transfer ${transferIndex} kW/kWh relation is invalid`)
          validTransfers = false
        }
      })

      if (validTransfers) {
        const transfers = transferValue as Transfer[]
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
        ;[
          ['solar source', solar, record.solarKwh],
          ['home destination', home, record.homeKwh],
          ['EV destination', ev, record.evKwh],
          ['grid import', gridImport, record.gridImportKwh],
          ['grid export', gridExport, record.gridExportKwh],
          ['battery charge and loss', batteryInput, record.batteryChargeKwh + record.chargeLossKwh],
          ['battery discharge and loss', batteryOutput, record.batteryDischargeKwh - record.dischargeLossKwh],
        ].forEach(([name, actual, expectedValue]) => {
          if (!closeEnough(actual as number, expectedValue as number)) {
            error(`index ${index}: transfers do not reconcile ${name}`)
          }
        })
        if (batteryInput / intervalHours > scenario.battery.maxPowerKw + tolerance) {
          error(`index ${index}: battery charge transfer exceeds the power limit`)
        }
        if (batteryOutput / intervalHours > scenario.battery.maxPowerKw + tolerance) {
          error(`index ${index}: battery discharge transfer exceeds the power limit`)
        }
      }
    }

    try {
      const accounting = accountInterval({
        tou: record.tou,
        homeKwh: record.homeKwh,
        evKwh: record.evKwh,
        gridImportKwh: record.gridImportKwh,
        gridExportKwh: record.gridExportKwh,
      }, scenario)
      ;(Object.keys(accounting) as Array<keyof typeof accounting>).forEach((field) => {
        if (!closeEnough(record[field], accounting[field])) {
          error(`index ${index}: accounting ${field} does not match interval inputs`)
        }
      })
    } catch {
      error(`index ${index}: accounting inputs are invalid`)
    }

    if (expected !== undefined && recordTotalsValid) {
      const totals = monthly[expected.month - 1]!
      totals.solarKwh += record.solarKwh
      totals.homeKwh += record.homeKwh
      totals.evKwh += record.evKwh
      totals.tripKwh += record.tripKwh
      addAggregate(annual, record)
      if (!Object.values(totals).every(Number.isFinite) || !Object.values(annual).every(Number.isFinite)) {
        totalsValid = false
      }
      const day = days[expected.dayOfYear - 1]!
      day.rain ||= record.precipitationInches > 0
      day.heatwave ||= record.dayType === 'heatwave'
      day.minimumTemperatureF = Math.min(day.minimumTemperatureF, record.temperatureF)
      if (record.tripKwh > 0) day.tripCount += 1
    } else {
      totalsValid = false
    }
  }

  if (errors.length >= maximumErrors) return errors

  days.forEach((day) => {
    if (day.tripCount !== 1) {
      error(`day ${day.dayOfYear}: expected exactly one positive EV trip; found ${day.tripCount}`)
    }
  })
  const finalRecord: unknown = records[scenario.records - 1]
  if (!isRecord(finalRecord) || !closeEnough(finalRecord.vehicleSocEndKwh as number, initialVehicleKwh)) {
    error('final vehicle state does not return to the scenario initial state')
  }

  if (totalsValid) {
    scenario.months.forEach((profile, index) => {
      const totals = monthly[index]!
      if (Math.abs(totals.solarKwh - profile.solarTargetKwh) > profile.solarTargetKwh * 0.02) {
        error(`month ${profile.month} solar total is outside the ±2% target envelope`)
      }
      if (!closeEnough(totals.homeKwh, profile.homeTargetKwh)) {
        error(`month ${profile.month} home total does not match the configured target`)
      }
      if (totals.evKwh < 250 - tolerance || totals.evKwh > 450 + tolerance) {
        error(`month ${profile.month} EV charge total is outside the 250–450 kWh envelope`)
      }
    })
    if (annual.homeKwh < 13_500 - tolerance || annual.homeKwh > 17_500 + tolerance) {
      error('annual home total is outside the 13500–17500 kWh envelope')
    }
    if (annual.evKwh < 3_600 - tolerance || annual.evKwh > 4_800 + tolerance) {
      error('annual EV charge total is outside the 3600–4800 kWh envelope')
    }
    const annualTripKwh = monthly.reduce((total, month) => total + month.tripKwh, 0)
    if (!closeEnough(annualTripKwh, scenario.ev.targetAnnualKwh)) {
      error('annual EV trip total does not match the configured target')
    }
  } else {
    error('monthly and annual energy totals must be finite')
  }

  categories.forEach((category) => {
    if (!Number.isFinite(categoryTotals[category]) || categoryTotals[category] <= 0) {
      error(`annual home category ${category} must be nonzero`)
    }
  })

  const winter = (month: number) => month === 12 || month <= 2
  if (!hasConsecutiveDays(days, 2, (day) => winter(day.month) && day.rain)) {
    error('annual conditions are missing required winter multi-day rain')
  }
  if (!hasConsecutiveDays(days, 3, (day) => day.month >= 7 && day.month <= 9 && day.heatwave)) {
    error('annual conditions are missing required summer heatwave')
  }
  if (!hasConsecutiveDays(days, 2, (day) => {
    const profile = scenario.months[day.month - 1]
    return winter(day.month) && profile !== undefined &&
      day.minimumTemperatureF <= profile.lowF - 4
  })) error('annual conditions are missing required winter cold snap')

  const precipitation = (months: readonly number[]) => records.reduce((total, record) =>
    isRecord(record) && months.includes(record.month as number) &&
    typeof record.precipitationInches === 'number' && Number.isFinite(record.precipitationInches)
      ? total + record.precipitationInches as number
      : total,
  0)
  if (precipitation([11, 12, 1, 2, 3]) <= precipitation([6, 7, 8, 9])) {
    error('wet-season precipitation must exceed dry-season precipitation')
  }

  if (totalsValid) {
    try {
      const aggregate = aggregateIntervals(records)
      ;(Object.keys(annual) as Array<keyof EnergyTotals>).forEach((field) => {
        if (!closeEnough(aggregate[field], annual[field])) {
          error(`aggregate ${field} does not reconcile annual interval totals`)
        }
      })
    } catch {
      error('aggregate totals could not be computed from malformed records')
    }
  }

  return errors
}

export const validateYear = (records: readonly EnergyInterval[]): string[] => {
  try {
    return runValidation(records)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return [`validation could not inspect malformed records: ${message}`]
  }
}
