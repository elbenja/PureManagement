# Woodland Hills energy simulation — session handoff

**Prepared:** November 7, 2026

**Project:** PureManagement, a local homeowner energy simulation

**Current implementation branch:** `main` (annual simulation and modeled outage/billing data)

**Working directory:** `/Users/benjaminsaravia/Projects/Silverdesk-lab/PureManagement`

## Where the project stands

The running application is a **plain simulation inspector**, not the planned visual homeowner dashboard. It generates and plays a deterministic, fully synthetic 2026 story for a Woodland Hills home. The user wants to design reusable visual components that can appear in several places, then build them. Prior research recommended starting with **Now & Flow**, **Cost & Credit**, and **Battery Readiness**, followed by Usage Drivers and History.

The annual simulation originated on `codex/annual-energy-flow`; `codex/simulated-outage-billing` added simulated outages, bill-credit accounting, and backup-hours estimates. Both sets of work are now in `main`. The earlier August generator remains available for compatibility. The feature worktrees may still exist locally, but use the repository root for the current app.

The earlier research report and visual PDF are in the repository root working folder, currently untracked:

- `/Users/benjaminsaravia/Projects/Silverdesk-lab/PureManagement/docs/research/2026-11-04-woodland-hills-home-energy-components.md`
- `/Users/benjaminsaravia/Projects/Silverdesk-lab/PureManagement/docs/research/woodland-hills-home-energy-visual-research.pdf`

Those research artifacts predate the new simulated bill, outage, and backup data. Their statements about those *simulated* gaps are now stale. Their warning about lack of **real telemetry and real utility billing** remains valid.

## Simulation scope

| Item | Current model |
| --- | --- |
| Place and period | Woodland Hills, Los Angeles; January 1–December 31, 2026 |
| Resolution | 105,120 immutable five-minute intervals, continuous across daylight-saving transitions |
| Scenario | 8 kW solar, 13.5 kWh / 5 kW home battery, 75 kWh EV with 7.2 kW charging, four residents in a 2,200 sq ft home |
| Annual targets | 13,581.49 kWh **potential** solar, 15,500 kWh home demand, 4,080 kWh EV energy |
| Inputs | Seeded synthetic weather, seasonal solar, home appliance and HVAC demand, EV travel and charging, fixed scenario tariff and emissions factor |
| Output | Physical energy routes, battery and vehicle state, grid import/export, modeled energy cost/credit/savings, avoided emissions, outage status, backup estimate, and monthly modeled statements |

The model is local and repeatable. It does not connect to a home, inverter, battery, utility account, weather service, or meter. The 2026 tariff values are fixed scenario inputs, not a live rate feed.

## Features and data semantics

1. **Annual energy ledger.** `generateYear()` builds the clock, weather, solar, home load, and EV schedule, then routes each interval in one pass. Battery and EV state continue across days and months. `validateYear()` checks the exact record contract, energy conservation, transfers, accounting, time, seasonal targets, and continuity. The legacy `generateMonth()` August dataset remains available.
2. **Grid-connected routing.** Solar serves home and EV first, then charges the battery, then exports. Battery discharge for bill optimization respects the 15% reserve and the 5 kW limit. Grid import meets remaining demand. Interval rates model import cost and export credit; savings compare with an all-grid case.
3. **Two simulated outages.** January 15, 15:00–17:30 PST, and July 21, 13:00–17:30 PDT. Both occur while the simulated EV is away. During an outage, grid import/export and EV charging are zero. Solar serves home and battery, battery can use its normal reserve, excess solar is curtailed, and unmet home demand is recorded. Outage intervals do not count unavailable grid energy as bill savings or avoided emissions. In the fixed 2026 events, some solar curtailment occurs; the model supports unmet demand, but these two events do not produce a positive unserved-demand value.
4. **Potential versus actual solar.** Annual `solarPotentialKwh` follows the target curve. `solarKwh` is actual generation after `curtailedSolarKwh`; it can be lower during an outage. `homeKwh` is requested home demand; served home energy is `homeKwh - unservedHomeKwh`.
5. **Battery-only backup estimate.** `backupHoursEstimate` is calculated at each interval's end from remaining stored energy, discharge efficiency, and average home demand over the preceding 60 minutes. It assumes no solar, no EV charging, and unchanged load. `backupPowerLimited` flags recent demand over the battery's 5 kW output limit. This is a simple modeled estimate, not guaranteed runtime.
6. **Monthly modeled statement.** `buildMonthlyStatements()` creates twelve calendar-month statements from annual import cost and export credit. January opens with a zero credit bank; earned credits offset import cost and unused credit carries forward. A $12 scenario service charge is added to the remaining energy amount. The displayed amount excludes taxes, minimum charges, adjustment factors, actual billing periods, and any real prior balance. Export credit is a bill credit, not cash income.
7. **Playback and consumer views.** Playback advances one simulated day per real minute and loops at year-end. The React controller supports play/pause, scrubbing, day jumps, six history ranges, bounded period navigation, and a simulated seven-day outlook. `getLiveFrame()` exposes five nodes and explicit energy transfers; the grid node reports `outage` during scheduled events. Historical totals use original intervals, while chart series are sampled.
8. **Inspector UI.** The app shows the current interval, playback controls, grid/battery/solar/home/EV nodes, transfer table, range totals, weather outlook, simulated outage and backup values, and the current month's modeled statement. It is deliberately an inspection surface; reusable visual cards and the final dashboard have not been designed or built.

