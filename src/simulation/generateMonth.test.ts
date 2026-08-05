import { describe, expect, it, vi } from 'vitest'
import type { EnergyInterval, LoadCategory } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { aggregateIntervals } from './aggregate'
import { accountInterval } from './accounting'
import { generateMonth } from './generateMonth'
import { balanceError, validateMonth } from './validate'

const scenario = LOS_ANGELES_AUGUST_2026
const intervalHours = scenario.intervalMinutes / 60
const tolerance = 1e-8
const categories: LoadCategory[] = [
  'hvac',
  'waterHeating',
  'cooking',
  'laundry',
  'refrigeration',
  'lighting',
  'electronicsOther',
]

const mutableMonth = () => structuredClone(generateMonth()) as EnergyInterval[]

const expectValidationError = (
  mutate: (records: EnergyInterval[]) => readonly EnergyInterval[],
  pattern: RegExp,
) => {
  const records = mutate(mutableMonth())
  let errors: string[] = []

  expect(() => {
    errors = validateMonth(records)
  }).not.toThrow()
  expect(errors.join('\n')).toMatch(pattern)
}

describe('generateMonth', () => {
  it('builds the same deeply immutable canonical ledger on every call', () => {
    const first = generateMonth()
    const second = generateMonth()

    expect(first).toHaveLength(scenario.records)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    first.forEach((record) => {
      expect(Object.isFrozen(record)).toBe(true)
      expect(Object.isFrozen(record.homeBreakdownKwh)).toBe(true)
      expect(Object.isFrozen(record.transfers)).toBe(true)
      record.transfers.forEach((transfer) => expect(Object.isFrozen(transfer)).toBe(true))
    })
  })

  it('is valid, ordered, unique, and includes every required day type', () => {
    const records = generateMonth()

    expect(validateMonth(records)).toEqual([])
    expect(new Set(records.map((record) => record.iso))).toHaveLength(records.length)
    records.forEach((record, index) => expect(record.index).toBe(index))
    expect(new Set(records.map((record) => record.dayType))).toEqual(
      new Set(['weekday', 'weekend', 'heatwave', 'cloudy']),
    )
  })

  it('hits the scenario totals and includes material grid and battery activity', () => {
    const totals = aggregateIntervals(generateMonth())

    expect(totals.solarKwh).toBeCloseTo(scenario.solar.targetAugustKwh, 8)
    expect(totals.homeKwh).toBeCloseTo(scenario.home.targetAugustKwh, 8)
    expect(totals.evKwh).toBeCloseTo(scenario.ev.targetAugustKwh, 8)
    expect(Math.abs(totals.energyConsumedKwh - totals.homeKwh - totals.evKwh)).toBeLessThan(tolerance)
    expect(totals.gridImportKwh).toBeGreaterThan(0)
    expect(totals.gridExportKwh).toBeGreaterThan(0)
    expect(totals.batteryChargeKwh).toBeGreaterThan(0)
    expect(totals.batteryDischargeKwh).toBeGreaterThan(0)
  })

  it('preserves every physical, chronological, transfer, and accounting invariant', () => {
    const records = generateMonth()
    const reserveKwh = scenario.battery.capacityKwh * scenario.battery.reservePercent / 100

    records.forEach((record, index) => {
      expect(balanceError(record)).toBeLessThanOrEqual(tolerance)
      expect(record.batterySocStartKwh).toBeGreaterThanOrEqual(reserveKwh - tolerance)
      expect(record.batterySocEndKwh).toBeLessThanOrEqual(scenario.battery.capacityKwh + tolerance)
      expect(record.batteryChargeKwh === 0 || record.batteryDischargeKwh === 0).toBe(true)
      expect(record.gridImportKwh === 0 || record.gridExportKwh === 0).toBe(true)
      expect(record.vehicleSocStartKwh).toBeGreaterThanOrEqual(record.tripKwh - tolerance)
      expect(record.evAvailable || record.evKwh === 0).toBe(true)
      expect(record.tripKwh === 0 || record.evKwh === 0).toBe(true)
      expect(record.solarKw).toBeLessThanOrEqual(scenario.solar.capacityKw + tolerance)
      if (record.minuteOfDay < 6 * 60 + 5 || record.minuteOfDay >= 19 * 60 + 45) {
        expect(record.solarKwh).toBe(0)
      }
      if (index > 0) {
        expect(record.batterySocStartKwh).toBeCloseTo(records[index - 1]!.batterySocEndKwh, 10)
        expect(record.vehicleSocStartKwh).toBeCloseTo(records[index - 1]!.vehicleSocEndKwh, 10)
      }

      const numericValues = [
        record.temperatureF,
        record.cloudFactor,
        record.solarKw,
        record.solarKwh,
        record.homeKw,
        record.homeKwh,
        ...Object.values(record.homeBreakdownKwh),
        record.evKw,
        record.evKwh,
        record.vehicleSocStartKwh,
        record.vehicleSocEndKwh,
        record.tripKwh,
        record.batteryChargeKw,
        record.batteryChargeKwh,
        record.batteryDischargeKw,
        record.batteryDischargeKwh,
        record.batterySocStartKwh,
        record.batterySocEndKwh,
        record.chargeLossKwh,
        record.dischargeLossKwh,
        record.gridImportKw,
        record.gridImportKwh,
        record.gridExportKw,
        record.gridExportKwh,
        record.importRate,
        record.exportRate,
        record.importCost,
        record.exportCredit,
        record.counterfactualCost,
        record.savings,
        record.avoidedCo2Kg,
        ...record.transfers.flatMap((transfer) => [transfer.kw, transfer.kwh]),
      ]
      expect(numericValues.every(Number.isFinite)).toBe(true)
      expect(categories.reduce((total, category) => total + record.homeBreakdownKwh[category], 0))
        .toBeCloseTo(record.homeKwh, 10)
      expect(record.solarKwh).toBeCloseTo(record.solarKw * intervalHours, 12)
      expect(record.homeKwh).toBeCloseTo(record.homeKw * intervalHours, 12)
      expect(record.evKwh).toBeCloseTo(record.evKw * intervalHours, 12)
      expect(record.batterySocEndKwh).toBeCloseTo(
        record.batterySocStartKwh + record.batteryChargeKwh - record.batteryDischargeKwh,
        10,
      )
      expect(record.vehicleSocEndKwh).toBeCloseTo(
        record.vehicleSocStartKwh + record.evKwh - record.tripKwh,
        10,
      )
      expect(record).toMatchObject(accountInterval({
        tou: record.tou,
        homeKwh: record.homeKwh,
        evKwh: record.evKwh,
        gridImportKwh: record.gridImportKwh,
        gridExportKwh: record.gridExportKwh,
      }))
    })
  })

  it('throws a prefixed integration error if final validation fails', async () => {
    vi.resetModules()
    vi.doMock('./validate', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./validate')>()
      return { ...actual, validateMonth: () => ['index 7: injected validation failure'] }
    })

    const isolated = await import('./generateMonth')
    expect(() => isolated.generateMonth()).toThrow(
      'Invalid simulation: index 7: injected validation failure',
    )

    vi.doUnmock('./validate')
    vi.resetModules()
  })
})

