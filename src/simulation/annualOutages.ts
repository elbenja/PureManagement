export type GridStatus = 'connected' | 'outage'

export interface AnnualOutage {
  id: 'winter' | 'summer'
  start: string
  end: string
}

export const ANNUAL_OUTAGES: readonly AnnualOutage[] = Object.freeze([
  Object.freeze({
    id: 'winter',
    start: '2026-01-15T15:00:00.000-08:00',
    end: '2026-01-15T17:30:00.000-08:00',
  }),
  Object.freeze({
    id: 'summer',
    start: '2026-07-21T13:00:00.000-07:00',
    end: '2026-07-21T17:30:00.000-07:00',
  }),
])

const outageTimes = ANNUAL_OUTAGES.map(({ start, end }) => [Date.parse(start), Date.parse(end)])

export const gridStatusAt = (iso: string): GridStatus => {
  const time = Date.parse(iso)
  return outageTimes.some(([start, end]) => time >= start! && time < end!)
    ? 'outage'
    : 'connected'
}
