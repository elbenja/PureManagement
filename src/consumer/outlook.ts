import type { EnergyInterval, WeatherState } from '../domain/energy'
import { validateRecordRange } from '../simulation/aggregate'

export interface DailyOutlook {
  date: string
  weatherState: WeatherState
  minTemperatureF: number
  maxTemperatureF: number
  precipitationInches: number
  expectedSolarKwh: number
}

const weatherStates: readonly WeatherState[] = [
  'clear',
  'partly-cloudy',
  'overcast',
  'rain',
]

const dryWeatherTieOrder = ['overcast', 'partly-cloudy', 'clear'] as const

const clampIndex = (index: number, recordCount: number): number => {
  if (Number.isNaN(index) || index === Number.NEGATIVE_INFINITY) return 0
  if (index === Number.POSITIVE_INFINITY) return recordCount - 1
  return Math.min(recordCount - 1, Math.max(0, Math.trunc(index)))
}

const dateKey = (record: EnergyInterval): string =>
  `${record.year}-${record.month.toString().padStart(2, '0')}-${record.day.toString().padStart(2, '0')}`

const validateOutlookRecord = (record: EnergyInterval, index: number) => {
  if (
    !Number.isFinite(record.temperatureF) ||
    !Number.isFinite(record.precipitationInches) || record.precipitationInches < 0 ||
    !Number.isFinite(record.solarKwh) || record.solarKwh < 0 ||
    !weatherStates.includes(record.weatherState)
  ) throw new Error(`Record ${index} contains invalid outlook values`)
}

const isSameLocalDate = (left: EnergyInterval | undefined, right: EnergyInterval): boolean =>
  left !== undefined &&
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day

export const getDailyOutlook = (
  records: readonly EnergyInterval[],
  anchorIndex: number,
  days = 7,
): DailyOutlook[] => {
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new Error('Invalid days')
  }
  if (records.length === 0) return []

  const anchor = clampIndex(anchorIndex, records.length)
  validateRecordRange(records, anchor, anchor)
  const anchorRecord = records[anchor]!
  let index = anchor
  while (index > 0 && isSameLocalDate(records[index - 1], anchorRecord)) index -= 1

  let selectedEnd = index
  let selectedDays = 0
  while (selectedEnd < records.length && selectedDays < days) {
    const first = records[selectedEnd]
    if (first === undefined || first.year !== anchorRecord.year) break
    selectedDays += 1
    selectedEnd += 1
    while (
      selectedEnd < records.length &&
      isSameLocalDate(records[selectedEnd], first)
    ) selectedEnd += 1
  }
  validateRecordRange(records, index, selectedEnd - 1)

  const outlook: DailyOutlook[] = []
  while (index < selectedEnd) {
    const first = records[index]!

    const date = dateKey(first)
    let minTemperatureF = Number.POSITIVE_INFINITY
    let maxTemperatureF = Number.NEGATIVE_INFINITY
    let precipitationInches = 0
    let expectedSolarKwh = 0
    let hasRain = false
    const dryCounts: Record<(typeof dryWeatherTieOrder)[number], number> = {
      overcast: 0,
      'partly-cloudy': 0,
      clear: 0,
    }

    while (index < selectedEnd && dateKey(records[index]!) === date) {
      const record = records[index]!
      validateOutlookRecord(record, index)
      minTemperatureF = Math.min(minTemperatureF, record.temperatureF)
      maxTemperatureF = Math.max(maxTemperatureF, record.temperatureF)
      precipitationInches += record.precipitationInches
      expectedSolarKwh += record.solarKwh
      if (record.precipitationInches > 0) hasRain = true
      if (record.weatherState !== 'rain') dryCounts[record.weatherState] += 1
      if (!Number.isFinite(precipitationInches) || !Number.isFinite(expectedSolarKwh)) {
        throw new Error(`Record ${record.index} causes outlook aggregate overflow`)
      }
      index += 1
    }

    let weatherState: WeatherState = 'rain'
    if (!hasRain) {
      weatherState = dryWeatherTieOrder.reduce((selected, candidate) =>
        dryCounts[candidate] > dryCounts[selected] ? candidate : selected)
    }

    outlook.push({
      date,
      weatherState,
      minTemperatureF,
      maxTemperatureF,
      precipitationInches,
      expectedSolarKwh,
    })
  }

  return outlook
}
