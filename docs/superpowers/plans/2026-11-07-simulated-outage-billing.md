# Simulated Outages and Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add physically consistent 2026 outages, a battery-only runtime estimate, and a modeled monthly credit and bill ledger to the Woodland Hills annual simulation.

**Architecture:** Keep the August contract unchanged. Add an annual record subtype and an annual routing wrapper; the existing grid-connected router handles normal intervals, while a dedicated outage router handles islanded intervals. Derive monthly statements from final immutable annual records and display the results in the existing inspector.

**Tech Stack:** TypeScript 7, React 19, Vitest 4, Vite 8.

---

## File map

- `src/domain/annualEnergy.ts`: annual-only record fields and type guard.
- `src/simulation/annualOutages.ts`: two fixed local-time outage events and slot lookup.
- `src/simulation/annualRouter.ts`: outage routing and grid-connected wrapper.
- `src/simulation/backupEstimate.ts`: trailing-hour battery-only estimate.
- `src/simulation/annualAccounting.ts`: zero comparative accounting during outage.
- `src/simulation/monthlyStatements.ts`: twelve statement records and credit-bank carry.
- `src/simulation/generateYear.ts`: assemble new annual fields in one continuous pass.
- `src/simulation/validateYear.ts`: exact annual shape, routing, accounting, continuity, and outage checks.
- `src/inspector/SimulationInspector.tsx`: inspect new values in the existing plain UI.
- `src/index.ts`: export the annual types, schedule, and statement selector.
- Focused `*.test.ts` files beside each new module; adjust annual tests for potential versus actual solar.

### Task 1: Annual contract and fixed outage schedule

**Files:** Create `src/domain/annualEnergy.ts`, `src/simulation/annualOutages.ts`, `src/simulation/annualOutages.test.ts`; modify `src/index.ts`.

- [ ] **Step 1: Write failing schedule tests.** Assert that January 15 at 15:00 and July 21 at 13:00 are outage slots, their exclusive end slots are connected, the durations are 30 and 54 five-minute slots, and the annual EV generator has zero charging and `available === false` in both windows.
- [ ] **Step 2: Run `npx vitest run src/simulation/annualOutages.test.ts --maxWorkers=1`; expect missing-module failure.**
- [ ] **Step 3: Implement the annual type and schedule.** Use these public fields and signatures:

```ts
export type GridStatus = 'connected' | 'outage'
export interface AnnualEnergyInterval extends EnergyInterval {
  gridStatus: GridStatus
  solarPotentialKwh: number
  curtailedSolarKwh: number
  unservedHomeKwh: number
  backupHoursEstimate: number
  backupPowerLimited: boolean
}
export const isAnnualEnergyInterval = (value: EnergyInterval): value is AnnualEnergyInterval =>
  'gridStatus' in value && (value.gridStatus === 'connected' || value.gridStatus === 'outage')
export interface AnnualOutage { id: 'winter' | 'summer'; start: string; end: string }
export const ANNUAL_OUTAGES: readonly AnnualOutage[] = Object.freeze([
  { id: 'winter', start: '2026-01-15T15:00:00.000-08:00', end: '2026-01-15T17:30:00.000-08:00' },
  { id: 'summer', start: '2026-07-21T13:00:00.000-07:00', end: '2026-07-21T17:30:00.000-07:00' },
])
export function gridStatusAt(iso: string): GridStatus // compare absolute timestamps in [start, end)
```

- [ ] **Step 4: Run the focused test; expect pass. Commit with `git add src/domain/annualEnergy.ts src/simulation/annualOutages* src/index.ts && git commit -m "feat: define annual outage schedule"`.**

### Task 2: Physically correct outage routing

**Files:** Create `src/simulation/annualRouter.ts`, `src/simulation/annualRouter.test.ts`; modify `src/simulation/router.ts` only to accept battery state below normal reserve after restoration.

