# Claude Design prompt — PureEnergy motion components

Paste everything below the line into Claude Design. Attach `sample GUI/V_light.jpg` and `sample GUI/v-fdark.jpg` as mood references (look and feel only; the prompt overrides their labels and units).

---

Design an exploration of animated, reusable components and two dashboard compositions for **PureEnergy**, a home-energy app for a house with rooftop solar, a home battery, an EV, and a grid connection. I want to see bold, distinct ideas, especially **how motion explains what the energy is doing**. Make every component an interactive prototype with real animation (CSS/JS/SVG), not static mockups, and include a small control panel that switches between the scenario snapshots below so I can watch each component react.

## The home (all data is a deterministic simulation)

Woodland Hills, Los Angeles · LADWP R-1B time-of-use rate · 8 kW rooftop solar · 13.5 kWh home battery (5 kW max output, 15% reserve held for outages) · 75 kWh EV with a 7.2 kW charger · four residents, 2,200 sq ft. The data replays the full year 2026 at five-minute resolution; playback runs one simulated day per real minute.

## Scenario snapshots to animate between (real values from the simulation)

| # | Moment | Solar | Home | EV | Battery | Grid | Notes |
|---|---|---|---|---|---|---|---|
| A | Jul 20, 12:30 PM, clear 85°F | 5.77 kW out | 2.74 kW | away | full 100%, idle | **exporting 3.04 kW** | solar→home 2.74, solar→grid 3.04 · backup ~4.7 h |
| B | Apr 3, 9:55 AM, clear 63°F | 4.82 kW | 0.48 kW | away | **charging 3.58 kW** | exporting 0.76 kW | solar splits three ways |
| C | Jul 22, 6:30 PM, 89°F | 1.72 kW | 5.70 kW | plugged in, idle | **discharging 3.98 kW**, 76% | idle | battery covering the evening; backup ~2 h |
| D | Jul 1, 8:00 PM | 0 | 4.17 kW | **charging 7.2 kW** | 24%, idle | **importing 11.37 kW** | grid→home 4.17, grid→EV 7.2 |
| E | Jan 1, 7:35 PM, rain 63°F | 0 | 3.89 kW | plugged in | discharging 1.43 kW, **15% = at reserve** | importing 2.46 kW | low battery; backup ~0.5 h |
| F | Jul 21, 3:00 PM, 91°F | 2.12 kW | 2.12 kW | away | 100%, idle | **OUTAGE** | grid down; solar alone carries the home, some solar curtailed; backup ~6 h |
| G | Jun 10, 7:35 PM | 0.45 kW | 4.89 kW | plugged in | discharging 4.43 kW, 56% | idle | **home demand near the battery's 5 kW limit** |

Period totals for trend components:

| Period | Solar | Home + EV used | Grid import | Grid export | Modeled import cost | Export bill credit | All-grid cost | Modeled savings | Avoided CO2e |
|---|---|---|---|---|---|---|---|---|---|
| January | 791 kWh | 1,590 kWh | 1,141 kWh | 325 kWh | $303.69 | $99.06 | $431.80 | $227.16 | 177 kg |
| June | 1,440 kWh | 1,540 kWh | 712 kWh | 593 kWh | $189.02 | $184.38 | $431.15 | $426.50 | 325 kg |
| July | 1,461 kWh | 1,990 kWh | 873 kWh | 312 kWh | $232.05 | $101.32 | $557.06 | $426.33 | 325 kg |
| Full year | 13,572 kWh | 19,580 kWh | 11,598 kWh | 5,294 kWh | $3,083.86 | $1,651.64 | $5,400.93 | $3,968.71 | 3,037 kg |

Modeled monthly statements: **June** opens with a $69.23 credit bank, earns $184.38, applies $189.02, closes with $64.58 banked → $12.00 due (service charge only). **July** applies the remaining $64.58 bank plus $101.32 earned → $78.14 due. **January** → $216.64 due.

Simulated 7-day outlook from Jul 20: clear every day, highs 90→102°F, expected solar 51, 38, 48, 44, 46, 46, 46 kWh.

## Components to design (priority order, from owner research)

