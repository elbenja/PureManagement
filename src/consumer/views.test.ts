import { beforeAll, describe, expect, it } from 'vitest'
import type { EnergyInterval } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { generateMonth } from '../simulation/generateMonth'
import { generateYear } from '../simulation/generateYear'
import {
  aggregateIntervals,
  rangeSlots,
  type EnergyTotals,
} from '../simulation/aggregate'
import * as aggregateModule from '../simulation/aggregate'
import * as viewsModule from './views'
import { getHistoryView, getLiveFrame, type HistoryView } from './views'

const batteryTransferKw = (
  record: ReturnType<typeof generateMonth>[number],
  direction: 'incoming' | 'outgoing',
) => record.transfers
  .filter((transfer) => direction === 'incoming'
    ? transfer.destination === 'battery'
    : transfer.source === 'battery')
  .reduce((total, transfer) => total + transfer.kw, 0)

describe('component-ready views', () => {
  const records = generateMonth()

  it('exposes one live frame without requiring component calculations', () => {
    const frame = getLiveFrame(records, 144)

    expect(frame).not.toBeNull()
    expect(frame).toMatchObject({
      index: 144,
      timestamp: records[144]!.iso,
      tou: records[144]!.tou,
      dayType: records[144]!.dayType,
      conditions: {
        temperatureF: records[144]!.temperatureF,
        cloudFactor: records[144]!.cloudFactor,
        weatherState: records[144]!.weatherState,
        precipitationInches: records[144]!.precipitationInches,
      },
    })
    expect(frame!.nodes.map((node) => node.id)).toEqual([
      'solar',
      'home',
      'ev',
      'battery',
      'grid',
    ])
    expect(frame!.transfers).toEqual(records[144]!.transfers)
    expect(frame!.appliancesKwh).toEqual(records[144]!.homeBreakdownKwh)
    expect(frame!.accounting).toEqual({
      importRateUsdPerKwh: records[144]!.importRate,
      exportRateUsdPerKwh: records[144]!.exportRate,
      importCostUsd: records[144]!.importCost,
      exportCreditUsd: records[144]!.exportCredit,
      counterfactualCostUsd: records[144]!.counterfactualCost,
      savingsUsd: records[144]!.savings,
      avoidedCo2Kg: records[144]!.avoidedCo2Kg,
    })
  })

  it('interpolates only power and battery state while preserving interval facts', () => {
    const index = records.findIndex((record, recordIndex) => {
      const next = records[recordIndex + 1]
      return next !== undefined && (
        record.solarKw !== next.solarKw ||
        record.homeKw !== next.homeKw ||
        record.batterySocEndKwh !== next.batterySocEndKwh
      )
    })
    const record = records[index]!
    const next = records[index + 1]!
    const frame = getLiveFrame(records, index, 0.25)!

    expect(frame.fraction).toBe(0.25)
    expect(frame.nodes[0].powerKw).toBeCloseTo(record.solarKw + (next.solarKw - record.solarKw) * 0.25)
    expect(frame.nodes[1].powerKw).toBeCloseTo(record.homeKw + (next.homeKw - record.homeKw) * 0.25)
    expect(frame.nodes[2].powerKw).toBeCloseTo(record.evKw + (next.evKw - record.evKw) * 0.25)
    expect(frame.nodes[3]).toMatchObject({
      id: 'battery',
      socKwh: record.batterySocEndKwh +
        (next.batterySocEndKwh - record.batterySocEndKwh) * 0.25,
    })
    expect(frame.appliancesKwh).toEqual(record.homeBreakdownKwh)
    expect(frame.accounting.savingsUsd).toBe(record.savings)
    expect(frame.transfers).toEqual(record.transfers)
    expect(frame.conditions.weatherState).toBe(record.weatherState)
    expect(frame.conditions.precipitationInches).toBe(record.precipitationInches)
  })

  it('interpolates battery display power from canonical AC-side transfers', () => {
    const index = records.findIndex((record, recordIndex) => {
      const next = records[recordIndex + 1]
      return next !== undefined && (
        batteryTransferKw(record, 'incoming') !== batteryTransferKw(next, 'incoming') ||
        batteryTransferKw(record, 'outgoing') !== batteryTransferKw(next, 'outgoing')
      )
    })
    const record = records[index]!
    const next = records[index + 1]!
    const fraction = 0.25
    const expectedIncomingKw = batteryTransferKw(record, 'incoming') +
      (batteryTransferKw(next, 'incoming') - batteryTransferKw(record, 'incoming')) * fraction
    const expectedOutgoingKw = batteryTransferKw(record, 'outgoing') +
      (batteryTransferKw(next, 'outgoing') - batteryTransferKw(record, 'outgoing')) * fraction
    const expectedNetKw = expectedOutgoingKw - expectedIncomingKw

    expect(getLiveFrame(records, index, fraction)!.nodes[3]).toMatchObject({
      chargeKw: Math.max(0, -expectedNetKw),
      dischargeKw: Math.max(0, expectedNetKw),
      powerKw: Math.abs(expectedNetKw),
    })
  })

  it('provides explicit flow directions, statuses, and battery percentage', () => {
    const batteryChargingIndex = records.findIndex((record) => record.batteryChargeKw > 0)
    const batteryDischargingIndex = records.findIndex((record) => record.batteryDischargeKw > 0)
    const gridImportingIndex = records.findIndex((record) => record.gridImportKw > 0)
    const gridExportingIndex = records.findIndex((record) => record.gridExportKw > 0)

    expect(getLiveFrame(records, batteryChargingIndex)!.nodes[3]).toMatchObject({
      id: 'battery',
      direction: 'charging',
      status: 'charging',
      chargeKw: batteryTransferKw(records[batteryChargingIndex]!, 'incoming'),
      dischargeKw: 0,
      socPercent:
        records[batteryChargingIndex]!.batterySocEndKwh /
        LOS_ANGELES_AUGUST_2026.battery.capacityKwh * 100,
    })
    expect(batteryTransferKw(records[batteryChargingIndex]!, 'incoming')).not.toBeCloseTo(
      records[batteryChargingIndex]!.batteryChargeKw,
      10,
    )
    expect(getLiveFrame(records, batteryDischargingIndex)!.nodes[3]).toMatchObject({
      direction: 'discharging',
      status: 'discharging',
      chargeKw: 0,
      dischargeKw: batteryTransferKw(records[batteryDischargingIndex]!, 'outgoing'),
      powerKw: batteryTransferKw(records[batteryDischargingIndex]!, 'outgoing'),
    })
    expect(batteryTransferKw(records[batteryDischargingIndex]!, 'outgoing')).not.toBeCloseTo(
      records[batteryDischargingIndex]!.batteryDischargeKw,
      10,
    )
    expect(getLiveFrame(records, gridImportingIndex)!.nodes[4]).toMatchObject({
      id: 'grid',
      direction: 'importing',
      status: 'importing',
      importKw: records[gridImportingIndex]!.gridImportKw,
      exportKw: 0,
    })
    expect(getLiveFrame(records, gridExportingIndex)!.nodes[4]).toMatchObject({
      direction: 'exporting',
      status: 'exporting',
    })
  })

  it('clamps live indexes and does not interpolate beyond the final record', () => {
    expect(getLiveFrame(records, -200)!.index).toBe(records[0]!.index)

    const final = records.at(-1)!
    const frame = getLiveFrame(records, records.length + 100, 1)!
    expect(frame.index).toBe(final.index)
    expect(frame.timestamp).toBe(final.iso)
    expect(frame.nodes[0].powerKw).toBe(final.solarKw)
    expect(frame.nodes[3]).toMatchObject({ socKwh: final.batterySocEndKwh })
  })

  it('returns null explicitly when no live or historical data exists', () => {
    expect(getLiveFrame([], 0)).toBeNull()
    expect(getHistoryView([], '24h', 0)).toBeNull()
  })

  it('returns a bounded historical view with precomputed totals and raw chart series', () => {
    const view = getHistoryView(records, '7d', 8_927)!

    expect(view.records).toHaveLength(2_016)
    expect(view.range).toMatchObject({
      key: '7d',
      label: 'Last week',
      startIndex: 6_912,
      endIndex: 8_927,
      startTimestamp: records[6_912]!.iso,
      endTimestamp: records[8_927]!.iso,
      canGoNext: false,
    })
    expect(view.totals.energyConsumedKwh).toBeGreaterThan(0)
    expect(view.series).toHaveLength(view.records.length)
    const firstPoint = view.series[0]!
    const expectedFirstPoint = {
      index: records[6_912]!.index,
      timestamp: records[6_912]!.iso,
      solarKw: records[6_912]!.solarKw,
      homeKw: records[6_912]!.homeKw,
      evKw: records[6_912]!.evKw,
      batteryNetKw:
        records[6_912]!.batteryDischargeKw - records[6_912]!.batteryChargeKw,
      gridImportKw: records[6_912]!.gridImportKw,
      gridExportKw: records[6_912]!.gridExportKw,
    }
    expect(firstPoint).toMatchObject({
      index: expectedFirstPoint.index,
      timestamp: expectedFirstPoint.timestamp,
    })
    for (const key of [
      'solarKw',
      'homeKw',
      'evKw',
      'batteryNetKw',
      'gridImportKw',
      'gridExportKw',
    ] as const) {
      expect(firstPoint[key]).toBeCloseTo(expectedFirstPoint[key], 8)
    }
  })

  it('charts battery net power from the same AC-side transfers as the live flow map', () => {
    const chargingIndex = records.findIndex((record) => record.batteryChargeKw > 0)
    const dischargingIndex = records.findIndex((record) => record.batteryDischargeKw > 0)

    for (const index of [chargingIndex, dischargingIndex]) {
      const view = getHistoryView(records, '24h', index)!
      const point = view.series.find((candidate) => candidate.index === index)!
      const expectedNetKw = batteryTransferKw(records[index]!, 'outgoing') -
        batteryTransferKw(records[index]!, 'incoming')

      expect(point.batteryNetKw).toBeCloseTo(expectedNetKw, 12)
    }
  })

  it('clamps history anchors and supports partial initial windows', () => {
    const initial = getHistoryView(records, '24h', -10)!
    expect(initial.records).toEqual(records.slice(0, 1))
    expect(initial.range).toMatchObject({
      startIndex: 0,
      endIndex: 0,
      canGoPrevious: false,
      canGoNext: true,
    })

    const final = getHistoryView(records, '24h', Number.MAX_SAFE_INTEGER)!
    expect(final.records).toEqual(records.slice(-rangeSlots['24h']))
    expect(final.range.endIndex).toBe(records.length - 1)
    expect(final.range.canGoNext).toBe(false)
  })

  it('preserves canonical indexes when selecting from a valid ledger slice', () => {
    const source = records.slice(100, 500)
    const view = getHistoryView(source, '24h', 399)!

    expect(view.records).toEqual(source.slice(112, 400))
    expect(view.range).toMatchObject({
      startIndex: 212,
      endIndex: 499,
    })
    expect(view.series[0]!.index).toBe(212)
    expect(view.series.at(-1)!.index).toBe(499)
  })

  it('does not mutate the source array while creating views', () => {
    const source = records.slice(0, 400)
    const before = source.slice()

    getLiveFrame(source, 20, 0.5)
    getHistoryView(source, '24h', 350)

    expect(source).toEqual(before)
    expect(source.every((record, index) => record === before[index])).toBe(true)
  })
})

