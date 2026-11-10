# Homeowner information needs in solar, battery and EV monitoring dashboards

Research date: 2026-11-08. This extends `docs/research/2026-11-04-woodland-hills-home-energy-components.md`. That document already covers the Enact 2022 survey headline, the Rewiring Australia 2026 survey, the Zhao and Huh 2026 Korean choice experiment, Tesla documentation, and LADWP NEM rules. This file adds detail and new sources rather than repeating them.

**Evidence labels used below:** [STRONG] = peer-reviewed or RCT/representative sample; [MODERATE] = peer-reviewed but small or self-selected, or a large industry or government survey; [VENDOR] = vendor or industry-commissioned; [ANECDOTAL] = forum or Reddit. Some items were verified only from search-result abstracts or snippets, not full text, and are marked "(abstract only)".

## 1. Studies (2018–2026) that measure which monitoring information homeowners value

### Takeaway
No rigorous, representative US study ranks dashboard metrics for solar, battery and EV owners. The best US data is a vendor panel (Enact, n=482, CA/NY, 2022). Better-designed studies come from Germany, Denmark and Sweden, plus older smart-meter in-home display (IHD) literature. Across them, three things recur: money/bill information, comparison with one's own past use, and timing information for shifting loads. Carbon information is rarely what people ask for, although environmental motivation is common.

