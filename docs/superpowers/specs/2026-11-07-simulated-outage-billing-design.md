# Woodland Hills simulated outage and billing data — design specification

**Date:** 2026-11-07  
**Status:** Approved and implemented

## Purpose and scope

Extend the deterministic 2026 annual simulation with coherent outage events, a modeled monthly bill and export-credit bank, and a battery-only backup-duration estimate. These are synthetic scenario values for reusable homeowner components, never utility or device telemetry. The existing August generator and its data contract remain intact.

The annual ledger remains the source of truth. No separate hypothetical outage overlay will be shown beside contradictory grid-connected flows. The two outage events occur on January 15, 15:00–17:30, and July 21, 13:00–17:30, in Woodland Hills local time. Both are weekdays while the simulated EV is away, so the established EV trip and charge schedule remains continuous.

## Annual outage routing

Each annual interval identifies the grid as `connected` or `outage`. During an outage, import and export are exactly zero. Solar first serves home demand and then charges the battery within its power and capacity limits. The battery serves remaining home demand within its power limit and may use energy below the normal 15% dispatch reserve, down to zero. Solar energy that cannot be used is recorded as curtailed; home demand that cannot be served is recorded as unserved. EV charging is zero throughout the fixed events.

The annual record distinguishes **potential solar** from actual generated solar. Potential continues to follow the existing deterministic solar model and reference targets; actual solar equals potential less curtailment. The home-load field remains demand, while served home energy equals demand less unserved energy. Transfer routes and the energy balance use actual solar and served home energy. After the grid returns, normal dispatch resumes; a battery below its usual reserve cannot discharge for bill optimization and recharges from later solar. Battery state never resets at an outage boundary.

Outage intervals have zero import cost and export credit. Their counterfactual all-grid cost, modeled bill savings, and grid-emissions comparison are also zero because grid service is unavailable. Unserved demand is shown separately and is never counted as financial savings.

## Monthly modeled statement

A selector derives twelve calendar-month statements from the annual interval ledger. The opening credit bank is zero in January. For each month:

1. Sum grid import cost and export credit earned from the intervals.
2. Add earned export credit to the opening bank.
3. Apply up to the month's import cost from the available bank.
4. Carry unused credit into the next month.
5. Add the scenario's $12 monthly service charge to any remaining energy amount due.

The statement exposes opening bank, import cost, credit earned, credit applied, closing bank, service charge, energy amount due, and **modeled amount due**. Internal arithmetic retains full precision; the inspector rounds only for display. The bank cannot become negative, and export credit is never presented as a cash payment. Taxes, minimum charges, adjustment factors, prior real balances, and actual LADWP billing periods are outside this scenario. The inspector must say so next to the modeled amount.

## Battery-only backup estimate

Each annual interval exposes an estimate for the **end** of that interval. It uses remaining stored battery energy, the discharge efficiency already used by the router, and average whole-home demand over the trailing 60 minutes. The estimate assumes no solar production, no EV charging, and an unchanged load. Normal dispatch reserve is available during an outage. If recent demand exceeds the 5 kW battery output limit, the estimate is zero and the power-limit condition is exposed. The value is a simple scenario estimate, not a guaranteed runtime or a Tesla device estimate. The inspector shows the assumption with the value.

## Public data and inspection

The annual record type adds grid status, potential solar, curtailed solar, unserved home energy, and backup estimate fields without changing the August record type. Export a typed monthly statement selector and the annual outage schedule for future components. The existing plain inspector shows current simulated grid status, curtailed/unserved energy when applicable, backup estimate and its assumption, and the selected calendar month's modeled statement. No new dashboard component is part of this change.

## Verification

- Each fixed event has the expected local timestamps and zero grid flow and EV charging.
- Every annual interval conserves energy and reconciles transfers, including curtailment, unmet demand, and battery losses.
- Battery and EV states remain continuous before, during, and after events; the normal reserve is respected for grid-connected discharge.
- Potential solar preserves the configured monthly and annual targets; actual solar never exceeds potential.
- Monthly statement totals reconcile to interval import costs and export credits, and credit bank continuity holds across all twelve months.
- Backup estimates follow the stated formula and power limit, including intervals with low battery charge.
- The full annual validator, targeted tests, type check, and production build pass.

## Source boundaries

The credit-bank concept follows [LADWP's NEM guidance](https://www.ladwp.com/sites/default/files/documents/LADWP_Amended_Net_Energy_Metering_Guidelines_Document_January_2021_.pdf), which says credits apply to later bills except certain charges. The runtime approach follows [Tesla's API description](https://developer.tesla.com/docs/fleet-api/endpoints/energy), which bases its estimate on remaining energy and recent home load. Neither source validates this scenario's dollar amount or backup hours for a real home.
