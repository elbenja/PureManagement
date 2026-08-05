import { describe, expect, expectTypeOf, it } from 'vitest'
import * as api from './index'
import {
  LOS_ANGELES_AUGUST_2026,
  accountInterval,
  advancePosition,
  aggregateIntervals,
  buildPrefixTotals,
  generateMonth,
  getHistoryView,
  getLiveFrame,
  getTrailingWindow,
  interpolatePower,
  validateMonth,
  type AccountingInput,
  type AccountingResult,
  type ClockSlot,
  type DayType,
  type EnergyInterval,
  type EnergyNode,
  type EnergyNodeView,
  type EnergyTotals,
  type HistoryRangeView,
  type HistorySeriesPoint,
  type HistoryView,
  type LiveAccountingView,
  type LiveFrame,
  type LoadCategory,
  type TimeRange,
  type TouPeriod,
  type Transfer,
} from './index'

const expectDeepFrozen = (value: unknown): void => {
  if (value === null || typeof value !== 'object') return

  expect(Object.isFrozen(value)).toBe(true)
  Object.values(value).forEach(expectDeepFrozen)
}

describe('public simulation API', () => {
  it('exports the scenario, generator, validation, and component selectors', () => {
    const records = generateMonth()

    expect(LOS_ANGELES_AUGUST_2026.id).toBe('woodland-hills-aug-2026-v1')
    expect(validateMonth(records)).toEqual([])
    expect(getLiveFrame(records, 0)?.index).toBe(0)
    expect(getHistoryView(records, '24h', 287)?.records).toHaveLength(288)
  })

  it('exports framework-neutral accounting, aggregation, and playback helpers', () => {
    const records = generateMonth().slice(0, 2)

    expect(aggregateIntervals(records).energyConsumedKwh).toBeGreaterThan(0)
    expect(buildPrefixTotals(records)).toHaveLength(3)
    expect(getTrailingWindow('24h', 1, 2)).toMatchObject({ start: 0, end: 1 })
    expect(advancePosition(0, 60_000, 8_928)).toBe(288)
    expect(interpolatePower(1, 3, 0.5)).toBe(2)
    expect(accountInterval({
      tou: 'base',
      homeKwh: 1,
      evKwh: 0,
      gridImportKwh: 1,
      gridExportKwh: 0,
    }).importCost).toBe(LOS_ANGELES_AUGUST_2026.tariff.energyRatesUsdPerKwh.base)
  })

  it('publishes a recursively frozen scenario', () => {
    expectDeepFrozen(LOS_ANGELES_AUGUST_2026)
  })

  it('cannot be mutated through a nested public property or alter generated totals', () => {
    const before = aggregateIntervals(generateMonth())
    const energyRates = LOS_ANGELES_AUGUST_2026.tariff.energyRatesUsdPerKwh as {
      base: number
    }

    expect(() => {
      energyRates.base = 99
    }).toThrow(TypeError)
    expect(LOS_ANGELES_AUGUST_2026.tariff.energyRatesUsdPerKwh.base).toBe(0.2654)
    expect(aggregateIntervals(generateMonth())).toEqual(before)
  })

  it('keeps simulation internals out of the public runtime surface', () => {
    expect(api).not.toHaveProperty('mulberry32')
    expect(api).not.toHaveProperty('generateHomeLoad')
    expect(api).not.toHaveProperty('routeInterval')
    expect(api).not.toHaveProperty('useEnergySimulation')
  })

  it('makes the public types accessible from the framework-neutral entry point', () => {
    expectTypeOf<TouPeriod>().toEqualTypeOf<'base' | 'low' | 'high'>()
    expectTypeOf<DayType>().toEqualTypeOf<'weekday' | 'weekend' | 'heatwave' | 'cloudy'>()
    expectTypeOf<EnergyNode>().toEqualTypeOf<'solar' | 'home' | 'ev' | 'battery' | 'grid'>()
    expectTypeOf<LoadCategory>().toBeString()
    expectTypeOf<ClockSlot>().toBeObject()
    expectTypeOf<Transfer>().toBeObject()
    expectTypeOf<EnergyInterval>().toBeObject()
    expectTypeOf<EnergyTotals>().toBeObject()
    expectTypeOf<TimeRange>().toEqualTypeOf<'24h' | '7d' | '31d'>()
    expectTypeOf<AccountingInput>().toBeObject()
    expectTypeOf<AccountingResult>().toBeObject()
    expectTypeOf<EnergyNodeView>().toBeObject()
    expectTypeOf<LiveAccountingView>().toBeObject()
    expectTypeOf<LiveFrame>().toBeObject()
    expectTypeOf<HistoryRangeView>().toBeObject()
    expectTypeOf<HistorySeriesPoint>().toBeObject()
    expectTypeOf<HistoryView>().toBeObject()
  })
})
