import type { EnergyInterval } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { accountInterval } from './accounting'
import { buildAnnualConditions } from './annualConditions'
import { generateAnnualEv } from './annualEv'
import { generateAnnualSolar } from './annualSolar'
import { generateHomeLoad } from './home'
import { routeInterval } from './router'
import { validateYear } from './validateYear'
import { buildYearClock } from './yearClock'

const scenario = LOS_ANGELES_2026

const freezeYear = (records: EnergyInterval[]): readonly EnergyInterval[] => {
  records.forEach((record) => {
    Object.freeze(record.homeBreakdownKwh)
    record.transfers.forEach(Object.freeze)
    Object.freeze(record.transfers)
    Object.freeze(record)
  })
  return Object.freeze(records)
}

type AnnualValidator = (records: readonly EnergyInterval[]) => string[]

/** @internal Test seam for atomic final validation. */
export const __finalizeAnnualLedger = (
  records: EnergyInterval[],
  validator: AnnualValidator = validateYear,
): readonly EnergyInterval[] => {
  const errors = validator(records)
  if (errors.length > 0) throw new Error(`Invalid annual simulation: ${errors.join('; ')}`)
  return freezeYear(records)
}

export const generateYear = (): readonly EnergyInterval[] => {
  const clock = buildYearClock()
  const conditions = buildAnnualConditions(clock, scenario.seedId)
  const solar = generateAnnualSolar(clock, conditions)
  const home = generateHomeLoad(clock, conditions, {
    canonicalClock: clock,
    seedId: scenario.seedId,
    monthlyTargetsKwh: scenario.months.map((profile) => profile.homeTargetKwh),
    includeHeating: true,
  })
  const ev = generateAnnualEv(clock, scenario.seedId)
  const records: EnergyInterval[] = []
  let batterySocKwh = scenario.battery.capacityKwh * scenario.battery.initialPercent / 100

  for (let index = 0; index < clock.length; index += 1) {
    const slot = clock[index]!
    const condition = conditions[index]!
    const solarPoint = solar[index]!
    const homePoint = home[index]!
    const evPoint = ev[index]!
    const routed = routeInterval({
      solarKwh: solarPoint.kwh,
      homeKwh: homePoint.kwh,
      evKwh: evPoint.chargeKwh,
      batterySocKwh,
      minuteOfDay: slot.minuteOfDay,
    }, scenario)
    const accounting = accountInterval({
      tou: slot.tou,
      homeKwh: homePoint.kwh,
      evKwh: evPoint.chargeKwh,
      gridImportKwh: routed.gridImportKwh,
      gridExportKwh: routed.gridExportKwh,
    }, scenario)

    records.push({
      ...slot,
      dayType: condition.dayType,
      temperatureF: condition.temperatureF,
      cloudFactor: condition.cloudFactor,
      weatherState: condition.weatherState,
      precipitationInches: condition.precipitationInches,
      solarKw: solarPoint.kw,
      solarKwh: solarPoint.kwh,
      homeKw: homePoint.kw,
      homeKwh: homePoint.kwh,
      homeBreakdownKwh: { ...homePoint.breakdownKwh },
      evKw: evPoint.chargeKw,
      evKwh: evPoint.chargeKwh,
      evAvailable: evPoint.available,
      vehicleSocStartKwh: evPoint.socStartKwh,
      vehicleSocEndKwh: evPoint.socEndKwh,
      tripKwh: evPoint.tripKwh,
      batteryChargeKw: routed.batteryChargeKw,
      batteryChargeKwh: routed.batteryChargeKwh,
      batteryDischargeKw: routed.batteryDischargeKw,
      batteryDischargeKwh: routed.batteryDischargeKwh,
      batterySocStartKwh: batterySocKwh,
      batterySocEndKwh: routed.batterySocEndKwh,
      chargeLossKwh: routed.chargeLossKwh,
      dischargeLossKwh: routed.dischargeLossKwh,
      gridImportKw: routed.gridImportKw,
      gridImportKwh: routed.gridImportKwh,
      gridExportKw: routed.gridExportKw,
      gridExportKwh: routed.gridExportKwh,
      transfers: routed.transfers.map((transfer) => ({ ...transfer })),
      ...accounting,
    })
    batterySocKwh = routed.batterySocEndKwh
  }

  return __finalizeAnnualLedger(records)
}
