# PureManagement energy simulation

A deterministic, fully local home-energy dataset for a high-use detached home in LADWP territory. It models all of 2026 in Woodland Hills at five-minute resolution, including synthetic weather, solar production, cooling and electric heat-pump demand, household loads, EV travel and charging, battery storage, grid flows, electricity costs, savings, and avoided CO2e.

The included inspector verifies the annual data contract. A presentation-grade dashboard remains a separate design stage.

## Run locally

```bash
bun install
bun run dev
```

Open the local address printed by Vite. Run the complete verification gate with:

```bash
bun run check
```

## Annual dataset and playback

- Location: Woodland Hills, Los Angeles
- Period: January 1–December 31, 2026
- Interval: one record every five absolute minutes
- Records: 105,120, normally 288 per local day
- Playback: one simulated day per 60 real seconds
- Full loop: 365 real minutes, or 6 hours 5 minutes, then playback returns to January 1
- Visual interpolation: instantaneous power and battery state only
- Ledger totals: always calculated from the original five-minute records

The annual scenario targets 13,581.49 kWh of solar, 15,500 kWh of home demand, and 4,080 kWh of EV charging. Winter home demand includes an electric heat pump; warmer months include the established cooling profile.

The ledger is continuous in absolute time across daylight-saving changes. Local labels skip from 01:55 PST to 03:00 PDT on March 8 and repeat the 01:00 hour with distinct offsets on November 1. This produces 276 local records on the spring transition day, 300 on the autumn transition day, and 288 on other local dates.

Weather is synthetic, deterministic, and generated locally from the versioned scenario seed. Seasonal temperatures and rain-event probabilities are anchored to monthly Woodland Hills climate profiles so rainy periods, summer cooling, and winter heating form a believable yearly story. The data is not observed weather and does not update from a weather service.

## Public data surfaces

Use the framework-neutral entry point when a component, worker, or service only needs data:

```ts
import {
  LOS_ANGELES_2026,
  generateYear,
  getDailyOutlook,
  getHistoryView,
  getLiveFrame,
  validateYear,
  type DailyOutlook,
  type EnergyInterval,
  type HistoryView,
  type LiveFrame,
  type TimeRange,
  type WeatherState,
} from './index'

const records = generateYear()
```

Use the React adapter when a component needs playback and time navigation:

```ts
import { useEnergySimulation } from './consumer/useEnergySimulation'
```

`src/index.ts` intentionally does not export React. Simulation scripts, tests, workers, and non-React consumers remain independent from the UI framework.

## React component example

Generate the year once at module scope and pass the immutable records to components. Module scope also prevents duplicate annual generation during React development checks:

```tsx
import { generateYear } from './index'
import { EnergyOverview } from './components/EnergyOverview'

const records = generateYear()

export function App() {
  return <EnergyOverview records={records} />
}
```

A component can consume ready-to-display views without recalculating energy flows:

```tsx
import type { EnergyInterval } from './index'
import { useEnergySimulation } from './consumer/useEnergySimulation'

interface EnergyOverviewProps {
  records: readonly EnergyInterval[]
}

export function EnergyOverview({ records }: EnergyOverviewProps) {
  const simulation = useEnergySimulation(records)

  if (!simulation.live || !simulation.history) {
    return <p>No energy data available.</p>
  }

  const battery = simulation.live.nodes.find((node) => node.id === 'battery')

  return (
    <section>
      <time dateTime={simulation.live.timestamp}>
        {simulation.live.timestamp}
      </time>

      <p>Battery: {battery?.socPercent.toFixed(0)}%</p>
      <p>Saved: ${simulation.history.totals.savingsUsd.toFixed(2)}</p>

      <button onClick={() => simulation.setRange('24h')}>Last 24h</button>
      <button onClick={() => simulation.setRange('7d')}>Last 7 days</button>
      <button onClick={() => simulation.setRange('30d')}>Last 30 days</button>
      <button onClick={() => simulation.setRange('month')}>Calendar month</button>
      <button onClick={() => simulation.setRange('ytd')}>Year to date</button>

      <button
        disabled={!simulation.history.range.canGoPrevious}
        onClick={simulation.previousPeriod}
      >
        Previous period
      </button>
      <button
        disabled={!simulation.history.range.canGoNext}
        onClick={simulation.nextPeriod}
      >
        Next period
      </button>
    </section>
  )
}
```

## Time ranges

`getRangeWindow()`, `getHistoryView()`, and the React controller accept six keys:

