# App Metric Benchmark: how leading home energy apps define, present, and explain key metrics

Research date: 2026-11-08. Method: web search and fetch of first-party documentation where reachable. **Major access caveat:** every tesla.com/support page returned HTTP 403 to the fetch tool (tried 5 URLs, including a localized en_IE page), and the Enphase support article (support.enphase.com, a Salesforce site) did not render. Tesla and Enphase findings below therefore rest on search-engine snippets of the first-party pages (the URLs are cited) plus a few third-party installer guides, which are labeled as such. Treat exact wording for Tesla and Enphase as "per indexed snippet" and verify in-app before quoting it in UI copy.

## Q1. Benchmark table: metrics each app shows (names, definitions, units, time scales, location)

### Takeaway
The cross-app standard is a four-node flow (Solar, Home, Battery, Grid) shown live in kW. Next to it sit historical kWh charts with Day/Week/Month/Year/Lifetime tabs, and at most one or two "headline ratio" metrics. Tesla's ratios are Self-Powered % and Solar Offset %. Home Assistant uses Self-sufficiency, Solar consumed and Grid neutrality. SolarEdge uses Self-consumption. Enphase uses Net energy. Wording for the same ratio differs from app to app, and so does the denominator.

### Benchmark table (only claims with sources; blank = not found)

