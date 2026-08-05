import { describe, expect, it } from 'vitest'
import type { Transfer } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { routeInterval } from './router'

const scenario = LOS_ANGELES_AUGUST_2026
const intervalHours = scenario.intervalMinutes / 60
const efficiency = Math.sqrt(scenario.battery.roundTripEfficiency)
const reserveKwh = scenario.battery.capacityKwh * (scenario.battery.reservePercent / 100)

const transferKwh = (transfers: Transfer[], source: Transfer['source'], destination: Transfer['destination']) =>
  transfers
    .filter((transfer) => transfer.source === source && transfer.destination === destination)
    .reduce((total, transfer) => total + transfer.kwh, 0)

const expectConserved = (input: Parameters<typeof routeInterval>[0]) => {
  const result = routeInterval(input)
  const supplied = input.solarKwh + result.batteryDischargeKwh + result.gridImportKwh
  const consumed =
    input.homeKwh +
    input.evKwh +
    result.batteryChargeKwh +
    result.gridExportKwh +
    result.chargeLossKwh +
    result.dischargeLossKwh

  expect(supplied).toBeCloseTo(consumed, 12)
  return result
}

describe('routeInterval', () => {
  it('serves load before charging and exporting surplus solar', () => {
    const result = routeInterval({
      solarKwh: 1,
      homeKwh: 0.2,
      evKwh: 0,
      batterySocKwh: 10,
      minuteOfDay: 12 * 60,
    })

    expect(transferKwh(result.transfers, 'solar', 'home')).toBeCloseTo(0.2, 12)
    expect(transferKwh(result.transfers, 'solar', 'ev')).toBe(0)
    expect(result.batteryChargeKwh).toBeGreaterThan(0)
    expect(result.gridExportKwh).toBeGreaterThan(0)
    expect(result.gridImportKwh).toBe(0)
    expect(result.transfers).toContainEqual(
      expect.objectContaining({ source: 'solar', destination: 'battery' }),
    )
    expect(result.transfers).toContainEqual(
      expect.objectContaining({ source: 'solar', destination: 'grid' }),
    )
  })

  it('preserves the battery reserve and imports when it cannot discharge', () => {
    const result = routeInterval({
      solarKwh: 0,
      homeKwh: 1,
      evKwh: 0,
      batterySocKwh: reserveKwh,
      minuteOfDay: 18 * 60,
    })

    expect(result.batteryDischargeKwh).toBe(0)
    expect(result.gridImportKwh).toBeCloseTo(1, 12)
    expect(result.batterySocEndKwh).toBe(reserveKwh)
  })

  it('discharges during the 13:00–20:00 window, but not afterwards', () => {
    const input = {
      solarKwh: 0,
      homeKwh: 1,
      evKwh: 0.25,
      batterySocKwh: reserveKwh + 0.5,
    }

    const evening = routeInterval({ ...input, minuteOfDay: 18 * 60 })
    const overnight = routeInterval({ ...input, minuteOfDay: 22 * 60 })

    expect(evening.batteryDischargeKwh).toBeGreaterThan(0)
    expect(evening.gridImportKwh).toBeGreaterThan(0)
    expect(transferKwh(evening.transfers, 'battery', 'home')).toBeGreaterThan(0)
    expect(overnight.batteryDischargeKwh).toBe(0)
    expect(overnight.gridImportKwh).toBeCloseTo(input.homeKwh + input.evKwh, 12)
  })

  it('uses stored-energy accounting for charge and discharge efficiency', () => {
    const charge = routeInterval({
      solarKwh: 1,
      homeKwh: 0,
      evKwh: 0,
      batterySocKwh: 10,
      minuteOfDay: 12 * 60,
    })
    const discharge = routeInterval({
      solarKwh: 0,
      homeKwh: 1,
      evKwh: 0,
      batterySocKwh: 3.5,
      minuteOfDay: 18 * 60,
    })
    const cycledCharge = routeInterval({
      solarKwh: 0.1,
      homeKwh: 0,
      evKwh: 0,
      batterySocKwh: reserveKwh,
      minuteOfDay: 12 * 60,
    })
    const cycledDischarge = routeInterval({
      solarKwh: 0,
      homeKwh: 1,
      evKwh: 0,
      batterySocKwh: cycledCharge.batterySocEndKwh,
      minuteOfDay: 18 * 60,
    })

    expect(charge.batteryChargeKwh).toBeCloseTo(
      transferKwh(charge.transfers, 'solar', 'battery') * efficiency,
      12,
    )
    expect(charge.chargeLossKwh).toBeCloseTo(
      transferKwh(charge.transfers, 'solar', 'battery') - charge.batteryChargeKwh,
      12,
    )
    expect(charge.batterySocEndKwh).toBeCloseTo(10 + charge.batteryChargeKwh, 12)
    expect(discharge.batteryDischargeKwh).toBeCloseTo(
      transferKwh(discharge.transfers, 'battery', 'home') / efficiency,
      12,
    )
    expect(discharge.dischargeLossKwh).toBeCloseTo(
      discharge.batteryDischargeKwh - transferKwh(discharge.transfers, 'battery', 'home'),
      12,
    )
    expect(discharge.batterySocEndKwh).toBeCloseTo(3.5 - discharge.batteryDischargeKwh, 12)
    expect(transferKwh(cycledDischarge.transfers, 'battery', 'home')).toBeCloseTo(
      transferKwh(cycledCharge.transfers, 'solar', 'battery') * scenario.battery.roundTripEfficiency,
      12,
    )
  })

  it('limits AC battery transfers and keeps state of charge in bounds', () => {
    const highCharge = routeInterval({
      solarKwh: 10,
      homeKwh: 0,
      evKwh: 0,
      batterySocKwh: 10,
      minuteOfDay: 12 * 60,
    })
    const highDischarge = routeInterval({
      solarKwh: 0,
      homeKwh: 10,
      evKwh: 0,
      batterySocKwh: scenario.battery.capacityKwh,
      minuteOfDay: 18 * 60,
    })

    ;[highCharge, highDischarge].forEach((result) => {
      result.transfers
        .filter((transfer) => transfer.source === 'battery' || transfer.destination === 'battery')
        .forEach((transfer) => expect(transfer.kw).toBeLessThanOrEqual(scenario.battery.maxPowerKw))
      expect(result.batterySocEndKwh).toBeGreaterThanOrEqual(reserveKwh)
      expect(result.batterySocEndKwh).toBeLessThanOrEqual(scenario.battery.capacityKwh)
    })
  })

  it('conserves energy across representative charging, discharging, and grid-only intervals', () => {
    expectConserved({ solarKwh: 1, homeKwh: 0.2, evKwh: 0, batterySocKwh: 10, minuteOfDay: 12 * 60 })
    expectConserved({ solarKwh: 0.1, homeKwh: 1, evKwh: 0.25, batterySocKwh: 3, minuteOfDay: 18 * 60 })
    expectConserved({ solarKwh: 0, homeKwh: 0.4, evKwh: 0.8, batterySocKwh: reserveKwh, minuteOfDay: 22 * 60 })
  })

  it('emits only positive approved transfers with interval-consistent units and source priority', () => {
    const result = routeInterval({
      solarKwh: 0.2,
      homeKwh: 0.3,
      evKwh: 0.8,
      batterySocKwh: 4,
      minuteOfDay: 18 * 60,
    })
    const approvedPairs = new Set([
      'solar-home', 'solar-ev', 'solar-battery', 'solar-grid',
      'battery-home', 'battery-ev', 'grid-home', 'grid-ev',
    ])

    result.transfers.forEach((transfer) => {
      expect(transfer.kwh).toBeGreaterThan(0)
      expect(transfer.kw).toBeGreaterThan(0)
      expect(transfer.kw).toBeCloseTo(transfer.kwh / intervalHours, 12)
      expect(approvedPairs.has(`${transfer.source}-${transfer.destination}`)).toBe(true)
    })
    expect(result.batteryChargeKw).toBeCloseTo(result.batteryChargeKwh / intervalHours, 12)
    expect(result.batteryDischargeKw).toBeCloseTo(result.batteryDischargeKwh / intervalHours, 12)
    expect(result.gridImportKw).toBeCloseTo(result.gridImportKwh / intervalHours, 12)
    expect(result.gridExportKw).toBeCloseTo(result.gridExportKwh / intervalHours, 12)
    expect(transferKwh(result.transfers, 'solar', 'home')).toBeCloseTo(0.2, 12)
    expect(transferKwh(result.transfers, 'solar', 'ev')).toBe(0)
    expect(transferKwh(result.transfers, 'battery', 'home')).toBeGreaterThan(0)
    expect(transferKwh(result.transfers, 'battery', 'ev')).toBeGreaterThan(0)
  })

  it('never charges and discharges, or imports and exports, in the same interval', () => {
    ;[
      routeInterval({ solarKwh: 10, homeKwh: 0.1, evKwh: 0, batterySocKwh: 4, minuteOfDay: 12 * 60 }),
      routeInterval({ solarKwh: 0, homeKwh: 1, evKwh: 0, batterySocKwh: 4, minuteOfDay: 18 * 60 }),
    ].forEach((result) => {
      expect(result.batteryChargeKwh === 0 || result.batteryDischargeKwh === 0).toBe(true)
      expect(result.gridImportKwh === 0 || result.gridExportKwh === 0).toBe(true)
    })
  })

  it.each([
    ['solarKwh', { solarKwh: Number.NaN }],
    ['solarKwh', { solarKwh: -0.01 }],
    ['homeKwh', { homeKwh: -0.01 }],
    ['homeKwh', { homeKwh: Number.POSITIVE_INFINITY }],
    ['evKwh', { evKwh: Number.POSITIVE_INFINITY }],
    ['evKwh', { evKwh: -0.01 }],
    ['batterySocKwh', { batterySocKwh: Number.NaN }],
    ['batterySocKwh', { batterySocKwh: reserveKwh - 0.01 }],
    ['batterySocKwh', { batterySocKwh: scenario.battery.capacityKwh + 0.01 }],
    ['minuteOfDay', { minuteOfDay: Number.NaN }],
    ['minuteOfDay', { minuteOfDay: 12 * 60 + 1 }],
    ['minuteOfDay', { minuteOfDay: 24 * 60 }],
  ])('rejects invalid %s with a field-specific error', (field, invalid) => {
    expect(() =>
      routeInterval({
        solarKwh: 0,
        homeKwh: 0,
        evKwh: 0,
        batterySocKwh: reserveKwh,
        minuteOfDay: 0,
        ...invalid,
      }),
    ).toThrow(`Invalid ${field}`)
  })
})
