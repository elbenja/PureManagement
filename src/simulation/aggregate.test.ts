import { describe, expect, expectTypeOf, it } from 'vitest'
import type { EnergyInterval } from '../domain/energy'
import { buildYearClock } from './yearClock'
import {
  aggregateIntervals,
  buildPrefixTotals,
  getRangeWindow,
  getTrailingWindow,
  rangeSlots,
  type FixedTimeRange,
} from './aggregate'

const interval = (overrides: Partial<EnergyInterval> = {}): EnergyInterval => ({
  index: 0,
  iso: '2026-08-01T00:00:00-07:00',
  year: 2026,
  month: 8,
  day: 1,
  dayOfYear: 213,
  dayOfWeek: 6,
  minuteOfDay: 0,
  utcOffset: '-07:00',
  tou: 'base',
  dayType: 'weekend',
  temperatureF: 75,
  cloudFactor: 1,
  weatherState: 'clear',
  precipitationInches: 0,
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

  it('rejects sparse records at their missing index', () => {
    const sparseRecords = new Array<EnergyInterval>(2)

    expect(() => aggregateIntervals(sparseRecords)).toThrow(/record 0.*invalid/i)
    expect(() => buildPrefixTotals(sparseRecords)).toThrow(/record 0.*invalid/i)
  })

  it.each([
    ['aggregateIntervals', aggregateIntervals],
    ['buildPrefixTotals', buildPrefixTotals],
  ])('rejects %s totals that overflow within a single record', (_name, aggregate) => {
    const overflowingRecord = interval({
      homeKwh: Number.MAX_VALUE,
      evKwh: Number.MAX_VALUE,
    })

    expect(() => aggregate([overflowingRecord])).toThrow(/record 0.*overflow/i)
  })

  it.each([
    ['aggregateIntervals', aggregateIntervals],
    ['buildPrefixTotals', buildPrefixTotals],
  ])('rejects %s totals that overflow across records', (_name, aggregate) => {
    const records = [
      interval({ solarKwh: Number.MAX_VALUE }),
      interval({ solarKwh: Number.MAX_VALUE }),
    ]

    expect(() => aggregate(records)).toThrow(/record 1.*overflow/i)
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
  it('accepts only fixed time ranges', () => {
    expectTypeOf<FixedTimeRange>().toEqualTypeOf<'24h' | '7d' | '30d' | '31d'>()
    expectTypeOf<Parameters<typeof getTrailingWindow>[0]>().toEqualTypeOf<FixedTimeRange>()
  })

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

  it('allows previous navigation only when a full 24-hour window precedes it', () => {
    expect(getTrailingWindow('24h', 574, 8928).canGoPrevious).toBe(false)
    expect(getTrailingWindow('24h', 575, 8928).canGoPrevious).toBe(true)
    expect(getTrailingWindow('24h', 288, 8928).canGoPrevious).toBe(false)
  })

  it('allows next navigation only when a full 24-hour window remains', () => {
    expect(getTrailingWindow('24h', 8800, 8928).canGoNext).toBe(false)
    expect(getTrailingWindow('24h', 8639, 8928).canGoNext).toBe(true)
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

  it.each(['toString', 'constructor', '__proto__'])('rejects prototype range key %s', (range) => {
    expect(() => getTrailingWindow(range as '24h', 0, 5)).toThrow(/invalid range/i)
  })

  it.each([-1, 1.5, 5])('rejects invalid anchor index %s', (anchorIndex) => {
    expect(() => getTrailingWindow('24h', anchorIndex, 5)).toThrow(/invalid anchorIndex/i)
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid record count %s', (recordCount) => {
    expect(() => getTrailingWindow('24h', 0, recordCount)).toThrow(/invalid recordCount/i)
  })
})

describe('getRangeWindow', () => {
  const annualRecords = buildYearClock() as unknown as readonly EnergyInterval[]
  const indexAt = (month: number, day: number, minuteOfDay: number) =>
    annualRecords.findIndex((record) =>
      record.month === month && record.day === day && record.minuteOfDay === minuteOfDay)

  it('keeps exact fixed-duration slot counts including legacy 31d', () => {
    expect(rangeSlots).toEqual({
      '24h': 288,
      '7d': 2_016,
      '30d': 8_640,
      '31d': 8_928,
    })
  })

  it('returns exactly 30 trailing days at an arbitrary February 15 anchor', () => {
    const anchor = indexAt(2, 15, 23 * 60 + 55)
    const window = getRangeWindow(annualRecords, '30d', anchor)

    expect(window.end - window.start + 1).toBe(8_640)
    expect(annualRecords[window.start]).toMatchObject({ month: 1, day: 17, minuteOfDay: 0 })
    expect(annualRecords[window.end]).toMatchObject({ month: 2, day: 15, minuteOfDay: 1_435 })
  })

  it('returns the full calendar month containing an arbitrary anchor including future records', () => {
    const anchor = indexAt(2, 15, 12 * 60)
    const window = getRangeWindow(annualRecords, 'month', anchor)

    expect(window.end - window.start + 1).toBe(8_064)
    expect(annualRecords[window.start]).toMatchObject({ month: 2, day: 1, minuteOfDay: 0 })
    expect(annualRecords[window.end]).toMatchObject({ month: 2, day: 28, minuteOfDay: 1_435 })
    expect(window).toMatchObject({
      previousAnchor: window.start - 1,
      nextAnchor: window.end + 1,
    })
  })

  it('derives daylight-saving calendar month sizes from the records', () => {
    const march = getRangeWindow(annualRecords, 'month', indexAt(3, 15, 12 * 60))
    const november = getRangeWindow(annualRecords, 'month', indexAt(11, 15, 12 * 60))

    expect(march.end - march.start + 1).toBe(8_916)
    expect(november.end - november.start + 1).toBe(8_652)
  })

  it('finds every calendar month boundary and limits navigation at year edges', () => {
    for (let month = 1; month <= 12; month += 1) {
      const anchor = annualRecords.findIndex((record) => record.month === month && record.day === 15)
      const window = getRangeWindow(annualRecords, 'month', anchor)

      expect(annualRecords[window.start]!.month).toBe(month)
      expect(annualRecords[window.start]!.day).toBe(1)
      expect(annualRecords[window.end]!.month).toBe(month)
      expect(annualRecords[window.end + 1]?.month).not.toBe(month)
      expect(window.previousAnchor).toBe(month === 1 ? null : window.start - 1)
      expect(window.nextAnchor).toBe(month === 12 ? null : window.end + 1)
    }
  })

  it('returns year-to-date through the anchor without period navigation', () => {
    const anchor = indexAt(9, 8, 10 * 60)

    expect(getRangeWindow(annualRecords, 'ytd', anchor)).toEqual({
      start: 0,
      end: anchor,
      previousAnchor: null,
      nextAnchor: null,
    })
  })

  it('supports partial initial fixed windows and full-period navigation anchors', () => {
    expect(getRangeWindow(annualRecords, '30d', 100)).toEqual({
      start: 0,
      end: 100,
      previousAnchor: null,
      nextAnchor: 8_740,
    })

    expect(getRangeWindow(annualRecords, '24h', 575)).toEqual({
      start: 288,
      end: 575,
      previousAnchor: 287,
      nextAnchor: 863,
    })
    expect(getRangeWindow(annualRecords, '24h', 574).previousAnchor).toBe(286)
  })

  it.each([
    ['24h', 288],
    ['30d', 8_640],
  ] as const)('round-trips an initial partial %s window through next and previous', (range, next) => {
    const initial = getRangeWindow(annualRecords, range, 0)
    const forward = getRangeWindow(annualRecords, range, initial.nextAnchor!)
    const backward = getRangeWindow(annualRecords, range, forward.previousAnchor!)

    expect(initial.nextAnchor).toBe(next)
    expect(forward.previousAnchor).toBe(0)
    expect(backward).toEqual(initial)
  })

  it('accepts a consecutive canonical ledger slice beginning above index zero', () => {
    const slice = annualRecords.slice(100, 500)

    expect(getRangeWindow(slice, '24h', 399)).toMatchObject({
      start: 112,
      end: 399,
    })
  })

  it('rejects empty, unknown, out-of-bounds, and non-integer inputs', () => {
    expect(() => getRangeWindow([], '24h', 0)).toThrow(/records/i)
    expect(() => getRangeWindow(annualRecords, 'bogus' as '24h', 0)).toThrow(/range/i)
    expect(() => getRangeWindow(annualRecords, '24h', -1)).toThrow(/anchor/i)
    expect(() => getRangeWindow(annualRecords, '24h', annualRecords.length)).toThrow(/anchor/i)
    expect(() => getRangeWindow(annualRecords, '24h', 1.5)).toThrow(/anchor/i)
  })

  it.each([
    ['index', { index: 1.5 }],
    ['year', { year: Number.NaN }],
    ['month', { month: 13 }],
    ['day', { day: 0 }],
  ] as const)('rejects malformed canonical %s fields', (_field, overrides) => {
    expect(() => getRangeWindow([interval(overrides)], 'month', 0)).toThrow(/record 0/i)
  })

  it('does not mutate records while resolving a range', () => {
    const source = annualRecords.slice()
    const before = source.slice()

    getRangeWindow(source, 'month', indexAt(8, 15, 12 * 60))

    expect(source).toEqual(before)
    expect(source.every((record, index) => record === before[index])).toBe(true)
  })

  it('caches successful structural validation for a deeply frozen ledger', () => {
    let indexReads = 0
    const source = Object.freeze([0, 1].map((index) => {
      const record = interval({ index })
      Object.defineProperty(record, 'index', {
        enumerable: true,
        get: () => {
          indexReads += 1
          return index
        },
      })
      return Object.freeze(record)
    }))

    getRangeWindow(source, '24h', 1)
    const readsAfterFirstValidation = indexReads
    getRangeWindow(source, '24h', 1)

    expect(readsAfterFirstValidation).toBe(source.length)
    expect(indexReads).toBe(readsAfterFirstValidation)
  })

  it('revalidates mutable ledgers after a successful call', () => {
    const source = [interval()]
    getRangeWindow(source, 'month', 0)
    source[0]!.month = 13

    expect(() => getRangeWindow(source, 'month', 0)).toThrow(/record 0/i)
  })
})
