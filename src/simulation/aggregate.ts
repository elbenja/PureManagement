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

const rangeCacheFields = ['index', 'year', 'month', 'day'] as const

const hasOwnImmutableDataProperty = (value: object, key: PropertyKey): boolean => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor !== undefined &&
    'value' in descriptor &&
    descriptor.writable === false &&
    descriptor.configurable === false
}

interface RecordRangeValidationState {
  baseIndex: number
  ranges: Array<{ start: number; end: number }>
  recordReads: number
  calendarBoundaryReads: number
}

const recordRangeValidationStates = new WeakMap<
  readonly EnergyInterval[],
  RecordRangeValidationState
>()

interface CalendarWindowState {
  yearStarts: Map<number, number>
  months: Map<string, { start: number; end: number }>
}

const calendarWindowStates = new WeakMap<readonly EnergyInterval[], CalendarWindowState>()

const isCovered = (
  ranges: readonly { start: number; end: number }[],
  start: number,
  end: number,
): boolean => ranges.some((range) => range.start <= start && range.end >= end)

const addCoveredRange = (
  ranges: readonly { start: number; end: number }[],
  start: number,
  end: number,
): Array<{ start: number; end: number }> => {
  const merged: Array<{ start: number; end: number }> = []
  let nextStart = start
  let nextEnd = end

  for (const range of ranges) {
    if (range.end + 1 < nextStart) {
      merged.push(range)
    } else if (nextEnd + 1 < range.start) {
      merged.push({ start: nextStart, end: nextEnd }, range)
      nextStart = Number.POSITIVE_INFINITY
      nextEnd = Number.POSITIVE_INFINITY
    } else {
      nextStart = Math.min(nextStart, range.start)
      nextEnd = Math.max(nextEnd, range.end)
    }
  }

  if (Number.isFinite(nextStart)) merged.push({ start: nextStart, end: nextEnd })
  return merged
}

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

