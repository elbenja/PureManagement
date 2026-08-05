import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { generateMonth } from '../simulation/generateMonth'
import { rangeSlots } from '../simulation/aggregate'
import { getHistoryView, getLiveFrame } from './views'

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
      chargeKw: records[batteryChargingIndex]!.batteryChargeKw,
      dischargeKw: 0,
      socPercent:
        records[batteryChargingIndex]!.batterySocEndKwh /
        LOS_ANGELES_AUGUST_2026.battery.capacityKwh * 100,
    })
    expect(getLiveFrame(records, batteryDischargingIndex)!.nodes[3]).toMatchObject({
      direction: 'discharging',
      status: 'discharging',
    })
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
    expect(view.series[0]).toEqual({
      index: records[6_912]!.index,
      timestamp: records[6_912]!.iso,
      solarKw: records[6_912]!.solarKw,
      homeKw: records[6_912]!.homeKw,
      evKw: records[6_912]!.evKw,
      batteryNetKw:
        records[6_912]!.batteryDischargeKw - records[6_912]!.batteryChargeKw,
      gridImportKw: records[6_912]!.gridImportKw,
      gridExportKw: records[6_912]!.gridExportKw,
    })
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

  it('does not mutate the source array while creating views', () => {
    const source = records.slice(0, 400)
    const before = source.slice()

    getLiveFrame(source, 20, 0.5)
    getHistoryView(source, '24h', 350)

    expect(source).toEqual(before)
    expect(source.every((record, index) => record === before[index])).toBe(true)
  })
})