### Cited Findings
- **Enact (US: CA and NY, Q2 2022, published Sep 2023) [VENDOR].** Online SurveyMonkey purchased panel. 879 started a 35-question survey and 482 qualified as homeowners with installed solar. Saving money was the top motivation for going solar (36%), with environment and "supplying my own power" tied at 25%. Respondents "would prefer to have more information on how to save money" than product recommendations (no percentage given). App satisfaction: 57.39% strongly agree, 31.28% somewhat agree, about 3.45% disagree. Run by an installer marketplace, so not neutral. — [Enact](https://enact.solar/understanding-residential-solar-consumers-in-california/)
- **Enact, notification preferences [VENDOR].** Weekly 36.93%, daily 28.42%, monthly 25.73%; "only for outages or drastic changes" was just over 4.9%. Owners of systems costing over $35,000 were three times more likely to want daily notifications. — [Enact](https://enact.solar/understanding-residential-solar-consumers-in-california/)
- **EnergySage H1 2025 Marketplace Report (US) [VENDOR].** Surveyed solar customers gave three closely ranked reasons for adding a battery: savings on utility rates (30%), solar self-supply (29%) and backup power (26%). In the same survey, 67% of installers named resilience/backup as the main motivation and only 11% mentioned financial savings. That is an installer–customer mismatch. Sample size was not found in the coverage reviewed. — [ESS News](https://www.ess-news.com/2025/12/29/the-installer-customer-mismatch-on-residential-battery-motivations/); [EnergySage report 21](https://www.energysage.com/press/energysage-marketplace-intel-report-21)
- **EnergySage 2025 Home Electrification report [VENDOR].** 73% of respondents were interested in battery backup alongside solar. This measures interest, not a reason for buying. — [The Cool Down summary](https://www.thecooldown.com/green-business/solar-panels-battery-backup-interest-survey/)
- **Rewiring Australia home battery survey (Australia, 11 May–4 Jun 2026) [MODERATE/self-selected].** 597 respondents, recruited by email and social media; the report calls it "exploratory… not rigorous representative polling". Funder not stated. Battery motivations (% ranked in top 3):
  - lower bills: 90.1% (ranked 1st by 35.8%)
  - fight climate change: 85.7% (ranked 1st by 37.5%)
  - use more of own solar: 82.6%
  - avoid blackouts: 40.9% (ranked 1st by 8.7%)

  70% had not joined a VPP. The report contains no data on app-checking frequency or app comprehension. Respondent counts are internally inconsistent: the page says both "407 battery owners" and 597 total. — [Rewiring Australia](https://rewiringaustralia.org/impact/research/home-battery-survey-report)
- **Gram-Hanssen, Hansen and Mechlenborg 2020, *Sustainability* (Denmark) [STRONG for survey design].** A representative sample of 2,505 PV owners plus 12 in-depth interviews. Owners reported being more attentive to energy use and timing everyday practices to production. Monitoring-specific percentages were not retrieved (MDPI returned 403). Funding came via the Danish EUDP/energy-research "prosumers" project. — [IDEAS/RePEc](https://ideas.repec.org/a/gam/jsusta/v12y2020i10p4121-d359626.html); [project final report](https://energiforskning.dk/files/media/document/Final_report%2C_prosumers_project_2020_1_23062020_1549%5B1%5D.pdf) (abstract only)
- **Wittenberg and Matthies 2018, *Renewable Energy* 122 (Germany) [MODERATE].** Online survey of 425 PV households recruited from 15 PV web portals, a likely enthusiast skew. Technology affinity and the availability of monitoring devices predicted active monitoring. In pre-grid-parity households, energy saving was explained by active monitoring plus environmental motivation. In post-grid-parity (self-consumption-era) households, load shifting and sufficiency attitudes were the main drivers. — [EconPapers](https://econpapers.repec.org/RePEc:eee:renene:v:122:y:2018:i:c:p:291-300) (abstract only)
- **Wittenberg and Matthies 2016, *ERSS* 21 (same sample).** PV households did not consume less electricity than others but had higher environmental motivation. Battery storage and automatic load shifting increased self-consumption. — [Encyclopédie de l'énergie](https://encyclopedie-energie.org/?p=7615) (abstract only; older than the 2018 window)
- **Palm, Eidenskog and Luthander 2018, *ERSS* (Sweden) [MODERATE, qualitative].** Prosumer interviews plus consumption data from one year before to one year after PV installation. Awareness of the energy system rose, but there was little substantial change in when or how activities were done. — [Lund University](https://lup.lub.lu.se/search/files/53222731/ER_SS_Palm_et_al_2018.doc) (abstract only)
- **Smart-meter IHD review (global; about 100 pilots; commissioned by the ESMIG industry body) [VENDOR-commissioned, older ~2011–2014].** Customers valued most an IHD showing up-to-date consumption, an up-to-date cost or bill, and historical consumption, "in a format they can understand". Average electricity reduction with a display was about 8.5%. — [Electronic Specifier](https://www.electronicspecifier.com/?p=123189)
- **Earlier-doc sources, not repeated:** Zhao and Huh 2026 (Korea choice experiment: rate alerts and appliance-level use valued above carbon) and the MDPI 2022 energy-portal study (alerts for unusual use and appliance insights). See the background document.

### Inferences
- In surveys, owners consistently rank money first, but "use more of my own solar" (self-sufficiency) and climate sit close behind. Self-sufficiency is a distinct value, not just a proxy for savings. That argues for a self-powered % component alongside the savings component, and for carbon as a secondary card rather than being dropped.
- The installer/owner mismatch on backup suggests outage readiness is a lower everyday need for owners than the industry assumes, but it is not trivial: about a quarter of US battery buyers cite it, and it is a top-3 reason for 41% in Australia. In LA, where outages are less frequent than in PG&E PSPS territory, battery readiness is plausibly a "check when needed" component, not the headline.

### Gaps
- No peer-reviewed US/California study that directly asks solar+battery+EV owners to rank dashboard metrics was found.
- No survey sample sizes were found for EnergySage H1 2025.
- No SGIP (CPUC/Verdant) host-survey results on monitoring or motivations were retrieved; the reports exist but their survey sections were not accessible in this pass ([SGIP 2023 PPPE](https://webproda.cpuc.ca.gov/-/media/cpuc-website/divisions/energy-division/documents/self-generation-incentive-program/sgip_2023_pppe.pdf)).
- No Tesla, Sunrun, SunPower or Enphase published consumer survey on app usage was found.

## 2. How often owners check monitoring apps, and why

### Takeaway
Only one quantified check-frequency figure exists for US solar owners: Enact 2022 (vendor). About two-thirds checked at least weekly, LA respondents checked daily at twice the rate of others, and 13% never used the app. Field experiments show that engagement with digital tools fades quickly even in motivated samples. Qualitative studies show that the main uses are reassurance and fault spotting, plus shifting flexible loads (laundry, dishwasher, EV) into solar hours.

### Cited Findings
- **Enact (CA/NY, 2022, n=482) [VENDOR].** App use frequency: daily 36%, weekly 31%, monthly 13%, rarely 7%, never 13%. Owners of newer systems and higher-income owners used it more. Los Angeles participants were "two times more likely" to use the app daily than other regions. — [Enact](https://enact.solar/understanding-residential-solar-consumers-in-california/)
- **Pelka et al. 2024, *Energy Strategy Reviews* (Germany) [MODERATE, field experiment].** 111 PV households. Feedback alone raised self-consumption modestly (about 3–4%); a default setting gave a larger gain (about 16% for active participants). Even this motivated sample rarely interacted with the digital tools. — [TU Delft repository](https://repository.tudelft.nl/record/uuid:640a2c1f-2545-49ad-994e-b3594ac71180) (abstract only; full text fetch failed)
- **Zapico et al. 2024, ICT4S conference (Sweden) [MODERATE/small qualitative].** Nine PV households with an always-on in-home display, interviewed before and after. The display helped shift flexible practices such as laundry but not non-negotiable ones such as cooking or hot water. Users valued simplicity. — [ICT4S 2024 paper](https://conf.researchr.org/getImage/ict4s-2024/orig/ICT4S2024_paper_40.pdf) (abstract-level summary only; PDF link returned 404 on fetch)
- **Buildings 2024 (Arizona) [MODERATE].** Daily load data from 1,299 users. A household case continuously monitored PV power via a mobile app to shift major appliance use to peak solar hours. — [Buildings 14(12):4035](https://doi.org/10.3390/buildings14124035) (abstract only)
- **Hargreaves, Nye and Burgess 2013, *Energy Policy* (UK; pre-2018, flagged).** A commonly cited study of long-term householder engagement with smart energy monitors; it is the standard reference for the "fade into the background" effect. — cited in search results, see [Hargreaves et al. 2013 via Lund/ERSS search listing](https://lup.lub.lu.se/record/e7f3eda3-b60a-4986-a86b-c7945ab4c47f) (not fetched; reported here only as context)
- **Australian government guidance.** A battery's app shows the same information as the display panel but also stores past operation history, which is framed as useful for checking performance. — [energy.gov.au](https://www.energy.gov.au/solar/use-your-solar-system/monitor-your-solar-system)
- **Fault detection value [VENDOR claim].** Solar Analytics, an ARENA-funded ($2.1M) monitoring company, claims fault diagnosis can raise yield by more than 15%. This is a company and grant claim, not user-behaviour evidence. — [SolarQuotes/ARENA coverage](https://www.solardirectory.com.au/news/1232-arena-solar-homes)
- **Forum evidence that owners use apps to judge whether the battery behaves correctly [ANECDOTAL].** Tesla Motors Club threads such as "wonky Powerwall numbers", "outage yesterday surprising battery charge lost" and "system misbehaving today" show owners checking apps after unexpected events. — [TMC wonky numbers](https://teslamotorsclub.com/tmc/threads/wonky-powerwall-numbers-is-this-normal.223284/latest); [TMC outage charge lost](https://teslamotorsclub.com/tmc/threads/outage-yesterday-surprising-battery-charge-lost.216647/)

### Inferences
- Design for two modes: a glanceable "is everything OK and what is happening" check (daily, about a third of owners) and an occasional deep dive (monthly bills, after anomalies or outages).
- Because engagement decays, defaults and automation (for example, EV charging scheduled into solar or off-peak hours) likely matter more than dashboards for outcomes. Dashboards earn their keep through explanation and reassurance.
- The LA-specific daily-use finding is supportive but rests on a vendor sample.

### Gaps
- No data was found on check frequency specifically for battery or EV owners (versus solar-only), or on how frequency changes over months of ownership.
- No reasons-for-checking breakdown (savings vs fault vs outage vs curiosity) with percentages was found in any source.

## 3. Ranking money vs kWh vs carbon vs self-sufficiency

### Takeaway
Owners say money matters most and IHD users value cost and bill displays, but behavioral evidence is mixed. In a US RCT, health and environment framing produced more conservation than cost framing. For solar owners, self-sufficiency ("use my own solar") is ranked near money. A sensible hierarchy is money and self-powered % as primary metrics, kWh as the underlying unit, and carbon as secondary but present.

### Cited Findings
- **Stated motivations.** Saving money is first in Enact (36%) versus environment (25%) and self-supply (25%). EnergySage battery motivations are bills 30%, self-supply 29%, backup 26%. In Rewiring Australia, lower bills had the highest popularity index (5.92), but climate was ranked first slightly more often (37.5% vs 35.8%). — [Enact](https://enact.solar/understanding-residential-solar-consumers-in-california/); [ESS News](https://www.ess-news.com/2025/12/29/the-installer-customer-mismatch-on-residential-battery-motivations/); [Rewiring Australia](https://rewiringaustralia.org/impact/research/home-battery-survey-report)
- **Asensio and Delmas 2015, *PNAS* (Los Angeles, UCLA family housing; pre-2018, flagged) [STRONG RCT].** Real-time, appliance-level metering for 8 months, with weekly messages comparing each household to its most efficient neighbor. Environment/health framing produced 8% savings versus control, and up to 19% for families with children. Cost-savings framing produced little change. The authors attribute this partly to cheap US electricity. Persistence was not studied. Relevant because it is LA. Note: this population is renters, not solar owners. — [PNAS/PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4330782); [UCLA release](https://www.uclahealth.org/news/release/more-important-than-money-environmental-health-benefits-inspire-people-to-cut-back-on-electricity)
- **Smart-meter IHD review [older, industry-commissioned].** Up-to-date cost or bill was among the most valued IHD features. — [Electronic Specifier](https://www.electronicspecifier.com/?p=123189)
- **Display format.** A University of Bath PhD thesis on IHD design (2015, flagged) found participants preferred a numerical display and detected changes better with it than with two alternative formats. — [Bath/REF impact listing via search](https://results2021.ref.ac.uk/impact/37071028-e2a4-4c8d-bb00-fbcc6cd412ed/pdf) (search-snippet level)
- **Korean choice experiment (Zhao and Huh 2026).** Carbon information was valued less than rate alerts and appliance monitoring. See the background document.

### Inferences
- What people say (money first) and what moves behavior (environment and health sometimes beats money) diverge. For a solar home, bill savings are already locked in by hardware. Money framing reassures, while self-powered % and carbon may sustain engagement.
- Cost is more salient where rates are high. California tariffs are far higher than the national averages in the 2015 study, which may strengthen money framing for an LADWP home.

### Gaps
- No study was found that directly compares self-powered %, savings $ and CO2 displays head to head among solar owners.

## 4. What homeowners find confusing

### Takeaway
Confusion clusters in five areas:
- **kW vs kWh units:** about 20–50% of the general public cannot identify the kWh unit.
- **Bills vs app numbers:** true-up and NEM credits, fixed charges not offset by solar, and the gap between app-modeled and utility-billed results.
- **Battery percentage vs real usable energy or backup hours.**
- **Production-only monitoring without consumption data**, which leaves owners unable to explain their bills.
- **Low solar vs a real fault.**

Most system-specific evidence is anecdotal; unit-literacy evidence comes from moderate-quality surveys.

### Cited Findings
- **kWh literacy.**
  - **UK, Which? 2022 (n=2,089) [MODERATE].** kWh was among the most struggled-with terms on a mock bill, and 41% found areas of the bill confusing. — [Which?](https://www.which.co.uk/policy-and-insight/article/energy-bills-transparency-aT5uF9p6RIqE)
  - **Australia, Energy Consumers Australia, Dec 2024 (n=4,152).** 18% did not know their bill's unit (kWh). — [SolarQuotes summary](https://solarquotes.com.au/blog/energy-literacy-australia-mb3100)
  - **North America, E Source (about 3,000 bill payers).** Only about half said they understood kW and kWh. — [E Source](https://web-ivr.esource.com/printpdf/207833)
  - **Japan, Selectra 2026.** 47.3% correctly chose kWh as the usage unit, and about 39% chose kW. — [Selectra](https://selectra.jp/energy/survey/electricity-literacy-survey-2026)
  - **Caveat.** These are general-public samples; solar owners likely score higher, but no owner-specific data was found.
- **Bill vs app / true-up confusion [ANECDOTAL plus aggregator].**
  - Reddit threads show solar owners blindsided by true-up bills. Commenters often attribute it to monitoring that covers only production, not consumption, or to a mismatch between monitoring data and the utility statement.
  - PG&E NEM3 owners note that exports are revalued at lower rates and that CCA customers (for example MCE) get a separate true-up.
  - A 2026 comment notes that PG&E's $24 Base Services Charge cannot be offset by solar.
  - Sources: [r/solar "bill wrong" thread](https://reddit.birdcat.cafe/r/solar/comments/1jsxgo4/bill_wrong/mmce9h8/?context=3); [The Cool Down on a PG&E Reddit refund case](https://www.thecooldown.com/green-home/solar-bill-refund-reddit-pge/); [The Cool Down on a Colorado bill discrepancy](https://www.thecooldown.com/green-home/colorado-homeowner-solar-bill-discrepancy/)
  - An installer blog (2018, flagged) argues customers often don't realize their usage is trued up annually: a "failure to communicate between installer and consumer". — [Run On Sun](https://runonsun.solar/~runons5/blogs/blog1.php/residential-solar/solar-high-bills)
  - The background document already covers an LADWP NEM bank withdrawal-math Reddit thread.
- **Enact: savings uncertainty varies by region [VENDOR].** 88%+ in LA agreed they were aware of their savings versus 72% in the Bay Area, where respondents were "2x more likely" to be uncertain. Lower-income buyers were more anxious or unsure about savings. 17% overall, and nearly 40% in the Bay Area and Sacramento Valley, could not name their inverter manufacturer. — [Enact](https://enact.solar/understanding-residential-solar-consumers-in-california/)
- **Battery % vs usable energy or backup time [ANECDOTAL].**
  - A Tesla Motors Club owner expected about 25 kWh discharged (13.5 kWh usable per Powerwall) but the app showed 14 kWh.
  - Another advises using the app % only to know when the battery is "fully charged or about to go offline".
  - Reserve changes reportedly took up to two hours to show up in the app.
  - Sources: [TMC wonky numbers](https://teslamotorsclub.com/tmc/threads/wonky-powerwall-numbers-is-this-normal.223284/latest); [TMC how much energy do I actually have](https://teslamotorsclub.com/tmc/threads/how-much-energy-to-i-actually-have.241509/)
  - A Home Assistant issue documents the Tesla app's % differing from the API % below 100% because of a hidden 5% reserve. — [GitHub home-assistant/core #82297](https://github.com/home-assistant/core/issues/82297)
- **How one vendor explains backup-time estimates [VENDOR documentation].** Base Power's app calculates estimated backup duration from current charge and the last 15 minutes of usage. The estimate rises as usage falls, a tilde (~) marks it as approximate, and it excludes solar charging. This shows the volatility owners see and a disclosure pattern for it. — [Base Power help: backup estimate](https://help.basepowercompany.com/en/articles/10196033); [Base Power help: status bar](https://help.basepowercompany.com/en/articles/10771026-how-should-i-interpret-the-base-app-status-bar-with-power-source-battery-charge-and-estimated-backup-time)
- **Low solar vs fault.** No systematic evidence was found beyond the earlier document's qualitative study (Berry et al.) and forum threads about "misbehaving" systems. — [TMC system misbehaving](https://teslamotorsclub.com/tmc/threads/powerwall-system-misbehaving-today.284124/)

### Inferences
- Every power or energy number needs a unit and a time window. Cost numbers need a "modeled vs billed" label.
- The battery card should show kWh available above reserve, not just %, and any runtime should be labeled an estimate based on recent load ("~X h at current use").
- Consumption monitoring, not just production, is what lets owners reconcile bills. The simulation already has both and should surface the home-use side prominently.

### Gaps
- No quantified prevalence data was found on confusion among solar or battery owners specifically: no surveys on NEM credit comprehension or battery-% comprehension. Reddit evidence shows these confusions exist, not how common they are.
- Direct r/Powerwall and r/TeslaSolar threads did not surface in search; the forum evidence is mostly Tesla Motors Club.

## 5. Which feedback formats improve understanding or action

### Takeaway
Feedback typically yields low-single-digit to about 8% savings. Effects are larger in volunteer samples and decay over weeks. Comparison with one's own history appears more effective than normative (neighbor) comparison in UK reviews. However, an LA RCT that combined neighbor comparison with environment/health framing worked well. Evidence on appliance-level (disaggregated) feedback is too varied to meta-analyze. For PV households, defaults and automation beat feedback alone.

### Cited Findings
- **Karlin, Zinger and Ford 2015, *Psychological Bulletin* [STRONG meta-analysis; studies dated 1976–2010].** 42 studies. Feedback is effective on average, and the effect is moderated by frequency, medium, comparison message, duration, and combination with goals or incentives. The pooled effect size was not retrieved. — [USF Digital Commons](https://digitalcommons.usf.edu/psy_facpub/2305)
- **Meta-studies review (*Energies* 2019) [STRONG review].** Assessed 61 studies across 57 initiatives. Savings were higher for programs targeting overall conservation than for those targeting specific time periods. — [Energies 12(19):3788](https://www2.mdpi.com/1996-1073/12/19/3788)
- **Marangoni and Tavoni 2021 (Italy, field experiment) [STRONG].** Real-time feedback access gave a 5.7% average reduction that persisted up to 4 weeks. — [Politecnico di Milano](https://re.public.polimi.it/bitstream/11311/1159251/1/Marangoni-Tavoni2021_Article_Real-timeFeedbackOnElectricity.pdf)
- **Swiss shower real-time feedback (697 opt-in households) [STRONG].** Large, stable savings for activity-specific feedback. The authors warn that most large-savings feedback studies rely on volunteer samples. — [University of St. Gallen](https://alexandria.unisg.ch/server/api/core/bitstreams/32e56360-b2c6-4c67-b81e-f08038871dff/content)
- **Disaggregated feedback review (arXiv 2016) [MODERATE].** Of 12 disaggregated-feedback studies, six reported only point estimates; they are too varied for meta-analysis. — [arXiv 1605.00962](https://arxiv.org/pdf/1605.00962.pdf)
- **UK smart-metering review [MODERATE, older].** Historic feedback, meaning comparison with one's own previous periods, appears more effective than comparative or normative feedback. — [E3T NW smart metering report](https://www.e3tnw.org/research/energy/downloads/smart-metering-report.pdf)
- **IHD support and education.** The ESMIG-commissioned review emphasizes that savings depend on support, advice and education alongside the display. — [Electronic Specifier](https://www.electronicspecifier.com/?p=123189)
- **Pelka et al. 2024 (German PV, n=111).** Feedback raised self-consumption about 3–4%; defaults raised it about 16%. — [TU Delft](https://repository.tudelft.nl/record/uuid:640a2c1f-2545-49ad-994e-b3594ac71180) (abstract only)
- **Asensio and Delmas 2015 (LA RCT).** Neighbor comparison plus environment/health message gave 8% savings; cost framing gave little. — [PNAS/PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4330782)
- **Zapico et al. 2024 (Sweden, 9 PV homes).** A simple always-on display helped shift flexible loads only. — [ICT4S 2024](https://conf.researchr.org/getImage/ict4s-2024/orig/ICT4S2024_paper_40.pdf) (abstract only)

### Inferences
- For a solar+battery+EV home, the actionable behaviors are timing behaviors (EV charging, laundry, pre-cooling). Formats that show when solar surplus or cheap periods occur, plus your own past period for comparison, are best supported.
- Appliance breakdowns are popular in stated-preference studies but have weak causal evidence. Use them for explanation ("why did use rise"), not as a guaranteed savings lever.
- Normative comparisons are optional and risky for a single simulated home; self-history comparison is safer and better supported.

### Gaps
- No feedback study was found that is specific to battery owners or EV charging displays.
- The pooled effect sizes from Karlin et al. 2015 were not retrieved.
- No 2024–2026 UK DESNZ/Ofgem IHD evaluation was found in this pass. The IHD evidence cited is roughly 2011–2016 and largely industry-commissioned.
