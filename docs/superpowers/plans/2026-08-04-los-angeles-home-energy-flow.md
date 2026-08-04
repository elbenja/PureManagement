# Los Angeles Home Energy Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished browser prototype that deterministically generates and replays the approved August 2026 Woodland Hills household energy scenario.

**Architecture:** A pure TypeScript simulation generates 8,928 validated five-minute ledger records from one versioned scenario and seed. React reads that immutable ledger through a playback controller; every flow, card, chart, money value, and carbon value derives from the same selected interval or aggregate. The prototype is entirely local and has no backend or live API dependency.

**Tech Stack:** Bun, React 19, TypeScript, Vite 8, Vitest 4, Testing Library, Lucide React, semantic HTML, SVG, and plain CSS

---

## Approved source

Implement against [the approved design specification](../specs/2026-08-04-los-angeles-home-energy-flow-design.md). The supplied visual references are:

- `/Users/benjaminsaravia/Downloads/v-fdark.jpg`
- `/Users/benjaminsaravia/Downloads/V_light.jpg`

Use them for hierarchy, tone, and interaction reference only. Do not embed either full dashboard screenshot as the application's background.

## File map

| Path | Responsibility |
|---|---|
| `package.json`, `bun.lock` | Reproducible commands and dependencies |
| `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json` | Browser, build, and test configuration |
| `src/main.tsx` | React entry point |
| `src/domain/energy.ts` | Shared units, records, routes, and aggregate types |
| `src/scenario/losAngelesAugust2026.ts` | Versioned household, solar, tariff, battery, EV, and carbon inputs |
| `src/simulation/time.ts` | August interval construction and TOU classification |
| `src/simulation/random.ts` | Seeded deterministic random helpers |
| `src/simulation/conditions.ts` | Day types, temperature, clouds, and occupancy |
| `src/simulation/solar.ts` | PVWatts-anchored solar series |
| `src/simulation/home.ts` | Appliance-category and HVAC loads |
| `src/simulation/ev.ts` | Trips, availability, vehicle state, and charging demand |
| `src/simulation/router.ts` | Solar/battery/grid dispatch and resolved transfers |
| `src/simulation/accounting.ts` | Tariff, NEM credit, savings, and carbon calculations |
| `src/simulation/generateMonth.ts` | End-to-end deterministic ledger generation |
| `src/simulation/validate.ts` | Interval and month rejection checks |
| `src/simulation/aggregate.ts` | Day, week, month, and prefix totals |
| `src/playback/playback.ts` | Pure timing and interpolation functions |
| `src/playback/usePlayback.ts` | React playback, pause, jump, and scrub state |
| `src/components/MetricCard.tsx` | Reusable KPI card |
| `src/components/EnergyFlowMap.tsx` | Nodes and animated directional connections |
| `src/components/EnergyChart.tsx` | Compact time-series chart |
| `src/components/PlaybackControls.tsx` | Play/pause, day jump, and scrub controls |
| `src/components/Dashboard.tsx` | Composition and aggregation selection |
| `src/App.tsx` | Dataset generation, failure boundary, and dashboard entry |
| `src/styles.css` | Responsive light/dark visual system and motion |
| `src/test/setup.ts` | DOM matcher setup |
| `src/**/*.test.ts(x)` | Focused and integration tests beside their units |

## Task 1: Create the tested browser shell

**Files:**
- Create: `package.json`
- Create: `bun.lock`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Initialize the package and install the minimal dependencies**

Run:

```bash
bun init -y
bun add react@19.2.8 react-dom@19.2.8 lucide-react
bun add -d vite@8.1.5 vitest@4.1.10 typescript @vitejs/plugin-react @types/react @types/react-dom jsdom @testing-library/react @testing-library/jest-dom
```

