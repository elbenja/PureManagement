# Mobbin component patterns for a home energy dashboard

Method: 13 searches via the Mobbin MCP server (search_screens / search_flows; iOS and web), on 2026-11-08. Each entry below was checked against the inline screenshot Mobbin returned. Descriptions come from those images, not from metadata. Nothing was saved to the user's Mobbin account. All URLs are the `mobbin_url` values the tool returned. Platform is iOS unless marked (web).

Coverage caveat: Mobbin's Tesla capture is an account with a **Wall Connector + Model 3 only**. It has no Powerwall or solar site. So the Powerwall energy-flow animation, Backup Reserve slider, Storm Watch, Impact/Self-Powered and solar-savings screens are **not on Mobbin** (see Gaps). In the Tesla app, the closest Powerwall material on Mobbin is the "Demo Powerwall" teaser and the rate-plan (TOU) screens.

---

## 1. Tesla app: what is on Mobbin, and what makes it readable?

### Takeaway
Tesla's readable screens follow one formula: a dark canvas, one large number with a small grey unit (e.g. "155.0 kWh", "$119"), a single accent colour per meaning, and labels placed directly next to the data rather than in legends. The strongest pieces for an energy dashboard are the **TOU rate timeline bar**, the **Charge Stats month view** (hero totals + daily bars + location split), and the **Petrol Savings comparison** (spent vs equivalent). The live-flow house render ("4.6 kW" floating over the house/garage) shows the spatial energy-flow idiom, but Mobbin has only the EV-charger version.

