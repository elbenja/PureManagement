// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import type { AnnualEnergyInterval } from '../domain/annualEnergy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { generateYear } from './generateYear'
import { buildMonthlyStatements } from './monthlyStatements'

describe('modeled monthly statements', () => {
  let records: readonly AnnualEnergyInterval[]

  beforeAll(() => {
    records = generateYear()
  }, 30_000)

  it('carries credit forward and reconciles every monthly amount', () => {
    const statements = buildMonthlyStatements(records)
    expect(statements).toHaveLength(12)
    expect(statements[0]?.openingCreditBankUsd).toBe(0)

    statements.forEach((statement, index) => {
      const monthRecords = records.filter((record) => record.month === index + 1)
      const importCost = monthRecords.reduce((sum, record) => sum + record.importCost, 0)
      const earnedCredit = monthRecords.reduce((sum, record) => sum + record.exportCredit, 0)
      expect(statement.month).toBe(index + 1)
      expect(statement.importCostUsd).toBeCloseTo(importCost, 8)
      expect(statement.earnedCreditUsd).toBeCloseTo(earnedCredit, 8)
      expect(statement.openingCreditBankUsd).toBeCloseTo(
        index === 0 ? 0 : statements[index - 1]!.closingCreditBankUsd,
        8,
      )
      expect(statement.appliedCreditUsd).toBeCloseTo(
        Math.min(importCost, statement.openingCreditBankUsd + earnedCredit),
        8,
      )
      expect(statement.closingCreditBankUsd).toBeCloseTo(
        statement.openingCreditBankUsd + earnedCredit - statement.appliedCreditUsd,
        8,
      )
      expect(statement.closingCreditBankUsd).toBeGreaterThanOrEqual(0)
      expect(statement.serviceChargeUsd).toBe(LOS_ANGELES_2026.tariff.serviceChargeUsdPerMonth)
      expect(statement.amountDueUsd).toBeCloseTo(
        importCost - statement.appliedCreditUsd + statement.serviceChargeUsd,
        8,
      )
    })
    expect(Object.isFrozen(statements)).toBe(true)
    expect(statements.every(Object.isFrozen)).toBe(true)
  })
})
