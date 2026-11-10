# How Ordinary People Comprehend Energy and Carbon Metrics, and Which Presentation Formats Work

Research date: 2026-11-08. Evidence years are flagged inline. "Robust" = large-sample RCT/field experiment or meta-analysis; "single small study" = n < ~150 or a single lab/survey study.

## kW vs kWh: how well do consumers understand power vs energy, and what framings work?

### Takeaway
I found no peer-reviewed study that directly measures how well consumers tell kW from kWh. The nearest evidence shows people misjudge energy quantities badly, by roughly 2.8x on average. They judge best in energy units over longer periods (monthly, not hourly), and their estimates depend heavily on which reference unit they are given. Plain-language time framing ("using right now" vs "used today") is the likely workaround, but it has not been tested directly.

### Cited Findings
- Attari et al. (PNAS, 2010; online survey, n ~ 500): across 15 activities, participants underestimated energy use and savings by a factor of about 2.8 on average. They slightly overestimated low-energy activities and greatly underestimated high-energy ones. Most named curtailment (turning off lights) over efficiency upgrades. Higher numeracy and pro-environmental attitudes predicted accuracy. — [Our Energy Policy summary](https://www.ourenergypolicy.org/public-perceptions-of-energy-consumption-and-savings/); [White Rose eprints](https://eprints.whiterose.ac.uk/id/eprint/74518/)
- Frederick, Meyer & Mochon (PNAS, 2011, comment on Attari): the measured underestimation depends heavily on the reference unit. With a 3 W LED as the referent, underestimation was 18.3x; with a 100 W incandescent bulb it was 2.5x. Reference anchors change the judgments themselves. — [PMC3044394](https://pmc.ncbi.nlm.nih.gov/articles/PMC3044394)
- University of Leeds PhD work (Lesic, with Bruine de Bruin et al.; ~2016–2017): consumers' perceptions of appliance electricity use were more accurate in energy units than in monetary units, and over monthly periods than hourly ones. Their perception of relative household use (vs others) was fairly accurate. — [White Rose eTheses](https://etheses.whiterose.ac.uk/18286); [Manchester CMIST PDF](https://hummedia.manchester.ac.uk/institutes/cmist/researchdocs/lesic.pdf)
- Industry evidence of confusion is weaker. A 2025 analysis by Valda Energy counted online questions about the kWh term (~3,000 in 12 months), not comprehension. Consumer guides routinely note that people treat kW and kWh as interchangeable. — [Fix Radio report](https://www.fixradio.co.uk/news/construction-news/energy-confusion-could-be-costing-construction-firms-money-research); [SolarQuotes](https://solarquotes.com.au/blog/confusing-kw-with-kwh); [Energy Vanguard](https://www.energyvanguard.com/blog/energy-and-power-and-confusion-and-consternation/)
- Even utilities mislabel units in customer emails (an OVO Energy forum thread flags wrong units in a "Power Move" email). This is anecdotal. — [OVO forum](https://forum.ovoenergy.com/the-archive-149/wrong-units-used-on-power-move-flex-email-20404)
- UK supplier IHDs show real-time consumption "in kWh or pounds and pence," with green/amber/red traffic-light feedback against targets. The real-time number is translated into a rate of spend or a colour rather than left as a bare kW figure. — [BEIS/BIT, Smart meters IHD impacts, July 2019](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/829466/smart-meters-in-home-displays-impacts.pdf)

### Inferences
- Because no direct kW/kWh comprehension data exists, the safest course is to avoid making users interpret "kW" at all. Label instantaneous values by time ("Using now: 2.3 kW") and cumulative values by period ("Used today: 14 kWh"), so the time word carries the meaning even if the unit does not.
- The Leeds finding (monthly beats hourly) suggests cumulative day/month totals are easier to judge than instantaneous rates. Lead with "today/this month" totals and treat "right now" as secondary, live context.
- The Frederick et al. anchor effect implies that any reference object ("about the same as running a kettle") will strongly shape perception. Choose anchors deliberately and keep them consistent.

### Gaps
- No controlled study found that tests kW vs kWh labeling, or "right now" vs "today" framing, for comprehension. This is a genuine evidence gap, not a search failure.
- No evidence found on understanding battery capacity (kWh) vs battery power rating (kW) specifically.

## Money vs kWh vs percent vs carbon framings: which are understood and acted on? "Self-powered %" / energy independence?

### Takeaway
Money is the most commonly preferred and motivating frame. kWh is judged slightly more accurately. Environmental/health framing beat money framing in one well-designed but small RCT, and cost messages can even backfire where electricity is cheap. "Self-sufficiency %" (autarky) is a well-defined industry metric, but I found no comprehension research on it, and real user confusion exists.

### Cited Findings
- Asensio & Delmas (PNAS, 2015; RCT, 118 apartments in Los Angeles, real-time appliance-level metering): weekly messages framed around environmental and public-health externalities (pounds of pollutants, childhood asthma, cancer) produced 8.2% savings vs control, and up to 19% for families with children. The cost-savings frame (dollars, compared with the top 10% most efficient neighbours) produced no significant net conservation. In high-use deciles it led to increased use relative to control ("splurging"). The authors suggest low electricity prices weakened the money frame. Persistence after the study was not measured. This is a single small study, though high-resolution. — [PMC4330782](https://pmc.ncbi.nlm.nih.gov/articles/PMC4330782); [UCLA IoES](https://www.ioes.ucla.edu/publication/nonprice-incentives-and-energy-conservation/)
- Aziz (Archives of Design Research, 2015; n = 35, lab study): participants preferred cost and kWh units. Environmental metrics such as CO2 and "trees" caused confusion. Single small study. — [Academia.edu listing](https://cmu.academia.edu/AzizanAziz)
- Leeds thesis (~2016–17): perceptions were more accurate in energy units than in money. People may prefer money but judge kWh better. — [White Rose eTheses](https://etheses.whiterose.ac.uk/18286)
- BEIS/BIT (2019) supplier trial surveys: younger respondents were more likely to manage energy for cost savings and older respondents for comfort. Motivation differs by segment. — [BEIS IHD impacts report, 2019](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/829466/smart-meters-in-home-displays-impacts.pdf)
- Self-sufficiency (autarky) definition: the share of consumption met by PV, directly or via battery, i.e. PV-supplied energy divided by energy consumed. — [Aurora Solar help center](https://help.aurorasolar.com/hc/en-us/articles/45485868561427-What-is-Autarky)
- Self-consumption is a different metric: it measures the share of PV output used on site, while self-sufficiency is the share of site demand covered by PV. Vendors show them on separate screens, and they are easy to confuse. — [Schneider Electric blog, 2019](https://blog.se.com/infrastructure-and-grid/power-management-metering-monitoring-power-quality/2019/07/01/optimizing-your-solar-investment-was-never-easier/)
- Modeled benchmarks: most consumers can exceed 70% self-sufficiency with a 20 kWh battery and PV sized to annual consumption, vs ~35% average with PV only (Barbour & González, Applied Energy, 2018). — [Loughborough repository](https://dspace.lboro.ac.uk/dspace-jspui/handle/2134/36989)
- Real-world confusion (anecdotal): a FoxESS user saw "0% self-sufficiency" on a day with solar output. The vendor's formula, based on grid consumption and purchases, clamps negative results to 0%. — [FoxESS community forum](https://foxesscommunity.com/viewtopic.php?p=6404)

### Inferences
- Pair money with kWh rather than choosing one. Money gives meaning and motivation; kWh supports accurate judgment and stays stable when tariffs change.
- Do not rely on cost framing alone to drive behaviour. In low-price contexts it can license more use (Asensio & Delmas, small n).
- "Self-powered %" needs explicit definition text ("share of your home's electricity that came from your solar and battery today") and must never show a clamped or unexplained 0%. Distinguish it from "solar used at home %", or omit the latter for lay users.

### Gaps
- No peer-reviewed comprehension or behavioural study found on "self-powered %", "energy independence", or "autarky" framings in consumer apps.
- No direct head-to-head test found of percent-change framing ("12% less than last month") vs absolute kWh or money.

## Carbon equivalents (EPA GHG Equivalencies Calculator): calculation, accuracy caveats, and evidence on understanding

### Takeaway
The EPA calculator uses national-average factors, and its electricity factor depends on whether the user wants "electricity used" (average rate) or "electricity avoided" (marginal rate). The two differ by about 1.7x, which is a major source of misstatement. Experimental evidence suggests abstract equivalents such as "trees" are less effective than CO2 by weight. Familiar, energy-native equivalents (light-bulb minutes) can help.

### Cited Findings (EPA methodology, page last updated 4 Aug 2026)
- **Electricity used:** eGRID2022 national average of 823.1 lb CO2/MWh, including 5.1% line losses, gives 3.94×10⁻⁴ t CO2/kWh. — [EPA Calculations & References](https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references)
- **Electricity avoided (e.g., solar, efficiency):** eGRID2022 national default marginal rate of 1,405.3 lb CO2/MWh, adjusted for line losses, gives 6.72×10⁻⁴ t CO2/kWh. A ZIP code selects regional marginal rates (e.g., CAMX/California 1,055.0 lb/MWh; SRMW 1,808.6 lb/MWh). CO2 only. — [EPA](https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references)
- **Miles driven by an average gasoline car:** 22.8 mpg and 8.89×10⁻³ t CO2/gallon give 3.93×10⁻⁴ t CO2e/mile (2022 FHWA data). — [EPA](https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references)
- **Gallons of gasoline:** 8,887 g CO2/gallon, assuming full oxidation. — [EPA](https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references)
- **Tree seedlings grown for 10 years:** 0.060 t CO2 per tree per year (weighted 89% deciduous / 11% conifer urban trees, McPherson et al. 2016). Assumes survival rates, excludes shading benefits, and EPA says it is not for reforestation. — [EPA](https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references)
- **Acres of US forest for one year:** 1.00 t CO2/acre/year (2022 net change). The 2014–2022 average is 0.23 t C/acre/yr, so the factor moves year to year. EPA's FAQ cites 1.06 t elsewhere, an inconsistency between EPA pages. — [EPA](https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references); [EPA FAQ](https://epa.gov/energy/frequent-questions-epas-greenhouse-gas-equivalencies-calculator)
- **Homes' electricity use for a year:** 12,194 kWh/home × average rate gives ~4.8 t CO2/home/year; total home energy gives 7.45 t. National average. The page mixes 2021 and 2022 data years internally. — [EPA](https://www.epa.gov/energy/ghg-equivalencies-calculator-calculations-and-references)
- EPA states the calculator was developed for use in the United States only. — [EPA FAQ](https://epa.gov/energy/frequent-questions-epas-greenhouse-gas-equivalencies-calculator)
- **Evidence on equivalents (CHI 2023, Toyota Research Institute; online scenario survey):** in ride-hailing choice scenarios, CO2 by weight was the most effective format for prompting green choices. Abstract equivalences like "saving trees" were less effective, and participants showed low carbon literacy. Framing (individual vs collective, positive vs negative valence) also mattered. These are hypothetical choices, not observed behaviour. — [arXiv 2407.08897](https://arxiv.org/pdf/2407.08897); [TRI](https://www.tri.global/research/save-tree-or-6-kg-co2-understanding-effective-carbon-footprint-interventions-eco-friendly)
- Camilleri et al. (Nature Climate Change, 2019; survey n ~ 1,000 plus a choice experiment n = 120): people underestimated emissions of appliances, and of foods even more. A carbon label expressed in a familiar energy unit ("light-bulb minutes") shifted soup choices toward lower-emission options. The label experiment is small and covers one category. — [IDEAS/RePEc](https://ideas.repec.org/a/nat/natcli/v9y2019i1d10.1038_s41558-018-0354-z.html); [Yale e360](https://e360.yale.edu/digest/can-food-labels-drive-consumers-to-choose-less-carbon-intense-diets)
- Aziz (2015, n = 35): CO2 and tree metrics caused confusion in eco-feedback displays. — [Academia.edu](https://cmu.academia.edu/AzizanAziz)
- Commentary (opinion, not experiment): converting emissions to trees means little to most readers; driving or flying miles are more concrete. — [Grist](https://grist.org/article/seal-the-deal)

### Inferences
- If you show carbon for solar generation or avoided grid use, the methodologically correct EPA factor is the marginal "avoided" rate, ideally regional, not the average "used" rate. Mixing them overstates or understates results by roughly 1.7x nationally, and much more across regions (California marginal rate ~1,055 vs Midwest SRMW ~1,809 lb/MWh).
- Trees and forest-acres are the weakest equivalents: they are abstract, the factors vary year to year, and EPA itself warns about assumptions. Miles driven and gallons of gasoline map to more familiar experience. Use at most one equivalent, label it as approximate, and show kg CO2 as the primary figure.
- Energy-native equivalents (bulb-hours, phone charges, kettle boils) may be the most legible for a home-energy product, based on the Camilleri label result, but evidence is limited to one small experiment.

### Gaps
- No large controlled study found that tests whether EPA-style equivalents (miles, homes, trees) improve numerical comprehension vs raw kg CO2 in a home-energy context.
- No study found on whether equivalents mislead users about magnitude (e.g., anchoring on "3 trees").

## Comparisons: previous period, same period last year, similar homes (normative feedback), weather-normalized baselines

### Takeaway
Normative "similar homes" comparisons, delivered via Opower/Oracle Home Energy Reports, have the most robust behavioural evidence in this whole field. Many randomized trials covering hundreds of thousands to millions of households show ~2% average reductions, concentrated among high users, persistent for years and decaying slowly. Self-comparison is also supported, but effects plateau. Weather normalization is standard practice, but I found no comprehension research on it.

### Cited Findings
- Allcott (J. Public Economics, 2011; RCTs, ~600,000 households): Opower neighbour-comparison reports cut consumption by ~2.0% on average (1.9–2.0% in the working paper), equivalent to an 11–20% short-run price increase. The top pre-treatment consumption decile cut use by 6.3%, the bottom decile by 0.3%. Injunctive-norm categories played an insignificant role in deterring low users from increasing use (low "boomerang" risk). Robust. — [MIT CEEPR](https://ceepr.mit.edu/workingpaper/social-norms-and-energy-conservation); [RePEc](https://econpapers.repec.org/RePEc:eee:pubeco:v:95:y:2011:i:9-10:p:1082-1095)
- Allcott & Rogers (AER, 2014; >6 million households): early reports trigger cycles of action and backsliding that fade over time. Consumers are slow to habituate. After reports stop (following ~2 years), effects decay only ~10–20% per year. Robust. — [IDEAS/RePEc](https://ideas.repec.org/a/aea/aecrev/v104y2014i10p3003-37.html); [NBER w18492](https://www.nber.org/papers/w18492.pdf)
- A separate analysis of Opower programs across 21 US utilities suggests 35–55% of savings come from efficiency investments rather than just behaviour (as reported in a search summary; the primary source was not retrieved). — [Springer review PDF](https://springerlink.bibliotecabuap.elogim.com/content/pdf/10.1007/s10603-014-9266-0.pdf)
- Froehlich, Findlater & Landay (CHI 2010; review of 44 HCI and 12 environmental-psychology papers): self-comparison with past behaviour has been shown to be effective. Social comparison results are mixed: people are often interested in comparisons that do not change behaviour, and a performance plateau eventually limits gains from emphasizing improvement. Few HCI eco-feedback studies measured actual behaviour change. — [Makeability Lab PDF](https://makeabilitylab.cs.washington.edu/media/publications/Froehlich_TheDesignOfEcoFeedbackTechnology_CHI2010.pdf)
- Karlin, Zinger & Ford (Psychological Bulletin, 2015; meta-analysis of 42 feedback studies): small average effect (r = .071) with wide variation (about −.08 to .48). The least engaging feedback (bill summaries) performed worst; more engaging formats (real-time software) and goal-setting combined with feedback did better. Robust as a meta-analysis, but heterogeneous. — [Strathclyde](https://pureportal.strath.ac.uk/en/publications/the-effects-of-feedback-on-energy-conservation-a-meta-analysis/); [APA press release](https://www.apa.org/news/press/releases/2015/09/energy-use-feedback)
- Asensio & Delmas (2015): the cost frame that included a "top 10% efficient neighbours" comparison did not produce net savings, which shows a normative comparison does not guarantee an effect when paired with a weak frame (small n). — [PMC4330782](https://pmc.ncbi.nlm.nih.gov/articles/PMC4330782)

### Inferences
- "Compared with similar homes" is the best-evidenced comparison for motivating change, especially for high users. Since injunctive cues showed little effect on low users in Allcott (2011), a simple positive acknowledgement for efficient homes is low-risk.
- Same-period-last-year comparisons (ideally weather-adjusted) avoid misleading seasonal swings that "vs last month" produces. Pair "vs last month" with a note on the season or temperature.
- For solar/battery owners, "similar homes" must mean similar systems (PV size, battery). Otherwise the comparison mostly reflects hardware differences, not behaviour.

### Gaps
- No user comprehension study found on weather-normalized baselines ("adjusted for weather") and whether lay users trust or understand them.
- No direct evidence found on normative comparisons for solar/battery prosumers (e.g., comparing self-sufficiency with neighbours).
- Oracle Utilities post-2020 evaluation figures were not retrieved.

## Visual encoding: Sankey/flow diagrams vs stacked bars vs donuts/rings; gauges for battery state

### Takeaway
The eco-feedback visualization literature is thin and mostly small lab or survey studies. A systematic review concludes that inappropriate visualization choices reduce effectiveness. I found no controlled study comparing Sankey or flow diagrams with stacked bars for household energy, or testing battery gauges. Available evidence slightly favours familiar time-series charts (bars or areas) over novel encodings.

### Cited Findings
- Aziz (Archives of Design Research, 2015; n = 35; response time, correctness, preference): participants preferred stacked area charts to stacked bar charts for disaggregated appliance data. Single small study. — [Academia.edu](https://cmu.academia.edu/AzizanAziz)
- UCL manuscript (2021; n = 65): tested an area-based visualization of cumulative energy by appliance over time vs other formats, to see whether disaggregated feedback improves understanding. Result details were not retrieved. — [UCL Discovery](https://discovery-pp.ucl.ac.uk/10128398/1/2021_April%20revised%20manuscript.pdf)
- Energy Efficiency (Springer, 2017; contextual think-aloud, n = 13): little is known about how users understand and interpret energy data visualizations. Very small qualitative study. — [Springer PDF](https://rd.springer.com/content/pdf/10.1007/s12053-017-9555-y.pdf)
- Chalal et al. (Renewable & Sustainable Energy Reviews, 2022; systematic review): inappropriate use of visualization patterns and techniques decreases the effectiveness of eco-feedback. — [NTU IRep](https://irep.ntu.ac.uk/id/eprint/46139)
- Froehlich et al. (CHI 2010): open design dimensions include update frequency, measurement units, data granularity (appliance vs whole house), medium (push vs pull, ambient vs web), and comparisons. These "have yet to be fully investigated." — [Makeability Lab PDF](https://makeabilitylab.cs.washington.edu/media/publications/Froehlich_TheDesignOfEcoFeedbackTechnology_CHI2010.pdf)
- UK supplier IHDs and apps used traffic-light (green/amber/red) encodings tied to user-set targets, alongside historical charts. In Supplier A's trial, app users rated their device "very easy" to use more often than IHD users (68% vs 43%) and "very useful" more often (42% vs 30%). Survey samples were biased toward engaged users, per BIT. — [BEIS/BIT 2019](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/829466/smart-meters-in-home-displays-impacts.pdf)

### Inferences
- With no head-to-head evidence, use conventional encodings for primary reading: bars for period totals, lines or areas for time of day. Use a flow diagram only as a secondary "where did my energy go right now" explainer with few nodes (solar, battery, grid, home). Flows suit the "right now" kW view because they visualize direction, which bars cannot.
- For battery state, a fill-level or percent display (a familiar phone-battery metaphor) is a reasonable default. Note that this is a design inference, not tested evidence.
- Traffic-light colouring against a target is widely deployed in UK IHDs, but its separate effect has not been isolated.

### Gaps
- No controlled study found that compares Sankey/flow diagrams, stacked bars, and donuts/rings for household energy comprehension.
- No study found on gauge vs bar vs numeric displays for battery state of charge.
- No EuroVis paper specific to residential energy encoding was retrieved within the search budget.

## Labeling estimates/modeled values and data freshness: effect on trust

### Takeaway
General science-communication evidence (robust, multi-experiment) shows that flagging a figure as an estimate and giving a numeric range costs little trust, while vague verbal hedges cost more. I found no energy-specific research on labeling modeled values or on data-freshness indicators.

### Cited Findings
- van der Bles et al. (PNAS, 2020; 5 experiments, n = 5,780, including a preregistered national replication and a BBC News field experiment): communicating uncertainty raised perceived uncertainty. It caused only a small decrease in trust in the numbers and in the source, mostly when uncertainty was expressed verbally ("estimated to be about"). Numeric ranges had little effect on source trust. Robust. — [CORE PDF](https://core.ac.uk/download/305110478.pdf); [ScienceDaily](https://sciencedaily.com/releases/2020/03/200323152106.htm)
- Press coverage of that study reports the best result came when a figure was flagged as an estimate and accompanied by its numeric range (secondary source). — [ZME Science](https://zmescience.com/science/uncertainty-can-be-reported-without-damaging-trust-and-we-need-that-more-than-ever)
- BIT's review of UK smart-meter trials noted that small samples and imprecise savings estimates are common across the evidence base. Supplier trial confidence intervals spanned zero (e.g., −1.29% to +2.26%). Even official estimates carry wide uncertainty that is rarely shown to consumers. — [BEIS/BIT 2019](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/829466/smart-meters-in-home-displays-impacts.pdf)

### Inferences
- Label modeled values (e.g., estimated savings, avoided CO2, values filled in during an outage) explicitly as "Estimated". Where available, use a numeric range or method note, not vague words. This should cost little trust and protect credibility if numbers later change.
- Freshness labels ("Updated 2 min ago") are a reasonable transparency practice. Note that this is inferred from general trust principles, not tested in energy apps.

### Gaps
- No energy-specific study found on how "estimated/modeled" labels or data-freshness timestamps affect trust in home-energy apps.
- No study found on how users react to silent gaps or to interpolated data after outages.

## Cross-cutting robustness summary (for the report writer)
- **Robust:** Opower normative comparisons (~2% average savings, larger for high users, persistent; Allcott 2011, Allcott & Rogers 2014); feedback meta-analysis (small, heterogeneous effects; Karlin et al. 2015); people misjudge energy quantities by ~2.8x (Attari 2010, ~500 people); numeric uncertainty costs little trust (van der Bles 2020); UK smart-meter/IHD savings of ~2.2% electricity and 1.5% gas, with a "realistic" durable 3% (ELP 2015, as cited in BEIS 2019) — [BEIS/BIT 2019](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/829466/smart-meters-in-home-displays-impacts.pdf).
- **Single or small studies:** health vs money framing (Asensio & Delmas, n = 118); chart and unit preferences (Aziz, n = 35); light-bulb-minute carbon label (Camilleri, n = 120); CO2-by-weight beating trees (CHI 2023, hypothetical choices).
- **No evidence found:** kW vs kWh comprehension; "self-powered %"; Sankey vs bars; battery gauges; estimate labels in energy apps; weather-normalization comprehension.
