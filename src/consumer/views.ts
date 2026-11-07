import type {
  DayType,
  EnergyInterval,
  LoadCategory,
  TouPeriod,
  Transfer,
  WeatherState,
} from '../domain/energy'
import { isAnnualEnergyInterval } from '../domain/annualEnergy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import {
  aggregateIntervals,
  getRangeWindow,
  type EnergyTotals,
  type TimeRange,
} from '../simulation/aggregate'
import { interpolatePower } from '../playback/playback'

export interface SolarNodeView {
  id: 'solar'
  label: 'Solar'
  powerKw: number
  direction: 'outbound' | 'idle'
  status: 'generating' | 'idle'
}

export interface HomeNodeView {
  id: 'home'
  label: 'Home'
  powerKw: number
  direction: 'inbound' | 'idle'
  status: 'consuming' | 'idle'
}

export interface EvNodeView {
  id: 'ev'
  label: 'EV'
  powerKw: number
  direction: 'inbound' | 'idle'
  status: 'charging' | 'connected' | 'away'
  isAvailable: boolean
}

export interface BatteryNodeView {
  id: 'battery'
  label: 'Battery'
  /** AC-side power, matching the canonical transfer routes. */
  powerKw: number
  direction: 'charging' | 'discharging' | 'idle'
  status: 'charging' | 'discharging' | 'idle'
  /** AC-side power entering the battery. */
  chargeKw: number
  /** AC-side power leaving the battery. */
  dischargeKw: number
  socKwh: number
  socPercent: number
}

export interface GridNodeView {
  id: 'grid'
  label: 'Grid'
  powerKw: number
  direction: 'importing' | 'exporting' | 'idle'
  status: 'importing' | 'exporting' | 'idle' | 'outage'
  importKw: number
  exportKw: number
}

export type EnergyNodeView =
  | SolarNodeView
  | HomeNodeView
  | EvNodeView
  | BatteryNodeView
  | GridNodeView

export interface LiveAccountingView {
  importRateUsdPerKwh: number
  exportRateUsdPerKwh: number
  importCostUsd: number
  exportCreditUsd: number
  counterfactualCostUsd: number
  savingsUsd: number
  avoidedCo2Kg: number
}

export interface LiveFrame {
  index: number
  timestamp: string
  fraction: number
  tou: TouPeriod
  dayType: DayType
  conditions: {
    temperatureF: number
    cloudFactor: number
    weatherState: WeatherState
    precipitationInches: number
  }
  nodes: [
    SolarNodeView,
    HomeNodeView,
    EvNodeView,
    BatteryNodeView,
    GridNodeView,
  ]
  /** Exact current-interval routes. Transfer power is intentionally not interpolated. */
  transfers: Transfer[]
  appliancesKwh: Record<LoadCategory, number>
  accounting: LiveAccountingView
}

export interface HistoryRangeView {
  key: TimeRange
  label:
    | 'Last 24h'
    | 'Last week'
    | 'Last 30 days'
    | 'Last month'
    | 'Calendar month'
    | 'Year to date'
  startIndex: number
  endIndex: number
  startTimestamp: string
  endTimestamp: string
  previousAnchor: number | null
  nextAnchor: number | null
  canGoPrevious: boolean
  canGoNext: boolean
}

export interface HistorySeriesPoint {
  index: number
  timestamp: string
  solarKw: number
  homeKw: number
  evKw: number
  /** AC-side power: positive discharges to loads; negative charges the battery. */
  batteryNetKw: number
  gridImportKw: number
  gridExportKw: number
}

export interface HistoryView {
  records: readonly EnergyInterval[]
  range: HistoryRangeView
  totals: EnergyTotals
  series: HistorySeriesPoint[]
}

const rangeLabels: Record<TimeRange, HistoryRangeView['label']> = {
  '24h': 'Last 24h',
  '7d': 'Last week',
  '30d': 'Last 30 days',
  '31d': 'Last month',
  month: 'Calendar month',
  ytd: 'Year to date',
}

