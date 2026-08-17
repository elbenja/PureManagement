# Woodland Hills Annual Energy Flow — Design Specification

**Date:** 2026-08-17

**Status:** Approved design, pending written-spec review

## 1. Purpose

Extend the existing deterministic August 2026 home-energy simulation into a believable, fully local calendar-year story for Woodland Hills, Los Angeles. The annual dataset must make seasonal solar, rain, heating, cooling, household demand, EV charging, battery dispatch, grid exchange, cost, savings, and avoided emissions available through the same five-minute ledger model used by the current prototype.

This is the data-foundation stage. The separate presentation-grade dashboard and tabbed navigation remain a subsequent project built after the annual contract is stable.

## 2. Approved product decisions

- Location remains Woodland Hills, Los Angeles.
- The simulated period is January 1 through December 31, 2026.
- Weather uses climate-anchored synthetic patterns. It is a scenario, not observed weather or a forecast.
- The same seed always reproduces the same year.
- Playback remains one simulated day per real minute and loops after December 31.
- Historical filters accept any valid anchor in the year; no navigation date is hard-coded.
- The existing August generator remains available as a backward-compatible API.

## 3. Chosen approach

Use **monthly climate envelopes with continuous annual state**.

A versioned monthly table supplies the seasonal envelope for daylight, solar yield, temperature, rain, heating, cooling, household demand, and EV behavior. Seeded generators select the exact daily events within those envelopes. The router then resolves all 365 days in a single continuous pass so home-battery and EV state never reset at a day or month boundary.

This approach was selected over independently stitched months, which would create state discontinuities, and over one smooth annual equation, which would make discrete rain systems, cold snaps, heat waves, and other recognizable events harder to control.

## 4. Annual clock and local time

The 2026 ledger contains exactly **105,120 immutable five-minute records**: 365 days × 24 hours × 12 intervals.

Records are continuous in absolute time and expose local `America/Los_Angeles` calendar fields. The clock must model the 2026 daylight-saving transitions correctly:

- The spring transition has 23 local hours and skips the nonexistent local hour.
- The autumn transition has 25 local hours and represents the repeated local hour with distinct UTC offsets.
- ISO timestamps remain ordered and unique across both transitions.

Year-aware clock fields include the calendar year, month, day of month, day of year, day of week, minute of day, and local UTC offset. Duration-based selectors operate on record counts and absolute chronology, not assumptions that every local calendar day contains 288 records.

## 5. Seasonal story

### Winter

January and February have the shortest daylight, lower solar yield, mild but visible heat-pump demand, clustered cloudy or rainy systems, and occasional deterministic cold snaps. December returns to the same winter regime. Winter remains recognizably Southern Californian rather than resembling a freezing climate.

### Spring

March through May increase daylight and solar production while heating falls and cooling remains moderate. Rain becomes less frequent and tapers toward late spring. Household demand should visibly relax between the winter and summer peaks.

### Summer

June through September have long daylight, strong solar production, dry conditions, sustained cooling demand, and deterministic heat-wave events. August preserves the existing scenario's character: strong production alongside high air-conditioning demand.

### Autumn

October may include late-season heat, followed by declining solar and cooling demand. November transitions toward shorter daylight, renewed rain systems, and mild heating demand.

Seasonal changes must be gradual at month boundaries. Monthly parameters define envelopes, while interpolation and correlated daily variation prevent visible step changes on the first of each month.

## 6. Weather and conditions model

Each interval exposes:

- Temperature in degrees Fahrenheit
- Cloud factor
- A weather state: `clear`, `partly-cloudy`, `overcast`, or `rain`
- Nonnegative precipitation for the interval
- The existing behavioral day type, such as weekday, weekend, heat wave, or cloud-affected day

Rain occurs in seeded multi-hour or multi-day systems, not isolated white-noise samples. Most rain events occur in the wet-season months; dry-season rain is rare but not impossible. Cloud cover ramps into and out of a weather system, suppresses solar production, and shares one condition source with the temperature and load models.

Weather is generated before solar and household demand so those modules respond to the same conditions shown by consumers. No value or label may imply that this synthetic outlook predicts real weather.

## 7. Energy generation and demand

### Solar

