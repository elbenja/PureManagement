# Woodland Hills Annual Energy Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, locally generated 2026 Woodland Hills energy ledger with believable seasonal weather, winter heating, annual playback, arbitrary time navigation, and a seven-day simulated outlook while preserving the existing August API.

**Architecture:** Keep the approved August generator intact as the legacy fixture and add focused annual clock, weather, solar, EV, validation, and orchestration modules. Generalize only the home, router, accounting, range, and consumer layers that must serve both datasets. The immutable five-minute ledger remains the single source for live flow, history, accounting, and outlook views.

**Tech Stack:** Bun, TypeScript 7, React 19, Vite 8, Vitest 4, Testing Library, and plain CSS

---

## Approved source

Implement against [the approved annual design specification](../specs/2026-08-17-woodland-hills-annual-energy-flow-design.md). Do not begin the showcase-dashboard design in this plan.

## Execution prerequisite

Before Task 1, use `superpowers:using-git-worktrees` to create an isolated worktree and confirm the baseline with:

```bash
bun run check
```

Expected: typecheck, all existing tests, and the Vite build pass before annual work begins.

## File map

| Path | Responsibility |
|---|---|
| `src/domain/energy.ts` | Year-aware clock and weather fields shared by August and annual ledgers |
| `src/scenario/deepFreeze.ts` | Shared recursive freeze helper |
| `src/scenario/losAngelesAugust2026.ts` | Unchanged public August values using the shared freeze helper |
| `src/scenario/losAngeles2026.ts` | Versioned annual system, climate, solar, home, and EV targets |
| `src/simulation/time.ts` | Existing August clock and shared TOU classification |
| `src/simulation/yearClock.ts` | Continuous absolute 2026 clock with Los Angeles DST conversion |
| `src/simulation/conditions.ts` | Existing August conditions plus compatible weather metadata |
| `src/simulation/annualConditions.ts` | Seeded seasonal temperatures, cloud cover, rain systems, and occupancy |
| `src/simulation/solar.ts` | Existing August solar generator |
| `src/simulation/annualSolar.ts` | Month-calibrated annual daylight and solar generation |
| `src/simulation/home.ts` | Shared home-load generator with opt-in heating and monthly scaling |
| `src/simulation/ev.ts` | Existing August EV fixture |
| `src/simulation/annualEv.ts` | Calendar-day-aware annual travel, charging, and SOC continuity |
| `src/simulation/router.ts` | Scenario-parameterized battery and grid routing |
| `src/simulation/accounting.ts` | Scenario-parameterized tariff and emissions accounting |
| `src/simulation/generateYear.ts` | Annual orchestration, continuity, validation, and freezing |
| `src/simulation/validateYear.ts` | Annual clock, weather, energy, state, and target validation |
| `src/simulation/aggregate.ts` | Fixed-duration and calendar range boundaries |
| `src/consumer/views.ts` | Annual weather in live frames and bounded chart sampling |
| `src/consumer/outlook.ts` | Up-to-seven-day simulated weather and solar outlook |
| `src/consumer/useEnergySimulation.ts` | Range navigation and outlook in the React controller |
| `src/inspector/SimulationInspector.tsx` | Annual metadata, ranges, weather, and outlook inspection |
| `src/App.tsx` | Generate the annual ledger once and preserve the failure boundary |
| `src/index.ts` | Framework-neutral annual public exports |
| `README.md` | Annual dataset, ranges, outlook, and compatibility documentation |

Tests remain beside their units using existing `*.test.ts(x)` conventions.

### Task 1: Add the annual scenario and compatible domain fields

**Files:**
- Create: `src/scenario/deepFreeze.ts`
- Create: `src/scenario/losAngeles2026.ts`
- Create: `src/scenario/losAngeles2026.test.ts`
- Modify: `src/scenario/losAngelesAugust2026.ts`
- Modify: `src/domain/energy.ts`
- Modify: `src/simulation/time.ts`
- Modify: `src/simulation/conditions.ts`
- Modify: `src/simulation/generateMonth.ts`
- Modify: `src/simulation/time.test.ts`
- Modify: `src/simulation/generateMonth.test.ts`

- [ ] **Step 1: Write failing tests for the annual scenario and the expanded August record contract**

Add tests that require a deeply frozen annual scenario, 105,120 records, the approved solar table, and weather-compatible August records:

