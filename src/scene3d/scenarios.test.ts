import { describe, expect, it } from 'vitest'
import { SCENARIOS, SCENARIO_IDS, batteryState, lookState, mixLook } from './scenarios'

describe('scenarios', () => {
  it('covers the seven prototype scenarios A–G', () => {
    expect(SCENARIO_IDS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })

  it('keeps energy states consistent with the dashboard rules', () => {
    for (const { energy } of Object.values(SCENARIOS)) {
      expect(energy.ev === 'charging').toBe(energy.evKw > 0)
      if (energy.grid === 'outage' || energy.grid === 'idle') expect(energy.gridKw).toBe(0)
      else expect(energy.gridKw).toBeGreaterThan(0)
    }
    expect(batteryState(SCENARIOS.B.energy)).toBe('charging')
    expect(batteryState(SCENARIOS.C.energy)).toBe('discharging')
    expect(batteryState(SCENARIOS.E.energy)).toBe('reserve')
    expect(batteryState(SCENARIOS.A.energy)).toBe('idle')
  })

  it('blends looks key by key and lands exactly on each end', () => {
    const a = lookState(SCENARIOS.A.look)
    const e = lookState(SCENARIOS.E.look)
    const out = lookState(SCENARIOS.A.look)

    mixLook(out, a, e, 0)
    expect(out.rain).toBe(0)
    expect(out.skyTop.equals(a.skyTop)).toBe(true)

    mixLook(out, a, e, 1)
    expect(out.rain).toBe(SCENARIOS.E.look.rain)
    expect(out.keyDir).toEqual(SCENARIOS.E.look.keyDir)
    expect(out.skyTop.equals(e.skyTop)).toBe(true)

    mixLook(out, a, e, 0.5)
    expect(out.lights).toBeCloseTo(0.5)
    expect(out.keyDir[1]).toBeCloseTo((10 + 10) / 2)
  })
})