describe('validateMonth', () => {
  it('rejects a missing day-31 trip even when vehicle chronology remains internally consistent', () => {
    const records = mutableMonth()
    const tripIndex = records.findIndex((record) => record.day === 31 && record.tripKwh > 0)
    const removedTripKwh = records[tripIndex]!.tripKwh
    records[tripIndex]!.tripKwh = 0

    for (let index = tripIndex; index < records.length; index += 1) {
      if (index === tripIndex) records[index]!.vehicleSocEndKwh += removedTripKwh
      else {
        records[index]!.vehicleSocStartKwh += removedTripKwh
        records[index]!.vehicleSocEndKwh += removedTripKwh
      }
    }

    expect(Math.max(...records.slice(tripIndex).flatMap((record) => [
      record.vehicleSocStartKwh,
      record.vehicleSocEndKwh,
    ]))).toBeLessThanOrEqual(scenario.ev.capacityKwh)
    const errors = validateMonth(records).join('\n')
    expect(errors).toMatch(/day 31.*exactly one.*trip/i)
    expect(errors).toMatch(/monthly EV trip.*target/i)
    expect(errors).toMatch(/final vehicle.*initial/i)
  })

  it('rejects a split daily trip even when daily and monthly energy still reconcile', () => {
    const records = mutableMonth()
    const tripIndex = records.findIndex((record) => record.day === 31 && record.tripKwh > 0)
    const splitTripKwh = records[tripIndex]!.tripKwh / 2

    records[tripIndex]!.tripKwh = splitTripKwh
    records[tripIndex]!.vehicleSocEndKwh += splitTripKwh
    records[tripIndex + 1]!.vehicleSocStartKwh += splitTripKwh
    records[tripIndex + 1]!.tripKwh = splitTripKwh

    expect(validateMonth(records).join('\n')).toMatch(/day 31.*exactly one.*trip/i)
  })

  it.each([
    [
      'a missing final record',
      (records: EnergyInterval[]) => records.slice(0, -1),
      /record count.*8928/i,
    ],
    [
      'a sparse record',
      (records: EnergyInterval[]) => {
        delete records[11]
        return records
      },
      /index 11.*missing/i,
    ],
    [
      'a duplicate timestamp',
      (records: EnergyInterval[]) => {
        records[20]!.iso = records[19]!.iso
        return records
      },
      /index 20.*(duplicate.*timestamp|timestamp.*duplicate|iso.*canonical)/i,
    ],
    [
      'an out-of-order clock index',
      (records: EnergyInterval[]) => {
        records[30]!.index = 31
        return records
      },
      /index 30.*clock.*index/i,
    ],
    [
      'an energy imbalance',
      (records: EnergyInterval[]) => {
        records[40]!.gridImportKwh += 1
        records[40]!.gridImportKw += 12
        return records
      },
      /index 40.*balance/i,
    ],
    [
      'a battery state below reserve',
      (records: EnergyInterval[]) => {
        records[50]!.batterySocStartKwh = 0
        return records
      },
      /index 50.*battery.*(reserve|bounds)/i,
    ],
    [
      'a battery discontinuity',
      (records: EnergyInterval[]) => {
        records[60]!.batterySocStartKwh += 0.25
        records[60]!.batterySocEndKwh += 0.25
        return records
      },
      /index 60.*battery.*continuity/i,
    ],
    [
      'simultaneous grid import and export',
      (records: EnergyInterval[]) => {
        records[70]!.gridImportKwh = 0.1
        records[70]!.gridImportKw = 1.2
        records[70]!.gridExportKwh = 0.1
        records[70]!.gridExportKw = 1.2
        return records
      },
      /index 70.*simultaneous grid/i,
    ],
    [
      'nighttime solar',
      (records: EnergyInterval[]) => {
        records[0]!.solarKwh = 0.1
        records[0]!.solarKw = 1.2
        return records
      },
      /index 0.*solar.*night/i,
    ],
    [
      'a non-finite field',
      (records: EnergyInterval[]) => {
        records[80]!.homeKwh = Number.NaN
        return records
      },
      /index 80.*homeKwh.*finite/i,
    ],
    [
      'an infeasible EV trip',
      (records: EnergyInterval[]) => {
        const index = records.findIndex((record) => record.tripKwh > 0)
        records[index]!.tripKwh = records[index]!.vehicleSocStartKwh + 1
        return records
      },
      /index \d+.*trip.*(feasible|state)/i,
    ],
    [
      'an accounting mismatch',
      (records: EnergyInterval[]) => {
        records[90]!.importCost += 1
        return records
      },
      /index 90.*accounting.*importCost/i,
    ],
  ] as const)('returns a descriptive error without throwing for %s', (_case, mutate, pattern) => {
    expectValidationError(mutate, pattern)
  })

  it('returns errors rather than throwing for a non-record value', () => {
    expect(() => validateMonth([null as unknown as EnergyInterval])).not.toThrow()
    expect(validateMonth([null as unknown as EnergyInterval]).join('\n')).toMatch(/index 0.*missing/i)
  })
})
