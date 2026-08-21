import { beforeAll, describe, expect, it } from 'vitest'
import type { EnergyInterval, WeatherState } from '../domain/energy'
import { generateYear } from '../simulation/generateYear'
import { getDailyOutlook } from './outlook'

describe('getDailyOutlook', () => {
  let records: readonly EnergyInterval[]

  beforeAll(() => {
    records = generateYear()
  })

  const indexAt = (month: number, day: number, minuteOfDay: number) =>
    records.findIndex((record) =>
      record.month === month && record.day === day && record.minuteOfDay === minuteOfDay)

  const recordsForDate = (year: number, month: number, day: number) =>
    records.filter((record) =>
      record.year === year && record.month === month && record.day === day)

  it('returns seven distinct local dates starting with an arbitrary anchor date', () => {
    const outlook = getDailyOutlook(records, indexAt(2, 15, 13 * 60 + 20))

    expect(outlook.map((day) => day.date)).toEqual([
      '2026-02-15',
      '2026-02-16',
      '2026-02-17',
      '2026-02-18',
      '2026-02-19',
      '2026-02-20',
      '2026-02-21',
    ])
  })

  it('aggregates exact full-day temperature, precipitation, and solar values', () => {
    const dayRecords = recordsForDate(2026, 2, 15)
    const day = getDailyOutlook(records, indexAt(2, 15, 13 * 60 + 20), 1)[0]!

    expect(day).toMatchObject({
      date: '2026-02-15',
      minTemperatureF: Math.min(...dayRecords.map((record) => record.temperatureF)),
      maxTemperatureF: Math.max(...dayRecords.map((record) => record.temperatureF)),
      precipitationInches: dayRecords.reduce(
        (total, record) => total + record.precipitationInches,
        0,
      ),
      expectedSolarKwh: dayRecords.reduce((total, record) => total + record.solarKwh, 0),
    })
  })

  it('classifies any date with positive interval precipitation as rain', () => {
    const rainyRecord = records.find((record) => record.precipitationInches > 0)!
    const day = getDailyOutlook(records, rainyRecord.index, 1)[0]!

    expect(day.weatherState).toBe('rain')
    expect(day.precipitationInches).toBeGreaterThan(0)
  })

  it('uses deterministic dry-weather frequency ties in overcast, partly-cloudy, clear order', () => {
    const states: WeatherState[] = [
      'clear',
      'partly-cloudy',
      'overcast',
      'clear',
      'partly-cloudy',
      'overcast',
      'rain',
    ]
    const source = states.map((weatherState, index) => ({
      ...records[0]!,
      index,
      weatherState,
      precipitationInches: 0,
    }))

    expect(getDailyOutlook(source, 0, 1)[0]!.weatherState).toBe('overcast')
  })

  it('groups daylight-saving transition dates by calendar fields', () => {
    const marchRecords = recordsForDate(2026, 3, 8)
    const novemberRecords = recordsForDate(2026, 11, 1)
    const march = getDailyOutlook(records, indexAt(3, 8, 12 * 60), 1)[0]!
    const november = getDailyOutlook(records, indexAt(11, 1, 12 * 60), 1)[0]!

    expect(marchRecords).toHaveLength(276)
    expect(novemberRecords).toHaveLength(300)
    expect(march.expectedSolarKwh).toBe(
      marchRecords.reduce((total, record) => total + record.solarKwh, 0),
    )
    expect(november.expectedSolarKwh).toBe(
      novemberRecords.reduce((total, record) => total + record.solarKwh, 0),
    )
  })

  it('does not wrap past December 31', () => {
    const outlook = getDailyOutlook(records, indexAt(12, 31, 12 * 60), 7)

    expect(outlook).toHaveLength(1)
    expect(outlook[0]!.date).toBe('2026-12-31')
  })

  it('returns empty data explicitly and clamps anchors like the live selector', () => {
    expect(getDailyOutlook([], 0)).toEqual([])
    expect(getDailyOutlook(records, Number.NaN, 1)[0]!.date).toBe('2026-01-01')
    expect(getDailyOutlook(records, Number.NEGATIVE_INFINITY, 1)[0]!.date).toBe('2026-01-01')
    expect(getDailyOutlook(records, Number.POSITIVE_INFINITY, 1)[0]!.date).toBe('2026-12-31')
    expect(getDailyOutlook(records, indexAt(2, 15, 0) + 0.9, 1)[0]!.date).toBe('2026-02-15')
  })

  it.each([0, -1, 1.5, 8, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid day count %s',
    (days) => {
      expect(() => getDailyOutlook(records, 0, days)).toThrow(/days/i)
    },
  )

  it.each([
    ['temperatureF', Number.NaN],
    ['precipitationInches', -0.1],
    ['solarKwh', Number.POSITIVE_INFINITY],
    ['weatherState', 'snow'],
  ] as const)('rejects malformed %s outlook inputs', (field, value) => {
    const malformed = [{ ...records[0]!, [field]: value }] as EnergyInterval[]

    expect(() => getDailyOutlook(malformed, 0, 1)).toThrow(/record 0.*outlook/i)
  })

  it('does not mutate source records', () => {
    const before = records.slice()

    getDailyOutlook(records, indexAt(8, 15, 12 * 60), 7)

    expect(records).toEqual(before)
    expect(records.every((record, index) => record === before[index])).toBe(true)
  })
})