Solar uses month-aware daylight and the following fixed synthetic target table, stored in the annual scenario. The values preserve the existing annual PVWatts anchor and approved August target while providing a believable seasonal curve for this scenario.

| Month | Target solar energy |
| --- | ---: |
| January | 791.00 kWh |
| February | 867.00 kWh |
| March | 1,155.00 kWh |
| April | 1,300.00 kWh |
| May | 1,380.00 kWh |
| June | 1,440.00 kWh |
| July | 1,470.00 kWh |
| August | 1,414.65 kWh |
| September | 1,205.00 kWh |
| October | 1,050.00 kWh |
| November | 780.00 kWh |
| December | 728.84 kWh |
| **Annual** | **13,581.49 kWh** |

Generated annual energy must remain within ±2% of the annual anchor, and every monthly total must remain within ±2% of its configured target.

Solar is zero outside the month-appropriate daylight window, never exceeds the 8 kW array rating, and responds continuously to cloud and rain conditions.

### Home and HVAC

The existing appliance breakdown remains intact. HVAC demand becomes season-aware:

- Heating responds to winter temperature shortfalls.
- Cooling responds to summer temperature excess and heat waves.
- Shoulder-season HVAC demand is lower than the winter and summer peaks.

The annual high-use detached-home target is **13,500–17,500 kWh before EV charging**. August remains within the existing 1,700–1,950 kWh envelope. The final deterministic fixture must include nonzero energy for every existing appliance category.

### EV

EV travel and charging remain deterministic and continuous across the year. Daily trip timing may vary by season and weekday/weekend state, but the vehicle must support every scheduled departure and remain within its state-of-charge bounds.

Annual home EV charging must remain between **3,600 and 4,800 kWh**, with every calendar month between 250 and 450 kWh. Charging continues to prefer the approved off-peak period unless the vehicle needs energy for its next departure.

## 8. Routing, accounting, and continuity

The existing routing order and accounting rules remain authoritative:

1. Solar serves home and EV demand.
2. Remaining solar charges the battery.
3. Remaining solar exports to the grid.
4. The battery may serve an eligible shortfall above its reserve.
5. The grid supplies the final unmet demand.

Every interval must conserve energy, including battery conversion losses. Battery charging and discharging remain mutually exclusive; grid import and export remain mutually exclusive. Battery and EV state carry continuously across midnight, month boundaries, daylight-saving transitions, and December 31. Only playback wraps from the final record to the first; ledger state and historical selectors do not treat the year as circular.

The versioned 2026 annual scenario owns all tariff and emissions inputs. Components continue to describe exports as **export credit earned**, not cash income.

## 9. Public data contract

Add a framework-neutral `generateYear()` entry point that returns the frozen 2026 ledger. Retain `generateMonth()` and the August scenario export for backward compatibility.

Existing interval fields, live nodes, transfers, appliance values, and accounting values remain compatible. The annual record contract adds the year-aware clock and weather fields described above.

`getLiveFrame()` continues to expose the active timestamp, conditions, nodes, transfers, appliance breakdown, and interval accounting. Consumers can display the city from annual scenario metadata rather than duplicating it in every record.

`getHistoryView()` supports the following approved ranges at any valid anchor:

- Last 24 hours
- Last 7 days
- Last 30 days
- Calendar month containing the anchor
- Year to date

A trailing 30-day view contains at most 8,640 five-minute intervals and can cross month boundaries. For example, a view anchored at the end of February 15 spans January 17 through February 15. This is an example of range semantics, not a hard-coded date. Near the beginning of the dataset, trailing views return the available bounded slice and report navigation availability accurately.

Calendar-month and year-to-date ranges use local calendar boundaries. All totals come from the exact immutable records in the selected range.

## 10. Simulated daily outlook

Add a framework-neutral daily-outlook selector derived from future annual ledger records. From an arbitrary anchor it returns up to the next seven available calendar days with:

- Local date
- Dominant weather state
- Minimum and maximum temperature
- Total simulated precipitation
- Expected solar energy

At the end of December, the selector returns only days that remain in the dataset; it does not wrap to January. The outlook is labeled as part of the simulated scenario and must never be presented as live meteorological forecasting.

## 11. Playback and navigation

Playback advances 288 five-minute slots per real minute, equal to one simulated 24-hour duration per minute. A complete annual loop takes 6 hours 5 minutes. After the final interval, the visual playback position returns to the first interval.