```ts
import { describe, expect, it } from 'vitest'
import { LOS_ANGELES_2026 } from './losAngeles2026'

const deepFrozen = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') return true
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen)
}

describe('LOS_ANGELES_2026', () => {
  it('defines the approved immutable annual targets', () => {
    expect(LOS_ANGELES_2026).toMatchObject({
      id: 'woodland-hills-2026-v1',
      records: 105_120,
      intervalMinutes: 5,
      year: 2026,
    })
    expect(LOS_ANGELES_2026.months.map((month) => month.solarTargetKwh))
      .toEqual([791, 867, 1155, 1300, 1380, 1440, 1470, 1414.65, 1205, 1050, 780, 728.84])
    expect(LOS_ANGELES_2026.months.reduce((sum, month) => sum + month.solarTargetKwh, 0))
      .toBeCloseTo(13_581.49, 8)
    expect(deepFrozen(LOS_ANGELES_2026)).toBe(true)
  })
})
```

In `generateMonth.test.ts`, assert the first legacy record has `year: 2026`, `month: 8`, `dayOfYear: 213`, `utcOffset: '-07:00'`, a valid `weatherState`, and `precipitationInches: 0`. Keep all existing August total assertions unchanged.

- [ ] **Step 2: Run the focused tests and verify the intended failures**

Run:

```bash
bun run test src/scenario/losAngeles2026.test.ts src/simulation/time.test.ts src/simulation/generateMonth.test.ts
```

Expected: FAIL because the annual scenario and year/weather fields do not exist.

- [ ] **Step 3: Add the shared freeze helper, domain fields, and annual scenario**

Move the existing recursive helper without changing its behavior:

```ts
// src/scenario/deepFreeze.ts
export const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}
```

Add `WeatherState` and make these clock fields required:

```ts
export type WeatherState = 'clear' | 'partly-cloudy' | 'overcast' | 'rain'

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
```

Add `weatherState: WeatherState` and `precipitationInches: number` to `EnergyInterval`, and the same two fields to `Condition`. Populate the August clock with `year: 2026`, `month: 8`, `dayOfYear: day + 212`, and `utcOffset: '-07:00'`. Preserve August condition numerics; derive metadata only:

```ts
weatherState: dayType === 'cloudy'
  ? 'overcast'
  : cloudFactor < 0.88 ? 'partly-cloudy' : 'clear',
precipitationInches: 0,
```

Copy those condition fields into each `generateMonth()` record.

Create `LOS_ANGELES_2026` with the existing equipment, tariff, and emissions values plus these exact monthly profiles:

```ts
const profiles = [
  [1, 791, 1250, 47, 67, 0.18],
  [2, 867, 1150, 49, 68, 0.18],
  [3, 1155, 1050, 51, 71, 0.12],
  [4, 1300, 950, 54, 75, 0.07],
  [5, 1380, 1000, 57, 78, 0.03],
  [6, 1440, 1200, 61, 84, 0.01],
  [7, 1470, 1650, 65, 91, 0.005],
  [8, 1414.65, 1825, 65, 92, 0.005],
  [9, 1205, 1550, 63, 89, 0.01],
  [10, 1050, 1250, 58, 82, 0.04],
  [11, 780, 1100, 51, 73, 0.10],
  [12, 728.84, 1525, 47, 67, 0.16],
] as const

months: profiles.map(([month, solarTargetKwh, homeTargetKwh, lowF, highF, rainStartProbability]) => ({
  month,
  solarTargetKwh,
  homeTargetKwh,
  lowF,
  highF,
  rainStartProbability,
})),
```

Set `home.targetAnnualKwh` to 15,500, `ev.targetMonthlyKwh` to 340, and `ev.targetAnnualKwh` to 4,080. Define `standardUtcOffset: '-08:00'` and `daylightUtcOffset: '-07:00'` instead of a single annual offset.

- [ ] **Step 4: Run the focused tests and the legacy month suite**

Run:

```bash
bun run test src/scenario/losAngeles2026.test.ts src/simulation/time.test.ts src/simulation/generateMonth.test.ts
```

Expected: PASS, including the unchanged August energy totals and deterministic fixture tests.

- [ ] **Step 5: Commit the compatible contract**

```bash
git add src/domain/energy.ts src/scenario src/simulation/time.ts src/simulation/conditions.ts src/simulation/generateMonth.ts src/simulation/time.test.ts src/simulation/generateMonth.test.ts
git commit -m "feat: define annual simulation contract"
```

### Task 2: Build the continuous annual clock with DST

**Files:**
- Create: `src/simulation/yearClock.ts`
- Create: `src/simulation/yearClock.test.ts`

- [ ] **Step 1: Write failing clock and DST tests**

