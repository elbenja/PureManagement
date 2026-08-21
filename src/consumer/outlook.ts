import type { EnergyInterval, WeatherState } from '../domain/energy'

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

const validatedFrozenOutlookRecords = new WeakSet<readonly EnergyInterval[]>()

const clampIndex = (index: number, recordCount: number): number => {
  if (Number.isNaN(index) || index === Number.NEGATIVE_INFINITY) return 0
  if (index === Number.POSITIVE_INFINITY) return recordCount - 1
  return Math.min(recordCount - 1, Math.max(0, Math.trunc(index)))
}

const dateKey = (record: EnergyInterval): string =>
  `${record.year}-${record.month.toString().padStart(2, '0')}-${record.day.toString().padStart(2, '0')}`

const validateRecords = (records: readonly EnergyInterval[]) => {
  if (validatedFrozenOutlookRecords.has(records)) return

  let firstRecordIndex: number | null = null
  let previousDate = Number.NEGATIVE_INFINITY

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const recordIndex = record?.index
    if (index === 0 && typeof recordIndex === 'number' && Number.isSafeInteger(recordIndex)) {
      firstRecordIndex = recordIndex
    }
    if (
      record === undefined ||
      typeof recordIndex !== 'number' ||
      !Number.isSafeInteger(recordIndex) ||
      firstRecordIndex === null ||
      recordIndex !== firstRecordIndex + index ||
      !Number.isInteger(record.year) || record.year < 1 ||
      !Number.isInteger(record.month) || record.month < 1 || record.month > 12 ||
      !Number.isInteger(record.day) || record.day < 1 ||
      record.day > new Date(Date.UTC(record.year, record.month, 0)).getUTCDate() ||
      !Number.isFinite(record.temperatureF) ||
      !Number.isFinite(record.precipitationInches) || record.precipitationInches < 0 ||
      !Number.isFinite(record.solarKwh) || record.solarKwh < 0 ||
      !weatherStates.includes(record.weatherState)
    ) {
      throw new Error(`Record ${index} contains invalid outlook values`)
    }

    const date = Date.UTC(record.year, record.month - 1, record.day)
    if (date < previousDate) {
      throw new Error(`Record ${index} contains invalid outlook calendar order`)
    }
    previousDate = date
  }

  if (Object.isFrozen(records) && records.every((record) => Object.isFrozen(record))) {
    validatedFrozenOutlookRecords.add(records)
  }
}

export const getDailyOutlook = (
  records: readonly EnergyInterval[],
  anchorIndex: number,
  days = 7,
): DailyOutlook[] => {
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new Error('Invalid days')
  }
  if (records.length === 0) return []

  validateRecords(records)
  const anchor = clampIndex(anchorIndex, records.length)
  const anchorRecord = records[anchor]!
  const anchorDate = dateKey(anchorRecord)
  let index = anchor
  while (index > 0 && dateKey(records[index - 1]!) === anchorDate) index -= 1

  const outlook: DailyOutlook[] = []
  while (index < records.length && outlook.length < days) {
    const first = records[index]!
    if (first.year !== anchorRecord.year) break

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

    while (index < records.length && dateKey(records[index]!) === date) {
      const record = records[index]!
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