- [ ] **Step 1: Write failing routing tests.** For an outage input with 0.2 kWh solar, 0.4 kWh home demand, zero EV, and 0.3 kWh stored battery, assert zero grid flow, positive battery-to-home transfer, and `solar + battery discharge = served home + charge + losses + curtailment`. Test a full battery with surplus solar produces curtailment. Test zero battery produces unserved home demand. Test connected routing accepts SOC below reserve but never discharges it for bill optimization.
- [ ] **Step 2: Run `npx vitest run src/simulation/annualRouter.test.ts src/simulation/router.test.ts --maxWorkers=1`; expect the new tests to fail.**
- [ ] **Step 3: Implement `routeAnnualInterval(input, gridStatus)` with the annual scenario.** The connected branch calls `routeInterval` and returns zero `curtailedSolarKwh` and `unservedHomeKwh`. The outage branch applies this exact order, with `η = sqrt(roundTripEfficiency)` and `slotHours = 5/60`:

```ts
const solarToHome = Math.min(solarKwh, homeKwh)
const remainingHome = homeKwh - solarToHome
const surplusSolar = solarKwh - solarToHome
const solarToBattery = Math.min(surplusSolar, maxPowerKw * slotHours, (capacityKwh - socKwh) / η)
const storedCharge = solarToBattery * η
const batteryToHome = Math.min(remainingHome, maxPowerKw * slotHours, socKwh * η)
const storedDischarge = batteryToHome / η
const curtailedSolarKwh = surplusSolar - solarToBattery
const unservedHomeKwh = remainingHome - batteryToHome
const actualSolarKwh = solarKwh - curtailedSolarKwh
const socEndKwh = socKwh + storedCharge - storedDischarge
```

The outage branch emits only positive solar-home, solar-battery, and battery-home transfers, with matching AC-side kW, battery charge/discharge and loss fields, and zero grid fields. It rejects nonzero EV charging. `routeInterval` accepts a valid SOC from zero to capacity; its grid-connected discharge remains limited to `max(0, SOC - reserve)`.
- [ ] **Step 4: Run focused tests; expect pass. Commit with `git add src/simulation/annualRouter* src/simulation/router.ts src/simulation/router.test.ts && git commit -m "feat: route annual outage intervals"`.**

### Task 3: Backup estimate and outage accounting

**Files:** Create `src/simulation/backupEstimate.ts`, `src/simulation/backupEstimate.test.ts`, `src/simulation/annualAccounting.ts`, `src/simulation/annualAccounting.test.ts`.

- [ ] **Step 1: Write failing tests.** Assert 9 kWh stored at 2 kW recent demand yields `9 * sqrt(0.9) / 2` hours, 0 kWh yields zero, and demand over 5 kW yields zero with `powerLimited: true`. Assert connected accounting equals `accountInterval`, while outage accounting has zero cost, credit, counterfactual, savings, and emissions comparison.
- [ ] **Step 2: Run `npx vitest run src/simulation/backupEstimate.test.ts src/simulation/annualAccounting.test.ts --maxWorkers=1`; expect missing-module failure.**
- [ ] **Step 3: Implement these interfaces and formulas.**

```ts
export interface BackupEstimate { hours: number; powerLimited: boolean }
export function estimateBackup(socEndKwh: number, trailingHomeKwh: number, slotCount: number): BackupEstimate {
  const averageKw = trailingHomeKwh / (slotCount * LOS_ANGELES_2026.intervalMinutes / 60)
  return averageKw > LOS_ANGELES_2026.battery.maxPowerKw
    ? { hours: 0, powerLimited: true }
    : { hours: averageKw === 0 ? 0 : socEndKwh * Math.sqrt(LOS_ANGELES_2026.battery.roundTripEfficiency) / averageKw, powerLimited: false }
}
export function accountAnnualInterval(input: AccountingInput, status: GridStatus): AccountingResult {
  const normal = accountInterval(input, LOS_ANGELES_2026)
  return status === 'connected' ? normal : {
    ...normal, importCost: 0, exportCredit: 0, counterfactualCost: 0,
    savings: 0, avoidedCo2Kg: 0,
  }
}
```

- [ ] **Step 4: Run focused tests; expect pass. Commit with `git add src/simulation/backupEstimate* src/simulation/annualAccounting* && git commit -m "feat: estimate backup and account for outages"`.**

### Task 4: Assemble and validate the annual ledger

**Files:** Modify `src/simulation/generateYear.ts`, `src/simulation/validateYear.ts`, `src/simulation/generateYear.test.ts`; create `src/simulation/outageYear.test.ts`.