```ts
import { describe, expect, it } from 'vitest'
import { buildYearClock } from './yearClock'

describe('buildYearClock', () => {
  it('creates every absolute five-minute interval in 2026', () => {
    const clock = buildYearClock()
    expect(clock).toHaveLength(105_120)
    expect(clock[0]?.iso).toBe('2026-01-01T00:00:00.000-08:00')
    expect(clock.at(-1)?.iso).toBe('2026-12-31T23:55:00.000-08:00')
    expect(new Set(clock.map((slot) => slot.iso)).size).toBe(clock.length)
  })

  it('skips spring local time and repeats autumn time with distinct offsets', () => {
    const clock = buildYearClock()
    const spring = clock.findIndex((slot) => slot.iso === '2026-03-08T01:55:00.000-08:00')
    expect(clock[spring + 1]?.iso).toBe('2026-03-08T03:00:00.000-07:00')
    const autumn = clock.findIndex((slot) => slot.iso === '2026-11-01T01:55:00.000-07:00')
    expect(clock[autumn + 1]?.iso).toBe('2026-11-01T01:00:00.000-08:00')
  })
})
```

Also assert spring has 276 local records, autumn has 300, all other dates have 288, and TOU classification uses local weekday/minute values.

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun run test src/simulation/yearClock.test.ts`

Expected: FAIL because `yearClock.ts` does not exist.

- [ ] **Step 3: Implement the absolute clock and explicit 2026 offsets**

Use fixed instants belonging to the versioned 2026 scenario, avoiding host-timezone behavior:

```ts
const START_MS = Date.parse('2026-01-01T00:00:00-08:00')
const END_MS = Date.parse('2027-01-01T00:00:00-08:00')
const DST_START_MS = Date.parse('2026-03-08T02:00:00-08:00')
const DST_END_MS = Date.parse('2026-11-01T02:00:00-07:00')
const STEP_MS = 5 * 60_000

const offsetFor = (instantMs: number) =>
  instantMs >= DST_START_MS && instantMs < DST_END_MS ? -7 : -8
```

For each absolute instant, add the offset before reading UTC calendar fields, format the ISO string with the matching offset, compute `dayOfYear` from local fields, and call the existing `classifyTou(dayOfWeek, minuteOfDay)`. Assert the final array length equals the scenario record count before returning it.

- [ ] **Step 4: Run clock and legacy time tests**

Run: `bun run test src/simulation/yearClock.test.ts src/simulation/time.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the annual clock**

```bash
git add src/simulation/yearClock.ts src/simulation/yearClock.test.ts
git commit -m "feat: add DST-aware annual clock"
```

### Task 3: Generate deterministic seasonal conditions and rain systems

**Files:**
- Create: `src/simulation/annualConditions.ts`
- Create: `src/simulation/annualConditions.test.ts`

- [ ] **Step 1: Write failing seasonal-weather tests**

Generate the full clock and assert:

```ts
const clock = buildYearClock()
const first = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
const second = buildAnnualConditions(clock, LOS_ANGELES_2026.seedId)
expect(first).toEqual(second)
expect(first).toHaveLength(105_120)
expect(first.every((point) => point.cloudFactor >= 0 && point.cloudFactor <= 1)).toBe(true)
expect(first.every((point) => point.precipitationInches >= 0)).toBe(true)
```

Group by `dayOfYear` and require at least one winter rain system spanning multiple consecutive days, at least one July–September heat-wave sequence, at least one winter cold snap, more rain intervals in November–March than June–September, and no single positive-precipitation interval isolated from every adjacent interval.

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun run test src/simulation/annualConditions.test.ts`

Expected: FAIL because `buildAnnualConditions` does not exist.

- [ ] **Step 3: Implement correlated daily weather**

Create one seeded daily descriptor per `dayOfYear`. Interpolate monthly low/high values using the current and next month profiles. Maintain `rainDaysRemaining`; when it is zero, begin a 1–3 day system when the seeded draw is below `rainStartProbability`.

Maintain two other correlated event counters. In July–September, a draw below 0.05 begins a 3–4 day heat wave and adds 10 °F to the interpolated daily temperatures. In December–February, a draw below 0.04 begins a 2–3 day cold snap and subtracts 8 °F. Give active heat waves `dayType: 'heatwave'`; otherwise give rainy/overcast systems `dayType: 'cloudy'`, then fall back to weekend or weekday. Force deterministic acceptance anchors only through the seed: if the first pass lacks a winter multi-day rain system, a summer heat wave, or a winter cold snap, regenerate the daily descriptors with `${seedId}:weather:1`, incrementing the suffix until all required event families exist, capped at 32 attempts with a clear error.

Use these concrete interval curves:

```ts
const dayFraction = slot.minuteOfDay / 1440
const temperatureF = lowF + (highF - lowF) *
  (0.5 + 0.5 * Math.cos(2 * Math.PI * (dayFraction - 16 / 24))) + dailyOffsetF
