import type { EnergyNode, Transfer } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'

export interface RouterInput {
  solarKwh: number
  homeKwh: number
  evKwh: number
  batterySocKwh: number
  minuteOfDay: number
}

export interface RouterScenario {
  readonly intervalMinutes: number
  readonly battery: {
    readonly capacityKwh: number
    readonly maxPowerKw: number
    readonly roundTripEfficiency: number
    readonly reservePercent: number
  }
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

const dispatchStartMinute = 13 * 60
const dispatchEndMinute = 20 * 60
const invariantTolerance = 1e-10
const maximumTransferCount = 8
const routingEpsilon = invariantTolerance / 100
const maximumOmittedRouteKwh = maximumTransferCount * routingEpsilon
const approvedRoutePairs = new Set([
  'solar-home', 'solar-ev', 'solar-battery', 'solar-grid',
  'battery-home', 'battery-ev', 'grid-home', 'grid-ev',
])

type LoadAllocation = { homeKwh: number; evKwh: number; remainingKwh: number }

interface RouterConstants {
  intervalHours: number
  batteryEfficiency: number
  reserveKwh: number
  maxAcKwhPerInterval: number
}

const frozenScenarioConstants = new WeakMap<object, RouterConstants>()

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactEnumerableShape = (value: object, fields: readonly string[]) => {
  const keys = Object.keys(value)
  return keys.length === fields.length && fields.every((field) => keys.includes(field))
}

const scenarioConstants = (scenario: RouterScenario): RouterConstants => {
  if (!isObject(scenario)) throw new Error('Invalid router scenario')
  const canonicalScenario = scenario === LOS_ANGELES_AUGUST_2026 || scenario === LOS_ANGELES_2026
  if (
    !canonicalScenario &&
    !hasExactEnumerableShape(scenario, ['intervalMinutes', 'battery'])
  ) {
    throw new Error('Invalid router scenario shape: expected exactly intervalMinutes,battery')
  }
  const cached = frozenScenarioConstants.get(scenario)
  if (cached !== undefined) return cached
  const battery = scenario.battery
  if (!isObject(battery)) throw new Error('Invalid router scenario battery')
  const batteryFields = ['capacityKwh', 'maxPowerKw', 'roundTripEfficiency', 'reservePercent']
  if (!canonicalScenario && !hasExactEnumerableShape(battery, batteryFields)) {
    throw new Error(
      'Invalid router scenario battery shape: expected exactly capacityKwh,maxPowerKw,roundTripEfficiency,reservePercent',
    )
  }
  const { intervalMinutes } = scenario
  if (
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes <= 0 ||
    intervalMinutes > 24 * 60 ||
    (24 * 60) % intervalMinutes !== 0
  ) {
    throw new Error('Invalid router scenario intervalMinutes')
  }
  if (!Number.isFinite(battery.capacityKwh) || battery.capacityKwh <= 0) {
    throw new Error('Invalid router scenario battery capacityKwh')
  }
  if (!Number.isFinite(battery.maxPowerKw) || battery.maxPowerKw <= 0) {
    throw new Error('Invalid router scenario battery maxPowerKw')
  }
  if (
    !Number.isFinite(battery.roundTripEfficiency) ||
    battery.roundTripEfficiency <= 0 ||
    battery.roundTripEfficiency > 1
  ) {
    throw new Error('Invalid router scenario battery roundTripEfficiency')
  }
  if (
    !Number.isFinite(battery.reservePercent) ||
    battery.reservePercent < 0 ||
    battery.reservePercent >= 100
  ) {
    throw new Error('Invalid router scenario battery reservePercent')
  }

  const intervalHours = intervalMinutes / 60
  const batteryEfficiency = Math.sqrt(battery.roundTripEfficiency)
  const reserveKwh = battery.capacityKwh * (battery.reservePercent / 100)
  const maxAcKwhPerInterval = battery.maxPowerKw * intervalHours
  if (![intervalHours, batteryEfficiency, reserveKwh, maxAcKwhPerInterval].every(Number.isFinite)) {
    throw new Error('Invalid router scenario derived values')
  }

  const constants = { intervalHours, batteryEfficiency, reserveKwh, maxAcKwhPerInterval }
  if (Object.isFrozen(scenario) && Object.isFrozen(battery)) {
    frozenScenarioConstants.set(scenario, constants)
  }
  return constants
}

const nonNegative = (value: number) => (value <= routingEpsilon ? 0 : value)

const closeEnough = (left: number, right: number) => Math.abs(left - right) <= invariantTolerance

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
  intervalHours: number,
) => {
  if (kwh <= routingEpsilon) return

  transfers.push({
    source,
    destination,
    kwh,
    kw: kwh / intervalHours,
  })
}