const clampIndex = (index: number, recordCount: number): number => {
  if (Number.isNaN(index) || index === Number.NEGATIVE_INFINITY) return 0
  if (index === Number.POSITIVE_INFINITY) return recordCount - 1
  return Math.min(recordCount - 1, Math.max(0, Math.trunc(index)))
}

const clampFraction = (fraction: number): number =>
  Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0

const resolveBidirectionalFlow = (
  inboundKw: number,
  outboundKw: number,
): { inboundKw: number; outboundKw: number; powerKw: number } => {
  const netKw = outboundKw - inboundKw
  return {
    inboundKw: Math.max(0, -netKw),
    outboundKw: Math.max(0, netKw),
    powerKw: Math.abs(netKw),
  }
}

const batteryTransferKw = (
  record: EnergyInterval,
  direction: 'incoming' | 'outgoing',
): number => record.transfers
  .filter((transfer) => direction === 'incoming'
    ? transfer.destination === 'battery'
    : transfer.source === 'battery')
  .reduce((total, transfer) => total + transfer.kw, 0)

const validateHistoryRecord = (record: EnergyInterval, index: number) => {
  const powerValues = [
    record.solarKw,
    record.homeKw,
    record.evKw,
    record.gridImportKw,
    record.gridExportKw,
  ]
  if (
    powerValues.some((value) => !Number.isFinite(value) || value < 0) ||
    !Array.isArray(record.transfers) ||
    record.transfers.some((transfer) => !Number.isFinite(transfer.kw) || transfer.kw < 0)
  ) {
    throw new Error(`Record ${index} contains invalid history values`)
  }
}

type TotalPrefixArrays = Record<keyof EnergyTotals, Float64Array>
type ChartPrefixKey =
  | 'solarKw'
  | 'homeKw'
  | 'evKw'
  | 'batteryNetKw'
  | 'gridImportKw'
  | 'gridExportKw'
type ChartPrefixArrays = Record<ChartPrefixKey, Float64Array>

interface HistoryPrefixCache {
  totals: TotalPrefixArrays
  chart: ChartPrefixArrays
  buildCount: 1
  sourceRecordReads: number
  prefixValueReads: number
}

const historyPrefixCaches = new WeakMap<readonly EnergyInterval[], HistoryPrefixCache>()
const historyPrefixThreshold = 32_768

const historyCacheFields = [
  'index',
  'iso',
  'year',
  'month',
  'day',
  'solarKwh',
  'homeKwh',
  'evKwh',
  'batteryChargeKwh',
  'batteryDischargeKwh',
  'gridImportKwh',
  'gridExportKwh',
  'importCost',
  'exportCredit',
  'counterfactualCost',
  'savings',
  'avoidedCo2Kg',
  'solarKw',
  'homeKw',
  'evKw',
  'gridImportKw',
  'gridExportKw',
  'transfers',
] as const

const transferCacheFields = ['source', 'destination', 'kw', 'kwh'] as const

const hasOwnImmutableDataProperty = (value: object, key: PropertyKey): boolean => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor !== undefined &&
    'value' in descriptor &&
    descriptor.writable === false &&
    descriptor.configurable === false
}

const isStableTransferList = (transfers: readonly Transfer[]): boolean => {
  if (
    !Array.isArray(transfers) ||
    Object.isExtensible(transfers) ||
    !hasOwnImmutableDataProperty(transfers, 'length')
  ) return false

  for (let index = 0; index < transfers.length; index += 1) {
    if (!hasOwnImmutableDataProperty(transfers, index)) return false
    const transfer = transfers[index]!
    if (
      Object.getPrototypeOf(transfer) !== Object.prototype ||
      Object.isExtensible(transfer) ||
      !transferCacheFields.every((field) => hasOwnImmutableDataProperty(transfer, field))
    ) return false
  }

  return true
}

const isStableHistoryLedger = (records: readonly EnergyInterval[]): boolean => {
  if (
    !Array.isArray(records) ||
    Object.isExtensible(records) ||
    !hasOwnImmutableDataProperty(records, 'length')
  ) return false

  for (let index = 0; index < records.length; index += 1) {
    if (!hasOwnImmutableDataProperty(records, index)) return false
    const record = records[index]!
    if (
      Object.getPrototypeOf(record) !== Object.prototype ||
      Object.isExtensible(record) ||
      !historyCacheFields.every((field) => hasOwnImmutableDataProperty(record, field)) ||
      !isStableTransferList(record.transfers)
    ) return false
  }

  return true
}