const rainPulse = rainy
  ? Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (dayFraction - 0.12) / 0.78))))
  : 0
const precipitationInches = rainy ? rainIntensity * rainPulse / 12 : 0
```

Set `weatherState` to `rain` when precipitation is positive, otherwise `overcast` for a rainy system, `partly-cloudy` for cloud factors below 0.82, and `clear` otherwise. Use `dayOfWeek` and local `minuteOfDay` for occupancy. Round temperature, cloud factor, and precipitation to stable decimal precision as the August generator does.

- [ ] **Step 4: Run the seasonal tests twice to prove reproduction**

Run:

```bash
bun run test src/simulation/annualConditions.test.ts
bun run test src/simulation/annualConditions.test.ts
```

Expected: both runs PASS with identical event dates.

- [ ] **Step 5: Commit annual conditions**

```bash
git add src/simulation/annualConditions.ts src/simulation/annualConditions.test.ts
git commit -m "feat: model annual weather conditions"
```

### Task 4: Generate month-calibrated annual solar

**Files:**
- Create: `src/simulation/annualSolar.ts`
- Create: `src/simulation/annualSolar.test.ts`

- [ ] **Step 1: Write failing annual solar tests**

Require 105,120 finite points, zero solar outside daylight, no value above 8 kW, and each month within `1e-6` kWh of its configured target. Verify the annual total is 13,581.49 kWh and a rainy midday produces less raw solar than a clear midday with a similar day-of-year.

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun run test src/simulation/annualSolar.test.ts`

Expected: FAIL because `generateAnnualSolar` does not exist.

- [ ] **Step 3: Implement month-specific daylight and scaling**

Use:

```ts
const dayLengthHours = 12 + 2.2 * Math.sin(2 * Math.PI * (slot.dayOfYear - 80) / 365)
const solarNoonMinute = slot.utcOffset === '-07:00' ? 12 * 60 + 55 : 11 * 60 + 55
const daylightStart = solarNoonMinute - dayLengthHours * 30
const daylightEnd = solarNoonMinute + dayLengthHours * 30
```

Inside the daylight window, calculate `capacityKw * sin(π * daylightProgress) * cloudFactor`. Group raw points by `slot.month`, reuse the existing bounded binary-search strategy separately for each group, and scale each month to `LOS_ANGELES_2026.months[month - 1].solarTargetKwh`. Throw if any target is unreachable under the capacity limit.

- [ ] **Step 4: Run annual and legacy solar tests**

Run: `bun run test src/simulation/annualSolar.test.ts src/simulation/solar.test.ts`

Expected: PASS; the August generator remains unchanged.

- [ ] **Step 5: Commit annual solar**

```bash
git add src/simulation/annualSolar.ts src/simulation/annualSolar.test.ts
git commit -m "feat: generate seasonal annual solar"
```

### Task 5: Generalize household load and add winter heat-pump demand

**Files:**
- Modify: `src/simulation/home.ts`
- Modify: `src/simulation/home.test.ts`
- Create: `src/simulation/annualHome.test.ts`

- [ ] **Step 1: Write failing annual home-load tests**

Call the shared generator with annual options and require exact monthly configured totals, an exact 15,500 kWh annual total, nonzero energy for every load category, and visible winter heating:

```ts
const points = generateHomeLoad(clock, conditions, {
  canonicalClock: clock,
  seedId: LOS_ANGELES_2026.seedId,
  monthlyTargetsKwh: LOS_ANGELES_2026.months.map((month) => month.homeTargetKwh),
  includeHeating: true,
})
expect(points.reduce((sum, point) => sum + point.kwh, 0)).toBeCloseTo(15_500, 6)
```

Compare cold winter intervals below 60 °F against equivalent occupied times in mild spring conditions and require higher mean HVAC kW. Keep the existing `generateHomeLoad(clock, conditions)` tests unchanged to protect the August fixture.

- [ ] **Step 2: Run annual and legacy home tests and verify only the annual call fails**

Run: `bun run test src/simulation/annualHome.test.ts src/simulation/home.test.ts`

Expected: FAIL because the third options argument does not exist; existing August tests still PASS.

- [ ] **Step 3: Add explicit generation options and heating**

Add:

```ts
export interface HomeLoadOptions {
  canonicalClock: readonly ClockSlot[]
  seedId: string
  monthlyTargetsKwh: readonly number[]
  includeHeating: boolean
}
```

