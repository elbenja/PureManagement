import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { accountInterval, type AccountingScenario } from './accounting'

const scenario = LOS_ANGELES_AUGUST_2026

describe('accountInterval', () => {
  it('preserves legacy defaults and accepts the annual scenario without mutation', () => {
    const input = {
      tou: 'high' as const,
      homeKwh: 1,
      evKwh: 0.5,
      gridImportKwh: 0.4,
      gridExportKwh: 0,
    }
    const augustBefore = JSON.stringify(LOS_ANGELES_AUGUST_2026)
    const annualBefore = JSON.stringify(LOS_ANGELES_2026)
    const legacy = accountInterval(input)

    expect(accountInterval(input, LOS_ANGELES_AUGUST_2026)).toEqual(legacy)
    expect(accountInterval(input, LOS_ANGELES_2026)).toEqual(legacy)
    expect(JSON.stringify(LOS_ANGELES_AUGUST_2026)).toBe(augustBefore)
    expect(JSON.stringify(LOS_ANGELES_2026)).toBe(annualBefore)
  })

  it('uses rates and emissions from the supplied scenario', () => {
    const custom: AccountingScenario = {
      tariff: { energyRatesUsdPerKwh: { base: 1, low: 2, high: 3 } },
      emissions: { kgCo2ePerKwh: 4 },
    }
    const result = accountInterval({
      tou: 'low',
      homeKwh: 0.5,
      evKwh: 0.25,
      gridImportKwh: 0.25,
      gridExportKwh: 0,
    }, custom)

    expect(result.importRate).toBe(2)
    expect(result.exportRate).toBe(2)
    expect(result.importCost).toBe(0.5)
    expect(result.counterfactualCost).toBe(1.5)
    expect(result.avoidedCo2Kg).toBe(2)
  })

  it.each([
    null,
    {},
    { tariff: null, emissions: scenario.emissions },
    { tariff: { energyRatesUsdPerKwh: { base: 1, low: 2 } }, emissions: scenario.emissions },
    { tariff: { energyRatesUsdPerKwh: { base: 1, low: -1, high: 3 } }, emissions: scenario.emissions },
    { tariff: scenario.tariff, emissions: { kgCo2ePerKwh: Number.POSITIVE_INFINITY } },
    { tariff: { energyRatesUsdPerKwh: Object.create(scenario.tariff.energyRatesUsdPerKwh) }, emissions: scenario.emissions },
    { tariff: { energyRatesUsdPerKwh: { ...scenario.tariff.energyRatesUsdPerKwh, shoulder: 1 } }, emissions: scenario.emissions },
  ])('rejects malformed accounting scenario %#', (invalidScenario) => {
    expect(() => accountInterval({
      tou: 'base',
      homeKwh: 0,
      evKwh: 0,
      gridImportKwh: 0,
      gridExportKwh: 0,
    }, invalidScenario as AccountingScenario)).toThrow(/invalid .*scenario/i)
  })

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