const validateInput = (
  input: RouterInput,
  scenario: RouterScenario,
  { intervalHours, reserveKwh }: RouterConstants,
) => {
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

const verifyResult = (
  input: RouterInput,
  result: RouterResult,
  scenario: RouterScenario,
  { intervalHours, reserveKwh }: RouterConstants,
) => {
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

  if (!numericValues.every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error('Router invariant failed: non-negative finite result required')
  }
  if (
    result.batterySocEndKwh < reserveKwh - invariantTolerance ||
    result.batterySocEndKwh > scenario.battery.capacityKwh + invariantTolerance
  ) {
    throw new Error('Router invariant failed: battery state out of bounds')
  }
  if (result.batteryChargeKwh > invariantTolerance && result.batteryDischargeKwh > invariantTolerance) {
    throw new Error('Router invariant failed: simultaneous battery charge and discharge')
  }
  if (result.gridImportKwh > invariantTolerance && result.gridExportKwh > invariantTolerance) {
    throw new Error('Router invariant failed: simultaneous grid import and export')
  }

  const transferTotals = {
    solar: 0,
    home: 0,
    ev: 0,
    gridImport: 0,
    gridExport: 0,
    batteryCharge: 0,
    batteryDischarge: 0,
  }
  result.transfers.forEach((transfer) => {
    if (
      !Number.isFinite(transfer.kwh) ||
      !Number.isFinite(transfer.kw) ||
      transfer.kwh <= 0 ||
      transfer.kw <= 0 ||
      !approvedRoutePairs.has(`${transfer.source}-${transfer.destination}`) ||
      !closeEnough(transfer.kw, transfer.kwh / intervalHours)
    ) {
      throw new Error('Router invariant failed: invalid transfer')
    }
    if (transfer.source === 'solar') transferTotals.solar += transfer.kwh
    if (transfer.destination === 'home') transferTotals.home += transfer.kwh
    if (transfer.destination === 'ev') transferTotals.ev += transfer.kwh
    if (transfer.source === 'grid') transferTotals.gridImport += transfer.kwh
    if (transfer.source === 'solar' && transfer.destination === 'grid') {
      transferTotals.gridExport += transfer.kwh
    }
    if (transfer.source === 'solar' && transfer.destination === 'battery') {
      transferTotals.batteryCharge += transfer.kwh
    }
    if (transfer.source === 'battery') transferTotals.batteryDischarge += transfer.kwh
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

  if (
    !closeEnough(transferTotals.solar, input.solarKwh) ||
    !closeEnough(transferTotals.home, input.homeKwh) ||
    !closeEnough(transferTotals.ev, input.evKwh) ||
    !closeEnough(transferTotals.gridImport, result.gridImportKwh) ||
    !closeEnough(transferTotals.gridExport, result.gridExportKwh) ||
    !closeEnough(transferTotals.batteryCharge, result.batteryChargeKwh + result.chargeLossKwh) ||
    !closeEnough(transferTotals.batteryDischarge, result.batteryDischargeKwh - result.dischargeLossKwh)
  ) {
    throw new Error('Router invariant failed: transfers do not reconcile')
  }

  if (
    transferTotals.batteryDischarge / intervalHours >
      scenario.battery.maxPowerKw + invariantTolerance ||
    transferTotals.batteryCharge / intervalHours >
      scenario.battery.maxPowerKw + invariantTolerance
  ) {
    throw new Error('Router invariant failed: battery AC power limit exceeded')
  }
}

export const routeInterval = (
  input: RouterInput,
  scenario: RouterScenario = LOS_ANGELES_AUGUST_2026,
): RouterResult => {
  const constants = scenarioConstants(scenario)
  const { intervalHours, batteryEfficiency, reserveKwh, maxAcKwhPerInterval } = constants
  validateInput(input, scenario, constants)

  if (maximumOmittedRouteKwh >= invariantTolerance) {
    throw new Error('Router invariant failed: routing epsilon exceeds reconciliation tolerance')
  }

  const transfers: Transfer[] = []
  const solarAllocation = allocateLoad(input.solarKwh, input.homeKwh, input.evKwh)
  addTransfer(transfers, 'solar', 'home', solarAllocation.homeKwh, intervalHours)
  addTransfer(transfers, 'solar', 'ev', solarAllocation.evKwh, intervalHours)

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

  addTransfer(transfers, 'solar', 'battery', chargeAcKwh, intervalHours)
  addTransfer(transfers, 'solar', 'grid', solarExportKwh, intervalHours)

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

  addTransfer(transfers, 'battery', 'home', batteryAllocation.homeKwh, intervalHours)
  addTransfer(transfers, 'battery', 'ev', batteryAllocation.evKwh, intervalHours)

  const gridHomeKwh = nonNegative(remainingHomeKwh - batteryAllocation.homeKwh)
  const gridEvKwh = nonNegative(remainingEvKwh - batteryAllocation.evKwh)
  const gridImportKwh = gridHomeKwh + gridEvKwh

  addTransfer(transfers, 'grid', 'home', gridHomeKwh, intervalHours)
  addTransfer(transfers, 'grid', 'ev', gridEvKwh, intervalHours)

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

  verifyResult(input, result, scenario, constants)
  return result
}