Default to the canonical August clock, August seed, `[targetAugustKwh]`, and `includeHeating: false`. Key daily patterns by `${year}-${month}-${day}` and seed them with the supplied `seedId`. Preserve the current cooling formula. Add heating only when requested:

```ts
const heatingExcess = options.includeHeating ? Math.max(0, 65 - condition.temperatureF) : 0
const heatingAvailability = 0.55 + 0.45 * (
  pulse(minute, 7 * 60, 210) + pulse(minute, 20 * 60, 260)
)
const heatingKw = heatingExcess * 0.085 * heatingAvailability * (0.75 + 0.25 * occupied)
hvac: coolingKw + heatingKw
```

Validate the supplied clock against `canonicalClock` field by field. Scale raw breakdowns separately by calendar month when 12 targets are supplied; use the single legacy target across all records for August. Apply each month's one scale to every category so category reconciliation remains exact.

- [ ] **Step 4: Run home and month-integration tests**

Run:

```bash
bun run test src/simulation/annualHome.test.ts src/simulation/home.test.ts src/simulation/generateMonth.test.ts
```

Expected: PASS, including the exact legacy August home target.

- [ ] **Step 5: Commit household seasonality**

```bash
git add src/simulation/home.ts src/simulation/home.test.ts src/simulation/annualHome.test.ts
git commit -m "feat: add seasonal household heating load"
```

### Task 6: Generate continuous annual EV travel and charging

**Files:**
- Create: `src/simulation/annualEv.ts`
- Create: `src/simulation/annualEv.test.ts`

- [ ] **Step 1: Write failing annual EV tests**

Require deterministic output, 105,120 records, exactly one trip per local calendar day, 4,080 kWh annual trip and charge energy, each month between 250 and 450 kWh, charger power at or below 7.2 kW, valid availability, continuous SOC, every departure served, and final SOC equal to initial SOC.

Include explicit assertions across January/February, the spring DST day, the autumn DST day, and December 31 so the implementation cannot assume 288 records per local date.

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun run test src/simulation/annualEv.test.ts`

Expected: FAIL because `generateAnnualEv` does not exist.

- [ ] **Step 3: Implement calendar-grouped EV behavior**

Group clock indexes by `${year}-${month}-${day}` rather than slicing by 288. Build weekday and weekend trips with the existing mileage bounds and departure/return rules. Within each month, proportionally allocate daily trip energy to exactly 340 kWh while respecting each day's mileage bounds.

Walk the complete annual clock once. At each departure slot, deduct trip energy and add it to pending charge. Charge while available after 8:00 p.m. or before 7:30 a.m.; start earlier only if remaining preferred slots cannot satisfy the next trip. Use actual available clock indexes, so DST days require no special slot-count branch. Reconcile the last physical charging interval to the exact annual target, rebuild the SOC ledger, and run finite/bounds/continuity checks before returning.

- [ ] **Step 4: Run annual and legacy EV tests**

Run: `bun run test src/simulation/annualEv.test.ts src/simulation/ev.test.ts`

Expected: PASS; `generateEv()` remains the unchanged August fixture.

- [ ] **Step 5: Commit annual EV generation**

```bash
git add src/simulation/annualEv.ts src/simulation/annualEv.test.ts
git commit -m "feat: generate continuous annual EV activity"
```

### Task 7: Parameterize routing and accounting, then assemble and validate the year

**Files:**
- Modify: `src/simulation/router.ts`
- Modify: `src/simulation/router.test.ts`
- Modify: `src/simulation/accounting.ts`
- Modify: `src/simulation/accounting.test.ts`
- Create: `src/simulation/validateYear.ts`
- Create: `src/simulation/validateYear.test.ts`
- Create: `src/simulation/generateYear.ts`
- Create: `src/simulation/generateYear.test.ts`

- [ ] **Step 1: Write failing scenario-parameter and annual integration tests**

Add a router/accounting test that passes `LOS_ANGELES_2026` as the optional second argument and expects the same result as the legacy default for identical inputs. In `generateYear.test.ts`, require:

```ts
const records = generateYear()
expect(records).toHaveLength(105_120)
expect(validateYear(records)).toEqual([])
expect(records[0]?.batterySocStartKwh).toBeCloseTo(6.75)
expect(records.every(Object.isFrozen)).toBe(true)
expect(Object.isFrozen(records)).toBe(true)
```

Assert battery and vehicle continuity across every adjacent pair, energy balance below `1e-8`, monthly solar targets, annual home/EV totals, and deterministic equality of representative records from two calls. Mutation tests must make `validateYear` reject a duplicated timestamp, negative precipitation, broken battery continuity, simultaneous grid import/export, solar outside daylight, and a corrupted annual target.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
bun run test src/simulation/router.test.ts src/simulation/accounting.test.ts src/simulation/validateYear.test.ts src/simulation/generateYear.test.ts
```

