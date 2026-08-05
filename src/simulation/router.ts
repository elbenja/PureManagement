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

const nonNegative = (value: number) => (value <= tolerance ? 0 : value)

const closeEnough = (left: number, right: number) => Math.abs(left - right) <= tolerance

const transferTotal = (
  transfers: Transfer[],
  predicate: (transfer: Transfer) => boolean,
) => transfers.filter(predicate).reduce((total, transfer) => total + transfer.kwh, 0)

const allocateLoad = (availableKwh: number, homeKwh: number, evKwh: number): LoadAllocation => {
  const servedHomeKwh = nonNegative(Math.min(availableKwh, homeKwh))
  const afterHomeKwh = nonNegative(availableKwh - servedHomeKwh)
  const servedEvKwh = nonNegative(Math.min(afterHomeKwh, evKwh))

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
  if (kwh <= tolerance) return

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
    if (
      !Number.isFinite(input[field]) ||
      input[field] < 0 ||
      !Number.isFinite(input[field] / intervalHours)
    ) {
      throw new Error(`Invalid ${field}`)
    }
  })

  if (!Number.isFinite(input.homeKwh + input.evKwh)) {
    throw new Error('Invalid aggregate demand')
  }

  if (
    !Number.isFinite(input.batterySocKwh) ||
    input.batterySocKwh < reserveKwh ||
    input.batterySocKwh > scenario.battery.capacityKwh
  ) {
    throw new Error('Invalid batterySocKwh')
  }

  if (!Number.isFinite(input.solarKwh + input.batterySocKwh)) {
    throw new Error('Invalid aggregate supply')
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
      !closeEnough(transfer.kw, transfer.kwh / intervalHours)
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

  if (!closeEnough(suppliedKwh, consumedKwh)) {
    throw new Error('Router invariant failed: energy is not conserved')
  }

  const solarTransfersKwh = transferTotal(result.transfers, (transfer) => transfer.source === 'solar')
  const homeTransfersKwh = transferTotal(result.transfers, (transfer) => transfer.destination === 'home')
  const evTransfersKwh = transferTotal(result.transfers, (transfer) => transfer.destination === 'ev')
  const gridImportTransfersKwh = transferTotal(result.transfers, (transfer) => transfer.source === 'grid')
  const gridExportTransfersKwh = transferTotal(
    result.transfers,
    (transfer) => transfer.source === 'solar' && transfer.destination === 'grid',
  )
  const batteryChargeTransfersKwh = transferTotal(
    result.transfers,
    (transfer) => transfer.source === 'solar' && transfer.destination === 'battery',
  )
  const batteryDischargeTransfersKwh = transferTotal(
    result.transfers,
    (transfer) => transfer.source === 'battery',
  )

  if (
    !closeEnough(solarTransfersKwh, input.solarKwh) ||
    !closeEnough(homeTransfersKwh, input.homeKwh) ||
    !closeEnough(evTransfersKwh, input.evKwh) ||
    !closeEnough(gridImportTransfersKwh, result.gridImportKwh) ||
    !closeEnough(gridExportTransfersKwh, result.gridExportKwh) ||
    !closeEnough(batteryChargeTransfersKwh, result.batteryChargeKwh + result.chargeLossKwh) ||
    !closeEnough(batteryDischargeTransfersKwh, result.batteryDischargeKwh - result.dischargeLossKwh)
  ) {
    throw new Error('Router invariant failed: transfers do not reconcile')
  }

  if (
    transferTotal(result.transfers, (transfer) => transfer.source === 'battery') / intervalHours >
      scenario.battery.maxPowerKw + tolerance ||
    transferTotal(
      result.transfers,
      (transfer) => transfer.source === 'solar' && transfer.destination === 'battery',
    ) /
      intervalHours >
      scenario.battery.maxPowerKw + tolerance
  ) {
    throw new Error('Router invariant failed: battery AC power limit exceeded')
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
  const chargeAcKwh = nonNegative(
    Math.min(
      solarAllocation.remainingKwh,
      maxAcKwhPerInterval,
      availableBatteryCapacityKwh / batteryEfficiency,
    ),
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
  const batteryDeliveredKwh = nonNegative(
    inDispatchWindow
      ? Math.min(demandKwh, maxAcKwhPerInterval, availableBatteryDischargeKwh)
      : 0,
  )
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
