import type { EnergyNode, Transfer } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'

export interface RouterInput {
  solarKwh: number
  homeKwh: number
  evKwh: number
  batterySocKwh: number
  minuteOfDay: number
}

export interface RouterResult {
  batteryChargeKw: number
  batteryChargeKwh: number
  batteryDischargeKw: number
  batteryDischargeKwh: number
  batterySocEndKwh: number
  chargeLossKwh: number
  dischargeLossKwh: number
  gridImportKw: number
  gridImportKwh: number
  gridExportKw: number
  gridExportKwh: number
  transfers: Transfer[]
}

const scenario = LOS_ANGELES_AUGUST_2026
const intervalHours = scenario.intervalMinutes / 60
const batteryEfficiency = Math.sqrt(scenario.battery.roundTripEfficiency)
const reserveKwh = scenario.battery.capacityKwh * (scenario.battery.reservePercent / 100)
const maxAcKwhPerInterval = scenario.battery.maxPowerKw * intervalHours
const dispatchStartMinute = 13 * 60
const dispatchEndMinute = 20 * 60
const tolerance = 1e-10

type LoadAllocation = { homeKwh: number; evKwh: number; remainingKwh: number }

const nonNegative = (value: number) => Math.max(0, value)

const allocateLoad = (availableKwh: number, homeKwh: number, evKwh: number): LoadAllocation => {
  const servedHomeKwh = Math.min(availableKwh, homeKwh)
  const afterHomeKwh = nonNegative(availableKwh - servedHomeKwh)
  const servedEvKwh = Math.min(afterHomeKwh, evKwh)

  return {
    homeKwh: servedHomeKwh,
    evKwh: servedEvKwh,
    remainingKwh: nonNegative(afterHomeKwh - servedEvKwh),
  }
}

const addTransfer = (
  transfers: Transfer[],
  source: EnergyNode,
  destination: EnergyNode,
  kwh: number,
) => {
  if (kwh <= 0) return

  transfers.push({
    source,
    destination,
    kwh,
    kw: kwh / intervalHours,
  })
}

const validateInput = (input: RouterInput) => {
  const energyFields: Array<keyof Pick<RouterInput, 'solarKwh' | 'homeKwh' | 'evKwh'>> = [
    'solarKwh',
    'homeKwh',
    'evKwh',
  ]

  energyFields.forEach((field) => {
    if (!Number.isFinite(input[field]) || input[field] < 0) throw new Error(`Invalid ${field}`)
  })

  if (
    !Number.isFinite(input.batterySocKwh) ||
    input.batterySocKwh < reserveKwh ||
    input.batterySocKwh > scenario.battery.capacityKwh
  ) {
    throw new Error('Invalid batterySocKwh')
  }

  if (
    !Number.isInteger(input.minuteOfDay) ||
    input.minuteOfDay < 0 ||
    input.minuteOfDay >= 24 * 60 ||
    input.minuteOfDay % scenario.intervalMinutes !== 0
  ) {
    throw new Error('Invalid minuteOfDay')
  }
}

const verifyResult = (input: RouterInput, result: RouterResult) => {
  const numericValues = [
    result.batteryChargeKw,
    result.batteryChargeKwh,
    result.batteryDischargeKw,
    result.batteryDischargeKwh,
    result.batterySocEndKwh,
    result.chargeLossKwh,
    result.dischargeLossKwh,
    result.gridImportKw,
    result.gridImportKwh,
    result.gridExportKw,
    result.gridExportKwh,
  ]
  const approvedPairs = new Set([
    'solar-home', 'solar-ev', 'solar-battery', 'solar-grid',
    'battery-home', 'battery-ev', 'grid-home', 'grid-ev',
  ])

  if (!numericValues.every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error('Router invariant failed: non-negative finite result required')
  }
  if (
    result.batterySocEndKwh < reserveKwh - tolerance ||
    result.batterySocEndKwh > scenario.battery.capacityKwh + tolerance
  ) {
    throw new Error('Router invariant failed: battery state out of bounds')
  }
  if (result.batteryChargeKwh > tolerance && result.batteryDischargeKwh > tolerance) {
    throw new Error('Router invariant failed: simultaneous battery charge and discharge')
  }
  if (result.gridImportKwh > tolerance && result.gridExportKwh > tolerance) {
    throw new Error('Router invariant failed: simultaneous grid import and export')
  }

  result.transfers.forEach((transfer) => {
    if (
      !Number.isFinite(transfer.kwh) ||
      !Number.isFinite(transfer.kw) ||
      transfer.kwh <= 0 ||
      transfer.kw <= 0 ||
      !approvedPairs.has(`${transfer.source}-${transfer.destination}`) ||
      Math.abs(transfer.kw - transfer.kwh / intervalHours) > tolerance
    ) {
      throw new Error('Router invariant failed: invalid transfer')
    }
  })

  const suppliedKwh = input.solarKwh + result.batteryDischargeKwh + result.gridImportKwh
  const consumedKwh =
    input.homeKwh +
    input.evKwh +
    result.batteryChargeKwh +
    result.gridExportKwh +
    result.chargeLossKwh +
    result.dischargeLossKwh

  if (Math.abs(suppliedKwh - consumedKwh) > tolerance) {
    throw new Error('Router invariant failed: energy is not conserved')
  }
}