Expected: FAIL because annual parameterization, validation, and generation do not exist.

- [ ] **Step 3: Parameterize routing and accounting without changing defaults**

Define narrow structural types:

```ts
export interface RouterScenario {
  intervalMinutes: number
  battery: {
    capacityKwh: number
    maxPowerKw: number
    roundTripEfficiency: number
    reservePercent: number
  }
}

export interface AccountingScenario {
  tariff: { energyRatesUsdPerKwh: Record<TouPeriod, number> }
  emissions: { kgCo2ePerKwh: number }
}
```

Change signatures to `routeInterval(input, scenario = LOS_ANGELES_AUGUST_2026)` and `accountInterval(input, scenario = LOS_ANGELES_AUGUST_2026)`. Move all derived constants currently at module scope into the call or a pure `routerConstants(scenario)` helper. Run all existing router/accounting tests before proceeding.

- [ ] **Step 4: Implement annual validation**

`validateYear(records)` returns `string[]` and caps errors at 100, matching `validateMonth`. Compare every record to `buildYearClock()`, check all numeric and weather fields, verify kW/kWh relations, allowed transfers, energy conservation, accounting recomputation with `LOS_ANGELES_2026`, battery/EV bounds and adjacent continuity, and grid/battery mutual exclusion.

Aggregate by month and year. Enforce configured solar targets within ±2%, exact configured home targets within the existing floating tolerance, EV month totals in 250–450 kWh, annual home 13,500–17,500 kWh, annual EV 3,600–4,800 kWh, at least one multi-day winter rain system, a summer heat wave, a winter cold snap, and greater wet-season than dry-season precipitation.

- [ ] **Step 5: Implement atomic annual generation**

Follow the existing `generateMonth()` orchestration with annual modules and scenario-aware routing/accounting. Start the battery at 50%, carry its state through all records, add weather fields to each record, call `validateYear(records)`, throw `Invalid annual simulation: ...` on any error, then recursively freeze breakdowns, transfers, records, and the outer array.

- [ ] **Step 6: Run annual integration and every legacy simulation test**

Run:

```bash
bun run test src/simulation
```

Expected: PASS with both the annual integration and all existing August tests.

- [ ] **Step 7: Commit annual orchestration**

```bash
git add src/simulation/router.ts src/simulation/router.test.ts src/simulation/accounting.ts src/simulation/accounting.test.ts src/simulation/validateYear.ts src/simulation/validateYear.test.ts src/simulation/generateYear.ts src/simulation/generateYear.test.ts
git commit -m "feat: assemble and validate annual energy ledger"
```

### Task 8: Add annual ranges, sampled history, and simulated outlook

**Files:**
- Modify: `src/simulation/aggregate.ts`
- Modify: `src/simulation/aggregate.test.ts`
- Modify: `src/consumer/views.ts`
- Modify: `src/consumer/views.test.ts`
- Create: `src/consumer/outlook.ts`
- Create: `src/consumer/outlook.test.ts`

- [ ] **Step 1: Write failing range, sampling, live-weather, and outlook tests**

Extend `TimeRange` to require `'24h' | '7d' | '30d' | '31d' | 'month' | 'ytd'`. Using annual records, anchor at the last February 15 interval and assert `30d` starts on January 17 and contains 8,640 records. Assert `month` returns all of February, `ytd` begins January 1 and ends at the anchor, and previous/next anchors are correct at month boundaries.

Require `getLiveFrame()` conditions to include weather state and precipitation. Require history totals to equal `aggregateIntervals(view.records)` while `view.series.length <= 2_048` for a year-to-date view.

For `getDailyOutlook(records, anchor, 7)`, assert seven distinct local dates, min/max temperature, summed precipitation and solar, a rain day labeled `rain`, and only one result when anchored on December 31.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
bun run test src/simulation/aggregate.test.ts src/consumer/views.test.ts src/consumer/outlook.test.ts
```

Expected: FAIL because annual ranges, weather views, sampling, and outlook do not exist.

- [ ] **Step 3: Add record-aware range windows**

Keep `getTrailingWindow()` and `'31d'` for compatibility. Add:

```ts
export interface RangeWindow {
  start: number
  end: number
  previousAnchor: number | null
  nextAnchor: number | null
}

