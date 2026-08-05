import type {
  DayType,
  EnergyInterval,
  LoadCategory,
  TouPeriod,
  Transfer,
} from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import {
  aggregateIntervals,
  getTrailingWindow,
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
  status: 'importing' | 'exporting' | 'idle'
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
  label: 'Last 24h' | 'Last week' | 'Last month'
  startIndex: number
  endIndex: number
  startTimestamp: string
  endTimestamp: string
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
  '31d': 'Last month',
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
        status: gridDirection,
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
  const window = getTrailingWindow(range, anchor, records.length)
  const selectedRecords = records.slice(window.start, window.end + 1)
  const startRecord = selectedRecords[0]!
  const endRecord = selectedRecords[selectedRecords.length - 1]!

  return {
    records: selectedRecords,
    range: {
      key: range,
      label: rangeLabels[range],
      startIndex: startRecord.index,
      endIndex: endRecord.index,
      startTimestamp: startRecord.iso,
      endTimestamp: endRecord.iso,
      canGoPrevious: window.canGoPrevious,
      canGoNext: window.canGoNext,
    },
    totals: aggregateIntervals(selectedRecords),
    series: selectedRecords.map((record) => ({
      index: record.index,
      timestamp: record.iso,
      solarKw: record.solarKw,
      homeKw: record.homeKw,
      evKw: record.evKw,
      batteryNetKw:
        batteryTransferKw(record, 'outgoing') -
        batteryTransferKw(record, 'incoming'),
      gridImportKw: record.gridImportKw,
      gridExportKw: record.gridExportKw,
    })),
  }
}
