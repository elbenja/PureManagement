import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { generateAnnualEv } from './annualEv'
import { ANNUAL_OUTAGES, gridStatusAt } from './annualOutages'
import { buildYearClock } from './yearClock'

describe('annual outage schedule', () => {
  it('marks two fixed local-time events with exclusive end times', () => {
    expect(ANNUAL_OUTAGES).toHaveLength(2)
    expect(gridStatusAt('2026-01-15T14:55:00.000-08:00')).toBe('connected')
    expect(gridStatusAt('2026-01-15T15:00:00.000-08:00')).toBe('outage')
    expect(gridStatusAt('2026-01-15T17:25:00.000-08:00')).toBe('outage')
    expect(gridStatusAt('2026-01-15T17:30:00.000-08:00')).toBe('connected')
    expect(gridStatusAt('2026-07-21T13:00:00.000-07:00')).toBe('outage')
    expect(gridStatusAt('2026-07-21T17:30:00.000-07:00')).toBe('connected')
  })

  it('keeps the EV away throughout both events', () => {
    const clock = buildYearClock()
    const ev = generateAnnualEv(clock, LOS_ANGELES_2026.seedId)
    const outageIndexes = clock.flatMap((slot, index) =>
      gridStatusAt(slot.iso) === 'outage' ? [index] : [],
    )

    expect(outageIndexes).toHaveLength(84)
    expect(outageIndexes.every((index) =>
      !ev[index]!.available && ev[index]!.chargeKwh === 0,
    )).toBe(true)
  })
})
