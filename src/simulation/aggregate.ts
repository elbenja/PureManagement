import type { EnergyInterval } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'

export interface EnergyTotals {
  solarKwh: number
  homeKwh: number
  evKwh: number
  energyConsumedKwh: number
  batteryChargeKwh: number
  batteryDischargeKwh: number
  gridImportKwh: number
  gridExportKwh: number
  importCostUsd: number
  exportCreditUsd: number
  counterfactualCostUsd: number
  savingsUsd: number
  avoidedCo2Kg: number
}

export type TimeRange = '24h' | '7d' | '31d'

const intervalMinutes = LOS_ANGELES_AUGUST_2026.intervalMinutes

export const rangeSlots = {
  '24h': (24 * 60) / intervalMinutes,
  '7d': (7 * 24 * 60) / intervalMinutes,
  '31d': LOS_ANGELES_AUGUST_2026.records,
} as const

const isTimeRange = (value: unknown): value is TimeRange =>
  value === '24h' || value === '7d' || value === '31d'

const zeroTotals = (): EnergyTotals => ({
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

function validateRecord(
  record: EnergyInterval | undefined,
  index: number,
): asserts record is EnergyInterval {
  if (record === undefined) {
    throw new Error(`Record ${index} contains invalid aggregate values`)
  }

  const nonNegativeValues = [
    record.solarKwh,
    record.homeKwh,
    record.evKwh,
    record.batteryChargeKwh,
    record.batteryDischargeKwh,
    record.gridImportKwh,
    record.gridExportKwh,
    record.importCost,
    record.exportCredit,
    record.counterfactualCost,
    record.avoidedCo2Kg,
  ]

  if (
    nonNegativeValues.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isFinite(record.savings)
  ) {
    throw new Error(`Record ${index} contains invalid aggregate values`)
  }
}

const validateTotals = (totals: EnergyTotals, index: number) => {
  const values = Object.values(totals)
  const nonNegativeValues = [
    totals.solarKwh,
    totals.homeKwh,
    totals.evKwh,
    totals.energyConsumedKwh,
    totals.batteryChargeKwh,
    totals.batteryDischargeKwh,
    totals.gridImportKwh,
    totals.gridExportKwh,
    totals.importCostUsd,
    totals.exportCreditUsd,
    totals.counterfactualCostUsd,
    totals.avoidedCo2Kg,
  ]

  if (!values.every(Number.isFinite)) {
    throw new Error(`Record ${index} causes aggregate overflow`)
  }
  if (nonNegativeValues.some((value) => value < 0)) {
    throw new Error(`Record ${index} causes invalid aggregate totals`)
  }
}

const addRecord = (totals: EnergyTotals, record: EnergyInterval): EnergyTotals => ({
  solarKwh: totals.solarKwh + record.solarKwh,
  homeKwh: totals.homeKwh + record.homeKwh,
  evKwh: totals.evKwh + record.evKwh,
  energyConsumedKwh: totals.energyConsumedKwh + record.homeKwh + record.evKwh,
  batteryChargeKwh: totals.batteryChargeKwh + record.batteryChargeKwh,
  batteryDischargeKwh: totals.batteryDischargeKwh + record.batteryDischargeKwh,
  gridImportKwh: totals.gridImportKwh + record.gridImportKwh,
  gridExportKwh: totals.gridExportKwh + record.gridExportKwh,
  importCostUsd: totals.importCostUsd + record.importCost,
  exportCreditUsd: totals.exportCreditUsd + record.exportCredit,
  counterfactualCostUsd: totals.counterfactualCostUsd + record.counterfactualCost,
  savingsUsd: totals.savingsUsd + record.savings,
  avoidedCo2Kg: totals.avoidedCo2Kg + record.avoidedCo2Kg,
})

export const aggregateIntervals = (records: readonly EnergyInterval[]): EnergyTotals => {
  let totals = zeroTotals()

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    validateRecord(record, index)
    totals = addRecord(totals, record)
    validateTotals(totals, index)
  }

  return totals
}

export const buildPrefixTotals = (records: readonly EnergyInterval[]): EnergyTotals[] => {
  const prefixes = [zeroTotals()]
  let totals = prefixes[0]

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    validateRecord(record, index)
    totals = addRecord(totals, record)
    validateTotals(totals, index)
    prefixes.push(totals)
  }

  return prefixes
}

export const getTrailingWindow = (
  range: TimeRange,
  anchorIndex: number,
  recordCount: number,
) => {
  if (!isTimeRange(range)) throw new Error('Invalid range')
  if (!Number.isInteger(recordCount) || recordCount <= 0) {
    throw new Error('Invalid recordCount')
  }
  if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= recordCount) {
    throw new Error('Invalid anchorIndex')
  }

  const end = anchorIndex
  const start = Math.max(0, end - rangeSlots[range] + 1)

  return {
    start,
    end,
    canGoPrevious: start > 0,
    canGoNext: end + rangeSlots[range] < recordCount,
  }
}