const createTotalPrefixArrays = (length: number): TotalPrefixArrays => ({
  solarKwh: new Float64Array(length),
  homeKwh: new Float64Array(length),
  evKwh: new Float64Array(length),
  energyConsumedKwh: new Float64Array(length),
  batteryChargeKwh: new Float64Array(length),
  batteryDischargeKwh: new Float64Array(length),
  gridImportKwh: new Float64Array(length),
  gridExportKwh: new Float64Array(length),
  importCostUsd: new Float64Array(length),
  exportCreditUsd: new Float64Array(length),
  counterfactualCostUsd: new Float64Array(length),
  savingsUsd: new Float64Array(length),
  avoidedCo2Kg: new Float64Array(length),
})

const createChartPrefixArrays = (length: number): ChartPrefixArrays => ({
  solarKw: new Float64Array(length),
  homeKw: new Float64Array(length),
  evKw: new Float64Array(length),
  batteryNetKw: new Float64Array(length),
  gridImportKw: new Float64Array(length),
  gridExportKw: new Float64Array(length),
})

const buildHistoryPrefixCache = (
  records: readonly EnergyInterval[],
): HistoryPrefixCache => {
  const totals = createTotalPrefixArrays(records.length + 1)
  const chart = createChartPrefixArrays(records.length + 1)
  const cache: HistoryPrefixCache = {
    totals,
    chart,
    buildCount: 1,
    sourceRecordReads: 0,
    prefixValueReads: 0,
  }

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!
    const next = index + 1
    validateHistoryRecord(record, record.index)
    const aggregateInputs = [
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
      aggregateInputs.some((value) => !Number.isFinite(value) || value < 0) ||
      !Number.isFinite(record.savings)
    ) {
      throw new Error(`Record ${record.index} contains invalid aggregate values`)
    }

    totals.solarKwh[next] = totals.solarKwh[index]! + record.solarKwh
    totals.homeKwh[next] = totals.homeKwh[index]! + record.homeKwh
    totals.evKwh[next] = totals.evKwh[index]! + record.evKwh
    totals.energyConsumedKwh[next] =
      totals.energyConsumedKwh[index]! + record.homeKwh + record.evKwh
    totals.batteryChargeKwh[next] =
      totals.batteryChargeKwh[index]! + record.batteryChargeKwh
    totals.batteryDischargeKwh[next] =
      totals.batteryDischargeKwh[index]! + record.batteryDischargeKwh
    totals.gridImportKwh[next] = totals.gridImportKwh[index]! + record.gridImportKwh
    totals.gridExportKwh[next] = totals.gridExportKwh[index]! + record.gridExportKwh
    totals.importCostUsd[next] = totals.importCostUsd[index]! + record.importCost
    totals.exportCreditUsd[next] = totals.exportCreditUsd[index]! + record.exportCredit
    totals.counterfactualCostUsd[next] =
      totals.counterfactualCostUsd[index]! + record.counterfactualCost
    totals.savingsUsd[next] = totals.savingsUsd[index]! + record.savings
    totals.avoidedCo2Kg[next] = totals.avoidedCo2Kg[index]! + record.avoidedCo2Kg

    const totalValues = [
      totals.solarKwh[next],
      totals.homeKwh[next],
      totals.evKwh[next],
      totals.energyConsumedKwh[next],
      totals.batteryChargeKwh[next],
      totals.batteryDischargeKwh[next],
      totals.gridImportKwh[next],
      totals.gridExportKwh[next],
      totals.importCostUsd[next],
      totals.exportCreditUsd[next],
      totals.counterfactualCostUsd[next],
      totals.savingsUsd[next],
      totals.avoidedCo2Kg[next],
    ]
    if (!totalValues.every(Number.isFinite)) {
      throw new Error(`Record ${record.index} causes aggregate overflow`)
    }

    const batteryNetKw =
      batteryTransferKw(record, 'outgoing') - batteryTransferKw(record, 'incoming')
    chart.solarKw[next] = chart.solarKw[index]! + record.solarKw
    chart.homeKw[next] = chart.homeKw[index]! + record.homeKw
    chart.evKw[next] = chart.evKw[index]! + record.evKw
    chart.batteryNetKw[next] = chart.batteryNetKw[index]! + batteryNetKw
    chart.gridImportKw[next] = chart.gridImportKw[index]! + record.gridImportKw
    chart.gridExportKw[next] = chart.gridExportKw[index]! + record.gridExportKw
    if (![
      chart.solarKw[next],
      chart.homeKw[next],
      chart.evKw[next],
      chart.batteryNetKw[next],
      chart.gridImportKw[next],
      chart.gridExportKw[next],
    ].every(Number.isFinite)) {
      throw new Error(`Record ${record.index} causes history prefix overflow`)
    }
    cache.sourceRecordReads += 1
  }

  return cache
}

