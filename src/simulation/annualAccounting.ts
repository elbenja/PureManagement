import type { GridStatus } from './annualOutages'
import { accountInterval, type AccountingInput, type AccountingResult } from './accounting'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'

export const accountAnnualInterval = (
  input: AccountingInput,
  status: GridStatus,
): AccountingResult => {
  const normal = accountInterval(input, LOS_ANGELES_2026)
  return status === 'connected' ? normal : {
    ...normal,
    importCost: 0,
    exportCredit: 0,
    counterfactualCost: 0,
    savings: 0,
    avoidedCo2Kg: 0,
  }
}