export const getRangeWindow = (
  records: readonly EnergyInterval[],
  range: TimeRange,
  anchorIndex: number,
): RangeWindow => {
  if (records.length === 0) throw new Error('Invalid records')
  if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= records.length) {
    throw new Error('Invalid anchorIndex')
  }

  const fixedSlots: Partial<Record<TimeRange, number>> = {
    '24h': 288,
    '7d': 2_016,
    '30d': 8_640,
    '31d': 8_928,
  }
  const slots = fixedSlots[range]
  if (slots !== undefined) {
    const end = anchorIndex
    const start = Math.max(0, end - slots + 1)
    return {
      start,
      end,
      previousAnchor: start >= slots ? end - slots : null,
      nextAnchor: end + slots < records.length ? end + slots : null,
    }
  }

  const anchor = records[anchorIndex]!
  if (range === 'ytd') {
    let start = anchorIndex
    while (start > 0 && records[start - 1]!.year === anchor.year) start -= 1
    return { start, end: anchorIndex, previousAnchor: null, nextAnchor: null }
  }
  if (range !== 'month') throw new Error('Invalid range')

  let start = anchorIndex
  let end = anchorIndex
  while (
    start > 0 &&
    records[start - 1]!.year === anchor.year &&
    records[start - 1]!.month === anchor.month
  ) start -= 1
  while (
    end + 1 < records.length &&
    records[end + 1]!.year === anchor.year &&
    records[end + 1]!.month === anchor.month
  ) end += 1
  return {
    start,
    end,
    previousAnchor: start > 0 ? start - 1 : null,
    nextAnchor: end + 1 < records.length ? end + 1 : null,
  }
}
```

For fixed durations use 288, 2,016, 8,640, and 8,928 slots. For `month`, scan to the first and last record sharing the anchor's `year` and `month`; previous/next anchors are the adjacent records when present. For `ytd`, start at the first record sharing the anchor year, end at the anchor, and expose no period navigation. Validate range and anchor arguments exactly as existing helpers do.

- [ ] **Step 4: Extend views and bound series size**

Use `getRangeWindow()` in `getHistoryView()`. Add `previousAnchor` and `nextAnchor` to `HistoryRangeView`, with labels `Last 24h`, `Last week`, `Last 30 days`, `Last month`, `Calendar month`, and `Year to date`.

Add weather fields to `LiveFrame.conditions`. For chart series, keep raw points when the range has at most 2,048 records. Otherwise use `step = Math.ceil(records.length / 2_048)`, average each bucket's power values, and use the bucket's final index/timestamp. Continue calculating totals from all unsampled records.

- [ ] **Step 5: Implement the daily outlook selector**

Define:

```ts
export interface DailyOutlook {
  date: string
  weatherState: WeatherState
  minTemperatureF: number
  maxTemperatureF: number
  precipitationInches: number
  expectedSolarKwh: number
}
```

Clamp the anchor like the view selectors, include its local calendar date, and aggregate up to seven available distinct dates without wrapping. If any interval has precipitation, the dominant state is `rain`; otherwise select the most frequent state with the deterministic tie order `overcast`, `partly-cloudy`, `clear`.

- [ ] **Step 6: Run selector and all consumer tests**

Run: `bun run test src/simulation/aggregate.test.ts src/consumer`

Expected: PASS.

- [ ] **Step 7: Commit annual consumer selectors**

```bash
git add src/simulation/aggregate.ts src/simulation/aggregate.test.ts src/consumer/views.ts src/consumer/views.test.ts src/consumer/outlook.ts src/consumer/outlook.test.ts
git commit -m "feat: add annual history and outlook selectors"
```

### Task 9: Update the React controller and inspector for the annual contract

**Files:**
- Modify: `src/consumer/useEnergySimulation.ts`
- Modify: `src/consumer/useEnergySimulation.test.tsx`
- Modify: `src/inspector/SimulationInspector.tsx`
- Modify: `src/inspector/SimulationInspector.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing controller, inspector, and app tests**

Require the controller to expose `outlook`, switch to `30d`, `month`, and `ytd`, move fixed and calendar ranges using `previousAnchor`/`nextAnchor`, and keep next navigation bounded by the retained live index.

Update inspector tests to expect `woodland-hills-2026-v1`, `105,120 records`, weather state, precipitation, `Last 30 days`, `Calendar month`, `Year to date`, and a `Simulated 7-day outlook` table.

