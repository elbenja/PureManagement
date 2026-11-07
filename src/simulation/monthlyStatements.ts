import type { AnnualEnergyInterval } from '../domain/annualEnergy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'

export interface MonthlyStatement {
  month: number
  openingCreditBankUsd: number
  importCostUsd: number
  earnedCreditUsd: number
  appliedCreditUsd: number
  closingCreditBankUsd: number
  serviceChargeUsd: number
  energyAmountDueUsd: number
  amountDueUsd: number
}

export const buildMonthlyStatements = (
  records: readonly AnnualEnergyInterval[],
): readonly MonthlyStatement[] => {
  if (records.length !== LOS_ANGELES_2026.records) {
    throw new Error('Monthly statements require the complete annual ledger')
  }
  const monthly = Array.from({ length: 12 }, () => ({ importCostUsd: 0, earnedCreditUsd: 0 }))
  records.forEach((record) => {
    const totals = monthly[record.month - 1]!
    totals.importCostUsd += record.importCost
    totals.earnedCreditUsd += record.exportCredit
  })

  let openingCreditBankUsd = 0
  const statements = monthly.map(({ importCostUsd, earnedCreditUsd }, index) => {
    const appliedCreditUsd = Math.min(importCostUsd, openingCreditBankUsd + earnedCreditUsd)
    const closingCreditBankUsd = openingCreditBankUsd + earnedCreditUsd - appliedCreditUsd
    const energyAmountDueUsd = importCostUsd - appliedCreditUsd
    const serviceChargeUsd = LOS_ANGELES_2026.tariff.serviceChargeUsdPerMonth
    const statement: MonthlyStatement = Object.freeze({
      month: index + 1,
      openingCreditBankUsd,
      importCostUsd,
      earnedCreditUsd,
      appliedCreditUsd,
      closingCreditBankUsd,
      serviceChargeUsd,
      energyAmountDueUsd,
      amountDueUsd: energyAmountDueUsd + serviceChargeUsd,
    })
    openingCreditBankUsd = closingCreditBankUsd
    return statement
  })

  return Object.freeze(statements)
}
