/**
 * Energy data uses kW for instantaneous power and kWh for interval or aggregate
 * energy. Money is USD and emissions are kg CO2e. Transfer kW/kWh values are
 * AC-side; battery state-of-charge kWh values are storage-side.
 */

export type {
  ClockSlot,
  DayType,
  EnergyInterval,
  EnergyNode,
  LoadCategory,
  TouPeriod,
  Transfer,
  WeatherState,
} from './domain/energy'
export { isAnnualEnergyInterval } from './domain/annualEnergy'
export type { AnnualEnergyInterval } from './domain/annualEnergy'
export { ANNUAL_OUTAGES, gridStatusAt } from './simulation/annualOutages'
export type { AnnualOutage, GridStatus } from './simulation/annualOutages'

export { LOS_ANGELES_2026 } from './scenario/losAngeles2026'
export { LOS_ANGELES_AUGUST_2026 } from './scenario/losAngelesAugust2026'
export { generateMonth } from './simulation/generateMonth'
export { generateYear } from './simulation/generateYear'
export { validateMonth } from './simulation/validate'
export { validateYear } from './simulation/validateYear'
export { buildMonthlyStatements } from './simulation/monthlyStatements'
export type { MonthlyStatement } from './simulation/monthlyStatements'

export { accountInterval } from './simulation/accounting'
export type {
  AccountingInput,
  AccountingResult,
} from './simulation/accounting'

export {
  aggregateIntervals,
  buildPrefixTotals,
  getRangeWindow,
  getTrailingWindow,
} from './simulation/aggregate'
export type { EnergyTotals, TimeRange } from './simulation/aggregate'

export { advancePosition, interpolatePower } from './playback/playback'

export { getHistoryView, getLiveFrame } from './consumer/views'
export { getDailyOutlook } from './consumer/outlook'
export type { DailyOutlook } from './consumer/outlook'
export type {
  BatteryNodeView,
  EnergyNodeView,
  EvNodeView,
  GridNodeView,
  HistoryRangeView,
  HistorySeriesPoint,
  HistoryView,
  HomeNodeView,
  LiveAccountingView,
  LiveFrame,
  SolarNodeView,
} from './consumer/views'
