# PureManagement energy simulation

A deterministic home-energy dataset for a high-use detached home in LADWP territory. It models August 2026 in five-minute intervals, including solar production, household demand, EV charging and travel, battery storage, grid imports and exports, electricity costs, savings, and avoided CO2e.

The included inspector is deliberately plain. It verifies the data contract while future visual components remain free to define their own layout and styling.

## Run locally

```bash
bun install
bun run dev
```

Open the local address printed by Vite. Run the complete verification gate with:

```bash
bun run check
```

## Dataset and playback

- Location: Woodland Hills, Los Angeles
- Period: August 1–31, 2026
- Interval: one sample every five simulated minutes
- Samples: 288 per day and 8,928 for the month
- Playback: one simulated day per 60 real seconds
- Visual interpolation: instantaneous power and battery state only
- Ledger totals: always calculated from the original five-minute records

The fixed scenario produces 1,414.65 kWh of solar energy, 1,825 kWh of home consumption, and 340 kWh of EV charging.

## Public data surfaces

Use the framework-neutral entry point when a component or service only needs data:

```ts
import {
  generateMonth,
  getHistoryView,
  getLiveFrame,
  type EnergyInterval,
  type HistoryView,
  type LiveFrame,
  type TimeRange,
} from '../index'
```

Use the React adapter when a component needs playback and time navigation:

```ts
import { useEnergySimulation } from '../consumer/useEnergySimulation'
```

`src/index.ts` intentionally does not export React. This keeps simulation scripts, tests, workers, and other non-React consumers independent from the UI framework.

## React component example

Generate the month once at module scope and pass the immutable records to components. Module scope avoids generating the full month twice during React development checks:

```tsx
import { generateMonth } from './index'
import { EnergyOverview } from './components/EnergyOverview'

const records = generateMonth()

export function App() {
  return <EnergyOverview records={records} />
}
```

A future component can consume ready-to-display views without calculating energy flows:

```tsx
import type { EnergyInterval } from '../domain/energy'
import { useEnergySimulation } from '../consumer/useEnergySimulation'

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
      <button onClick={() => simulation.setRange('7d')}>Last week</button>
      <button onClick={() => simulation.setRange('31d')}>Last month</button>

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

## Component-to-data mapping

| Future component | Read from |
| --- | --- |
| Energy-flow lines | `live.transfers` |
| Solar, home, EV, battery, and grid cards | `live.nodes` |
| Battery percentage | Battery node `socPercent` |
| Appliance breakdown | `live.appliancesKwh` |
| Current tariff and interval economics | `live.accounting` |
| Power history chart | `history.series` |
| Energy summary cards | `history.totals` |
| Money saved | `history.totals.savingsUsd` |
| Grid purchase cost | `history.totals.importCostUsd` |
| Export credit earned | `history.totals.exportCreditUsd` |
| Avoided emissions | `history.totals.avoidedCo2Kg` |
| Selected filter and dates | `range` and `history.range` |
| Previous/next button state | `history.range.canGoPrevious` and `canGoNext` |

The React controller also exposes `play`, `pause`, `toggle`, `scrubTo(index)`, `jumpDay(delta)`, `previousPeriod`, and `nextPeriod`. Calling `play()` after browsing historical periods returns the view to its retained live position.

### Live frame

`getLiveFrame(records, index, fraction)` and `simulation.live` provide:

- `timestamp`, tariff period, day type, temperature, and cloud factor
- five ordered nodes: solar, home, EV, battery, and grid
- explicit directions such as `importing`, `exporting`, `charging`, and `discharging`
- battery state in kWh and percent
- active source-to-destination transfers
- appliance energy breakdown
- current interval cost, credit, savings, and avoided CO2e

Components should animate flow lines from `live.transfers`. Each transfer already contains `source`, `destination`, `kw`, and `kwh`; components do not need to infer routing from signed values.

### Historical view

`getHistoryView(records, range, anchorIndex)` and `simulation.history` provide:

- the exact records in the selected 24-hour, seven-day, or 31-day window
- start/end indexes and timestamps
- bounded previous/next navigation flags
- precomputed energy, money, and carbon totals
- chart-ready solar, home, EV, battery, grid-import, and grid-export series

## Units and accounting rules

- `kW` is instantaneous power.
- Interval `kWh` is energy during one five-minute record.
- Aggregate `kWh` is the sum of ledger records in a selected range.
- Transfer power and energy are AC-side values, so flow lines reconcile with node power.
- Battery state of charge is storage-side kWh and includes conversion losses.
- Money fields are USD.
- Carbon fields are kilograms of CO2e.

Do not calculate totals from interpolated visual values. Use `history.totals` or the exported aggregation helpers so money, energy, and carbon always reconcile with the ledger.

## Lower-level selectors

React is optional. A non-React consumer can create exactly the same views:

```ts
import { generateMonth, getHistoryView, getLiveFrame } from './index'

const records = generateMonth()
const live = getLiveFrame(records, 144, 0.25)
const history = getHistoryView(records, '7d', records.length - 1)
```

The scenario and generated records are runtime-frozen. Treat them as immutable and derive UI state through selectors rather than modifying source data.