Expected: `package.json` and `bun.lock` exist and all commands exit 0. Set these scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc -b --pretty false && vitest run && vite build"
  }
}
```

- [ ] **Step 2: Create the Vite, TypeScript, Vitest, and HTML configuration**

Use React's Vite plugin, `jsdom`, `src/test/setup.ts`, strict TypeScript, and `noEmit`. `index.html` must contain `<div id="root"></div>` and load `/src/main.tsx`. Keep build output at Vite's default `dist/`.

- [ ] **Step 3: Write the failing shell test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('identifies the approved scenario', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /woodland hills energy/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the shell test and verify the intended failure**

Run: `bun test src/App.test.tsx`

Expected: FAIL because `App` and/or the requested heading does not exist.

- [ ] **Step 5: Add the minimal React shell**

```tsx
// src/App.tsx
export function App() {
  return (
    <main>
      <h1>Woodland Hills Energy</h1>
    </main>
  );
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Verify and commit the shell**

Run: `bun run check`

Expected: one passing test, successful typecheck, and successful production build.

```bash
git add package.json bun.lock index.html tsconfig*.json vite.config.ts vitest.config.ts src
git commit -m "chore: scaffold energy flow prototype"
```

## Task 2: Define the scenario, interval clock, and tariff periods

**Files:**
- Create: `src/domain/energy.ts`
- Create: `src/scenario/losAngelesAugust2026.ts`
- Create: `src/simulation/time.ts`
- Test: `src/simulation/time.test.ts`

- [ ] **Step 1: Write failing tests for the month and tariff boundaries**

```ts
import { describe, expect, it } from 'vitest';
import { buildAugustClock, classifyTou } from './time';

describe('August clock', () => {
  it('creates every five-minute interval exactly once', () => {
    const slots = buildAugustClock();
    expect(slots).toHaveLength(8_928);
    expect(new Set(slots.map((slot) => slot.iso)).size).toBe(8_928);
    expect(slots[0].iso).toBe('2026-08-01T00:00:00.000-07:00');
  });

  it('classifies weekday boundaries and weekends', () => {
    expect(classifyTou(1, 12 * 60 + 55)).toBe('low');
    expect(classifyTou(1, 13 * 60)).toBe('high');
    expect(classifyTou(1, 17 * 60)).toBe('low');
    expect(classifyTou(1, 20 * 60)).toBe('base');
    expect(classifyTou(6, 14 * 60)).toBe('base');
  });
});
```

- [ ] **Step 2: Run the tests and confirm missing-module failures**

Run: `bun test src/simulation/time.test.ts`

Expected: FAIL because `time.ts` does not exist.

- [ ] **Step 3: Define the canonical domain contract**

```ts
export type TouPeriod = 'base' | 'low' | 'high';
export type DayType = 'weekday' | 'weekend' | 'heatwave' | 'cloudy';
export type EnergyNode = 'solar' | 'home' | 'ev' | 'battery' | 'grid';
export type LoadCategory = 'hvac' | 'waterHeating' | 'cooking' | 'laundry' | 'refrigeration' | 'lighting' | 'electronicsOther';

export interface ClockSlot {
  index: number;
  iso: string;
  day: number;
  dayOfWeek: number;
  minuteOfDay: number;
  tou: TouPeriod;
}

export interface Transfer {
  source: EnergyNode;
  destination: EnergyNode;
  kw: number;
  kwh: number;
}

export interface EnergyInterval extends ClockSlot {
  dayType: DayType;
  temperatureF: number;
  cloudFactor: number;
  solarKw: number;
  solarKwh: number;
  homeKw: number;
  homeKwh: number;
  homeBreakdownKwh: Record<LoadCategory, number>;
  evKw: number;
  evKwh: number;
  evAvailable: boolean;
  vehicleSocStartKwh: number;
  vehicleSocEndKwh: number;
  tripKwh: number;
  batteryChargeKw: number;
  batteryChargeKwh: number;
  batteryDischargeKw: number;
  batteryDischargeKwh: number;
  batterySocStartKwh: number;
  batterySocEndKwh: number;
  chargeLossKwh: number;
  dischargeLossKwh: number;
  gridImportKw: number;
  gridImportKwh: number;
  gridExportKw: number;
  gridExportKwh: number;
  transfers: Transfer[];
  importRate: number;
  exportRate: number;
  importCost: number;
  exportCredit: number;
  counterfactualCost: number;
  savings: number;
  avoidedCo2Kg: number;
}
```

- [ ] **Step 4: Add the single versioned scenario object**

Define `LOS_ANGELES_AUGUST_2026` with the approved coordinates, 8 kW solar/1,414.65 kWh target, 1,825 kWh home target, 340 kWh EV target, 13.5 kWh/5 kW/90% battery, 15% reserve, TOU rates, $12 service charge, and 0.229 kg CO2e/kWh. Freeze the object with `as const`; do not duplicate these values elsewhere.

- [ ] **Step 5: Implement the month clock and classifier**

```ts
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalIso(day: number, minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `2026-08-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00.000-07:00`;
}

export function classifyTou(dayOfWeek: number, minute: number): TouPeriod {
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'base';
  if (minute >= 13 * 60 && minute < 17 * 60) return 'high';
  if ((minute >= 10 * 60 && minute < 13 * 60) || (minute >= 17 * 60 && minute < 20 * 60)) return 'low';
  return 'base';
}

export function buildAugustClock(): ClockSlot[] {
  return Array.from({ length: 8_928 }, (_, index) => {
    const day = Math.floor(index / 288) + 1;
    const minuteOfDay = (index % 288) * 5;
    const dayOfWeek = new Date(Date.UTC(2026, 7, day)).getUTCDay();
    return {
      index,
      iso: formatLocalIso(day, minuteOfDay),
      day,
      dayOfWeek,
      minuteOfDay,
      tou: classifyTou(dayOfWeek, minuteOfDay),
    };
  });
}
```

- [ ] **Step 6: Verify and commit the domain baseline**

Run: `bun test src/simulation/time.test.ts && bun run build`

Expected: two passing tests and successful build.

```bash
git add src/domain src/scenario src/simulation/time.ts src/simulation/time.test.ts
git commit -m "feat: define Los Angeles energy scenario"
```

## Task 3: Generate deterministic conditions and solar

**Files:**
- Create: `src/simulation/random.ts`
- Create: `src/simulation/conditions.ts`
- Create: `src/simulation/solar.ts`
- Test: `src/simulation/solar.test.ts`

- [ ] **Step 1: Write failing solar acceptance tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildAugustClock } from './time';
import { buildConditions } from './conditions';
import { generateSolar } from './solar';

