import type { EnergyInterval } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { accountInterval } from './accounting'
import { buildConditions } from './conditions'
import { generateEv } from './ev'
import { generateHomeLoad } from './home'
import { routeInterval } from './router'
import { generateSolar } from './solar'
import { buildAugustClock } from './time'
import { validateMonth } from './validate'

const scenario = LOS_ANGELES_AUGUST_2026

const freezeMonth = (records: EnergyInterval[]): readonly EnergyInterval[] => {
  records.forEach((record) => {
    Object.freeze(record.homeBreakdownKwh)
    record.transfers.forEach(Object.freeze)
    Object.freeze(record.transfers)
    Object.freeze(record)
  })
  return Object.freeze(records)
}

export const generateMonth = (): readonly EnergyInterval[] => {
  const clock = buildAugustClock()
  const conditions = buildConditions(clock, scenario.seedId)
  const solar = generateSolar(clock, conditions)
  const home = generateHomeLoad(clock, conditions)
  const ev = generateEv(clock, scenario.seedId)
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
    })
    const accounting = accountInterval({
      tou: slot.tou,
      homeKwh: homePoint.kwh,
      evKwh: evPoint.chargeKwh,
      gridImportKwh: routed.gridImportKwh,
      gridExportKwh: routed.gridExportKwh,
    })

    records.push({
      ...slot,
      dayType: condition.dayType,
      temperatureF: condition.temperatureF,
      cloudFactor: condition.cloudFactor,
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

  const errors = validateMonth(records)
  if (errors.length > 0) throw new Error(`Invalid simulation: ${errors.join('; ')}`)

  return freezeMonth(records)
}
