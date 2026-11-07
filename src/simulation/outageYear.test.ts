// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import type { AnnualEnergyInterval } from '../domain/annualEnergy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { generateYear } from './generateYear'
import { validateYear } from './validateYear'

const tolerance = 1e-8

describe('outages in the annual ledger', () => {
  let records: readonly AnnualEnergyInterval[]

  beforeAll(() => {
    records = generateYear() as readonly AnnualEnergyInterval[]
  }, 30_000)

  it('contains exactly the two scheduled outages with no grid flow or EV charging', () => {
    const outages = records.filter((record) => record.gridStatus === 'outage')
    expect(outages).toHaveLength(84)
    expect(outages[0]?.iso).toBe('2026-01-15T15:00:00.000-08:00')
    expect(outages[29]?.iso).toBe('2026-01-15T17:25:00.000-08:00')
    expect(outages[30]?.iso).toBe('2026-07-21T13:00:00.000-07:00')
    expect(outages.at(-1)?.iso).toBe('2026-07-21T17:25:00.000-07:00')
    expect(outages.every((record) =>
      record.gridImportKwh === 0 && record.gridExportKwh === 0 && record.evKwh === 0,
    )).toBe(true)
    expect(outages.every((record) =>
      record.importCost === 0 && record.exportCredit === 0 &&
      record.counterfactualCost === 0 && record.savings === 0,
    )).toBe(true)
    expect(outages.some((record) => record.curtailedSolarKwh > 0)).toBe(true)
  })

  it('balances actual solar, served home energy, losses, and continuous storage', () => {
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index]!
      expect(Math.abs(record.solarPotentialKwh - record.solarKwh - record.curtailedSolarKwh)).toBeLessThan(tolerance)
      const supply = record.solarKwh + record.batteryDischargeKwh + record.gridImportKwh
      const servedHome = record.homeKwh - record.unservedHomeKwh
      const demand = servedHome + record.evKwh + record.batteryChargeKwh +
        record.gridExportKwh + record.chargeLossKwh + record.dischargeLossKwh
      expect(Math.abs(supply - demand)).toBeLessThan(tolerance)
      if (index > 0) {
        expect(Math.abs(record.batterySocStartKwh - records[index - 1]!.batterySocEndKwh)).toBeLessThan(tolerance)
      }
    }
  })

  it('preserves potential solar targets and validates the completed ledger', () => {
    const potential = records.reduce((sum, record) => sum + record.solarPotentialKwh, 0)
    expect(potential).toBeCloseTo(LOS_ANGELES_2026.solar.annualReferenceKwh, 6)
    expect(validateYear(records)).toEqual([])
  })
})
