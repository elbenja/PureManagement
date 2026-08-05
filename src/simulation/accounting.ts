import type { TouPeriod } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'

export interface AccountingInput {
  tou: TouPeriod
  homeKwh: number
  evKwh: number
  gridImportKwh: number
  gridExportKwh: number
}

export interface AccountingResult {
  importRate: number
  exportRate: number
  importCost: number
  exportCredit: number
  counterfactualCost: number
  savings: number
  avoidedCo2Kg: number
}

const scenario = LOS_ANGELES_AUGUST_2026
const simultaneousGridTolerance = 1e-10

const isTouPeriod = (value: unknown): value is TouPeriod =>
  value === 'base' || value === 'low' || value === 'high'

const validateInput = (input: AccountingInput) => {
  if (!isTouPeriod(input.tou)) throw new Error('Invalid tou')

  const energyFields: Array<keyof Omit<AccountingInput, 'tou'>> = [
    'homeKwh',
    'evKwh',
    'gridImportKwh',
    'gridExportKwh',
  ]

  energyFields.forEach((field) => {
    if (!Number.isFinite(input[field]) || input[field] < 0) {
      throw new Error(`Invalid ${field}`)
    }
  })

  if (
    input.gridImportKwh > simultaneousGridTolerance &&
    input.gridExportKwh > simultaneousGridTolerance
  ) {
    throw new Error('Simultaneous grid import and export is invalid')
  }
}

export const accountInterval = (input: AccountingInput): AccountingResult => {
  validateInput(input)

  const importRate = scenario.tariff.energyRatesUsdPerKwh[input.tou]
  const exportRate = importRate
  const importCost = input.gridImportKwh * importRate
  const exportCredit = input.gridExportKwh * exportRate
  const counterfactualCost = (input.homeKwh + input.evKwh) * importRate
  const savings = counterfactualCost - (importCost - exportCredit)
  const avoidedCo2Kg = Math.max(
    0,
    input.homeKwh + input.evKwh - input.gridImportKwh + input.gridExportKwh,
  ) * scenario.emissions.kgCo2ePerKwh

  const result = {
    importRate,
    exportRate,
    importCost,
    exportCredit,
    counterfactualCost,
    savings,
    avoidedCo2Kg,
  }

  if (!Object.values(result).every(Number.isFinite)) {
    throw new Error('Invalid accounting result')
  }

  return result
}