const getHistoryPrefixCache = (
  records: readonly EnergyInterval[],
): HistoryPrefixCache | null => {
  const existing = historyPrefixCaches.get(records)
  if (existing !== undefined) return existing
  if (!isStableHistoryLedger(records)) return null

  const cache = buildHistoryPrefixCache(records)
  historyPrefixCaches.set(records, cache)
  return cache
}

const prefixDifference = (
  cache: HistoryPrefixCache,
  prefix: Float64Array,
  start: number,
  end: number,
): number => {
  cache.prefixValueReads += 2
  const value = prefix[end]! - prefix[start]!
  if (!Number.isFinite(value)) throw new Error('History prefix range overflow')
  return value
}

const totalsFromPrefixes = (
  cache: HistoryPrefixCache,
  start: number,
  end: number,
): EnergyTotals => ({
  solarKwh: prefixDifference(cache, cache.totals.solarKwh, start, end),
  homeKwh: prefixDifference(cache, cache.totals.homeKwh, start, end),
  evKwh: prefixDifference(cache, cache.totals.evKwh, start, end),
  energyConsumedKwh: prefixDifference(cache, cache.totals.energyConsumedKwh, start, end),
  batteryChargeKwh: prefixDifference(cache, cache.totals.batteryChargeKwh, start, end),
  batteryDischargeKwh: prefixDifference(cache, cache.totals.batteryDischargeKwh, start, end),
  gridImportKwh: prefixDifference(cache, cache.totals.gridImportKwh, start, end),
  gridExportKwh: prefixDifference(cache, cache.totals.gridExportKwh, start, end),
  importCostUsd: prefixDifference(cache, cache.totals.importCostUsd, start, end),
  exportCreditUsd: prefixDifference(cache, cache.totals.exportCreditUsd, start, end),
  counterfactualCostUsd: prefixDifference(
    cache,
    cache.totals.counterfactualCostUsd,
    start,
    end,
  ),
  savingsUsd: prefixDifference(cache, cache.totals.savingsUsd, start, end),
  avoidedCo2Kg: prefixDifference(cache, cache.totals.avoidedCo2Kg, start, end),
})

const buildHistorySeriesFromPrefixes = (
  records: readonly EnergyInterval[],
  start: number,
  end: number,
  cache: HistoryPrefixCache,
): HistorySeriesPoint[] => {
  const recordCount = end - start
  const step = Math.ceil(recordCount / 2_048)
  const series: HistorySeriesPoint[] = []

  for (let bucketStart = start; bucketStart < end; bucketStart += step) {
    const bucketEnd = Math.min(end, bucketStart + step)
    const count = bucketEnd - bucketStart
    const finalRecord = records[bucketEnd - 1]!
    series.push({
      index: finalRecord.index,
      timestamp: finalRecord.iso,
      solarKw: prefixDifference(cache, cache.chart.solarKw, bucketStart, bucketEnd) / count,
      homeKw: prefixDifference(cache, cache.chart.homeKw, bucketStart, bucketEnd) / count,
      evKw: prefixDifference(cache, cache.chart.evKw, bucketStart, bucketEnd) / count,
      batteryNetKw:
        prefixDifference(cache, cache.chart.batteryNetKw, bucketStart, bucketEnd) / count,
      gridImportKw:
        prefixDifference(cache, cache.chart.gridImportKw, bucketStart, bucketEnd) / count,
      gridExportKw:
        prefixDifference(cache, cache.chart.gridExportKw, bucketStart, bucketEnd) / count,
    })
  }

  return series
}