| Key | Meaning |
| --- | --- |
| `24h` | Trailing 24 hours, bounded at the start of the ledger |
| `7d` | Trailing 7 days |
| `30d` | Trailing 30 days; may cross calendar-month boundaries |
| `31d` | Legacy fixed 31-day August-compatible range |
| `month` | Local calendar month containing the anchor |
| `ytd` | January 1 through the anchor |

Every range works at an arbitrary valid anchor; no date is hard-wired. Previous and next anchors remain bounded to the annual ledger. Calling `play()` after browsing a historical period returns the history view to its retained live position.

## Component-to-data mapping

| Component | Read from |
| --- | --- |
| City and location | `LOS_ANGELES_2026.location` |
| Active date and time | `live.timestamp` |
| Energy-flow lines | `live.transfers` |
| Solar, home, EV, battery, and grid cards | `live.nodes` |
| Battery percentage | Battery node `socPercent` |
| Appliance breakdown | `live.appliancesKwh` |
| Temperature, weather, and rain | `live.conditions` |
| Current tariff and interval economics | `live.accounting` |
| Power history chart | `history.series` |
| Energy, money, and carbon totals | `history.totals` |
| Selected filter and dates | `range` and `history.range` |
| Previous/next button state | `history.range.canGoPrevious` and `canGoNext` |
| Seven-day simulated outlook | `outlook` or `getDailyOutlook()` |

The React controller also exposes `play`, `pause`, `toggle`, `scrubTo(index)`, `jumpDay(delta)`, `previousPeriod`, and `nextPeriod`.

### Live frame

`getLiveFrame(records, index, fraction)` and `simulation.live` provide:

- active timestamp, tariff period, day type, temperature, cloud factor, weather state, and precipitation
- five ordered nodes: solar, home, EV, battery, and grid
- explicit directions such as `importing`, `exporting`, `charging`, and `discharging`
- battery state in kWh and percent
- active source-to-destination transfers
- appliance energy breakdown
- current interval cost, export credit, savings, and avoided CO2e

Components can animate flow lines directly from `live.transfers`. Each transfer already contains `source`, `destination`, `kw`, and `kwh`; consumers do not need to infer routing from signed values.

### Historical view and sampling

`getHistoryView(records, range, anchorIndex)` and `simulation.history` provide exact start/end boundaries, bounded navigation, precomputed totals, and chart-ready solar, home, EV, battery, grid-import, and grid-export series.

Energy, money, and carbon totals use every original record in the selected window. Only `history.series` is sampled, and it is bounded to at most 2,048 points so annual charts remain responsive. Never calculate totals from the sampled chart series or from interpolated live values.

### Simulated daily outlook

`getDailyOutlook(records, anchorIndex)` and `simulation.outlook` derive the anchor's local date plus following available dates, up to seven local days total, from the annual ledger. Each day includes the local date, dominant weather state, minimum and maximum temperature, simulated precipitation, and expected solar energy. The selector stops at December 31 and never wraps into a new year.

This outlook is part of the deterministic simulated scenario. It is not a live weather forecast and must be labeled as simulated wherever it is displayed.

## Units and accounting rules

- `kW` is instantaneous power.
- Interval `kWh` is energy during one five-minute record.
- Aggregate `kWh` is the sum of ledger records in a selected range.
- Transfer power and energy are AC-side values, so flow lines reconcile with node power.
- Battery state of charge is storage-side kWh and includes conversion losses.
- Money fields are USD.
- Carbon fields are kilograms of CO2e.
- Grid exports are export credit earned, not cash income.

Use `history.totals` or the exported aggregation helpers so accounting always reconciles with the immutable ledger.

## Framework-neutral selectors

React is optional. A non-React consumer can create the same views:

```ts
import {
  generateYear,
  getDailyOutlook,
  getHistoryView,
  getLiveFrame,
} from './index'

const records = generateYear()
const anchor = records.length - 1
const live = getLiveFrame(records, anchor, 0.25)
const history = getHistoryView(records, '30d', anchor)
const outlook = getDailyOutlook(records, anchor)
```

The scenario and generated records are runtime-frozen. Treat them as immutable and derive UI state through selectors rather than modifying source data.

## August compatibility

`generateMonth()` and `LOS_ANGELES_AUGUST_2026` remain public for existing consumers. The legacy fixture still returns 8,928 August records and its approved totals: 1,414.65 kWh of solar, 1,825 kWh of home consumption, and 340 kWh of EV charging.

New annual consumers should use `generateYear()` and `LOS_ANGELES_2026`.