Play, pause, scrub, and day-jump behavior remain available. History anchors and calendar filters remain bounded to the annual dataset. Resuming playback restores the history view to the retained live position, matching the current controller behavior.

## 12. Backward compatibility and migration

The current `generateMonth()` behavior, August scenario, and August-focused tests remain available. The annual implementation adds new modules and generalizes shared helpers without silently changing the approved legacy fixture.

The inspector migrates to annual scenario metadata and `generateYear()` only after annual validation passes. It should expose enough annual information to inspect weather, arbitrary range selection, the daily outlook, and continuity across month and daylight-saving boundaries. The presentation-grade dashboard is explicitly outside this implementation stage.

## 13. Validation

Annual generation is rejected if any of the following checks fail:

- Record count is not exactly 105,120.
- Timestamps are missing, duplicated, unordered, or incorrect at a daylight-saving boundary.
- Energy fails to balance within the approved floating-point tolerance.
- Battery or EV state leaves its bounds or becomes discontinuous.
- Battery charge/discharge or grid import/export occurs simultaneously.
- Solar is nonzero outside daylight or exceeds the array rating.
- A solar month or the annual total falls outside its configured target tolerance.
- Annual or August home demand falls outside its approved envelope.
- Annual or monthly EV energy falls outside its approved envelope.
- Weather fields are nonfinite, precipitation is negative, or rain is not concentrated into coherent events.
- Winter has no heating response, summer has no cooling response, or required seasonal event types are absent.
- Interval totals and arbitrary selector totals do not reconcile with the source ledger.

Generation and validation are atomic. On failure, the consumer receives no partial annual dataset and the app retains the existing **“Simulation data unavailable.”** boundary.

## 14. Test strategy

- Clock tests cover the first and last intervals, all month boundaries, February 28, both daylight-saving transitions, uniqueness, order, and record count.
- Weather tests cover deterministic reproduction, seed variation, wet/dry season distribution, coherent rain systems, heat waves, cold snaps, and gradual month transitions.
- Solar tests cover monthly and annual targets, daylight windows, array limits, and weather response.
- Home tests cover annual and August envelopes, appliance reconciliation, heating response, cooling response, and seasonal ordering.
- EV tests cover annual/monthly envelopes, scheduled departures, continuity, and bounds across month boundaries.
- Router and accounting tests retain current invariants and add cross-month and daylight-saving cases.
- Selector tests cover every approved range at the start, middle, end, month boundaries, and arbitrary anchors, including a 30-day range that crosses January and February.
- Outlook tests cover daily aggregation, seven-day bounding, arbitrary anchors, and the end-of-year partial result.
- Playback tests confirm one-day-per-minute advancement and looping from the final annual record to the first.
- A deterministic annual integration fixture locks representative timestamps, monthly totals, event dates, and the final annual totals.

## 15. Performance and storage posture

The annual ledger remains generated locally and held in memory. No database, network service, worker, persistence layer, or precomputed download is introduced in this stage. The generator runs once at application module scope, following the current Strict Mode protection.

Charts consuming long annual ranges must use selector-level sampling or aggregation rather than rendering all 105,120 points. Accounting totals must always use the unsampled ledger.

## 16. Out of scope

- Actual observed or forecast 2026 weather
- Utility-grade billing or investment forecasting
- A second geography or household profile
- Equipment degradation and financing
- Network synchronization or cloud persistence
- The award-style visual dashboard and its tab navigation

## 17. Acceptance criteria

1. `generateYear()` deterministically produces a valid, frozen 105,120-record 2026 ledger.
2. The year communicates recognizable Woodland Hills winter, spring, summer, and autumn behavior.
3. Rain, clouds, temperature, solar, HVAC demand, and storage response tell one internally consistent story.
4. Energy, money, and carbon remain balanced and reconcilable at every interval and approved range.
5. Any valid anchor supports 24-hour, 7-day, 30-day, calendar-month, and year-to-date views.
6. The daily outlook exposes up to seven simulated future days without implying a real forecast.
7. Playback advances one day per minute and loops after December 31.
8. Existing August generation remains available and its public behavior does not regress.
9. The inspector can verify the annual contract before new showcase components are built.
