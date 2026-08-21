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

export type TimeRange = '24h' | '7d' | '30d' | '31d' | 'month' | 'ytd'

const intervalMinutes = LOS_ANGELES_AUGUST_2026.intervalMinutes

export const rangeSlots = {
  '24h': (24 * 60) / intervalMinutes,
  '7d': (7 * 24 * 60) / intervalMinutes,
  '30d': (30 * 24 * 60) / intervalMinutes,
  '31d': LOS_ANGELES_AUGUST_2026.records,
} as const

export type FixedTimeRange = keyof typeof rangeSlots

const isFixedTimeRange = (value: unknown): value is FixedTimeRange =>
  value === '24h' || value === '7d' || value === '30d' || value === '31d'

const isTimeRange = (value: unknown): value is TimeRange =>
  isFixedTimeRange(value) || value === 'month' || value === 'ytd'

export interface RangeWindow {
  start: number
  end: number
  previousAnchor: number | null
  nextAnchor: number | null
}

const validatedFrozenRangeRecords = new WeakSet<readonly EnergyInterval[]>()

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
  range: FixedTimeRange,
  anchorIndex: number,
  recordCount: number,
) => {
  if (!isFixedTimeRange(range)) throw new Error('Invalid range')
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
    canGoPrevious: start >= rangeSlots[range],
    canGoNext: end + rangeSlots[range] < recordCount,
  }
}

const validateRangeRecords = (records: readonly EnergyInterval[]) => {
  if (validatedFrozenRangeRecords.has(records)) return

  let firstRecordIndex: number | null = null
  let previousDate = Number.NEGATIVE_INFINITY
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const recordIndex = record?.index
    if (index === 0 && typeof recordIndex === 'number' && Number.isSafeInteger(recordIndex)) {
      firstRecordIndex = recordIndex
    }
    if (
      record === undefined ||
      typeof recordIndex !== 'number' ||
      !Number.isSafeInteger(recordIndex) ||
      firstRecordIndex === null ||
      recordIndex !== firstRecordIndex + index
    ) {
      throw new Error(`Record ${index} contains an invalid canonical index`)
    }
    if (
      !Number.isInteger(record.year) || record.year < 1 ||
      !Number.isInteger(record.month) || record.month < 1 || record.month > 12 ||
      !Number.isInteger(record.day) || record.day < 1 ||
      record.day > new Date(Date.UTC(record.year, record.month, 0)).getUTCDate()
    ) {
      throw new Error(`Record ${index} contains invalid calendar fields`)
    }

    const date = Date.UTC(record.year, record.month - 1, record.day)
    if (date < previousDate) {
      throw new Error(`Record ${index} contains out-of-order calendar fields`)
    }
    previousDate = date
  }

  if (Object.isFrozen(records) && records.every((record) => Object.isFrozen(record))) {
    validatedFrozenRangeRecords.add(records)
  }
}

export const getRangeWindow = (
  records: readonly EnergyInterval[],
  range: TimeRange,
  anchorIndex: number,
): RangeWindow => {
  if (records.length === 0) throw new Error('Invalid records')
  if (!isTimeRange(range)) throw new Error('Invalid range')
  if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= records.length) {
    throw new Error('Invalid anchorIndex')
  }

  validateRangeRecords(records)

  const end = anchorIndex
  if (isFixedTimeRange(range)) {
    const slots = rangeSlots[range]
    const start = Math.max(0, end - slots + 1)
    return {
      start,
      end,
      previousAnchor: start > 0 ? start - 1 : null,
      nextAnchor: end + slots < records.length ? end + slots : null,
    }
  }

  const anchor = records[anchorIndex]!
  let start = anchorIndex

  if (range === 'ytd') {
    while (start > 0 && records[start - 1]!.year === anchor.year) start -= 1
    return { start, end, previousAnchor: null, nextAnchor: null }
  }

  while (
    start > 0 &&
    records[start - 1]!.year === anchor.year &&
    records[start - 1]!.month === anchor.month
  ) start -= 1

  let monthEnd = anchorIndex
  while (
    monthEnd + 1 < records.length &&
    records[monthEnd + 1]!.year === anchor.year &&
    records[monthEnd + 1]!.month === anchor.month
  ) monthEnd += 1

  return {
    start,
    end: monthEnd,
    previousAnchor: start > 0 ? start - 1 : null,
    nextAnchor: monthEnd + 1 < records.length ? monthEnd + 1 : null,
  }
}