## Entry points and key files

| Purpose | File |
| --- | --- |
| Framework-neutral public API | `src/index.ts` |
| Fixed scenario and assumptions | `src/scenario/losAngeles2026.ts` |
| Annual record type | `src/domain/annualEnergy.ts` |
| Annual generation and validation | `src/simulation/generateYear.ts`, `src/simulation/validateYear.ts` |
| Outage schedule and routing | `src/simulation/annualOutages.ts`, `src/simulation/annualRouter.ts` |
| Backup estimate and monthly statements | `src/simulation/backupEstimate.ts`, `src/simulation/monthlyStatements.ts` |
| Playback, views, and React adapter | `src/playback/`, `src/consumer/views.ts`, `src/consumer/useEnergySimulation.ts` |
| Current UI | `src/inspector/SimulationInspector.tsx`, `src/App.tsx` |
| Approved designs and implementation plan | `docs/superpowers/specs/2026-08-17-woodland-hills-annual-energy-flow-design.md`, `docs/superpowers/specs/2026-11-07-simulated-outage-billing-design.md`, `docs/superpowers/plans/2026-11-07-simulated-outage-billing.md` |

For a component, import `generateYear`, `getLiveFrame`, `getHistoryView`, `getDailyOutlook`, `buildMonthlyStatements`, `LOS_ANGELES_2026`, and `AnnualEnergyInterval` from `src/index.ts`. The React adapter is `useEnergySimulation()` in `src/consumer/useEnergySimulation.ts`. Generate the year once and pass the immutable records to consumers; do not regenerate it on each render.

## Run and verify

From the **repository root** above:

```bash
npm install --no-package-lock --no-audit --no-fund
npm run dev -- --host 127.0.0.1
```

Open the local address printed by Vite (usually `http://127.0.0.1:5173/`). A server started in an earlier chat may have stopped; start a new one if the page does not load. The repository has no `package-lock.json`, so `npm ci` is not the setup command. `README.md` also documents a Bun workflow. Vitest excludes the nested `.worktrees/` folder so the root check runs only the current source tree.

```bash
npm run check
```

The full gate on `main` passed **392 tests in 30 files**, TypeScript, and the Vite production build on November 7, 2026. Rerun it after code changes.

## Boundaries for the next session

- Keep all homeowner copy explicit that these values are **simulated** or **modeled**. There is no live outage detection, utility bill balance, device diagnosis, or validated backup promise.
- Use actual solar (`solarKwh`) for displayed generation; use potential solar only when discussing the modeled production target or curtailment. Distinguish home demand from served home energy when an outage can leave load unmet.
- Do not turn export credits into “earnings” or treat the modeled monthly amount due as an actual LADWP bill.
- The earlier research points to reusable components. The current inspector is a data foundation, not the intended visual direction. Decide component design with the user before replacing it.
