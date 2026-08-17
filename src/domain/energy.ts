export type TouPeriod = 'base' | 'low' | 'high'

export type DayType = 'weekday' | 'weekend' | 'heatwave' | 'cloudy'

export type WeatherState = 'clear' | 'partly-cloudy' | 'overcast' | 'rain'

export type EnergyNode = 'solar' | 'home' | 'ev' | 'battery' | 'grid'

export type LoadCategory =
  | 'hvac'
  | 'waterHeating'
  | 'cooking'
  | 'laundry'
  | 'refrigeration'
  | 'lighting'
  | 'electronicsOther'

export interface ClockSlot {
  index: number
  iso: string
  year: number
  month: number
  day: number
  dayOfYear: number
  dayOfWeek: number
  minuteOfDay: number
  utcOffset: '-08:00' | '-07:00'
  tou: TouPeriod
}

export interface Transfer {
  source: EnergyNode
  destination: EnergyNode
  kw: number
  kwh: number
}

export interface EnergyInterval extends ClockSlot {
  dayType: DayType
  temperatureF: number
  cloudFactor: number
  weatherState: WeatherState
  precipitationInches: number
  solarKw: number
  solarKwh: number
  homeKw: number
  homeKwh: number
  homeBreakdownKwh: Record<LoadCategory, number>
  evKw: number
  evKwh: number
  evAvailable: boolean
  vehicleSocStartKwh: number
  vehicleSocEndKwh: number
  tripKwh: number
  batteryChargeKw: number
  batteryChargeKwh: number
  batteryDischargeKw: number
  batteryDischargeKwh: number
  batterySocStartKwh: number
  batterySocEndKwh: number
  chargeLossKwh: number
  dischargeLossKwh: number
  gridImportKw: number
  gridImportKwh: number
  gridExportKw: number
  gridExportKwh: number
  transfers: Transfer[]
  importRate: number
  exportRate: number
  importCost: number
  exportCredit: number
  counterfactualCost: number
  savings: number
  avoidedCo2Kg: number
}