### Cited Findings
**Energy flow / live power (house render)**
- *My Home*, Tesla iOS. A 3D dark render of the house with the car in the garage and one floating callout ("Blackstar / 4.6 kW") leading to the charger. Below it is a plain list: Energy, Charge History, Settings, Support. Why it reads well: the live kW value sits on the object it describes, so no legend is needed; one number fills the hero zone. Energy use: live power flow (solar→home, grid→home, home→EV) as callouts on a house illustration. — [Tesla My Home](https://mobbin.com/screens/e9185aa7-9613-424c-b995-08f17e9e2ae3?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Try the Tesla App / Demo Powerwall* teaser. A phone mock-up shows the Powerwall energy-flow screen: a house with solar panels and floating labels "SOLAR 6.5 kW", "MODEL 3 0.8 kW", "HOME 0.8 kW". This is the only Powerwall flow view on Mobbin, and it appears only as a small preview. Energy use: confirms Tesla's pattern of node labels in kW (power, not energy) placed spatially around the house. — [Tesla Demo Powerwall teaser](https://mobbin.com/screens/666b888d-e943-40ca-a1ac-72de35a934ba?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Energy* flow (2 screens: My Home → Vehicle year chart). — [Tesla Energy flow](https://mobbin.com/flows/730e86cd-9c83-425b-a55a-a76240826eca?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp); *My Home* flow (3 screens). — [Tesla My Home flow](https://mobbin.com/flows/659bda26-6282-47cb-babe-2b2eb4602914?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**Energy history graphs**
- *Vehicle (Year)*. "2026", a "↓ Charged" label, the hero "155.0 kWh" with a small grey unit, a Year dropdown, monthly bars J–D, and a right-aligned y-axis that carries the unit ("156 kWh / 78 / 0"). Why it reads well: the direction arrow plus verb ("↓ Charged") says what the number means, the unit is de-emphasised, and there are only three gridlines. Energy use: annual grid import, solar production or EV charging by month. Edge case: with one month of data the chart shows a single bar and 11 empty slots. That is honest, but it looks sparse. — [Tesla Vehicle year chart](https://mobbin.com/screens/1f99eb66-657e-478a-a519-36cd212b963f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Charge Stats (Month)*. A segmented Month/Year switch. Under "Last 31 Days" sit two side-by-side heroes: "Total Charged 391 kWh" and "Total Spent $115". Below are daily blue bars (one amber bar marks an outlier or highlight) and a 2×2 icon grid of share by location: 99% Home, 0% Supercharger, 0% Work, 1% Other, each with its own colour icon. Why it reads well: energy and money appear as twin heroes with the same type size, and the location split uses labelled icons, not a pie. Energy use: monthly summary pairing kWh used with $ cost, plus a breakdown by source (solar / battery / grid). — [Tesla Charge Stats month](https://mobbin.com/screens/71b09873-9a5b-4a0a-83a8-b50e82c53264?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Charge History list*. A month pager ("< January 2026"), then rows of timestamp + duration with kWh right-aligned, plus a download/export icon. Why it reads well: the right-aligned numbers are easy to scan, and the secondary duration line is grey. Energy use: an interval or event log (battery dispatch events, export sessions), with a CSV export for power users. — [Tesla Charge History](https://mobbin.com/screens/2df18314-58fa-427d-8629-f6b3dba3cdcd?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**Savings / cost**
- *Petrol Savings + Cost*. The hero "$119 Saved", labelled "Estimated Values" with an (i), sits beside a vertical two-column "stack meter": green "$115 Total Spent" next to grey "$234 Petrol Equivalent". Below, "Cost" has a "Per kWh" toggle and horizontal bars per location (Home $0.30). Why it reads well: the savings figure comes from a visible comparison, and the "Estimated" label states the uncertainty up front. Energy use: "Solar saved you $X vs. a grid-only bill", shown as actual cost against a counterfactual. — [Tesla Petrol Savings & Cost](https://mobbin.com/screens/f332f73c-408f-46ec-9201-de21fdd6cfb2?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Time-of-Use at Home*. Each TOU period (Off-Peak 24%, Mid-Peak 61%, Peak 15%) gets a horizontal progress bar with the percentage right-aligned, and a "%" toggle switches units. A footnote explains currency localisation. Energy use: the share of consumption or charging in each TOU window, a direct "load-shifting score". — [Tesla TOU at Home](https://mobbin.com/screens/15908683-d7a2-4e5f-bc7d-f4675ecafeda?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**Time-of-use rate timeline**
- *Rate plan Summary (schedule)*. A plan name ("Synergy Smart Home Plan") and season, then a **24-hour horizontal bar segmented by colour** (green Off-Peak, yellow Mid-Peak, red Peak) for weekday and for weekend. Under each bar is a legend list with time ranges ("Peak 3:00 PM – 9:00 PM"). Why it reads well: a full day fits in one glance, and traffic-light colours map to price intuitively. Energy use: TOU timeline, with a "now" marker that could be added. — [Tesla TOU schedule](https://mobbin.com/screens/115aa3aa-0efa-413f-869c-2fd19eda6d2f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Rate plan Summary (pricing)*. Each period shows a coloured dot, "Buy Price $0.15 / kWh" on the left and "Sell Price $0.03 / kWh" on the right (Peak buy $0.56, sell $0.10). Why it reads well: import and export rates sit side by side with explicit "/ kWh" units, which makes the buy/sell asymmetry obvious. Energy use: an explainer for why export credits are worth less than import costs. — [Tesla TOU buy/sell pricing](https://mobbin.com/screens/f40214c4-e79e-4b55-9440-551fb622620c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**Charging / battery state**
- *Vehicle charging card*. "61%" with a green battery glyph and a lightning icon, "2h 15m remaining to charge limit", a green fill slider with a white limit knob ("Charge limit: 80%"), and a telemetry line "4 kW · +0 kWh · 19/32A · 242V". Why it reads well: state (61%), target (80%) and time-to-target are shown together. Anti-pattern noted: the telemetry line packs kW, kWh, A and V into one grey string, which is dense for non-experts. Energy use: battery SoC with a target or reserve marker, and an EV charge session. — [Tesla charging card](https://mobbin.com/screens/c0a37ffb-23c3-44d7-a3e8-fd50735582e0?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp); scrolled with schedule text ("Charging will start at 11:00 PM…"). — [Tesla charging controls](https://mobbin.com/screens/64059d3f-9316-4844-bc80-9607fed6a85d?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *My Home Info*. A blueprint-style line drawing of a house with solar panels, a map, a product card (Wall Connector Gen 3, 32 A), and "Grid Connection: Import Limit None / Export Limit None". Energy use: a site configuration page showing export limits. — [Tesla My Home Info](https://mobbin.com/screens/8e7be3d5-bb57-4aa1-ba1d-b3ee374f1c18?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Add an energy product* flow (Powerwall 3 / Powerwall+ / Powerwall 2 / Solar Inverter picker with product photos). — [Tesla add energy product flow](https://mobbin.com/flows/a943d486-1ae5-4bbe-b4c8-4f83b193194c?tab=screens&utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

### Inferences
- Tesla's readability comes from restraint: about three type sizes per screen, units always smaller and grey, one accent colour per series, and most labels inline rather than in legends.
- Tesla consistently uses kW for live values on the house render and kWh for totals in history. That separation is worth copying exactly.
- "Estimated Values" plus an (i) on savings is a good model for honest counterfactual savings.

### Gaps
- No Mobbin screens for Powerwall Backup Reserve, the live animated flow at full size, Storm Watch, Impact/Self-Powered %, solar Energy history (stacked solar/home/grid/Powerwall), or Tesla's solar savings. Mobbin's Tesla account has no Powerwall, so these need non-Mobbin sources (Tesla support docs or press screenshots), which were not gathered here.

---

## 2. Other energy apps and adjacent domains on Mobbin

### Takeaway
Among energy-specific apps, **Octopus Energy** (UK utility) and **Rivian** (EV energy) are well represented and strong. The rest of the best metric patterns come from fitness (Apple Fitness, WHOOP, Garmin), finance (Copilot, Monarch, YNAB, Origin, Mercury) and carbon/impact apps (Uber, Commons, LARQ). Enphase, SolarEdge, Sense, Span, Ohme and Ovo did not appear in generic home-energy searches, and Apple Weather did not surface either.

### Cited Findings
**Octopus Energy (utility)**
- *Usage, Day*. A Day/Week/Month/Year tab row, a date pager, the hero "£1.02 ESTIMATED COST" with a (?) help chip, a **kWh / £ unit toggle**, half-hourly pink bars from 12am to 11pm with an evening peak, and a "TARIFF Octopus 16M Fixed" card linked beneath. Electricity and gas get separate cards with distinct icons. Why it reads well: the cost hero is labelled "estimated", the unit toggle sits right on the chart, and the tariff context is one tap away. Energy use: daily interval usage and cost. — [Octopus day usage](https://mobbin.com/screens/f74e0586-934f-43cf-a048-392c868b5893?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Usage, Week* (£2.56 estimated cost, Mon–Sun bars, future days left blank). — [Octopus week usage](https://mobbin.com/screens/8cf9882b-c968-4526-8452-f79834c10edf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp); custom range with a date + granularity dropdown (£5.31). — [Octopus custom range](https://mobbin.com/screens/0e9bb866-2bf6-4e52-aad9-c2d79381fb85?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Tariff detail*. "Prices depend on time of day", a Day 28.30p / Night 11.77p table with a "Price per kWh" header, a "62.48p/day STANDING CHARGE" hero with the unit as a superscript suffix, an end date, and "(All rates inc. VAT)". Energy use: rate-plan explainer that includes fixed charges. — [Octopus tariff detail](https://mobbin.com/screens/f95ffb41-c106-4db6-b0a5-012d235211f7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Empty/loading states*. A skeleton with a spinning wind-turbine loader. — [Octopus loading](https://mobbin.com/screens/3523ab46-acdb-428b-95d5-af04a2779d1a?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). "Your readings are on the way" illustration explaining the meter-data delay, with a "Get help" button. — [Octopus readings pending](https://mobbin.com/screens/ab624551-b366-4daf-b86c-6a25718dbd6e?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp). Gas week with "0.00 kWh USED" and an empty axis. — [Octopus zero state](https://mobbin.com/screens/d972bef4-2e25-4352-acae-6f8aa8563662?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**Rivian (EV energy)**
- *Energy usage donut*. "Usage • Last 24 hours", "Synced at 19:26", a segmented donut (dark amber = car/system, light amber = climate) with the total "0.9 kWh" in the centre, and a 2×2 icon grid below (System 0.7 kWh, Climate 0.2, Outlets 0.0, Gear Guard 0.0). Pagination dots switch between periods. Why it reads well: the total is in the middle, the parts are labelled with icons and values, and the sync timestamp signals how fresh the data is. — [Rivian usage donut](https://mobbin.com/screens/4df8142b-b9da-44bf-8ad1-e3571ef960ed?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *"What's using energy?" bottom sheet*. An icon plus a one-line plain-English definition for each category. This is progressive disclosure from the (i). Energy use: explaining load categories or what "self-consumption" means. — [Rivian what's using energy](https://mobbin.com/screens/127737cd-a602-421d-b682-d1e29bda72dc?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Charge limit with presets*. A thick green fill bar with a draggable knob at "70%", an "All-Purpose · 220 miles" label, and preset chips (20 / 70 / 85 / 100%). Energy use: setting the battery backup reserve with presets. — [Rivian charge limit](https://mobbin.com/screens/eda6f071-b522-468c-9928-80fb83986bc1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Charging in progress*. A bar at 67% with a hatched remainder up to a "70%" limit tick, plus "Speed 14 mi/hr" and "Time left 48 min" in two columns, above a giant "213 mi". Why it reads well: the hatched area shows the gap still to fill and the tick marks the target. Energy use: Powerwall charging toward full or toward reserve. — [Rivian charging progress](https://mobbin.com/screens/fdd5e60c-a1d2-4525-94ce-8b4bffe986a8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp); scheduled state ("187 miles", 59% bar, "00:00 to 08:00 Charging schedule", "Charge now"). — [Rivian scheduled charge](https://mobbin.com/screens/2379e167-7039-4ee6-9d87-a073d852d709?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Session overview receipt*. A large date title, "74 kWh added in 54 min / 162 miles", "$46.46 total", and an expandable Price section. Energy use: a per-session or per-day receipt. — [Rivian session overview](https://mobbin.com/screens/f48785fb-09dc-4687-94ad-ed42d3b5c2a8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**Other device or energy-adjacent**
- *Starlink Power draw*. Twin heroes "37 W Average | 37 W Current" split by a divider, a minimal sparkline area chart with a 0–50 W axis, and a "What is power draw?" explainer card. Energy use: live home load in kW with average vs now. — [Starlink power draw](https://mobbin.com/screens/6bef1263-c4dd-45ce-b6c4-0fbc73d36ab1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Polestar Charge*. A full-width orange fill block showing "33% / 65 mi" in huge type, "Not plugged in / Ready to use", and −/+ steppers for the 90% limit and 48 A. — [Polestar charge](https://mobbin.com/screens/3eaedacd-0029-4cb2-a49f-2d82bb7a6117?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *MyDyson indoor air quality*. A line chart with a **colour-banded y-axis scale** (green→red) and a labelled "Air quality target" line, plus a plain-language paragraph explaining the 15-minute averaging and data gaps. Energy use: grid carbon intensity or price bands, plus an honest explanation of data gaps. — [MyDyson air quality](https://mobbin.com/screens/f28828b0-3e78-4bff-9daf-a61ae42d25fb?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- *Garmin Body Battery*. A 1d/7d/4w switch, a 0–100 "battery" area line overlaid on stress/rest bars, an event-icon timeline, a legend, and a "Factors" list with signed deltas (Sleep +65 ↑, Run −4 ↓). Energy use: a battery SoC curve over the day with charge/discharge "factors" (solar charged +40%, evening peak −30%). — [Garmin Body Battery](https://mobbin.com/screens/920a4278-e04a-42eb-a7d1-b6e7f32be3e1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

### Inferences
- Octopus is the closest Mobbin analog to a utility-bill-aware solar dashboard. Its kWh/£ toggle and "estimated cost" labelling are directly reusable.
- Rivian is the best Mobbin source for battery-with-target and explainer-sheet patterns.

### Gaps
- Searches for generic "home energy / solar production" returned no Enphase, SolarEdge, Sense, Span, Ohme, Ovo or Google/SmartThings energy screens. Name-specific searches for each were not run, so they may exist on Mobbin but did not surface. Apple Weather did not surface for an "Apple Weather hourly / UV" query.

---

## 3. Catalog by component pattern (best entries per pattern)

### Takeaway
Every requested pattern has at least one strong Mobbin reference except a battery gauge with an explicit *reserve* line. Rivian's limit tick and Tesla's limit knob are the closest, and Garmin's step-goal dashed line shows how to draw a threshold line.

### Cited Findings
**A. Single hero number with context**
- Tesla Charge Stats twin heroes (kWh + $). — [link](https://mobbin.com/screens/71b09873-9a5b-4a0a-83a8-b50e82c53264?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Garmin Steps: a ring with "9,099" over the goal "7,890", "115% of Goal", a check mark, and a cumulative line crossing a dashed goal line. Energy use: daily solar production vs expected, or self-powered % vs target. — [Garmin steps](https://mobbin.com/screens/6bb49866-7232-4604-b0c6-c2a1fb49e058?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Fitbit Zone Minutes: "0 of 22 Zone Min" with the sentence "You're 22 Zone Minutes away from hitting your daily goal". Energy use: a hero number plus a natural-language gap statement. — [Fitbit zone min](https://mobbin.com/screens/b54bfe83-5c24-4750-880a-4c15ef965312?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Copilot Investments: "↗ 0.03%" above "$37,396 total balance", a line ending in a highlighted dot, and 1W/1M/3M/YTD/1Y chips. — [Copilot investments](https://mobbin.com/screens/ff5cb687-e8be-493b-b87d-07dd6016d7fe?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**B. Comparison vs previous period**
- Copilot category: "Spent $1,546.06 · $304 over" with a red dot, 12 monthly bars with a horizontal budget line labelled "$1,242", and over-budget months coloured red/orange against green. Energy use: monthly grid import vs a target or last year. — [Copilot household](https://mobbin.com/screens/278401e5-13b2-4778-8fb4-cfeccbf12357?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- CRED: "TOTAL IN MAR '24 ₹1,097.47" with a green "↓ ₹5,196.84 from last month" right beside it, plus a muted 12-month total and bars. — [CRED spends](https://mobbin.com/screens/7f33e880-f2cb-450b-a1bd-90def15a9e64?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Revolut Spent: "$36" with "$8.94 avg. per month" as a dotted average line labelled on the y-axis, and 1W/1M/6M/1Y chips. — [Revolut spent](https://mobbin.com/screens/69913e7a-7c90-4051-9fe1-84f2f55920d9?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Splitwise: a two-month stacked comparison (Oct vs Nov) whose colours match the dot markers on "$485 total / $275 your share – 56%". — [Splitwise comparison](https://mobbin.com/screens/f77b2738-8716-4219-932f-3e9080cbbd2c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**C. Stacked source breakdown**
- YNAB Spending Breakdown: a single 100% stacked bar under the total, then a category list where each row has its own colour mini-bar and %. Energy use: a "where your home's energy came from" bar (solar / battery / grid). — [YNAB breakdown](https://mobbin.com/screens/f9387a42-18ab-4c36-a7f5-425845680ff8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Snowflake Cost Management (web): daily stacked bars with a coloured legend, plus a table with inline proportional bars ("credits used"). — [Snowflake consumption](https://mobbin.com/screens/8202bdab-d6dd-47b1-bee3-be85ef43ce53?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Rivian usage donut (see §2). — [link](https://mobbin.com/screens/4df8142b-b9da-44bf-8ad1-e3571ef960ed?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Wise Spending: a month bar strip, then a category list with icon, amount, colour bar and %. — [Wise spending](https://mobbin.com/screens/e48a261e-ef6f-475e-9769-23f742453fc1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**D. Flow / Sankey diagrams**
- Monarch Cash Flow (web): KPI cards (Total income / expenses / net / savings rate) above a Sankey from Paychecks and Interest → Income → categories → subcategories. Every node is labelled with $ and %, and each category has its own colour. Energy use: Solar + Grid + Battery → Home / Battery charge / Export / EV. — [Monarch Sankey](https://mobbin.com/screens/92c2b32c-20a0-4487-9b6c-3f32cb464893?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Origin Spending Sankey (web): a softer pastel version with labels at node ends and a "View by" switch. — [Origin Sankey](https://mobbin.com/screens/d74b56f7-a4f0-43c9-b708-6615de691c5c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Mercury Insights (web): a Money In/Out Sankey with a natural-language insights column on the left ("Higher spend to Amazon… up from…"). Energy use: a Sankey paired with auto-generated explanations. — [Mercury insights](https://mobbin.com/screens/10e9460a-1e44-4361-afe6-e0e9d857e6d9?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**E. Battery gauge with target / reserve line**
- Rivian charging progress, with a hatched gap up to the limit tick. — [link](https://mobbin.com/screens/fdd5e60c-a1d2-4525-94ce-8b4bffe986a8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Rivian charge-limit slider with preset chips. — [link](https://mobbin.com/screens/eda6f071-b522-468c-9928-80fb83986bc1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Tesla charge-limit knob plus time-to-limit. — [link](https://mobbin.com/screens/c0a37ffb-23c3-44d7-a3e8-fd50735582e0?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- WHOOP widgets: % rings (Sleep 61%, Recovery 47%, Strain 6.6), one colour per metric, the number centred with a small "%". Energy use: battery SoC, self-powered % and solar-vs-forecast as a set of three rings. — [WHOOP rings](https://mobbin.com/screens/eb710c39-dc18-4cd5-954d-d71b96c42519?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**F. Time-of-use rate timeline**
- Tesla 24h segmented TOU bar. — [link](https://mobbin.com/screens/115aa3aa-0efa-413f-869c-2fd19eda6d2f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Tesla buy/sell price per period. — [link](https://mobbin.com/screens/f40214c4-e79e-4b55-9440-551fb622620c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Octopus Day/Night rate table plus standing charge. — [link](https://mobbin.com/screens/f95ffb41-c106-4db6-b0a5-012d235211f7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**G. Period switchers (day / week / month / year)**
- Octopus: text tabs plus a date pager plus a calendar button. — [link](https://mobbin.com/screens/8cf9882b-c968-4526-8452-f79834c10edf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Fi Activity: Day/Week/Month/Year underline tabs, a "Today, Feb 22" pager with disabled forward arrow, the hero "699" steps with a "7% of goal" ring, and hourly bars where future hours are dashed or greyed. Energy use: future intervals greyed (the forecast is not yet actual). — [Fi activity](https://mobbin.com/screens/7ceb0103-5a3e-456b-86fd-dc767d55e4d0?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Tesla Month/Year segmented control. — [link](https://mobbin.com/screens/71b09873-9a5b-4a0a-83a8-b50e82c53264?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**H. Credit vs cost / in vs out**
- Ubank In & Out: paired bars per month (cyan Money in, blue Money out), with signed totals "+$532.90 / −$129.14" in a colour-keyed list. Energy use: export credit vs import cost per month, with net. — [Ubank in & out](https://mobbin.com/screens/beea14a3-2aea-452f-b31c-d108331d7add?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Origin Breakdown: Income / Expenses / Net Cash Flow rows with colour dots above a donut. — [Origin breakdown](https://mobbin.com/screens/ffff5f8c-16be-423b-9387-193ed251fb63?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Tesla Petrol Savings (actual vs counterfactual). — [link](https://mobbin.com/screens/f332f73c-408f-46ec-9201-de21fdd6cfb2?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**I. Carbon equivalents**
- Uber "Estimated CO₂ saved": a pill-shaped hero "0 g", then "10 kg CO₂ is equal to…" with illustrated rows: 1.1 gal of gas, 28.4 mi driven, 7.7 lb waste recycled, 518.6 ft² of forest for one year. Why it reads well: it uses everyday units, one per row, each with an illustration. — [Uber CO₂ equivalents](https://mobbin.com/screens/f06bd89a-24cf-461d-a85b-6c94a32f0b11?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Commons Emissions: a "198 KG" hero with "$383 SPENT" context, monthly bars with the selected month highlighted, and "Emissions by category". — [Commons emissions](https://mobbin.com/screens/f138d64c-36f7-4fe6-9c7c-c0ee4db5dd64?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- LARQ "Your impact": three small cards (Reduced carbon footprint 3.7 lbs, Reduced plastic 0.8 lbs, Saved $31). — [LARQ impact](https://mobbin.com/screens/4c825c69-f6e7-48cc-9f54-e40784443255?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- bunq Green (empty state): an isometric forest illustration with "No Trees In Your Forest Yet", and "This Month / Total / Total Offset 0 g CO2" stats. — [bunq green](https://mobbin.com/screens/147b11c7-3820-482f-929d-9a5c372049a1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)
- Too Good To Go "CO2e avoided" empty state ("Looking a bit empty here?"), with a persistent "Total avoided: 0 lb" footer. — [TGTG CO2e](https://mobbin.com/screens/3ae2d046-5463-4d83-a39f-2c74bf4fbfea?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

**J. Usage dashboards on web (desktop layout reference)**
- OpenAI Platform Usage (web): a "Total Spend $1.97" hero bar chart with a dashed budget line, a range brush under the chart, and a right rail with a "March budget $0.13 / $10" progress bar plus sparklines. Energy use: a desktop layout with the main period chart in the centre and KPI sparklines in the right rail. — [OpenAI usage](https://mobbin.com/screens/2bf4f941-a9a7-4308-aa0c-864135823830?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)

### Inferences
- A strong home-energy screen could combine: Tesla twin hero (kWh + $) → YNAB-style 100% source bar → Octopus period tabs + kWh/$ toggle → Monarch Sankey on desktop → Uber-style carbon equivalents → Tesla TOU bar with a "now" marker.
- For the battery reserve, combine Rivian's hatched-gap bar with a labelled reserve tick, as in Garmin's dashed goal line.

### Gaps
- No Mobbin example shows an explicit battery *backup reserve* line under the current SoC (as opposed to a charge-limit ceiling).
- No Mobbin example shows a live animated energy-flow diagram at full size (Tesla's is only a teaser thumbnail).

---

## 4. Readability techniques and anti-patterns

### Takeaway
The readable screens share six techniques: units smaller and grey next to big numerals; one stable colour per source or series; direct labels instead of legends; explicit time scope and freshness ("Last 31 Days", "Synced at 19:26"); "estimated" qualifiers on money; and designed empty states. Anti-patterns seen: mixed units in one telemetry line, colour-only legends, dense multi-metric overlays, and savings framed as cash.

### Cited Findings
- **Unit placement.** Hero numerals with a smaller trailing unit: Tesla "155.0 kWh" ([link](https://mobbin.com/screens/1f99eb66-657e-478a-a519-36cd212b963f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)), Octopus "62.48p/day" with a superscript unit ([link](https://mobbin.com/screens/f95ffb41-c106-4db6-b0a5-012d235211f7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)), Starlink "37 W" ([link](https://mobbin.com/screens/6bef1263-c4dd-45ce-b6c4-0fbc73d36ab1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)).
- **Unit toggles.** Octopus kWh/£ chip on each chart ([link](https://mobbin.com/screens/f74e0586-934f-43cf-a048-392c868b5893?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)); Tesla "Per kWh" and "%" toggles ([link](https://mobbin.com/screens/f332f73c-408f-46ec-9201-de21fdd6cfb2?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)).
- **Freshness and scope labels.** Rivian "Synced at 19:26", "Since parked" ([link](https://mobbin.com/screens/441e925c-8aa0-4e4c-8e41-39100ffa194e?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)); Tesla "Last 31 Days".
- **Progressive disclosure.** Rivian (i) → definitions sheet ([link](https://mobbin.com/screens/127737cd-a602-421d-b682-d1e29bda72dc?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)); Starlink "What is power draw?" card; Octopus (?) next to "Estimated cost".
- **Honest estimates.** Tesla "Estimated Values" on savings; Octopus "ESTIMATED COST"; Uber "Estimated CO₂ saved".
- **Empty, loading and edge states.** Octopus skeleton + turbine loader, "readings on the way", and a zero-kWh week ([links in §2](https://mobbin.com/screens/ab624551-b366-4daf-b86c-6a25718dbd6e?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)); bunq and TGTG zero-carbon states; MyDyson text explaining data gaps ([link](https://mobbin.com/screens/f28828b0-3e78-4bff-9daf-a61ae42d25fb?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)).
- **Anti-pattern: mixed units in one string.** Tesla's "4 kW · +0 kWh · 19/32A · 242V" puts power, energy, current and voltage in one grey line ([link](https://mobbin.com/screens/c0a37ffb-23c3-44d7-a3e8-fd50735582e0?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)).
- **Anti-pattern: legend-dependent dense overlay.** Garmin Body Battery overlays a line, two bar series and icons, and needs a 6-item legend to decode ([link](https://mobbin.com/screens/920a4278-e04a-42eb-a7d1-b6e7f32be3e1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)).
- **Anti-pattern: tiny numbers / weak axis.** Octopus day chart y-axis labels read "0.1 / 0.1 / £" (repeated rounded ticks) ([link](https://mobbin.com/screens/f74e0586-934f-43cf-a048-392c868b5893?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)).
- **Anti-pattern: sparse year chart.** A Tesla year view with one month of data shows a single bar against 11 blanks, with no "data starts Jan" note ([link](https://mobbin.com/screens/1f99eb66-657e-478a-a519-36cd212b963f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp)).

### Inferences
- Credits vs cash: Tesla's "$119 Saved" and Uber's "CO₂ saved" both use the word "saved" for counterfactual values. In a solar context, bill credits are not cash, so use "credit applied to bill" or "avoided cost (estimated)" rather than "earned" or "saved $". This is a design inference; no Mobbin screen shows a net-metering credit explainer.
- Always pair kW (instantaneous) with live/now contexts and kWh with period totals. Never put both in one sentence without labels, which is the Tesla telemetry anti-pattern.
- Assign one fixed colour per source (solar, battery, grid import, grid export, EV) and reuse it on every chart. Tesla, Copilot and Monarch all keep colour consistent within a screen.

### Gaps
- No Mobbin screen explaining net-metering / NEM credits, export credits rolling over, or "true-up". This needs another source.
- No usability data (test results) behind any of these screens; readability judgments here are heuristic, made from the screenshots.
