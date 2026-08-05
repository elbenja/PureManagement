import { describe, expect, it } from 'vitest'
import type { EnergyInterval } from '../domain/energy'
import { aggregateIntervals, buildPrefixTotals, getTrailingWindow } from './aggregate'

const interval = (overrides: Partial<EnergyInterval> = {}): EnergyInterval => ({
  index: 0,
  iso: '2026-08-01T00:00:00-07:00',
  day: 1,
  dayOfWeek: 6,
  minuteOfDay: 0,
  tou: 'base',
  dayType: 'weekend',
  temperatureF: 75,
  cloudFactor: 1,
  solarKw: 0,
  solarKwh: 1,
  homeKw: 0,
  homeKwh: 2,
  homeBreakdownKwh: {
    hvac: 0,
    waterHeating: 0,
    cooking: 0,
    laundry: 0,
    refrigeration: 0,
    lighting: 0,
    electronicsOther: 0,
  },
  evKw: 0,
  evKwh: 3,
  evAvailable: true,
  vehicleSocStartKwh: 50,
  vehicleSocEndKwh: 50,
  tripKwh: 0,
  batteryChargeKw: 0,
  batteryChargeKwh: 4,
  batteryDischargeKw: 0,
  batteryDischargeKwh: 5,
  batterySocStartKwh: 6,
  batterySocEndKwh: 6,
  chargeLossKwh: 0,
  dischargeLossKwh: 0,
  gridImportKw: 0,
  gridImportKwh: 6,
  gridExportKw: 0,
  gridExportKwh: 7,
  transfers: [],
  importRate: 0.2654,
  exportRate: 0.2654,
  importCost: 8,
  exportCredit: 9,
  counterfactualCost: 10,
  savings: 11,
  avoidedCo2Kg: 12,
  ...overrides,
})

describe('aggregateIntervals', () => {
  it('sums accounting and energy totals while excluding battery activity from energy consumed', () => {
    const totals = aggregateIntervals([interval(), interval({ homeKwh: 1, evKwh: 0, batteryChargeKwh: 20 })])

    expect(totals).toEqual({
      solarKwh: 2,
      homeKwh: 3,
      evKwh: 3,
      energyConsumedKwh: 6,
      batteryChargeKwh: 24,
      batteryDischargeKwh: 10,
      gridImportKwh: 12,
      gridExportKwh: 14,
      importCostUsd: 16,
      exportCreditUsd: 18,
      counterfactualCostUsd: 20,
      savingsUsd: 22,
      avoidedCo2Kg: 24,
    })
  })

  it('returns zero totals for an empty record set', () => {
    expect(aggregateIntervals([])).toEqual({
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
  })

  it('builds cumulative prefixes without mutating records', () => {
    const records = [interval(), interval({ homeKwh: 1, savings: -2 }), interval({ evKwh: 4 })]
    const before = structuredClone(records)
    const prefix = buildPrefixTotals(records)

    expect(prefix).toHaveLength(records.length + 1)
    prefix.forEach((total, index) => expect(total).toEqual(aggregateIntervals(records.slice(0, index))))
    expect(records).toEqual(before)
  })

  it('returns a single zero prefix for an empty record set', () => {
    expect(buildPrefixTotals([])).toHaveLength(1)
    expect(buildPrefixTotals([])[0]).toEqual(aggregateIntervals([]))
  })

  it.each([
    ['solarKwh', Number.NaN],
    ['gridImportKwh', Number.POSITIVE_INFINITY],
    ['batteryChargeKwh', -0.1],
    ['importCost', -1],
    ['savings', Number.NaN],
  ] as const)('rejects malformed record %s with its index', (field, value) => {
    expect(() => aggregateIntervals([interval({ [field]: value })])).toThrow(/record 0.*invalid/i)
  })
})

describe('getTrailingWindow', () => {
  it('returns a 24-hour window with both navigation directions available', () => {
    expect(getTrailingWindow('24h', 575, 8928)).toEqual({
      start: 288,
      end: 575,
      canGoPrevious: true,
      canGoNext: true,
    })
  })

  it('clips a 24-hour window to available prior records', () => {
    expect(getTrailingWindow('24h', 287, 8928)).toEqual({
      start: 0,
      end: 287,
      canGoPrevious: false,
      canGoNext: true,
    })
  })

  it('returns all 31 days at the final record', () => {
    expect(getTrailingWindow('31d', 8927, 8928)).toEqual({
      start: 0,
      end: 8927,
      canGoPrevious: false,
      canGoNext: false,
    })
  })

  it('rejects an unknown range', () => {
    expect(() => getTrailingWindow('month' as '24h', 0, 5)).toThrow(/invalid range/i)
  })

  it.each([-1, 1.5, 5])('rejects invalid anchor index %s', (anchorIndex) => {
    expect(() => getTrailingWindow('24h', anchorIndex, 5)).toThrow(/invalid anchorIndex/i)
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid record count %s', (recordCount) => {
    expect(() => getTrailingWindow('24h', 0, recordCount)).toThrow(/invalid recordCount/i)
  })
})