1. **Live energy flow** — solar, home, EV, battery, grid as nodes with directional transfers and kW, plus a one-line plain-language sentence ("Solar is powering the home and sending extra to the grid"). Compact card and a large hero version.
2. **Modeled savings** — modeled cost vs. what an all-grid home would pay, shown in $ and kWh side by side, with period tabs (Day / Week / Month / Year).
3. **Self-powered share** — "Where your home's energy came from": solar / battery / grid as a 100% composition with kWh on each part (not a lone percentage ring).
4. **Battery readiness** — charge %, kWh available above the 15% reserve, state (charging / discharging / idle / holding reserve), and "~X h at recent use (estimate)". Draw the reserve as a visible line **below** the fill.
5. **Grid exchange** — grid import cost vs. export **bill credit**, a 24-hour R-1B rate bar with a "now" marker, and the modeled monthly statement with the credit bank carrying forward.
6. **Period history** — this period vs. last period (kWh by source) with a change indicator.

Then compose them into **two dashboards**: a desktop overview (≈1440 px) and a phone layout (≈390 px). Show both light and dark themes.

## Motion — this is the main thing I want ideas on

Please propose and prototype several directions for each of these. Suggestions to start from, but surprise me:

**Live vs. recorded (replay)**
- Live: a softly pulsing "Simulated live" dot, particles that keep flowing, numbers that roll like an odometer as values update, a timestamp that ticks.
- Recorded/replay: particles freeze or slow to a faint trail, colors desaturate slightly, a scrubber with a playhead appears, the chip changes to "Replay · Jul 21, 3:00 PM". The difference should be readable in under a second without reading text.

**Direction of flow (in vs. out)**
- Particles or dashes moving along each path; speed and line thickness proportional to kW; zero kW = no line, never a still dashed line that looks active.
- Grid import and grid export use different colors and visibly opposite motion; the grid node "breathes in" when importing and "breathes out" when exporting.
- Battery fills upward from the bottom when charging and drains downward when discharging; EV shows a charging pulse traveling into the car.
- Snapshot D (11.37 kW import) should feel heavy and fast; snapshot A (exporting) should feel generous, flowing out.

**Low battery**
- As charge approaches the reserve line, the fill shifts toward amber and the reserve line gains emphasis; at the reserve (snapshot E) the bar settles onto the line with a small "holding reserve" lock instead of flashing red alarms.
- Estimated backup hours count down smoothly; show the "~" and "estimate" at all times.

**Improving, deteriorating, steady**
- Change chips that count up into place ("↓ 38 kWh vs last month"), sparklines that draw themselves in, a ghost bar of last period that morphs into this period.
- Careful with color: less grid import is good, more export is good, more home use is neutral. Pair arrows with words, not color alone.

**Other moments worth motion**
- **Outage (snapshot F):** the grid line visibly disconnects (a severed or fading line), the grid node dims with a "Grid outage (simulated)" label, the home re-routes to solar + battery, curtailed solar shows as gently "spilling" away.
- **Battery at its 5 kW limit (snapshot G):** a strain indicator on the battery→home path.
- **Rate period:** the "now" marker slides along the 24-hour rate bar; the peak window glows softly when active.
- **Transitions between periods:** bars and totals animate between Day / Week / Month / Year rather than snapping.
- Respect `prefers-reduced-motion`: every animated meaning must also exist as a static cue (arrows, labels, icons).

## Content and labeling rules (non-negotiable)

- Always show a "Simulated 2026" badge and the local timestamp. Never imply this is a real meter, real outage detection, or a real LADWP bill.
- **kW only for "now"**; **kWh only with a named period** ("Used today: 18.4 kWh"). Never mix them in one number, never write "Wh" for power.
- Export is a **bill credit**, never "sold", "earnings", "income", or "money made". Use "Export bill credit".
- Savings are "**Modeled savings vs an all-grid bill**" with an (i) that reveals the formula.
- Backup hours are always "~X h (estimate, battery only)", never a guarantee.
- Use USD ($), not £. Show import and export as two numbers; never collapse them into one net signed value alone.
- Carbon is secondary: show kg CO2e as the number, at most one equivalent (miles driven), no trees.
- One fixed color per source across every component: solar, battery, grid import, grid export, EV, home.

## Visual direction

Use the attached images for mood: premium, calm, a house photo or render as the stage for the hero flow, rounded cards, large confident numbers with small units, generous spacing, light and dark versions. Avoid legends that need decoding; put labels on the data. Keep each component self-contained so it can be reused in other layouts.

## What to deliver

1. A component gallery: each of the six components in compact and expanded sizes, light and dark, with the scenario switcher driving them.
2. At least **two contrasting motion directions** for the live flow (e.g., particle-physics vs. minimal line pulses) so I can compare.
3. The desktop and phone dashboards composed from those components.
4. A short note per component explaining which motion communicates what.