export const routeInterval = (input: RouterInput): RouterResult => {
  validateInput(input)

  const transfers: Transfer[] = []
  const solarAllocation = allocateLoad(input.solarKwh, input.homeKwh, input.evKwh)
  addTransfer(transfers, 'solar', 'home', solarAllocation.homeKwh)
  addTransfer(transfers, 'solar', 'ev', solarAllocation.evKwh)

  const remainingHomeKwh = nonNegative(input.homeKwh - solarAllocation.homeKwh)
  const remainingEvKwh = nonNegative(input.evKwh - solarAllocation.evKwh)
  const availableBatteryCapacityKwh = scenario.battery.capacityKwh - input.batterySocKwh
  const chargeAcKwh = Math.min(
    solarAllocation.remainingKwh,
    maxAcKwhPerInterval,
    availableBatteryCapacityKwh / batteryEfficiency,
  )
  const batteryChargeKwh = nonNegative(chargeAcKwh * batteryEfficiency)
  const chargeLossKwh = nonNegative(chargeAcKwh - batteryChargeKwh)
  const solarExportKwh = nonNegative(solarAllocation.remainingKwh - chargeAcKwh)

  addTransfer(transfers, 'solar', 'battery', chargeAcKwh)
  addTransfer(transfers, 'solar', 'grid', solarExportKwh)

  const demandKwh = remainingHomeKwh + remainingEvKwh
  const inDispatchWindow =
    input.minuteOfDay >= dispatchStartMinute && input.minuteOfDay < dispatchEndMinute
  const availableBatteryDischargeKwh = (input.batterySocKwh - reserveKwh) * batteryEfficiency
  const batteryDeliveredKwh = inDispatchWindow
    ? Math.min(demandKwh, maxAcKwhPerInterval, availableBatteryDischargeKwh)
    : 0
  const batteryDischargeKwh = nonNegative(batteryDeliveredKwh / batteryEfficiency)
  const dischargeLossKwh = nonNegative(batteryDischargeKwh - batteryDeliveredKwh)
  const batteryAllocation = allocateLoad(batteryDeliveredKwh, remainingHomeKwh, remainingEvKwh)

  addTransfer(transfers, 'battery', 'home', batteryAllocation.homeKwh)
  addTransfer(transfers, 'battery', 'ev', batteryAllocation.evKwh)

  const gridHomeKwh = nonNegative(remainingHomeKwh - batteryAllocation.homeKwh)
  const gridEvKwh = nonNegative(remainingEvKwh - batteryAllocation.evKwh)
  const gridImportKwh = gridHomeKwh + gridEvKwh

  addTransfer(transfers, 'grid', 'home', gridHomeKwh)
  addTransfer(transfers, 'grid', 'ev', gridEvKwh)

  const result: RouterResult = {
    batteryChargeKw: batteryChargeKwh / intervalHours,
    batteryChargeKwh,
    batteryDischargeKw: batteryDischargeKwh / intervalHours,
    batteryDischargeKwh,
    batterySocEndKwh: nonNegative(input.batterySocKwh + batteryChargeKwh - batteryDischargeKwh),
    chargeLossKwh,
    dischargeLossKwh,
    gridImportKw: gridImportKwh / intervalHours,
    gridImportKwh,
    gridExportKw: solarExportKwh / intervalHours,
    gridExportKwh: solarExportKwh,
    transfers,
  }

  verifyResult(input, result)
  return result
}
