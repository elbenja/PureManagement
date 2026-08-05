import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { accountInterval } from './accounting'

const scenario = LOS_ANGELES_AUGUST_2026

describe('accountInterval', () => {
  it('calculates high-period costs, counterfactual cost, and savings', () => {
    const result = accountInterval({
      tou: 'high',
      homeKwh: 1,
      evKwh: 0.5,
      gridImportKwh: 0.4,
      gridExportKwh: 0,
    })

    expect(result.importRate).toBe(0.35124)
    expect(result.importCost).toBeCloseTo(0.140496, 12)
    expect(result.counterfactualCost).toBeCloseTo(0.52686, 12)
    expect(result.savings).toBeCloseTo(0.386364, 12)
  })

  it('uses the configured low-period rate for banked export credit and avoided emissions', () => {
    const result = accountInterval({
      tou: 'low',
      homeKwh: 0.2,
      evKwh: 0,
      gridImportKwh: 0,
      gridExportKwh: 0.5,
    })

    expect(result.exportRate).toBe(scenario.tariff.energyRatesUsdPerKwh.low)
    expect(result.exportCredit).toBeCloseTo(0.5 * result.exportRate, 12)
    expect(result.avoidedCo2Kg).toBeCloseTo((0.2 + 0.5) * 0.229, 12)
  })

  it('includes EV demand in base-period counterfactual costs while only grid flow changes simulated cost', () => {
    const result = accountInterval({
      tou: 'base',
      homeKwh: 0.3,
      evKwh: 0.4,
      gridImportKwh: 0.1,
      gridExportKwh: 0,
    })

    expect(result.counterfactualCost).toBeCloseTo(0.7 * scenario.tariff.energyRatesUsdPerKwh.base, 12)
    expect(result.importCost).toBeCloseTo(0.1 * scenario.tariff.energyRatesUsdPerKwh.base, 12)
    expect(result.savings).toBeCloseTo(0.6 * scenario.tariff.energyRatesUsdPerKwh.base, 12)
  })

  it.each([
    ['unknown TOU', { tou: 'peak', homeKwh: 0, evKwh: 0, gridImportKwh: 0, gridExportKwh: 0 }],
    ['negative energy', { tou: 'base', homeKwh: -0.1, evKwh: 0, gridImportKwh: 0, gridExportKwh: 0 }],
    ['NaN energy', { tou: 'base', homeKwh: Number.NaN, evKwh: 0, gridImportKwh: 0, gridExportKwh: 0 }],
    ['infinite energy', { tou: 'base', homeKwh: 0, evKwh: Number.POSITIVE_INFINITY, gridImportKwh: 0, gridExportKwh: 0 }],
  ])('rejects %s', (_description, input) => {
    expect(() => accountInterval(input as never)).toThrow(/invalid/i)
  })

  it('rejects simultaneous grid import and export', () => {
    expect(() => accountInterval({
      tou: 'base',
      homeKwh: 1,
      evKwh: 0,
      gridImportKwh: 0.1,
      gridExportKwh: 0.1,
    })).toThrow(/simultaneous grid import and export/i)
  })
})
