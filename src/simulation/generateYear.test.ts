import { beforeAll, describe, expect, it } from 'vitest'
import type { EnergyInterval, LoadCategory } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { aggregateIntervals } from './aggregate'
import { __finalizeAnnualLedger, generateYear } from './generateYear'
import * as annualValidation from './validateYear'

const validateYear = annualValidation.validateYear

const scenario = LOS_ANGELES_2026
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

const dateKey = (record: EnergyInterval) => `${record.year}-${record.month}-${record.day}`

const mutableArray = (records: readonly EnergyInterval[]) => Array.from(records)

const replace = (
  records: EnergyInterval[],
  index: number,
  changes: Partial<EnergyInterval>,
) => {
  records[index] = { ...records[index]!, ...changes }
}

const validateWithoutThrowing = (records: readonly EnergyInterval[]) => {
  let errors: string[] = []
  expect(() => { errors = validateYear(records) }).not.toThrow()
  expect(errors.length).toBeLessThanOrEqual(100)
  return errors.join('\n')
}

describe('generateYear', () => {
  let records: readonly EnergyInterval[]

  beforeAll(() => {
    records = generateYear()
  }, 30_000)

  it('assembles exactly one valid interval for every canonical annual clock slot', () => {
    expect(records).toHaveLength(105_120)
    expect(records).toHaveLength(scenario.records)
    expect(validateYear(records)).toEqual([])
    expect(records[0]).toMatchObject({
      index: 0,
      iso: '2026-01-01T00:00:00.000-08:00',
      year: 2026,
      month: 1,
      day: 1,
      dayOfYear: 1,
      minuteOfDay: 0,
      utcOffset: '-08:00',
    })
    expect(records.at(-1)).toMatchObject({
      index: 105_119,
      iso: '2026-12-31T23:55:00.000-08:00',
      year: 2026,
      month: 12,
      day: 31,
      dayOfYear: 365,
      minuteOfDay: 23 * 60 + 55,
      utcOffset: '-08:00',
    })
  })

  it('keeps battery, vehicle, and energy ledgers continuous and balanced at every interval', () => {
    let valid = true
    records.forEach((record, index) => {
      const supply = record.solarKwh + record.batteryDischargeKwh + record.gridImportKwh
      const demand = record.homeKwh + record.evKwh + record.batteryChargeKwh +
        record.gridExportKwh + record.chargeLossKwh + record.dischargeLossKwh
      valid &&= Math.abs(supply - demand) <= tolerance
      valid &&= Math.abs(
        record.batterySocEndKwh -
        (record.batterySocStartKwh + record.batteryChargeKwh - record.batteryDischargeKwh),
      ) <= tolerance
      valid &&= Math.abs(
        record.vehicleSocEndKwh -
        (record.vehicleSocStartKwh + record.evKwh - record.tripKwh),
      ) <= tolerance
      if (index > 0) {
        valid &&= Math.abs(record.batterySocStartKwh - records[index - 1]!.batterySocEndKwh) <= tolerance
        valid &&= Math.abs(record.vehicleSocStartKwh - records[index - 1]!.vehicleSocEndKwh) <= tolerance
      }
    })
    expect(valid).toBe(true)
  })

  it('hits configured monthly and annual energy targets', () => {
    const monthly = Array.from({ length: 12 }, () => ({ solar: 0, home: 0, ev: 0, trip: 0 }))
    const categoryTotals = Object.fromEntries(categories.map((category) => [category, 0])) as Record<LoadCategory, number>
    records.forEach((record) => {
      const totals = monthly[record.month - 1]!
      totals.solar += record.solarKwh
      totals.home += record.homeKwh
      totals.ev += record.evKwh
      totals.trip += record.tripKwh
      categories.forEach((category) => { categoryTotals[category] += record.homeBreakdownKwh[category] })
    })

    scenario.months.forEach((profile, index) => {
      expect(monthly[index]!.solar).toBeCloseTo(profile.solarTargetKwh, 6)
      expect(monthly[index]!.home).toBeCloseTo(profile.homeTargetKwh, 7)
      expect(monthly[index]!.ev).toBeGreaterThanOrEqual(250)
      expect(monthly[index]!.ev).toBeLessThanOrEqual(450)
      expect(monthly[index]!.trip).toBe(scenario.ev.targetMonthlyKwh)
    })
    const totals = aggregateIntervals(records)
    expect(totals.solarKwh).toBeCloseTo(scenario.solar.annualReferenceKwh, 6)
    expect(totals.homeKwh).toBeCloseTo(scenario.home.targetAnnualKwh, 7)
    expect(totals.evKwh).toBeCloseTo(scenario.ev.targetAnnualKwh, 7)
    expect(Object.values(categoryTotals).every((total) => total > 0)).toBe(true)
  })

  it('contains representative winter rain and heating, summer heatwave cooling and solar, and both DST transitions', () => {
    const winterRain = records.find((record) =>
      [12, 1, 2].includes(record.month) && record.precipitationInches > 0,
    )
    const summerHeatwave = records.find((record) =>
      record.month >= 7 && record.month <= 9 && record.dayType === 'heatwave' &&
      record.solarKwh > 0 && record.homeBreakdownKwh.hvac > 0,
    )

    expect(winterRain?.homeBreakdownKwh.hvac).toBeGreaterThan(0)
    expect(summerHeatwave?.solarKwh).toBeGreaterThan(0)
    expect(records.some((record) => record.iso === '2026-03-08T03:00:00.000-07:00')).toBe(true)
    expect(records.filter((record) => record.iso.startsWith('2026-11-01T01:'))).toHaveLength(24)
    expect(new Set(records.filter((record) => record.iso.startsWith('2026-11-01T01:')).map(
      (record) => record.utcOffset,
    ))).toEqual(new Set(['-07:00', '-08:00']))
  })

  it('is deterministic at representative fixtures and deeply freezes every returned layer', () => {
    const second = generateYear()
    const fixtureIndexes = [0, 18_947, 63_271, 105_119]

    expect(fixtureIndexes.map((index) => second[index])).toEqual(
      fixtureIndexes.map((index) => records[index]),
    )
    expect(second).not.toBe(records)
    expect(Object.isFrozen(second)).toBe(true)
    expect(second.every((record) =>
      Object.isFrozen(record) &&
      Object.isFrozen(record.homeBreakdownKwh) &&
      Object.isFrozen(record.transfers) &&
      record.transfers.every(Object.isFrozen),
    )).toBe(true)
  }, 15_000)

  it('contains exactly one served trip per local date and restores the initial vehicle state', () => {
    const tripCounts = new Map<string, number>()
    records.forEach((record) => {
      if (record.tripKwh > 0) {
        tripCounts.set(dateKey(record), (tripCounts.get(dateKey(record)) ?? 0) + 1)
        expect(record.tripKwh).toBeLessThanOrEqual(record.vehicleSocStartKwh + tolerance)
      }
    })
    expect(tripCounts).toHaveLength(365)
    expect([...tripCounts.values()].every((count) => count === 1)).toBe(true)
    expect(records.at(-1)!.vehicleSocEndKwh).toBe(
      scenario.ev.capacityKwh * scenario.ev.initialSocPercent / 100,
    )
  })

  it('rejects missing records and an extra sparse annual array', () => {
    expect(validateWithoutThrowing(records.slice(1))).toMatch(/record count|missing/i)

    const malformed = mutableArray(records)
    for (let index = 40; index < 140; index += 1) delete malformed[index]
    malformed.push(records.at(-1)!)
    const errors = validateWithoutThrowing(malformed)
    expect(errors).toMatch(/record count/i)
    expect(errors).toMatch(/index 40: missing or invalid record/i)
  })

  it('independently rejects duplicate, unordered, DST-corrupted, and new clock fields', () => {
    const malformed = mutableArray(records)
    malformed[2] = malformed[1]!
    ;[malformed[3], malformed[4]] = [malformed[4]!, malformed[3]!]
    replace(malformed, 5, { iso: '2026-03-08T02:00:00.000-08:00' })
    malformed[6] = { ...malformed[6]!, unexpectedClock: true } as EnergyInterval
    for (let index = 7; index < 107; index += 1) delete malformed[index]
    const errors = validateWithoutThrowing(malformed)

    expect(errors).toMatch(/index 2:.*canonical clock|duplicate timestamp/i)
    expect(errors).toMatch(/index 3:.*canonical clock/i)
    expect(errors).toMatch(/clock iso must match the canonical clock/i)
    expect(errors).toMatch(/index 6: invalid record shape/i)
  })

  it('collects malformed field, continuity, transfer, balance, accounting, grid, and daylight errors', () => {
    const malformed = mutableArray(records)
    replace(malformed, 100, { precipitationInches: -0.01 })
    replace(malformed, 101, { weatherState: 'fog' as EnergyInterval['weatherState'] })
    replace(malformed, 102, { cloudFactor: 2 })
    replace(malformed, 103, { solarKw: Number.NaN })
    replace(malformed, 104, {
      homeBreakdownKwh: { ...malformed[104]!.homeBreakdownKwh, hvac: -1 },
    })
    replace(malformed, 200, { batterySocStartKwh: malformed[200]!.batterySocStartKwh + 0.1 })
    replace(malformed, 201, { vehicleSocStartKwh: malformed[201]!.vehicleSocStartKwh + 0.1 })

    const transferIndex = malformed.findIndex((record) => record.transfers.length > 0)
    replace(malformed, transferIndex, {
      transfers: malformed[transferIndex]!.transfers.map((transfer, index) =>
        index === 0 ? { ...transfer, unexpected: true } as typeof transfer : transfer,
      ),
    })
    replace(malformed, 300, { gridImportKwh: malformed[300]!.gridImportKwh + 0.1 })
    replace(malformed, 301, { importCost: malformed[301]!.importCost + 0.01 })
    const importing = malformed.findIndex((record) => record.gridImportKwh > 0)
    replace(malformed, importing, { gridExportKw: 0.12, gridExportKwh: 0.01 })
    const midnight = malformed.findIndex((record) => record.minuteOfDay === 0)
    replace(malformed, midnight, { solarKw: 0.12, solarKwh: 0.01 })
    const away = malformed.findIndex((record) =>
      !record.evAvailable && record.evKwh === 0 && record.tripKwh === 0,
    )
    replace(malformed, away, { evKw: 12e-12, evKwh: 1e-12 })
    const departure = malformed.findIndex((record) => record.tripKwh > 0)
    replace(malformed, departure, { evAvailable: true })
    for (let index = 302; index < 402; index += 1) delete malformed[index]

    const errors = validateWithoutThrowing(malformed)
    ;[
      /precipitationInches must be finite and nonnegative/i,
      /invalid weatherState/i,
      /cloudFactor must be within 0\.\.1/i,
      /solarKw must be a finite number/i,
      /home breakdown hvac must be finite and nonnegative/i,
      /battery state continuity is broken/i,
      /vehicle state continuity is broken/i,
      /transfer 0 has invalid shape/i,
      /energy balance error exceeds tolerance/i,
      /accounting importCost does not match interval inputs/i,
      /simultaneous grid import and export/i,
      /solar must be zero outside the annual daylight window/i,
      /EV cannot charge while away/i,
      /EV trip requires the vehicle to be unavailable/i,
    ].forEach((pattern) => expect(errors).toMatch(pattern))
  })

  it('requires rain labels and positive precipitation to agree in both directions', () => {
    const malformed = mutableArray(records)
    replace(malformed, 0, { precipitationInches: 0.01, weatherState: 'overcast' })
    replace(malformed, 1, { precipitationInches: 0, weatherState: 'rain' })
    for (let index = 2; index < 102; index += 1) delete malformed[index]
    const errors = validateWithoutThrowing(malformed)

    expect(errors).toMatch(/positive precipitation requires weatherState rain/i)
    expect(errors).toMatch(/weatherState rain requires positive precipitation/i)
  })

  it('rejects corrupted targets and missing required seasonal events', () => {
    const malformed = records.map((record) => {
      const winter = [12, 1, 2].includes(record.month)
      return {
        ...record,
        precipitationInches: winter ? 0 : record.precipitationInches,
        weatherState: winter && record.weatherState === 'rain' ? 'overcast' : record.weatherState,
        temperatureF: winter ? Math.max(record.temperatureF, 70) : record.temperatureF,
        dayType: record.dayType === 'heatwave' ? 'weekday' : record.dayType,
      } as EnergyInterval
    })
    for (const day of [1, 2]) {
      const rainIndex = malformed.findIndex((candidate) =>
        candidate.month === 1 && candidate.day === day && candidate.minuteOfDay === 12 * 60,
      )
      const coldIndex = malformed.findIndex((candidate) =>
        candidate.month === 1 && candidate.day === day && candidate.minuteOfDay === 0,
      )
      replace(malformed, rainIndex, { precipitationInches: 0.01, weatherState: 'rain' })
      replace(malformed, coldIndex, { temperatureF: 0 })
    }
    for (const day of [1, 2, 3]) {
      const heatIndex = malformed.findIndex((candidate) =>
        candidate.month === 7 && candidate.day === day && candidate.minuteOfDay === 12 * 60,
      )
      replace(malformed, heatIndex, { dayType: 'heatwave' })
    }
    const record = malformed[400]!
    replace(malformed, 400, {
      homeKw: record.homeKw + 0.12,
      homeKwh: record.homeKwh + 0.01,
      homeBreakdownKwh: {
        ...record.homeBreakdownKwh,
        electronicsOther: record.homeBreakdownKwh.electronicsOther + 0.01,
      },
    })
    const tripIndex = malformed.findIndex((candidate) => candidate.tripKwh > 0)
    replace(malformed, tripIndex, { tripKwh: malformed[tripIndex]!.tripKwh + 0.01 })
    const errors = validateWithoutThrowing(malformed)
    expect(errors).toMatch(/month 1 home total does not match the configured target/i)
    expect(errors).toMatch(/annual EV trip total does not match the configured target/i)
    expect(errors).toMatch(/missing required winter multi-day rain/i)
    expect(errors).toMatch(/missing required summer heatwave/i)
    expect(errors).toMatch(/missing required winter cold snap/i)
  })

  it('reports an annual solar reference error independently from monthly checks', () => {
    expect(annualValidation).toHaveProperty('__annualSolarTotalError')
    const annualSolarTotalError = (
      annualValidation as typeof annualValidation & {
        __annualSolarTotalError: (solarKwh: number) => string | null
      }
    ).__annualSolarTotalError

    expect(annualSolarTotalError(scenario.solar.annualReferenceKwh)).toBeNull()
    expect(annualSolarTotalError(scenario.solar.annualReferenceKwh * 1.03)).toMatch(
      /annual solar total is outside the ±2% reference envelope/i,
    )
  })

  it('throws one prefixed error and exposes no partial ledger when final validation fails', () => {
    const partial: EnergyInterval[] = []
    expect(() => __finalizeAnnualLedger(
      partial,
      () => ['index 9: injected annual validation failure'],
    )).toThrow(
      'Invalid annual simulation: index 9: injected annual validation failure',
    )
    expect(Object.isFrozen(partial)).toBe(false)
  })
})