export const validateRecordRange = (
  records: readonly EnergyInterval[],
  start: number,
  end: number,
) => {
  if (
    records.length === 0 ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end >= records.length
  ) throw new Error('Invalid record range')

  const firstRecord = records[0]
  const baseIndex = firstRecord?.index
  if (
    firstRecord === undefined ||
    typeof baseIndex !== 'number' ||
    !Number.isSafeInteger(baseIndex) ||
    baseIndex < 0
  ) {
    throw new Error('Record 0 contains an invalid canonical index')
  }

  let state = recordRangeValidationStates.get(records)
  if (state === undefined || state.baseIndex !== baseIndex) {
    state = { baseIndex, ranges: [], recordReads: 0, calendarBoundaryReads: 0 }
    recordRangeValidationStates.set(records, state)
  }

  const stableFirstIndex =
    Array.isArray(records) &&
    hasOwnImmutableDataProperty(records, 0) &&
    Object.getPrototypeOf(firstRecord) === Object.prototype &&
    hasOwnImmutableDataProperty(firstRecord, 'index')
  if (stableFirstIndex && isCovered(state.ranges, start, end)) return

  let stableRange = stableFirstIndex
  let previousDate = Number.NEGATIVE_INFINITY
  for (let index = start; index <= end; index += 1) {
    const record = records[index]
    const recordIndex = record?.index
    if (
      record === undefined ||
      typeof recordIndex !== 'number' ||
      !Number.isSafeInteger(recordIndex) ||
      recordIndex !== baseIndex + index
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
    state.recordReads += 1
    stableRange &&=
      hasOwnImmutableDataProperty(records, index) &&
      Object.getPrototypeOf(record) === Object.prototype &&
      rangeCacheFields.every((field) => hasOwnImmutableDataProperty(record, field))
  }

  if (stableRange) state.ranges = addCoveredRange(state.ranges, start, end)
}

/** @internal Test seam for selected-range validation work. */
export const __getRecordRangeValidationStats = (
  records: readonly EnergyInterval[],
) => {
  const state = recordRangeValidationStates.get(records)
  return state === undefined
    ? null
    : {
        recordReads: state.recordReads,
        calendarBoundaryReads: state.calendarBoundaryReads,
      }
}

const countCalendarBoundaryRead = (records: readonly EnergyInterval[]) => {
  const state = recordRangeValidationStates.get(records)
  if (state !== undefined) state.calendarBoundaryReads += 1
}

const hasStableValidatedRange = (
  records: readonly EnergyInterval[],
  start: number,
  end: number,
): boolean => {
  const state = recordRangeValidationStates.get(records)
  return state !== undefined && isCovered(state.ranges, start, end)
}

const hasStableCalendarBoundary = (
  records: readonly EnergyInterval[],
  index: number,
): boolean => {
  if (index < 0 || index >= records.length) {
    return hasOwnImmutableDataProperty(records, 'length')
  }
  const record = records[index]
  return record !== undefined &&
    hasOwnImmutableDataProperty(records, index) &&
    Object.getPrototypeOf(record) === Object.prototype &&
    rangeCacheFields.every((field) => hasOwnImmutableDataProperty(record, field))
}

const getCalendarWindowState = (records: readonly EnergyInterval[]): CalendarWindowState => {
  let state = calendarWindowStates.get(records)
  if (state === undefined) {
    state = { yearStarts: new Map(), months: new Map() }
    calendarWindowStates.set(records, state)
  }
  return state
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

  const end = anchorIndex
  if (isFixedTimeRange(range)) {
    const slots = rangeSlots[range]
    const start = Math.max(0, end - slots + 1)
    validateRecordRange(records, start, end)
    return {
      start,
      end,
      previousAnchor: start > 0 ? start - 1 : null,
      nextAnchor: end + slots < records.length ? end + slots : null,
    }
  }

  validateRecordRange(records, anchorIndex, anchorIndex)
  const anchor = records[anchorIndex]!
  let start = anchorIndex

  if (range === 'ytd') {
    const cachedStart = calendarWindowStates.get(records)?.yearStarts.get(anchor.year)
    if (cachedStart !== undefined) {
      start = cachedStart
    } else {
      while (start > 0) {
        countCalendarBoundaryRead(records)
        if (records[start - 1]!.year !== anchor.year) break
        start -= 1
      }
    }
    validateRecordRange(records, start, end)
    if (
      hasStableValidatedRange(records, start, end) &&
      hasStableCalendarBoundary(records, start - 1)
    ) {
      getCalendarWindowState(records).yearStarts.set(anchor.year, start)
    }
    return { start, end, previousAnchor: null, nextAnchor: null }
  }

  const monthKey = `${anchor.year}:${anchor.month}`
  const cachedMonth = calendarWindowStates.get(records)?.months.get(monthKey)
  if (cachedMonth !== undefined) {
    validateRecordRange(records, cachedMonth.start, cachedMonth.end)
    return {
      start: cachedMonth.start,
      end: cachedMonth.end,
      previousAnchor: cachedMonth.start > 0 ? cachedMonth.start - 1 : null,
      nextAnchor: cachedMonth.end + 1 < records.length ? cachedMonth.end + 1 : null,
    }
  }

  while (start > 0) {
    countCalendarBoundaryRead(records)
    const candidate = records[start - 1]!
    if (candidate.year !== anchor.year || candidate.month !== anchor.month) break
    start -= 1
  }

  let monthEnd = anchorIndex
  while (monthEnd + 1 < records.length) {
    countCalendarBoundaryRead(records)
    const candidate = records[monthEnd + 1]!
    if (candidate.year !== anchor.year || candidate.month !== anchor.month) break
    monthEnd += 1
  }

  validateRecordRange(records, start, monthEnd)
  if (
    hasStableValidatedRange(records, start, monthEnd) &&
    hasStableCalendarBoundary(records, start - 1) &&
    hasStableCalendarBoundary(records, monthEnd + 1)
  ) {
    getCalendarWindowState(records).months.set(monthKey, { start, end: monthEnd })
  }

  return {
    start,
    end: monthEnd,
    previousAnchor: start > 0 ? start - 1 : null,
    nextAnchor: monthEnd + 1 < records.length ? monthEnd + 1 : null,
  }
}