- [ ] **Step 1: Add failing annual tests.** Assert exactly 84 outage slots, zero EV and grid flow in those slots, continuous battery state at both event boundaries, `solarPotentialKwh = solarKwh + curtailedSolarKwh`, and `servedHome = homeKwh - unservedHomeKwh`. Assert each outage's financial comparisons are zero, annual potential solar equals 13,581.49 kWh, and `validateYear(generateYear())` returns no errors.
- [ ] **Step 2: Run `npx vitest run src/simulation/outageYear.test.ts src/simulation/generateYear.test.ts --maxWorkers=1`; expect failure.**
- [ ] **Step 3: In `generateYear`, look up `gridStatusAt(slot.iso)`, route with `routeAnnualInterval`, and account with `accountAnnualInterval`.** Record actual `solarKw = actualSolarKwh / slotHours`, potential solar, curtailment, unmet home demand, and status. Maintain a twelve-slot rolling sum of home demand; after routing, set `backupHoursEstimate` and `backupPowerLimited` from `estimateBackup(routed.batterySocEndKwh, sum, count)`. Freeze the annual record subtype as before.
- [ ] **Step 4: Update `validateYear`'s exact fields and invariants.** Recompute expected status, annual routing, annual accounting, and trailing-hour estimate for each slot. Compare transfer destinations with served home demand; compare the physical supply with served demand, curtailment, and conversion losses. Allow SOC down to zero, but verify connected battery discharge never draws below reserve. Validate fixed outage count, zero grid/EV flow, and potential-solar targets.
- [ ] **Step 5: Run the annual tests until they pass. Commit with `git add src/simulation/generateYear.ts src/simulation/validateYear.ts src/simulation/generateYear.test.ts src/simulation/outageYear.test.ts && git commit -m "feat: generate and validate annual outages"`.**

### Task 5: Monthly statements and inspector

**Files:** Create `src/simulation/monthlyStatements.ts`, `src/simulation/monthlyStatements.test.ts`; modify `src/inspector/SimulationInspector.tsx`, `src/inspector/SimulationInspector.test.tsx`, `src/index.ts`.

- [ ] **Step 1: Write failing statement and inspector tests.** Assert twelve statements, January opening bank zero, each month's opening bank equals the previous closing bank, `applied = min(importCost, opening + earned)`, `closing = opening + earned - applied`, and `amountDue = importCost - applied + 12`. Assert inspector labels all new values `Simulated` or `Modeled` and does not render them for legacy August records.
- [ ] **Step 2: Run `npx vitest run src/simulation/monthlyStatements.test.ts src/inspector/SimulationInspector.test.tsx --maxWorkers=1`; expect failure.**
- [ ] **Step 3: Implement `buildMonthlyStatements(records: readonly AnnualEnergyInterval[]): readonly MonthlyStatement[]`.** Aggregate `importCost` and `exportCredit` by calendar month, calculate the bank in month order using the exact formulas above, and freeze each statement and the array. Export `MonthlyStatement` and the builder from `src/index.ts`.
- [ ] **Step 4: Add a plain annual-only inspector section.** Use the current interval's annual fields, show `Grid status (simulated)`, `Battery-only backup estimate (modeled)`, and outage curtailment/unserved demand. For the current calendar month, show opening credit, earned credit, applied credit, closing credit, service charge, and `Amount due (modeled)`. State that solar, future load, taxes, minimum charges, adjustment factors, and real bill balances are excluded as applicable.
- [ ] **Step 5: Run focused tests; expect pass. Commit with `git add src/simulation/monthlyStatements* src/inspector/SimulationInspector* src/index.ts && git commit -m "feat: expose modeled statements and outage data"`.**

### Task 6: Final verification

- [ ] **Step 1: Run `npm ci` in this worktree if dependencies are absent; expect a successful install matching `package-lock.json`.**
- [ ] **Step 2: Run `npm run check`; expect TypeScript, all Vitest suites, and Vite build to pass.**
- [ ] **Step 3: Run `git diff --check` and `git status --short`; expect no whitespace errors or unintended files.**
- [ ] **Step 4: Inspect one winter and one summer outage and one monthly statement through the generated dataset; confirm the displayed labels match the spec.**