/** @internal Test seam for verifying immutable-ledger prefix reuse. */
export const __getHistoryPrefixCacheStats = (
  records: readonly EnergyInterval[],
) => {
  const cache = historyPrefixCaches.get(records)
  return cache === undefined
    ? null
    : {
        buildCount: cache.buildCount,
        sourceRecordReads: cache.sourceRecordReads,
        prefixValueReads: cache.prefixValueReads,
      }
}

const buildHistorySeries = (
  records: readonly EnergyInterval[],
): HistorySeriesPoint[] => {
  const step = Math.ceil(records.length / 2_048)
  const series: HistorySeriesPoint[] = []

  for (let start = 0; start < records.length; start += step) {
    const end = Math.min(records.length, start + step)
    const finalRecord = records[end - 1]!
    let solarKw = 0
    let homeKw = 0
    let evKw = 0
    let batteryNetKw = 0
    let gridImportKw = 0
    let gridExportKw = 0

    for (let index = start; index < end; index += 1) {
      const record = records[index]!
      validateHistoryRecord(record, record.index)
      solarKw += record.solarKw
      homeKw += record.homeKw
      evKw += record.evKw
      batteryNetKw +=
        batteryTransferKw(record, 'outgoing') - batteryTransferKw(record, 'incoming')
      gridImportKw += record.gridImportKw
      gridExportKw += record.gridExportKw
      if (![
        solarKw,
        homeKw,
        evKw,
        batteryNetKw,
        gridImportKw,
        gridExportKw,
      ].every(Number.isFinite)) {
        throw new Error(`Record ${record.index} causes history bucket overflow`)
      }
    }

    const count = end - start
    series.push({
      index: finalRecord.index,
      timestamp: finalRecord.iso,
      solarKw: solarKw / count,
      homeKw: homeKw / count,
      evKw: evKw / count,
      batteryNetKw: batteryNetKw / count,
      gridImportKw: gridImportKw / count,
      gridExportKw: gridExportKw / count,
    })
  }

  return series
}