Mock `generateYear()` in `App.test.tsx` and retain both guarantees: generation happens once under Strict Mode and a thrown generator shows `Simulation data unavailable.`

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
bun run test src/consumer/useEnergySimulation.test.tsx src/inspector/SimulationInspector.test.tsx src/App.test.tsx
```

Expected: FAIL because the UI still consumes the August generator and fixed slot navigation.

- [ ] **Step 3: Refactor controller navigation around range metadata**

Memoize `getDailyOutlook(records, playback.index, 7)` and add it to `EnergySimulationController`. Replace `playback.index ± rangeSlots[range]` with `history.range.previousAnchor` and `history.range.nextAnchor`. A next anchor is usable only when it is non-null and not greater than `retainedLiveIndex.current`. Keep empty-dataset actions inert.

- [ ] **Step 4: Migrate the inspector and app**

Make `SimulationInspector` accept scenario metadata:

```ts
export interface SimulationInspectorProps {
  records: readonly EnergyInterval[]
  scenario?: { id: string; location: { neighborhood: string; city: string } }
}
```

Default the optional prop to the August scenario for compatibility. Pass `LOS_ANGELES_2026` from `App`. Render live weather and precipitation in the current interval, annual range buttons in History, and an accessible outlook table with Date, Weather, Low, High, Rain, and Solar columns.

Replace the module-scope generation cache's call to `generateMonth()` with `generateYear()` while retaining the same discriminated failure result.

- [ ] **Step 5: Run controller, inspector, and app tests**

Run:

```bash
bun run test src/consumer/useEnergySimulation.test.tsx src/inspector/SimulationInspector.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the annual inspector migration**

```bash
git add src/consumer/useEnergySimulation.ts src/consumer/useEnergySimulation.test.tsx src/inspector/SimulationInspector.tsx src/inspector/SimulationInspector.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: inspect annual energy simulation"
```

### Task 10: Publish the API, document the year, and run the release gate

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing public-surface tests**

Import and exercise `LOS_ANGELES_2026`, `generateYear`, `validateYear`, `getRangeWindow`, `getDailyOutlook`, `DailyOutlook`, and `WeatherState` from `src/index.ts`. Update the `TimeRange` type expectation to the six approved keys while retaining every legacy export assertion.

- [ ] **Step 2: Run the public API test and verify it fails**

Run: `bun run test src/index.test.ts`

Expected: FAIL because annual functions and types are not exported.

- [ ] **Step 3: Export only the approved framework-neutral surface**

Add the annual scenario, generator, validator, range window, outlook selector, and public types to `src/index.ts`. Keep generator internals such as `buildAnnualConditions`, `generateAnnualSolar`, `generateAnnualEv`, and `routeInterval` private, matching the existing API posture.

- [ ] **Step 4: Replace August-only README claims with annual documentation**

Document 105,120 records, Woodland Hills 2026, DST behavior, climate-anchored synthetic weather, electric heat-pump winter demand, one-day-per-minute playback, the six ranges, the daily outlook's simulation disclaimer, chart sampling versus exact totals, `generateYear()`, and continued `generateMonth()` compatibility.

- [ ] **Step 5: Run the complete verification gate**

Run:

```bash
bun run check
```

Expected: TypeScript passes, all Vitest suites pass, and Vite builds successfully.

- [ ] **Step 6: Benchmark annual generation without changing files**

Run:

```bash
/usr/bin/time -l bun -e "import { generateYear } from './src/simulation/generateYear.ts'; console.log(generateYear().length)"
```

Expected: output includes `105120`; record the elapsed time in the final handoff. A slow result is reported rather than hidden or addressed with an unplanned persistence layer.

- [ ] **Step 7: Inspect the working tree and commit documentation/API changes**

Run: `git status --short`

Expected: only Task 10 files plus any explicitly tracked plan-checklist updates are modified; `.DS_Store` remains untouched.

```bash
git add src/index.ts src/index.test.ts README.md
git commit -m "docs: publish annual simulation API"
```

## Final verification checklist

- [ ] `bun run check` passes from a clean implementation worktree.
- [ ] `generateMonth()` still reproduces its approved August totals and public behavior.
- [ ] `generateYear()` returns a frozen 105,120-record ledger and `validateYear()` returns no errors.
- [ ] Winter heat-pump demand, rain systems, summer cooling, and monthly solar targets are visible in tests.
- [ ] DST transitions are continuous in absolute time and correct in local labels.
- [ ] All history totals use unsampled records; chart series stay at or below 2,048 points.
- [ ] Arbitrary anchors support 24-hour, 7-day, 30-day, calendar-month, and year-to-date views.
- [ ] The simulated outlook does not wrap beyond December 31 or claim to be a real forecast.
- [ ] The inspector loads annual data once and retains the existing failure boundary.
- [ ] The showcase dashboard remains unimplemented and unmodified in this stage.
