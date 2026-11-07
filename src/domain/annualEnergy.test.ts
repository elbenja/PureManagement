import { describe, expect, it } from 'vitest'
import { generateMonth } from '../simulation/generateMonth'
import { isAnnualEnergyInterval } from './annualEnergy'

describe('annual energy record guard', () => {
  it('distinguishes annual records from legacy August records', () => {
    const august = generateMonth()[0]!
    const outage = { ...august, gridStatus: 'outage' }
    const unknown = { ...august, gridStatus: 'unknown' }
    expect(isAnnualEnergyInterval(august)).toBe(false)
    expect(isAnnualEnergyInterval(outage)).toBe(true)
    expect(isAnnualEnergyInterval(unknown)).toBe(false)
  })
})
