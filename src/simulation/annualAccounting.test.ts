import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { accountInterval } from './accounting'
import { accountAnnualInterval } from './annualAccounting'

const input = {
  tou: 'base' as const,
  homeKwh: 0.4,
  evKwh: 0,
  gridImportKwh: 0,
  gridExportKwh: 0,
}

describe('annual accounting', () => {
  it('uses the existing accounting formula when connected', () => {
    expect(accountAnnualInterval(input, 'connected')).toEqual(accountInterval(input, LOS_ANGELES_2026))
  })

  it('does not count unavailable grid service as bill savings', () => {
    const result = accountAnnualInterval(input, 'outage')
    expect(result).toMatchObject({
      importCost: 0,
      exportCredit: 0,
      counterfactualCost: 0,
      savings: 0,
      avoidedCo2Kg: 0,
    })
    expect(result.importRate).toBe(LOS_ANGELES_2026.tariff.energyRatesUsdPerKwh.base)
  })
})
