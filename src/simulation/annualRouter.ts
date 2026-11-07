import type { Transfer } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import type { GridStatus } from './annualOutages'
import { routeInterval, type RouterInput, type RouterResult } from './router'

export interface AnnualRouterResult extends RouterResult {
  actualSolarKwh: number
  curtailedSolarKwh: number
  unservedHomeKwh: number
}

const scenario = LOS_ANGELES_2026
const intervalHours = scenario.intervalMinutes / 60
const efficiency = Math.sqrt(scenario.battery.roundTripEfficiency)
const maxTransferKwh = scenario.battery.maxPowerKw * intervalHours

const transfer = (source: Transfer['source'], destination: Transfer['destination'], kwh: number): Transfer => ({
  source,
  destination,
  kwh,
  kw: kwh / intervalHours,
})

export const routeAnnualInterval = (
  input: RouterInput,
  status: GridStatus,
): AnnualRouterResult => {
  if (status === 'connected') {
    return {
      ...routeInterval(input, scenario),
      actualSolarKwh: input.solarKwh,
      curtailedSolarKwh: 0,
      unservedHomeKwh: 0,
    }
  }
  if (status !== 'outage') throw new Error('Invalid grid status')
  if (
    !Number.isFinite(input.solarKwh) || input.solarKwh < 0 ||
    !Number.isFinite(input.homeKwh) || input.homeKwh < 0 ||
    input.evKwh !== 0 ||
    !Number.isFinite(input.batterySocKwh) || input.batterySocKwh < 0 ||
    input.batterySocKwh > scenario.battery.capacityKwh ||
    !Number.isInteger(input.minuteOfDay) || input.minuteOfDay < 0 ||
    input.minuteOfDay >= 24 * 60 || input.minuteOfDay % scenario.intervalMinutes !== 0
  ) throw new Error('Invalid outage routing input')

  const solarToHome = Math.min(input.solarKwh, input.homeKwh)
  const remainingHome = input.homeKwh - solarToHome
  const surplusSolar = input.solarKwh - solarToHome
  const solarToBattery = Math.min(
    surplusSolar,
    maxTransferKwh,
    Math.max(0, scenario.battery.capacityKwh - input.batterySocKwh) / efficiency,
  )
  const batteryChargeKwh = solarToBattery * efficiency
  const chargeLossKwh = solarToBattery - batteryChargeKwh
  const batteryToHome = Math.min(remainingHome, maxTransferKwh, input.batterySocKwh * efficiency)
  const batteryDischargeKwh = batteryToHome / efficiency
  const dischargeLossKwh = batteryDischargeKwh - batteryToHome
  const curtailedSolarKwh = Math.max(0, surplusSolar - solarToBattery)
  const unservedHomeKwh = Math.max(0, remainingHome - batteryToHome)
  const transfers = [
    solarToHome > 0 ? transfer('solar', 'home', solarToHome) : null,
    solarToBattery > 0 ? transfer('solar', 'battery', solarToBattery) : null,
    batteryToHome > 0 ? transfer('battery', 'home', batteryToHome) : null,
  ].filter((item): item is Transfer => item !== null)

  return {
    actualSolarKwh: input.solarKwh - curtailedSolarKwh,
    curtailedSolarKwh,
    unservedHomeKwh,
    batteryChargeKw: batteryChargeKwh / intervalHours,
    batteryChargeKwh,
    batteryDischargeKw: batteryDischargeKwh / intervalHours,
    batteryDischargeKwh,
    batterySocEndKwh: Math.max(0, input.batterySocKwh + batteryChargeKwh - batteryDischargeKwh),
    chargeLossKwh,
    dischargeLossKwh,
    gridImportKw: 0,
    gridImportKwh: 0,
    gridExportKw: 0,
    gridExportKwh: 0,
    transfers,
  }
}