describe('solar generation', () => {
  const clock = buildAugustClock();
  const conditions = buildConditions(clock, 'woodland-hills-aug-2026-v1');
  const solar = generateSolar(clock, conditions);

  it('matches the PVWatts anchor and array limits', () => {
    expect(solar.reduce((sum, value) => sum + value.kwh, 0)).toBeCloseTo(1_414.65, 2);
    expect(Math.max(...solar.map((value) => value.kw))).toBeLessThanOrEqual(8);
  });

  it('is zero at night and varies between days', () => {
    expect(solar.filter((_, index) => clock[index].minuteOfDay < 5 * 60).every((value) => value.kwh === 0)).toBe(true);
    const noon = solar.filter((_, index) => clock[index].minuteOfDay === 12 * 60).map((value) => value.kw);
    expect(new Set(noon.map((value) => value.toFixed(2))).size).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `bun test src/simulation/solar.test.ts`

Expected: FAIL because the condition and solar modules do not exist.

- [ ] **Step 3: Implement a stable seeded generator**

```ts
export function seedFromString(value: string): number {
  let hash = 2_166_136_261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
```

- [ ] **Step 4: Implement conditions and normalized solar**

Use fixed heat-wave days 12–15 and cloud-affected days 6 and 22. Produce a smooth daily temperature curve, one correlated cloud factor per day plus bounded five-minute variation, and weekend occupancy. Solar uses a sine curve between 6:05 a.m. and 7:45 p.m., multiplies by cloud factor, caps at 8 kW, and applies one final scale so summed kWh equals 1,414.65.

The implementation must return `{ kw, kwh }[]`, use `kwh = kw / 12`, and never call `Math.random()`.

- [ ] **Step 5: Verify determinism, totals, and build**

Run: `bun test src/simulation/solar.test.ts && bun run build`

Expected: two passing solar tests and successful build.

```bash
git add src/simulation/random.ts src/simulation/conditions.ts src/simulation/solar.ts src/simulation/solar.test.ts
git commit -m "feat: generate anchored August solar"
```

## Task 4: Generate home and appliance demand

**Files:**
- Create: `src/simulation/home.ts`
- Test: `src/simulation/home.test.ts`

- [ ] **Step 1: Write failing load-profile tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildConditions } from './conditions';
import { generateHomeLoad } from './home';
import { buildAugustClock } from './time';

describe('home demand', () => {
  const clock = buildAugustClock();
  const load = generateHomeLoad(clock, buildConditions(clock, 'woodland-hills-aug-2026-v1'));

  it('hits the approved high-use target with complete categories', () => {
    expect(load.reduce((sum, value) => sum + value.kwh, 0)).toBeCloseTo(1_825, 2);
    expect(load.every((value) => Math.abs(Object.values(value.breakdownKwh).reduce((a, b) => a + b, 0) - value.kwh) < 1e-9)).toBe(true);
  });

  it('makes heat-wave afternoons heavier than ordinary afternoons', () => {
    const afternoon = (day: number) => load.filter((_, index) => clock[index].day === day && clock[index].minuteOfDay >= 13 * 60 && clock[index].minuteOfDay < 17 * 60).reduce((sum, value) => sum + value.kwh, 0);
    expect(afternoon(13)).toBeGreaterThan(afternoon(10));
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `bun test src/simulation/home.test.ts`

Expected: FAIL because `home.ts` does not exist.

- [ ] **Step 3: Implement additive category profiles**

For every interval, calculate non-negative category kW values for HVAC, water heating, cooking, laundry, refrigeration, lighting, and electronics/other. HVAC responds to temperature and occupancy; cooking peaks around 7:00 a.m. and 6:30 p.m.; lighting follows darkness; laundry/dishwasher events use seeded daily start times. Add smooth correlated noise per category, then scale every category by the same constant so the monthly total is exactly 1,825 kWh.

Return this complete shape:

```ts
export interface HomeLoadPoint {
  kw: number;
  kwh: number;
  breakdownKwh: Record<LoadCategory, number>;
}

export function generateHomeLoad(clock: ClockSlot[], conditions: Condition[]): HomeLoadPoint[] {
  const raw = clock.map((slot, index) => buildUnscaledPoint(slot, conditions[index]));
  const rawTotal = raw.reduce((sum, point) => sum + point.kwh, 0);
  const scale = LOS_ANGELES_AUGUST_2026.home.targetAugustKwh / rawTotal;
  return raw.map((point) => scalePoint(point, scale));
}
```

- [ ] **Step 4: Verify and commit home demand**

Run: `bun test src/simulation/home.test.ts && bun run build`

Expected: two passing load tests and successful build.

```bash
git add src/simulation/home.ts src/simulation/home.test.ts
git commit -m "feat: model household appliance demand"
```

## Task 5: Generate EV trips, availability, and charging

**Files:**
- Create: `src/simulation/ev.ts`
- Test: `src/simulation/ev.test.ts`

- [ ] **Step 1: Write failing EV behavior tests**

```ts
import { describe, expect, it } from 'vitest';
import { generateEv } from './ev';
import { buildAugustClock } from './time';

describe('EV model', () => {
  const clock = buildAugustClock();
  const ev = generateEv(clock, 'woodland-hills-aug-2026-v1');

  it('uses the approved monthly energy and charger limit', () => {
    expect(ev.reduce((sum, value) => sum + value.chargeKwh, 0)).toBeCloseTo(340, 2);
    expect(Math.max(...ev.map((value) => value.chargeKw))).toBeLessThanOrEqual(7.2);
  });

  it('stays bounded and can complete every departure', () => {
    expect(ev.every((value) => value.socEndKwh >= 0 && value.socEndKwh <= 75)).toBe(true);
    expect(ev.filter((value) => value.tripKwh > 0).every((value) => value.socStartKwh >= value.tripKwh)).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `bun test src/simulation/ev.test.ts`

Expected: FAIL because `ev.ts` does not exist.

- [ ] **Step 3: Implement the deterministic EV state machine**

Create daily trip requirements from seeded 30–40 mile weekday travel and lighter weekend travel, normalize the month to 340 kWh, and deduct the trip at departure. The EV is unavailable from 7:30 a.m. to 6:00 p.m. on weekdays. At home, defer charging until 8:00 p.m. unless the next departure cannot be met; cap charging at 7.2 kW. Begin at 80% state of charge and carry state across all 8,928 records.

Return `{ chargeKw, chargeKwh, available, socStartKwh, socEndKwh, tripKwh }[]`. Throw an error containing the day number if any departure lacks energy; do not silently clamp an impossible trip.

- [ ] **Step 4: Verify and commit EV behavior**

Run: `bun test src/simulation/ev.test.ts && bun run build`

Expected: two passing EV tests and successful build.

```bash
git add src/simulation/ev.ts src/simulation/ev.test.ts
git commit -m "feat: model EV trips and charging"
```

## Task 6: Route solar, battery, and grid energy

**Files:**
- Create: `src/simulation/router.ts`
- Test: `src/simulation/router.test.ts`

- [ ] **Step 1: Write failing router tests for priority and exclusivity**

```ts
import { describe, expect, it } from 'vitest';
import { routeInterval } from './router';

describe('energy router', () => {
  it('serves load, charges storage, then exports solar surplus', () => {
    const result = routeInterval({ solarKwh: 1, homeKwh: 0.2, evKwh: 0, batterySocKwh: 10, minuteOfDay: 12 * 60 });
    expect(result.gridImportKwh).toBe(0);
    expect(result.batteryChargeKwh).toBeGreaterThan(0);
    expect(result.gridExportKwh).toBeGreaterThan(0);
  });

  it('respects reserve and never mixes opposing states', () => {
    const result = routeInterval({ solarKwh: 0, homeKwh: 1, evKwh: 0, batterySocKwh: 13.5 * 0.15, minuteOfDay: 18 * 60 });
    expect(result.batteryDischargeKwh).toBe(0);
    expect(result.gridImportKwh).toBe(1);
    expect(result.gridImportKwh * result.gridExportKwh).toBe(0);
    expect(result.batteryChargeKwh * result.batteryDischargeKwh).toBe(0);
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `bun test src/simulation/router.test.ts`

Expected: FAIL because `router.ts` does not exist.

- [ ] **Step 3: Implement the approved router**

Use `sqrt(0.90)` for both battery directions. Treat charge as stored energy and discharge as removed stored energy. Cap inverter energy at `5 / 12` kWh per interval and preserve `13.5 × 0.15` kWh. Discharge only from 1:00–7:59 p.m. Solar serves home then EV, surplus stores then exports; battery serves home then EV, and grid serves the rest.

Create canonical transfer records only for positive delivered energy. Battery transfers carry delivered AC energy, while `batteryDischargeKwh` carries removed stored energy and `dischargeLossKwh` records the difference.

- [ ] **Step 4: Add a conservation test**

```ts
it.each([
  { solarKwh: 0.8, homeKwh: 0.3, evKwh: 0.2, batterySocKwh: 8, minuteOfDay: 14 * 60 },
  { solarKwh: 0, homeKwh: 0.6, evKwh: 0.4, batterySocKwh: 8, minuteOfDay: 18 * 60 },
  { solarKwh: 0, homeKwh: 0.2, evKwh: 0.5, batterySocKwh: 8, minuteOfDay: 22 * 60 },
])('balances %#', (input) => {
  const value = routeInterval(input);
  const sources = input.solarKwh + value.batteryDischargeKwh + value.gridImportKwh;
  const sinks = input.homeKwh + input.evKwh + value.batteryChargeKwh + value.gridExportKwh + value.chargeLossKwh + value.dischargeLossKwh;
  expect(sources).toBeCloseTo(sinks, 9);
});
```

- [ ] **Step 5: Verify and commit routing**

Run: `bun test src/simulation/router.test.ts && bun run build`

Expected: all router cases pass and the build succeeds.

```bash
git add src/simulation/router.ts src/simulation/router.test.ts
git commit -m "feat: route solar battery and grid energy"
```

## Task 7: Calculate tariff, savings, export credit, and carbon

**Files:**
- Create: `src/simulation/accounting.ts`
- Create: `src/simulation/aggregate.ts`
- Test: `src/simulation/accounting.test.ts`

- [ ] **Step 1: Write failing accounting tests**

```ts
import { describe, expect, it } from 'vitest';
import { accountInterval } from './accounting';

describe('interval accounting', () => {
  it('uses the interval TOU rate for imports and the counterfactual', () => {
    const value = accountInterval({ tou: 'high', homeKwh: 1, evKwh: 0.5, gridImportKwh: 0.4, gridExportKwh: 0 });
    expect(value.importRate).toBe(0.35124);
    expect(value.importCost).toBeCloseTo(0.140496, 6);
    expect(value.counterfactualCost).toBeCloseTo(0.52686, 6);
    expect(value.savings).toBeCloseTo(0.386364, 6);
  });

  it('labels export value as credit and includes displaced emissions', () => {
    const value = accountInterval({ tou: 'low', homeKwh: 0.2, evKwh: 0, gridImportKwh: 0, gridExportKwh: 0.5 });
    expect(value.exportCredit).toBeCloseTo(0.5 * value.exportRate, 9);
    expect(value.avoidedCo2Kg).toBeCloseTo((0.2 + 0.5) * 0.229, 9);
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `bun test src/simulation/accounting.test.ts`

Expected: FAIL because `accounting.ts` does not exist.

- [ ] **Step 3: Implement interval accounting**

```ts
export function accountInterval(input: AccountingInput): AccountingResult {
  const importRate = LOS_ANGELES_AUGUST_2026.tariff.rates[input.tou];
  const exportRate = importRate;
  const importCost = input.gridImportKwh * importRate;
  const exportCredit = input.gridExportKwh * exportRate;
  const counterfactualCost = (input.homeKwh + input.evKwh) * importRate;
  const savings = counterfactualCost - (importCost - exportCredit);
  const avoidedCo2Kg = Math.max(0, input.homeKwh + input.evKwh - input.gridImportKwh + input.gridExportKwh) * LOS_ANGELES_AUGUST_2026.emissions.kgCo2ePerKwh;
  return { importRate, exportRate, importCost, exportCredit, counterfactualCost, savings, avoidedCo2Kg };
}
```

- [ ] **Step 4: Implement typed aggregation**

`aggregateIntervals(records)` must sum solar, home+EV consumption, grid bought, grid sent, battery charge/discharge, import cost, export credit, counterfactual cost, savings, and avoided CO2e. `buildPrefixTotals(records)` must return 8,929 entries beginning with zero so cumulative cards can read totals at any playback index without rescanning the month.

- [ ] **Step 5: Verify and commit accounting**

Run: `bun test src/simulation/accounting.test.ts && bun run build`

Expected: two passing accounting tests and successful build.

```bash
git add src/simulation/accounting.ts src/simulation/accounting.test.ts src/simulation/aggregate.ts
git commit -m "feat: calculate energy economics and carbon"
```

## Task 8: Generate and reject the complete month

**Files:**
- Create: `src/simulation/generateMonth.ts`
- Create: `src/simulation/validate.ts`
- Test: `src/simulation/generateMonth.test.ts`

- [ ] **Step 1: Write the failing full-month integration test**

```ts
import { describe, expect, it } from 'vitest';
import { aggregateIntervals } from './aggregate';
import { generateMonth } from './generateMonth';
import { validateMonth } from './validate';

describe('approved month', () => {
  it('is deterministic, complete, and valid', () => {
    const first = generateMonth();
    const second = generateMonth();
    const totals = aggregateIntervals(first);
    expect(first).toEqual(second);
    expect(first).toHaveLength(8_928);
    expect(validateMonth(first)).toEqual([]);
    expect(totals.solarKwh).toBeCloseTo(1_414.65, 2);
    expect(totals.homeKwh).toBeCloseTo(1_825, 2);
    expect(totals.evKwh).toBeCloseTo(340, 2);
  });

  it('contains every required day type', () => {
    expect(new Set(generateMonth().map((record) => record.dayType))).toEqual(new Set(['weekday', 'weekend', 'heatwave', 'cloudy']));
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `bun test src/simulation/generateMonth.test.ts`

Expected: FAIL because the generator and validator do not exist.

- [ ] **Step 3: Compose the generator**

Build clock, conditions, solar, home, and EV arrays once. Iterate in chronological order, carrying battery state from one interval to the next. Route each interval, account it, and construct one `EnergyInterval` containing all exogenous, routed, and derived values. Start the battery at 50% state of charge. Call `validateMonth()` before returning; throw `Invalid simulation: ${errors.join('; ')}` when errors exist.

- [ ] **Step 4: Implement explicit validation**

Return string errors for record count/order, duplicate timestamps, interval conservation tolerance above `1e-8`, battery bounds, simultaneous battery states, simultaneous grid states, night solar, solar above 8 kW, EV bounds/trip sufficiency, non-finite numbers, monthly solar/home/EV envelopes, missing day types, and aggregate/source mismatches.

Use this invariant helper in the validator:

```ts
export function balanceError(record: EnergyInterval): number {
  const source = record.solarKwh + record.batteryDischargeKwh + record.gridImportKwh;
  const sink = record.homeKwh + record.evKwh + record.batteryChargeKwh + record.gridExportKwh + record.chargeLossKwh + record.dischargeLossKwh;
  return Math.abs(source - sink);
}
```

- [ ] **Step 5: Verify the whole simulation and commit**

Run: `bun test src/simulation && bun run build`

Expected: all simulation tests pass, the month contains 8,928 records, and the build succeeds.

```bash
git add src/simulation/generateMonth.ts src/simulation/generateMonth.test.ts src/simulation/validate.ts
git commit -m "feat: generate validated monthly ledger"
```

## Task 9: Implement smooth deterministic playback

**Files:**
- Create: `src/playback/playback.ts`
- Create: `src/playback/usePlayback.ts`
- Test: `src/playback/playback.test.ts`

- [ ] **Step 1: Write failing timing and interpolation tests**

```ts
import { describe, expect, it } from 'vitest';
import { advancePosition, interpolatePower } from './playback';

describe('playback', () => {
  it('plays one simulated day per minute', () => {
    expect(advancePosition(0, 60_000, 8_928)).toBe(288);
  });

  it('wraps after the last interval', () => {
    expect(advancePosition(8_927, 1_000, 8_928)).toBeLessThan(8_928);
  });

  it('interpolates live power without changing ledger totals', () => {
    expect(interpolatePower(1, 3, 0.25)).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `bun test src/playback/playback.test.ts`

Expected: FAIL because the playback modules do not exist.

- [ ] **Step 3: Implement pure playback functions**

```ts
const SLOTS_PER_REAL_MS = 288 / 60_000;

export function advancePosition(position: number, elapsedMs: number, count: number): number {
  return (position + elapsedMs * SLOTS_PER_REAL_MS) % count;
}

export function interpolatePower(start: number, end: number, fraction: number): number {
  return start + (end - start) * Math.min(1, Math.max(0, fraction));
}
```

- [ ] **Step 4: Implement the React playback controller**

`usePlayback(recordCount)` uses `requestAnimationFrame`, elapsed real time, and a floating-point position. Return `index`, `fraction`, `isPlaying`, `play`, `pause`, `toggle`, `scrubTo(index)`, and `jumpDay(delta)`; clamp manual navigation and wrap only automatic playback. Cancel the animation frame on unmount.

Only interpolate instantaneous kW and state of charge between `records[index]` and `records[index + 1]`. Read cumulative totals from the prefix entry at `index + 1`, never from interpolated values.

- [ ] **Step 5: Verify and commit playback**

Run: `bun test src/playback/playback.test.ts && bun run build`

Expected: three passing playback tests and successful build.

```bash
git add src/playback
git commit -m "feat: add monthly energy playback"
```

## Task 10: Build reusable metric and control components

**Files:**
- Create: `src/components/MetricCard.tsx`
- Create: `src/components/EnergyChart.tsx`
- Create: `src/components/PlaybackControls.tsx`
- Test: `src/components/MetricCard.test.tsx`
- Test: `src/components/PlaybackControls.test.tsx`

- [ ] **Step 1: Write failing accessibility tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MetricCard } from './MetricCard';
import { PlaybackControls } from './PlaybackControls';

it('exposes a metric label and formatted value', () => {
  render(<MetricCard label="Money saved" value="$381.20" detail="Modeled energy savings" />);
  expect(screen.getByText('Money saved')).toBeVisible();
  expect(screen.getByText('$381.20')).toBeVisible();
});

it('supports playback and scrubbing from labeled controls', () => {
  const toggle = vi.fn();
  const scrub = vi.fn();
  render(<PlaybackControls isPlaying={false} index={12} count={8_928} onToggle={toggle} onScrub={scrub} onJumpDay={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Play August' }));
  fireEvent.change(screen.getByLabelText('August playback position'), { target: { value: '144' } });
  expect(toggle).toHaveBeenCalledOnce();
  expect(scrub).toHaveBeenCalledWith(144);
});
```

- [ ] **Step 2: Run and confirm the missing-component failure**

Run: `bun test src/components`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the metric card and compact chart**

`MetricCard` renders semantic label, value, optional unit/detail, and optional mini-chart slot. `EnergyChart` accepts `{ value, label }[]`, width, height, and accent; normalize into one accessible SVG polyline and include a `<title>`. Empty data returns an empty chart frame rather than throwing.

- [ ] **Step 4: Implement playback controls**

Use real `<button>` elements for previous day, play/pause, and next day, plus `<input type="range" min={0} max={count - 1}>`. Give every control an explicit accessible name. The play label alternates between `Play August` and `Pause August`.

- [ ] **Step 5: Verify and commit the components**

Run: `bun test src/components && bun run build`

Expected: both interaction tests pass and the build succeeds.

```bash
git add src/components/MetricCard.tsx src/components/MetricCard.test.tsx src/components/EnergyChart.tsx src/components/PlaybackControls.tsx src/components/PlaybackControls.test.tsx
git commit -m "feat: add dashboard metric controls"
```

## Task 11: Build the animated energy-flow map

**Files:**
- Create: `src/components/EnergyFlowMap.tsx`
- Test: `src/components/EnergyFlowMap.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing flow-map test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnergyFlowMap } from './EnergyFlowMap';

it('shows active nodes and only active transfer routes', () => {
  render(<EnergyFlowMap solarKw={4.2} homeKw={2.1} evKw={0} batterySocPercent={68} gridKw={-1.4} transfers={[{ source: 'solar', destination: 'home', kw: 2.1, kwh: 0.175 }]} />);
  expect(screen.getByText('4.2 kW')).toBeVisible();
  expect(screen.getByText('68%')).toBeVisible();
  expect(screen.getByLabelText('Solar to home: 2.1 kW')).toBeVisible();
  expect(screen.queryByLabelText(/grid to home/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and confirm the missing-component failure**

Run: `bun test src/components/EnergyFlowMap.test.tsx`

Expected: FAIL because `EnergyFlowMap.tsx` does not exist.

- [ ] **Step 3: Implement the five-node map and routes**

Render solar, home, EV, battery, and grid nodes over a dark atmospheric panel. Use one SVG layer with fixed viewBox coordinates and a route lookup for the eight approved source/destination pairs. Each active route contains a muted base path and an animated mint dashed path. Set `aria-label="Source to destination: N.N kW"`, `data-power`, and CSS custom property `--flow-speed` derived from power.

Grid signed convention in the component is positive import and negative export. Its visible label must say `Buying` or `Sending`, never imply cash payment for exports.

- [ ] **Step 4: Add purposeful reduced-motion-safe styling**

In `src/styles.css`, define node cards, dotted paths, `@keyframes energy-flow`, and `[data-power]` opacity. Under `@media (prefers-reduced-motion: reduce)`, stop dash animation while preserving direction labels and active color. Keep text and controls at WCAG AA contrast.

- [ ] **Step 5: Verify and commit the flow map**

Run: `bun test src/components/EnergyFlowMap.test.tsx && bun run build`

Expected: the test passes and the build succeeds.

```bash
git add src/components/EnergyFlowMap.tsx src/components/EnergyFlowMap.test.tsx src/styles.css
git commit -m "feat: visualize live energy routes"
```

## Task 12: Compose the dashboard and aggregation modes

**Files:**
- Create: `src/components/Dashboard.tsx`
- Test: `src/components/Dashboard.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing dashboard language test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';
import { generateMonth } from '../simulation/generateMonth';

it('uses the approved energy and money language', () => {
  render(<Dashboard records={generateMonth()} />);
  expect(screen.getByText('Energy consumed')).toBeVisible();
  expect(screen.getByText('Money saved')).toBeVisible();
  expect(screen.getByText('Export credit earned')).toBeVisible();
  expect(screen.getByText('CO2e avoided')).toBeVisible();
  expect(screen.queryByText(/money made/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and confirm the missing-component failure**

Run: `bun test src/components/Dashboard.test.tsx`

Expected: FAIL because `Dashboard.tsx` does not exist.

- [ ] **Step 3: Compose the live and cumulative views**

`Dashboard` generates prefix totals once with `useMemo`, uses `usePlayback`, interpolates live kW/SoC, and passes current transfers to `EnergyFlowMap`. Add day/week/month segmented buttons. Their cards aggregate the selected calendar slice; the live map always reflects the current interval. Include cards for solar produced, energy consumed, money saved, export credit earned, CO2e avoided, battery charge, grid bought, and grid sent.

Use `Intl.NumberFormat('en-US')` for kWh, dollars, and kilograms. Show the date/time, `LADWP · Zone 2`, and `Modeled August 2026` so the synthetic context stays visible.

- [ ] **Step 4: Add the generated-month failure boundary in App**

```tsx
import { useMemo } from 'react';
import { Dashboard } from './components/Dashboard';
import { generateMonth } from './simulation/generateMonth';

export function App() {
  const result = useMemo(() => {
    try {
      return { records: generateMonth(), error: false } as const;
    } catch {
      return { records: [], error: true } as const;
    }
  }, []);

  if (result.error) {
    return <main className="simulation-error" role="alert"><h1>Simulation data unavailable.</h1></main>;
  }

  return <Dashboard records={result.records} />;
}
```

- [ ] **Step 5: Implement the responsive design system**

Define CSS custom properties for ink navy, paper white, mint energy, teal secondary, orange export, muted blue-gray, card radii, shadows, and spacing. At ≥1,000 px use a two-column layout with the flow map dominant and KPI rail beside it; below 1,000 px stack the map above a two-column card grid; below 640 px use one column and keep playback controls sticky. Use fluid type with `clamp()`, visible focus states, and minimum 44 px touch targets.

- [ ] **Step 6: Verify and commit the composed dashboard**

Run: `bun test src/components/Dashboard.test.tsx && bun run check`

Expected: dashboard copy test passes, all earlier tests pass, and the production build succeeds.

```bash
git add src/App.tsx src/components/Dashboard.tsx src/components/Dashboard.test.tsx src/styles.css
git commit -m "feat: compose energy management dashboard"
```

## Task 13: Verify the complete product behavior

**Files:**
- Modify only if a verification failure identifies a scoped defect

- [ ] **Step 1: Run the complete automated gate**

Run: `bun run check`

Expected: TypeScript exits 0, every Vitest test passes, and Vite produces `dist/` without warnings treated as errors.

- [ ] **Step 2: Start the local prototype and inspect the browser**

Run: `bun run dev --host 127.0.0.1`

Expected: Vite prints a reachable local URL. Open that URL in the in-app browser.

- [ ] **Step 3: Verify the approved live story manually**

At representative timestamps, confirm:

- Midnight: solar is zero, grid may serve EV and home, battery holds.
- 8:00 a.m.: home demand and solar ramp are visible.
- Noon: solar serves the home and charges the battery or exports.
- 2:00 p.m.: high-price state is visible; solar/battery reduce grid demand.
- 6:30 p.m.: the battery serves evening load where state permits.
- 9:00 p.m.: EV charging appears in the Base period.
- Cloudy and heat-wave days are visibly different from normal weekdays.
- Import/export and battery charge/discharge never appear simultaneously.

- [ ] **Step 4: Verify interaction and responsive states**

Pause, resume, scrub to the first and last intervals, jump backward/forward one day, and switch day/week/month. Confirm all cards recalculate consistently. Inspect at approximately 1440×900, 768×1024, and 390×844; confirm no horizontal overflow, clipped controls, unreadable text, or missing focus indication. Enable reduced motion and confirm flow direction remains understandable.

- [ ] **Step 5: Record final evidence and commit any scoped corrections**

Capture the exact `bun run check` result and screenshots of desktop and mobile states. If no correction was required, do not create an empty commit. If a scoped correction was required:

```bash
git add src
git commit -m "fix: complete energy flow verification"
```

## Completion definition

Implementation is complete only when:

- The fixed seed produces exactly 8,928 valid records with 1,414.65 kWh solar, 1,825 kWh home load, and 340 kWh EV charging.
- Every interval conserves energy and respects battery, solar, EV, and grid invariants.
- Day, week, month, and cumulative values derive from the ledger.
- Playback runs at one simulated day per minute and survives pause, jump, and scrub actions.
- The interface uses `Export credit earned` and never describes LADWP NEM credit as cash income.
- All automated checks pass and the desktop/mobile browser review covers the representative timestamps above.