export const getLiveFrame = (
  records: readonly EnergyInterval[],
  index: number,
  fraction = 0,
): LiveFrame | null => {
  if (records.length === 0) return null

  const position = clampIndex(index, records.length)
  const record = records[position]!
  const next = records[position + 1] ?? record
  const boundedFraction = clampFraction(fraction)
  const interpolate = (start: number, end: number) =>
    interpolatePower(start, end, boundedFraction)

  const solarKw = interpolate(record.solarKw, next.solarKw)
  const homeKw = interpolate(record.homeKw, next.homeKw)
  const evKw = interpolate(record.evKw, next.evKw)
  const batteryFlow = resolveBidirectionalFlow(
    interpolate(
      batteryTransferKw(record, 'incoming'),
      batteryTransferKw(next, 'incoming'),
    ),
    interpolate(
      batteryTransferKw(record, 'outgoing'),
      batteryTransferKw(next, 'outgoing'),
    ),
  )
  const gridFlow = resolveBidirectionalFlow(
    interpolate(record.gridImportKw, next.gridImportKw),
    interpolate(record.gridExportKw, next.gridExportKw),
  )
  const batterySocKwh = interpolate(
    record.batterySocEndKwh,
    next.batterySocEndKwh,
  )

  const batteryDirection = batteryFlow.inboundKw > 0
    ? 'charging'
    : batteryFlow.outboundKw > 0
      ? 'discharging'
      : 'idle'
  const gridDirection = gridFlow.inboundKw > 0
    ? 'importing'
    : gridFlow.outboundKw > 0
      ? 'exporting'
      : 'idle'

  return {
    index: record.index,
    timestamp: record.iso,
    fraction: boundedFraction,
    tou: record.tou,
    dayType: record.dayType,
    conditions: {
      temperatureF: record.temperatureF,
      cloudFactor: record.cloudFactor,
      weatherState: record.weatherState,
      precipitationInches: record.precipitationInches,
    },
    nodes: [
      {
        id: 'solar',
        label: 'Solar',
        powerKw: solarKw,
        direction: solarKw > 0 ? 'outbound' : 'idle',
        status: solarKw > 0 ? 'generating' : 'idle',
      },
      {
        id: 'home',
        label: 'Home',
        powerKw: homeKw,
        direction: homeKw > 0 ? 'inbound' : 'idle',
        status: homeKw > 0 ? 'consuming' : 'idle',
      },
      {
        id: 'ev',
        label: 'EV',
        powerKw: evKw,
        direction: evKw > 0 ? 'inbound' : 'idle',
        status: evKw > 0 ? 'charging' : record.evAvailable ? 'connected' : 'away',
        isAvailable: record.evAvailable,
      },
      {
        id: 'battery',
        label: 'Battery',
        powerKw: batteryFlow.powerKw,
        direction: batteryDirection,
        status: batteryDirection,
        chargeKw: batteryFlow.inboundKw,
        dischargeKw: batteryFlow.outboundKw,
        socKwh: batterySocKwh,
        socPercent: Math.min(
          100,
          Math.max(
            0,
            batterySocKwh / LOS_ANGELES_AUGUST_2026.battery.capacityKwh * 100,
          ),
        ),
      },
      {
        id: 'grid',
        label: 'Grid',
        powerKw: gridFlow.powerKw,
        direction: gridDirection,
        status: isAnnualEnergyInterval(record) && record.gridStatus === 'outage'
          ? 'outage'
          : gridDirection,
        importKw: gridFlow.inboundKw,
        exportKw: gridFlow.outboundKw,
      },
    ],
    transfers: record.transfers.map((transfer) => ({ ...transfer })),
    appliancesKwh: { ...record.homeBreakdownKwh },
    accounting: {
      importRateUsdPerKwh: record.importRate,
      exportRateUsdPerKwh: record.exportRate,
      importCostUsd: record.importCost,
      exportCreditUsd: record.exportCredit,
      counterfactualCostUsd: record.counterfactualCost,
      savingsUsd: record.savings,
      avoidedCo2Kg: record.avoidedCo2Kg,
    },
  }
}

export const getHistoryView = (
  records: readonly EnergyInterval[],
  range: TimeRange,
  anchorIndex: number,
): HistoryView | null => {
  if (records.length === 0) return null

  const anchor = clampIndex(anchorIndex, records.length)
  const window = getRangeWindow(records, range, anchor)
  const selectedRecords = records.slice(window.start, window.end + 1)
  const startRecord = selectedRecords[0]!
  const endRecord = selectedRecords[selectedRecords.length - 1]!
  const prefixCache = historyPrefixCaches.get(records) ?? (
    selectedRecords.length >= historyPrefixThreshold
      ? getHistoryPrefixCache(records)
      : null
  )

  return {
    records: selectedRecords,
    range: {
      key: range,
      label: rangeLabels[range],
      startIndex: startRecord.index,
      endIndex: endRecord.index,
      startTimestamp: startRecord.iso,
      endTimestamp: endRecord.iso,
      previousAnchor: window.previousAnchor,
      nextAnchor: window.nextAnchor,
      canGoPrevious: window.previousAnchor !== null,
      canGoNext: window.nextAnchor !== null,
    },
    totals: prefixCache === null
      ? aggregateIntervals(selectedRecords)
      : totalsFromPrefixes(prefixCache, window.start, window.end + 1),
    series: prefixCache === null
      ? buildHistorySeries(selectedRecords)
      : buildHistorySeriesFromPrefixes(
          records,
          window.start,
          window.end + 1,
          prefixCache,
        ),
  }
}