describe('annual history views', () => {
  let records: readonly EnergyInterval[]

  beforeAll(() => {
    records = generateYear()
  })

  const indexAt = (month: number, day: number, minuteOfDay: number) =>
    records.findIndex((record) =>
      record.month === month && record.day === day && record.minuteOfDay === minuteOfDay)

  it('exposes the simulated outage through the live grid node', () => {
    const outageIndex = indexAt(1, 15, 15 * 60)
    const frame = getLiveFrame(records, outageIndex)!
    expect(frame.nodes[4]).toMatchObject({
      id: 'grid',
      status: 'outage',
      powerKw: 0,
      importKw: 0,
      exportKw: 0,
    })
  })

  const expectViewToMatchDirectAggregation = (view: HistoryView) => {
    const expectedTotals = aggregateIntervals(view.records)
    for (const key of Object.keys(expectedTotals) as (keyof EnergyTotals)[]) {
      expect(view.totals[key]).toBeCloseTo(expectedTotals[key], 8)
    }

    const step = Math.ceil(view.records.length / 2_048)
    expect(view.series).toHaveLength(Math.ceil(view.records.length / step))
    view.series.forEach((point, pointIndex) => {
      const bucket = view.records.slice(pointIndex * step, (pointIndex + 1) * step)
      const finalRecord = bucket.at(-1)!
      const average = (select: (record: EnergyInterval) => number) =>
        bucket.reduce((total, record) => total + select(record), 0) / bucket.length

      expect(point.index).toBe(finalRecord.index)
      expect(point.timestamp).toBe(finalRecord.iso)
      expect(point.solarKw).toBeCloseTo(average((record) => record.solarKw), 8)
      expect(point.homeKw).toBeCloseTo(average((record) => record.homeKw), 8)
      expect(point.evKw).toBeCloseTo(average((record) => record.evKw), 8)
      expect(point.batteryNetKw).toBeCloseTo(average((record) =>
        batteryTransferKw(record, 'outgoing') - batteryTransferKw(record, 'incoming')), 8)
      expect(point.gridImportKw).toBeCloseTo(average((record) => record.gridImportKw), 8)
      expect(point.gridExportKw).toBeCloseTo(average((record) => record.gridExportKw), 8)
    })
  }

  it('keeps a cold 24h query bounded to its selected records without building prefixes', () => {
    const getValidationStats = (
      aggregateModule as typeof aggregateModule & {
        __getRecordRangeValidationStats?: (source: readonly EnergyInterval[]) => {
          recordReads: number
        } | null
      }
    ).__getRecordRangeValidationStats
    const getPrefixStats = (
      viewsModule as typeof viewsModule & {
        __getHistoryPrefixCacheStats?: (source: readonly EnergyInterval[]) => unknown
      }
    ).__getHistoryPrefixCacheStats

    expect(getValidationStats).toBeTypeOf('function')
    expect(getPrefixStats).toBeTypeOf('function')
    const before = getValidationStats!(records)?.recordReads ?? 0
    const view = getHistoryView(records, '24h', records.length - 1)!
    const after = getValidationStats!(records)!.recordReads

    expect(view.records).toHaveLength(288)
    expect(after - before).toBeLessThanOrEqual(288)
    expect(getPrefixStats!(records)).toBeNull()
  })

  it.each([
    ['24h', 'Last 24h'],
    ['7d', 'Last week'],
    ['30d', 'Last 30 days'],
    ['31d', 'Last month'],
    ['month', 'Calendar month'],
    ['ytd', 'Year to date'],
  ] as const)('labels %s as %s', (range, label) => {
    expect(getHistoryView(records, range, indexAt(8, 15, 12 * 60))!.range.label).toBe(label)
  })

  it('selects annual 30d, calendar-month, and year-to-date records with exact totals', () => {
    const anchor = indexAt(2, 15, 23 * 60 + 55)
    const trailing = getHistoryView(records, '30d', anchor)!
    const month = getHistoryView(records, 'month', anchor)!
    const ytd = getHistoryView(records, 'ytd', anchor)!

    expect(trailing.records).toHaveLength(8_640)
    expect(month.records).toHaveLength(8_064)
    expect(ytd.records).toHaveLength(anchor + 1)
    for (const view of [trailing, month, ytd]) {
      const expected = aggregateIntervals(view.records)
      for (const key of Object.keys(expected) as (keyof EnergyTotals)[]) {
        expect(view.totals[key]).toBeCloseTo(expected[key], 8)
      }
    }
    expect(month.range).toMatchObject({
      startIndex: month.records[0]!.index,
      endIndex: month.records.at(-1)!.index,
      previousAnchor: month.records[0]!.index - 1,
      nextAnchor: month.records.at(-1)!.index + 1,
      canGoPrevious: true,
      canGoNext: true,
    })
    expect(ytd.range).toMatchObject({
      previousAnchor: null,
      nextAnchor: null,
      canGoPrevious: false,
      canGoNext: false,
    })
  })

  it('samples long ranges into deterministic final-stamped average buckets', () => {
    const anchor = indexAt(2, 15, 23 * 60 + 55)
    const first = getHistoryView(records, '30d', anchor)!
    const second = getHistoryView(records, '30d', anchor)!
    const step = Math.ceil(first.records.length / 2_048)
    const firstBucket = first.records.slice(0, step)
    const average = (select: (record: EnergyInterval) => number) =>
      firstBucket.reduce((total, record) => total + select(record), 0) / firstBucket.length

    expect(first.series.length).toBeLessThanOrEqual(2_048)
    expect(first.series).toEqual(second.series)
    const expectedFirstPoint = {
      index: firstBucket.at(-1)!.index,
      timestamp: firstBucket.at(-1)!.iso,
      solarKw: average((record) => record.solarKw),
      homeKw: average((record) => record.homeKw),
      evKw: average((record) => record.evKw),
      batteryNetKw: average((record) =>
        batteryTransferKw(record, 'outgoing') - batteryTransferKw(record, 'incoming')),
      gridImportKw: average((record) => record.gridImportKw),
      gridExportKw: average((record) => record.gridExportKw),
    }
    expect(first.series[0]).toMatchObject({
      index: expectedFirstPoint.index,
      timestamp: expectedFirstPoint.timestamp,
    })
    for (const key of [
      'solarKw',
      'homeKw',
      'evKw',
      'batteryNetKw',
      'gridImportKw',
      'gridExportKw',
    ] as const) {
      expect(first.series[0]![key]).toBeCloseTo(expectedFirstPoint[key], 8)
    }
    expect(first.series.at(-1)).toMatchObject({
      index: first.records.at(-1)!.index,
      timestamp: first.records.at(-1)!.iso,
    })
  })

  it('matches direct totals and bucket averages across cached annual ranges and slices', () => {
    getHistoryView(records, 'ytd', records.length - 1)
    const annualCases = [
      getHistoryView(records, '24h', indexAt(8, 15, 12 * 60))!,
      getHistoryView(records, 'month', indexAt(3, 15, 12 * 60))!,
      getHistoryView(records, 'ytd', records.length - 1)!,
    ]
    const frozenSlice = Object.freeze(records.slice(100, 500))
    const sliceView = getHistoryView(frozenSlice, '24h', frozenSlice.length - 1)!

    for (const view of [...annualCases, sliceView]) {
      expectViewToMatchDirectAggregation(view)
    }
  })

  it('reuses compact prefixes for warm late-year YTD queries', () => {
    const getCacheStats = (
      viewsModule as typeof viewsModule & {
        __getHistoryPrefixCacheStats?: (source: readonly EnergyInterval[]) => {
          buildCount: number
          sourceRecordReads: number
          prefixValueReads: number
        } | null
      }
    ).__getHistoryPrefixCacheStats
    const getValidationStats = (
      aggregateModule as typeof aggregateModule & {
        __getRecordRangeValidationStats?: (source: readonly EnergyInterval[]) => {
          recordReads: number
          calendarBoundaryReads: number
        } | null
      }
    ).__getRecordRangeValidationStats

    expect(getCacheStats).toBeTypeOf('function')
    expect(getValidationStats).toBeTypeOf('function')
    getHistoryView(records, 'ytd', records.length - 1)
    const warmed = getCacheStats!(records)!
    const warmedValidation = getValidationStats!(records)!
    getHistoryView(records, '24h', records.length - 1)
    const afterShortRange = getCacheStats!(records)!
    getHistoryView(records, 'ytd', records.length - 1)
    const repeated = getCacheStats!(records)!
    const repeatedValidation = getValidationStats!(records)!

    expect(repeated.buildCount).toBe(1)
    expect(warmed.sourceRecordReads).toBe(records.length)
    expect(afterShortRange.sourceRecordReads).toBe(warmed.sourceRecordReads)
    expect(afterShortRange.prefixValueReads).toBeGreaterThan(warmed.prefixValueReads)
    expect(afterShortRange.prefixValueReads - warmed.prefixValueReads).toBeLessThanOrEqual(
      2 * (13 + 6 * 288),
    )
    expect(repeated.sourceRecordReads).toBe(warmed.sourceRecordReads)
    expect(warmedValidation.calendarBoundaryReads).toBeGreaterThan(0)
    expect(repeatedValidation.calendarBoundaryReads).toBe(warmedValidation.calendarBoundaryReads)
    expect(repeated.prefixValueReads - afterShortRange.prefixValueReads).toBeLessThanOrEqual(
      2 * (13 + 6 * 2_048),
    )
  })

  it('does not cache accessor-backed frozen history values', () => {
    let solarKw = records[0]!.solarKw
    const record = { ...records[0]! }
    Object.defineProperty(record, 'solarKw', {
      enumerable: true,
      get: () => solarKw,
    })
    const source = Object.freeze([Object.freeze(record)])

    getHistoryView(source, '24h', 0)
    solarKw = Number.NaN

    expect(() => getHistoryView(source, '24h', 0)).toThrow(/record 0.*history/i)
  })

  it('treats malformed values outside a short selection equally for frozen and mutable ledgers', () => {
    const mutable = generateMonth().slice(0, 400).map((record, index) =>
      index === 0 ? { ...record, solarKw: Number.NaN } : record)
    const frozen = Object.freeze(mutable.map((record) =>
      Object.isFrozen(record) ? record : Object.freeze(record)))

    expect(() => getHistoryView(mutable, '24h', 399)).not.toThrow()
    expect(() => getHistoryView(frozen, '24h', 399)).not.toThrow()
  })

  it('keeps the legacy August 7d series raw', () => {
    const august = generateMonth()
    const view = getHistoryView(august, '7d', august.length - 1)!

    expect(view.records).toHaveLength(2_016)
    expect(view.series).toHaveLength(2_016)
    expect(view.series.map((point) => point.index)).toEqual(view.records.map((record) => record.index))
  })

  it('rejects malformed annual history records', () => {
    const malformed = records.slice(0, 10).map((record) => ({ ...record }))
    malformed[5]!.index = 4

    expect(() => getHistoryView(malformed, 'month', 5)).toThrow(/record 5/i)
  })

  it('rejects non-finite chart inputs instead of returning malformed series', () => {
    const malformed = records.slice(0, 10).map((record) => ({ ...record }))
    malformed[5]!.solarKw = Number.NaN

    expect(() => getHistoryView(malformed, '24h', 9)).toThrow(/record 5.*history/i)
  })

  it('rejects overflow in a sampled history bucket', () => {
    const source = generateMonth().slice(0, 2_049).map((record, index) =>
      index < 2 ? { ...record, solarKw: Number.MAX_VALUE } : record)

    expect(() => getHistoryView(source, '31d', source.length - 1)).toThrow(/overflow/i)
  })

  it('rejects overflow in the final short sampled history bucket', () => {
    const source = generateMonth().slice(0, 4_097).map((record, index, selected) =>
      index >= selected.length - 2 ? { ...record, solarKw: Number.MAX_VALUE } : record)

    expect(() => getHistoryView(source, '31d', source.length - 1)).toThrow(/overflow/i)
  })

  it('rejects overflow produced by a cached prefix difference', () => {
    const source = Object.freeze(generateMonth().slice(0, 289).map((record, index) =>
      Object.freeze({
        ...record,
        savings: index === 0 ? -Number.MAX_VALUE : index <= 2 ? Number.MAX_VALUE : 0,
      })))

    expect(() => getHistoryView(source, '24h', 288)).toThrow(/overflow/i)
  })

  it('does not mutate annual records while selecting and sampling', () => {
    const before = records.slice()

    getHistoryView(records, '30d', indexAt(8, 15, 12 * 60))
    getHistoryView(records, 'month', indexAt(3, 15, 12 * 60))
    getHistoryView(records, 'ytd', records.length - 1)

    expect(records).toEqual(before)
    expect(records.every((record, index) => record === before[index])).toBe(true)
  })
})