| App | Live flow / power | Historical energy | Headline ratio(s) | Battery / backup | Savings / cost | Carbon / equivalents | EV |
|---|---|---|---|---|---|---|---|
| **Tesla app** | Live energy flow among solar, Powerwall, home and grid (third-party guides: [gridtitans](https://gridtitans.com/blogs/news/how-the-tesla-app-works), [etwenergy](https://etwenergy.com/blog/tesla-app-powerwall-solar-guide/)) | Historical energy data, outage history (third-party, [search summary of guides](https://lenergy.com.au/how-to-use-the-tesla-app-to-monitor-your-powerwall/)) | **Self-Powered %** and **Solar Offset %**, both on the "Impact" tab ([Tesla Impact Cards](https://tesla.com/support/energy/powerwall/mobile-app/impact-cards); [Tesla Self-Powered](https://www.tesla.com/support/energy/powerwall/mobile-app/self-powered)) | **Backup Reserve %**, default 20% ([Tesla Advanced Settings](https://www.tesla.com/support/energy/powerwall/mobile-app/advanced-settings) via third-party guide); **Storm Watch** alert ([Tesla alerts](https://tesla.com/support/energy/powerwall/own/system-alerts-notifications)) | **Solar Value** page exists ([Tesla Solar Value](https://www.tesla.com/support/energy/solar-panels/mobile-app/solar-value)); content not retrievable | not found | not verified (see Gaps) |
| **Enphase App** | Real-time production / consumption / battery ([Enphase utility bill page](https://enphase.com/learn/home-energy/explore-your-system/utility-bill-and-enphase-app)) | Energy page: **Produced, Consumed, Imported/Exported, Net Exported**; Day/Week/Month/Year/Lifetime (third-party guide [etwenergy](https://etwenergy.com/blog/enphase-app-monitoring-guide/)) | **Net energy** (daily; positive when exports > imports; needs consumption metering) ([Enphase: What is net energy?](https://support.enphase.com/s/article/What-is-net-energy)) | Profiles: **Self-Consumption**, **Savings** ("AI Optimization" in CA) ([Enphase system profile article](https://support.enphase.com/s/article/which-system-profile-should-i-choose-for-my-enphase-energy-system)) | Savings mode; no published calc method found | Optional environmental widget: CO2 avoided, tree equivalents ([etwenergy](https://etwenergy.com/blog/enphase-app-monitoring-guide/), third-party) | — |
| **mySolarEdge** | Dashboard: production, consumption, self-consumption, import/export ([SolarEdge support](https://solaredge.com/en/support/system-owner/track-energy-production-and-consumption)) | Same dashboard; time scales not stated on page | **Self-consumption** (shown as % per [energyscout guide](https://www.energyscout.io/support/solaredge-monitoring-app-guide/), third-party) | — | — | **Environmental Benefits**: CO2 and **trees planted**; v3.4 changelog "trees planted returned... for non-EV users" ([apppage listing](https://apppage.net/preview/com.solaredge.homeowner), mirror of store) | Changelog implies an EV-user variant of Environmental Benefits (same source) |
| **SPAN Home App** | Usage by grid, battery, solar; per-circuit power ([SPAN: Navigating the app](https://support.span.io/hc/en-us/articles/4411214235159-Navigating-the-SPAN-Home-App)) | Circuit-level history | — | Circuits tagged **Must Have / Nice to Have / Non-essential**; Nice to Have shed at 50% battery; battery view with time from full to empty based on priorities ([SPAN outage article](https://support.span.io/hc/en-us/articles/20362478944023-What-to-expect-during-an-outage)) | — | — | SPAN Drive (not researched) |
| **Sense** | **Now** screen: "a real-time tally of every watt"; **Power Meter**; device **bubbles** sized by power; **Always On** bubble for phantom loads ([Sense: Understanding the app](https://sense.com/consumer-blog/understanding-the-sense-app/)) | **Usage** in kWh or $; Day/Week/Month/Year/**Billing cycle**; tap a day for hourly ([same](https://sense.com/consumer-blog/understanding-the-sense-app/)) | — | — | $ requires user-entered electricity cost ([same](https://sense.com/consumer-blog/understanding-the-sense-app/)) | — | — |
| **Home Assistant Energy** | **Power Sankey** (real time), **power-total badge** combining grid + solar + battery ([HA energy cards](https://www.home-assistant.io/dashboards/energy/)) | Energy usage graph, solar graph (+forecast), **Energy distribution** flow, **energy Sankey**, devices graph + pie, sources table ([same](https://www.home-assistant.io/dashboards/energy/)) | **Self-sufficiency**, **Solar consumed**, **Grid neutrality** gauges; **Grid energy balance** (import − export) ([same](https://www.home-assistant.io/dashboards/energy/)) | Battery as a source in all cards | **Cost and compensation** per source in the sources table ([same](https://www.home-assistant.io/dashboards/energy/)) | **Carbon consumed** gauge: % of consumption from non-fossil sources (solar, wind, nuclear) ([same](https://www.home-assistant.io/dashboards/energy/)) | Via devices |
| **FranklinWH** | Real-time energy flow; charts of real-time and historic loads ([FranklinWH features](https://www.franklinwh.com/support/articles/detail/what-features-does-the-franklinwh-app-provide)) | Energy Data page incl. **Backup History** (when and how long) ([FranklinWH Energy Data](https://www.franklinwh.com/support/overview/energy-data)) | — | Predicted **available backup time** from SoC and consumption ([features](https://www.franklinwh.com/support/articles/detail/what-features-does-the-franklinwh-app-provide)); manual's **Backup Remaining** assumes no grid, generator or solar input ([manual v1.2.6, Jan 2023](https://e-uploads.franklinwh.com/website/news/4f5a997697fa608b31aaa9b0151a3295.pdf)) | — | — | — |
| **Sunrun app** | kW generated live, kWh exported (third-party listing [appbrain](https://www.appbrain.com/app/sunrun/com.sunrun.customerapp)) | Daily / weekly / monthly / yearly breakdown ([ConsumerAffairs review](https://www.consumeraffairs.com/solar-energy/sunrun.html), anecdotal) | — | — | "Estimated savings accrued today"; bill history ([appbrain](https://www.appbrain.com/app/sunrun/com.sunrun.customerapp)) | "Environmental impact" (same) | — |
| **mySunPower → SunStrong Connect** | Solar production, home consumption, battery flows ([Google Play](https://play.google.com/store/apps/details?id=com.mysunpower&hl=en_US)) | — | — | SunVault controls and status (same) | — | — | — |
| **Octopus Energy (UK)** | — | Half-hourly / daily / monthly consumption ([Octopus Compare listing](https://play.google.com/store/apps/details?id=com.m4consulting.octopus_comparison&hl=en_GB)); depends on meter read frequency ([Octopus blog](https://octopus.energy/blog/track-my-energy-use/)) | — | — | Export CSV includes unit rates and costs (same listing) | Carbon intensity in export (same); Agile cheaper when grid greener ([Octopus Agile blog](https://octopus.energy/blog/agile-smart-grid/)) | Intelligent Go needs half-hourly data ([switchtooctopus review](https://switchtooctopus.co.uk/review/)) |
| **Ohme** | not found | | | | | | |

### Cited Findings (detail)
- Tesla **Self-Powered** card: "measures self-sufficiency, or how effectively solar and Powerwall power your home without the need to use energy from the grid"; 100% means the home is fully powered by solar/stored solar rather than the grid. — [Tesla Self-Powered](https://www.tesla.com/support/energy/powerwall/mobile-app/self-powered); [Tesla Impact Cards](https://tesla.com/support/energy/powerwall/mobile-app/impact-cards) (via search snippet)
- Tesla **Solar Offset** card "contrasts your system's solar generation against your home's energy usage". It can exceed 100%, which typically happens in summer. A low value suggests more solar may be needed. — [Tesla Impact Cards](https://tesla.com/support/energy/powerwall/mobile-app/impact-cards) (via snippet)
- Both cards sit on the **Impact** tab, opened from the app home screen. — [Tesla Impact Cards](https://www.tesla.com/en_th/support/energy/powerwall/mobile-app/impact-cards)
- "Self-Powered" is also a Powerwall **operating mode** name, which can be confused with the metric. — [Tesla Self-Powered](https://www.tesla.com/support/energy/powerwall/mobile-app/self-powered); modes page [Tesla Powerwall modes](https://www.tesla.com/support/energy/powerwall/mobile-app/powerwall-modes)
- User observation (anecdotal): the Self-Powered % drops when solar is exported and grid power is imported later, i.e. it is not a net-energy measure. — [TMC thread](https://teslamotorsclub.com/tmc/threads/solar-offset-vs-energy-offset.206118/)
- Tesla grid-charging setting "No" means Powerwall charges only from solar. Powerwall may still grid-charge when its energy is low, during Storm Watch or during VPP events. — [Tesla Advanced Settings](https://www.tesla.com/support/energy/powerwall/mobile-app/advanced-settings) (via snippet)
- Storm Watch alert: Powerwall "is prioritizing charging to maximize your backup protection" until the storm ends. — [Tesla system alerts](https://tesla.com/support/energy/powerwall/own/system-alerts-notifications). Third-party: it temporarily raises reserve to 100% ([sunconnectsolar](https://www.sunconnectsolar.com.au/help/tesla-powerwall-owner-guide)). Some guides say it needs grid charging enabled ([sesre](https://www.sesre.com/resource/prepare-for-storms-tesla-powerwall/)).
- Enphase **Net energy**: a daily measurement available for any day in the system lifetime. It is positive when exports exceed imports and needs consumption metering. — [Enphase support](https://support.enphase.com/s/article/What-is-net-energy) (via snippet)
- Enphase "Net Exported" is described as the difference between total produced and the amount used onsite. — search snippet attributed to [Enphase monitor article](https://support.enphase.com/s/article/how-to-monitor-energy-data-in-the-enphase-app) (page did not render for verification)
- SolarEdge color code: production **green**, consumption **red**, self-consumption **blue**. A consumption meter is required; without one, only production shows. — [SolarEdge support](https://solaredge.com/en/support/system-owner/track-energy-production-and-consumption)
- Home Assistant **Self-sufficiency** gauge: "If you rely on grid imports, this value decreases"; more solar or battery raises it. — [HA energy cards](https://www.home-assistant.io/dashboards/energy/). Community formula: 1 − grid consumption / total consumption ([HA community](https://community.home-assistant.io/t/add-energy-self-sufficiency-level-to-energy-dashboard-solar-consumption-vs-total-consumption/467465)). Note: another forum reply describes it differently, which conflicts with the docs.
- HA **Grid neutrality** gauge colors: purple = returned more than consumed, blue = net grid consumption. An older doc version used green/red. — [HA energy cards](https://www.home-assistant.io/dashboards/energy/); older: [docs mirror](https://git.sebastienjean.net/jeans/home-assistant.io/raw/commit/49667ed6c404cd57fae7398a2a4e9751888b901b/source/_lovelace/energy.markdown)
- HA **Grid energy balance** card: shows import − export as an equation. Positive = net import. A bar fills from the center toward the dominant direction. — [HA energy cards](https://www.home-assistant.io/dashboards/energy/)
- HA naming history: the community pushed back on "self dependency" wording in favor of "self-sufficiency". — [HA community thread](https://community.home-assistant.io/t/energy-management-self-sufficiency-instead-of-self-dependency/336195)
- Sense colors: Dashboard total usage green; in single-device view the device is green, total grey. — [Sense app overview](https://sense.com/consumer-blog/understanding-the-sense-app/). The Power Meter blog describes a dark orange total-use line and a yellow solar line ([Sense Power Meter blog](https://sense.com/consumer-blog/real-time-energy-use-power-meter/)), so palettes differ by screen or version.
- Sense "Always On" averaging window: one Sense post says 48 h, another says 24 h. Unresolved conflict. — [Sense blog](https://sense.com/consumer-blog/understanding-the-sense-app/); [Sense blog](https://sense.com/consumer-blog/which-sense-home-app-features-are-you-using/)
- SPAN: without a compatible battery the panel has no backup capability. Battery backup time varies with consumption, priorities and battery. — [SPAN outage article](https://support.span.io/hc/en-us/articles/20362478944023-What-to-expect-during-an-outage)
- mySunPower renamed **SunStrong Connect**. — [Google Play](https://play.google.com/store/apps/details?id=com.mysunpower&hl=en_US)

### Inferences
- "Self-powered", "self-sufficiency" and "energy independence" all mean the share of home consumption *not* served by the grid (Tesla, HA). "Self-consumption" (SolarEdge, HA "solar consumed") means the share of *solar* used onsite. These are different denominators, and apps rarely say so on screen. A product should pick one, name it plainly, and show the formula on tap.
- Tesla's Solar Offset (production ÷ consumption, can exceed 100%) is a sizing / NEM-style metric. Self-Powered is a timing metric. Showing both lets a user see "I make enough, but not at the right time."
- Remaining-runtime metrics (FranklinWH Backup Remaining, SPAN full-to-empty) are conditional estimates on current load. FranklinWH states its assumptions (no solar or grid), which is a good transparency pattern.

### Gaps
- Exact Tesla Energy Data chart definitions, colors, time tabs, Solar Value methodology, and "Charge on Solar" (an EV feature) could not be verified because tesla.com returned 403. No first-party Tesla page using "Charge on Solar" surfaced in search.
- Enphase's savings and CO2 methodology (emission factor, tree conversion) was not found.
- Ohme app metrics: no sources found. Octopus's own app (not Compare) screen-level definitions were not found.
- Sunrun: no first-party feature documentation found. Only store listings and reviews were available.

## Q2. How apps explain savings/credits and carbon equivalents

### Takeaway
Little first-party methodology is published. Savings are either user-configured (Sense, HA: you enter rates) or computed from the utility rate plan (Tesla Solar Value, Enphase Savings mode). Carbon is shown as CO2 avoided plus "trees" equivalents (SolarEdge, Enphase), or as % low-carbon consumption (HA). No app's emission factor or tree-conversion constant was found.

### Cited Findings
- Sense shows $ only after the user sets an electricity cost. — [Sense](https://sense.com/consumer-blog/understanding-the-sense-app/)
- HA sources table adds **cost and compensation** (export credit) per source and in total, if configured. — [HA](https://www.home-assistant.io/dashboards/energy/)
- Enphase recommends reading the utility bill next to the app: the bill shows grid draw and export, the app shows production, consumption and battery. — [Enphase](https://enphase.com/learn/home-energy/explore-your-system/utility-bill-and-enphase-app)
- Enphase "Savings" profile maximizes bill savings by discharging during peak rates. — [Enphase](https://support.enphase.com/s/article/which-system-profile-should-i-choose-for-my-enphase-energy-system)
- Tesla has a dedicated **Solar Value** support page (content not retrievable). — [Tesla](https://www.tesla.com/support/energy/solar-panels/mobile-app/solar-value)
- SolarEdge Environmental Benefits: CO2 and trees planted, with an EV-specific variant implied by the changelog. — [apppage mirror](https://apppage.net/preview/com.solaredge.homeowner)
- HA carbon consumed counts own solar plus grid non-fossil share (solar, wind, nuclear) using a grid-carbon integration. A user reports it showing 0% despite a working sensor (anecdotal bug). — [HA](https://www.home-assistant.io/dashboards/energy/); [HA community](https://community.home-assistant.io/t/low-carbon-dashboard-doesn-t-work/1025263)
- Octopus ties price to carbon: Agile rates are cheaper when the grid is greener. Exports include carbon intensity per half-hour. — [Octopus](https://octopus.energy/blog/agile-smart-grid/); [Octopus Compare](https://play.google.com/store/apps/details?id=com.m4consulting.octopus_comparison&hl=en_GB)

### Inferences
- The only well-documented "savings" explanation pattern is the bill reconciliation framing (Enphase). A counterfactual "what you would have paid without solar/battery" is implied by Tesla Solar Value, but its method could not be confirmed.
- Tree equivalents are common but are a "feel-good" figure. A third-party guide calls them that rather than diagnostic ([energyscout](https://www.energyscout.io/support/solaredge-monitoring-app-guide/)).

### Gaps
- NEM bank / true-up explanations: no app documentation found in this pass (likely utility-side).
- Conversion constants (kg CO2 per kWh, kg per tree, miles) are not published in any source found.

## Q3. What reviews/forums praise or criticize about readability (anecdotal)

### Takeaway
The searches found little readability-specific review evidence. Most complaints are about data reliability and latency, not chart design. No source was found that explains *why* Tesla is considered readable.

### Cited Findings
- Enphase (Trustpilot, anecdotal): live status rarely loads; energy data updates only a couple of times a day; lost gateway control. — [Trustpilot](https://ca.trustpilot.com/review/enphase.com)
- SunStrong Connect (Google Play review, anecdotal): users lost access to historical data and had no export option. — [Google Play](https://play.google.com/store/apps/details?id=com.mysunpower&hl=en_US)
- Tesla (forum, anecdotal): gateway visible on network but no data reached the app. — [Mike Holt forum](https://forums.mikeholt.com/threads/tesla-pwrwall-gateway-shutdowns.142394/latest)
- Tesla Self-Powered % confuses users who export and then import (anecdotal). — [TMC](https://teslamotorsclub.com/tmc/threads/solar-offset-vs-energy-offset.206118/)
- HA users repeatedly asked for a self-sufficiency gauge before it existed, and debated its name. — [HA community 1](https://community.home-assistant.io/t/energy-dashboard-self-sufficiency-gauge-card/341692); [HA community 2](https://community.home-assistant.io/t/energy-management-self-sufficiency-instead-of-self-dependency/336195)
- SolarEdge tree metric was removed and restored (changelog), suggesting users wanted it back. — [apppage](https://apppage.net/preview/com.solaredge.homeowner)

### Inferences
- Readability trust depends first on fresh, reliable data. Stale data (Enphase reports) undermines any chart design.

### Gaps
- No Reddit or App Store aggregate sentiment on readability was retrieved. Claims that "Tesla is readable" remain unsourced here. Suggest a targeted pass on r/solar, r/TeslaSolar and App Store review text.

## Q4. Common conventions homeowners have already learned

### Takeaway
The shared visual grammar has four parts: a live node/flow diagram (Solar, Home, Battery, Grid), historical stacked or paired bars with Day/Week/Month/Year/Lifetime tabs, a single headline % ratio, and a battery % with reserve and runtime. Colors are *not* standardized: green means production at SolarEdge but total usage at Sense, and HA uses purple/blue for grid direction. Sankey diagrams are emerging (HA), not mainstream.

### Cited Findings
- Live flow: Tesla (third-party [gridtitans](https://gridtitans.com/blogs/news/how-the-tesla-app-works)); FranklinWH ([features](https://www.franklinwh.com/support/articles/detail/what-features-does-the-franklinwh-app-provide)); SunStrong ([Google Play](https://play.google.com/store/apps/details?id=com.mysunpower&hl=en_US)); HA energy distribution and power Sankey ([HA](https://www.home-assistant.io/dashboards/energy/)).
- Time tabs Day/Week/Month/Year (+Lifetime or Billing cycle): Enphase ([etwenergy](https://etwenergy.com/blog/enphase-app-monitoring-guide/)); Sense ([Sense](https://sense.com/consumer-blog/understanding-the-sense-app/)); Sunrun ([ConsumerAffairs](https://www.consumeraffairs.com/solar-energy/sunrun.html)).
- Gauges/rings for ratios: HA gauges ([HA](https://www.home-assistant.io/dashboards/energy/)); Tesla Impact cards ([Tesla](https://tesla.com/support/energy/powerwall/mobile-app/impact-cards)).
- Color mappings: SolarEdge green/red/blue ([SolarEdge](https://solaredge.com/en/support/system-owner/track-energy-production-and-consumption)); Sense green total, grey context, orange/yellow on Power Meter ([Sense](https://sense.com/consumer-blog/understanding-the-sense-app/), [Sense blog](https://sense.com/consumer-blog/real-time-energy-use-power-meter/)); HA purple/blue ([HA](https://www.home-assistant.io/dashboards/energy/)).
- Circuit/device breakdowns: SPAN circuits ([SPAN](https://support.span.io/hc/en-us/articles/4411214235159-Navigating-the-SPAN-Home-App)); Sense bubbles ([Sense](https://sense.com/consumer-blog/understanding-the-sense-app/)); HA devices graph + pie ([HA](https://www.home-assistant.io/dashboards/energy/)).

### Inferences
- The safest conventions to reuse are the four-node flow, the time tabs, a single % ring, and battery % with reserve marker. Color choices should come with an always-visible legend because there is no cross-app color standard.
- Units convention: kW for live power and kWh for period energy (HA doc distinguishes W/kW measurement sensors from kWh energy sensors: [HA energy docs](https://www.home-assistant.io/docs/energy/)).

### Gaps
- Feature changes dated 2024–2026 (e.g., Tesla app redesigns, Enphase app updates) could not be dated from first-party sources in this pass. Only the SunPower → SunStrong rename and the SolarEdge v3.4 changelog were found, and the latter is undated in the source.
