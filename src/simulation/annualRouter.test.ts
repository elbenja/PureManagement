import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { routeAnnualInterval } from './annualRouter'

const intervalHours = LOS_ANGELES_2026.intervalMinutes / 60

describe('annual interval routing', () => {
  it('serves an outage without grid flow and conserves energy', () => {
    const result = routeAnnualInterval({
      solarKwh: 0.2,
      homeKwh: 0.4,
      evKwh: 0,
      batterySocKwh: 0.3,
      minuteOfDay: 15 * 60,
    }, 'outage')

    expect(result.gridImportKwh).toBe(0)
    expect(result.gridExportKwh).toBe(0)
    expect(result.transfers.some((transfer) =>
      transfer.source === 'battery' && transfer.destination === 'home',
    )).toBe(true)
    expect(result.actualSolarKwh + result.batteryDischargeKwh).toBeCloseTo(
      0.4 - result.unservedHomeKwh + result.batteryChargeKwh +
      result.chargeLossKwh + result.dischargeLossKwh,
      10,
    )
    expect(result.batterySocEndKwh).toBeGreaterThanOrEqual(0)
  })

  it('curtails surplus solar when the battery is full', () => {
    const result = routeAnnualInterval({
      solarKwh: 0.5,
      homeKwh: 0.1,
      evKwh: 0,
      batterySocKwh: LOS_ANGELES_2026.battery.capacityKwh,
      minuteOfDay: 13 * 60,
    }, 'outage')

    expect(result.curtailedSolarKwh).toBeCloseTo(0.4, 10)
    expect(result.actualSolarKwh).toBeCloseTo(0.1, 10)
    expect(result.transfers).toHaveLength(1)
    expect(result.transfers[0]).toMatchObject({ source: 'solar', destination: 'home' })
  })

  it('records unmet home demand when storage is empty', () => {
    const result = routeAnnualInterval({
      solarKwh: 0,
      homeKwh: 0.4,
      evKwh: 0,
      batterySocKwh: 0,
      minuteOfDay: 15 * 60,
    }, 'outage')

    expect(result.unservedHomeKwh).toBe(0.4)
    expect(result.batterySocEndKwh).toBe(0)
    expect(result.transfers).toEqual([])
  })

  it('does not dispatch below reserve after grid restoration', () => {
    const result = routeAnnualInterval({
      solarKwh: 0,
      homeKwh: 0.4,
      evKwh: 0,
      batterySocKwh: 1,
      minuteOfDay: 15 * 60,
    }, 'connected')

    expect(result.batteryDischargeKwh).toBe(0)
    expect(result.gridImportKwh).toBe(0.4)
    expect(result.gridImportKw).toBeCloseTo(0.4 / intervalHours, 10)
    expect(result.curtailedSolarKwh).toBe(0)
    expect(result.unservedHomeKwh).toBe(0)
  })
})
