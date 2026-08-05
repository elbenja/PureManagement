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
} from './domain/energy'

export { LOS_ANGELES_AUGUST_2026 } from './scenario/losAngelesAugust2026'
export { generateMonth } from './simulation/generateMonth'
export { validateMonth } from './simulation/validate'

export { accountInterval } from './simulation/accounting'
export type {
  AccountingInput,
  AccountingResult,
} from './simulation/accounting'

export {
  aggregateIntervals,
  buildPrefixTotals,
  getTrailingWindow,
} from './simulation/aggregate'
export type { EnergyTotals, TimeRange } from './simulation/aggregate'

export { advancePosition, interpolatePower } from './playback/playback'

export { getHistoryView, getLiveFrame } from './consumer/views'
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
