import type { TouPeriod } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'

export interface AccountingInput {
  tou: TouPeriod
  homeKwh: number
  evKwh: number
  gridImportKwh: number
  gridExportKwh: number
}

export interface AccountingScenario {
  readonly tariff: {
    readonly energyRatesUsdPerKwh: Readonly<Record<TouPeriod, number>>
  }
  readonly emissions: {
    readonly kgCo2ePerKwh: number
  }
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

const simultaneousGridTolerance = 1e-10
const validatedFrozenScenarios = new WeakSet<object>()

const isTouPeriod = (value: unknown): value is TouPeriod =>
  value === 'base' || value === 'low' || value === 'high'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key)

const validateScenario = (scenario: AccountingScenario) => {
  if (!isObject(scenario) || !isObject(scenario.tariff) || !isObject(scenario.emissions)) {
    throw new Error('Invalid accounting scenario shape')
  }
  if (
    !hasOwn(scenario, 'tariff') || !hasOwn(scenario, 'emissions') ||
    !hasOwn(scenario.tariff, 'energyRatesUsdPerKwh') ||
    !hasOwn(scenario.emissions, 'kgCo2ePerKwh')
  ) throw new Error('Invalid accounting scenario shape')
  if (validatedFrozenScenarios.has(scenario)) return
  const rates = scenario.tariff.energyRatesUsdPerKwh
  const periods = ['base', 'low', 'high'] as const
  if (
    !isObject(rates) || Reflect.ownKeys(rates).length !== periods.length ||
    !periods.every((period) => hasOwn(rates, period) && Number.isFinite(rates[period]) && rates[period] > 0)
  ) {
    throw new Error('Invalid accounting scenario energy rates')
  }
  if (!Number.isFinite(scenario.emissions.kgCo2ePerKwh) || scenario.emissions.kgCo2ePerKwh <= 0) {
    throw new Error('Invalid accounting scenario emissions')
  }
  if (
    Object.isFrozen(scenario) && Object.isFrozen(scenario.tariff) &&
    Object.isFrozen(rates) && Object.isFrozen(scenario.emissions)
  ) validatedFrozenScenarios.add(scenario)
}

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

export const accountInterval = (
  input: AccountingInput,
  scenario: AccountingScenario = LOS_ANGELES_AUGUST_2026,
): AccountingResult => {
  validateScenario(scenario)
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
