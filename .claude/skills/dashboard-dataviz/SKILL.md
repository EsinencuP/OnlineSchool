---
name: dashboard-dataviz
description: "Best-practice guidance for designing, building, auditing, or reviewing dashboards and data visualisation interfaces — covering dashboard layout, information hierarchy, chart selection, KPI cards, data density, decluttering, colour in data visualisation, interactive filters on dashboards, drill-down patterns, real-time data, dashboard personas (operational vs. analytical vs. strategic), dashboard types, sparklines, status indicators, alert design, and responsive data layouts. Use this skill whenever the user is working on any dashboard or data display — analytics dashboards, executive dashboards, operational dashboards, monitoring dashboards, product dashboards, marketing dashboards, financial dashboards, BI tools, reporting interfaces, KPI screens, metrics pages, data portals, or any screen whose primary purpose is displaying data for decision-making. Trigger on words like dashboard, dashboard design, dashboard UX, dashboard layout, data visualisation, data visualization, dataviz, data viz, chart, graph, KPI, KPI card, metric card, metric, sparkline, bar chart, line chart, pie chart, donut chart, scatter plot, heat map, treemap, funnel chart, gauge, status indicator, data density, information density, declutter, data-ink ratio, colour in charts, color in charts, axis label, legend, tooltip, drill-down, data drill, dashboard filter, dashboard interactivity, real-time dashboard, live data, analytical dashboard, operational dashboard, strategic dashboard, executive dashboard — or when a screenshot or component contains charts, graphs, or KPI summaries."
metadata:
  tags: dashboard, data visualization, dataviz, KPI, charts, analytics, BI, metrics, data display, information design, UX, reporting
sources:
  - https://dashboarddesignpatterns.github.io/ — Bach, Freeman, Abdul-Rahman, Turkay, Khan, Fan & Chen, "Dashboard Design Patterns" (IEEE VIS 2023)
  - https://dashboarddesignpatterns.github.io/patterns.html — Dashboard Design Patterns catalog: component patterns, composition patterns, screenspace, layout, colour
  - https://www.geckoboard.com/blog/9-dashboard-design-principles-see-them-in-action-with-real-examples/ — Geckoboard, "9 Dashboard Design Principles"
  - https://uxplanet.org/10-rules-for-better-dashboard-design-ef68189d734c — Taras Bakusevych (UX Planet), "10 Rules for Better Dashboard Design"
  - https://www.smashingmagazine.com/2021/11/dashboard-design-research-decluttering-data-viz/ — Smashing Magazine, "Dashboard Design Research: Decluttering Data Viz"
related-skills:
  - data-table-ux (tables frequently appear inside dashboards)
  - filtering-ux (dashboards often have filter controls)
  - sorting-ux (dashboard tables and lists need sort controls)
---

## When to use

Load this skill whenever you are:

- Designing, building, auditing, or reviewing a dashboard of any kind
- Choosing chart types, KPI card layouts, or visual representations for data
- Deciding what to include or cut from a data display
- Designing filters, drill-downs, or interactive elements on a data screen
- Evaluating whether something that looks like a dashboard is actually needed
- Working on a metrics page, reporting screen, BI tool, analytics interface, or any screen whose primary job is showing data for decision-making

---

## How to use this skill

1. Start with **dashboard type** — identify whether the dashboard is operational, analytical, or strategic. This single decision drives layout density, interactivity depth, and update frequency.
2. Apply **purpose and audience** before any layout or chart work. An unclear purpose is the root cause of most dashboard failures.
3. Use the **chart selection matrix** to pick the right visual for each data question.
4. Run the **decluttering checklist** before finalising.
5. Finish with the **30-second design review** to catch the most common mistakes.

---

## Core concept

A dashboard is a curated lens through which people view large and complex data sets at a glance. It integrates visual representations and graphical elements to abstract and simplify multiple related data points, enabling viewers to grasp the most critical information efficiently (Bach et al., IEEE VIS 2023).

The difference between a mediocre dashboard and a great one is not aesthetics — it is process. Great dashboards emerge from consistent user research, purposeful chart selection, semantically coherent colour, and iterative validation with real users (Smashing Magazine, 2021). Copying visual patterns without understanding the underlying research decisions produces "cargo cult design" — dashboards that look polished but fail to help users make decisions.

---

## Do you even need a dashboard?

Before designing anything, ask:

- **What decision will this dashboard help someone make?** If you cannot name a decision, you may only need a report or a notification.
- **Who will look at it, how often, and for how long?** A screen checked for 10 seconds on a wall display needs a radically different design from one used for 30-minute weekly analysis.
- **Is the data stable enough to be worth displaying?** Dashboards built on unreliable or poorly understood data erode trust faster than they build it.
- **Will a simpler artefact serve just as well?** A weekly email summary, a single alert threshold, or a single-number Slack notification may outperform a full dashboard.

Only proceed with dashboard design when you have affirmative answers.

---

## Core principles

### 1. Define the dashboard type first

Three fundamental dashboard personas determine almost every downstream decision:

| Type | Audience | Time horizon | Primary need |
|---|---|---|---|
| **Operational** | Frontline, managers | Real-time / hourly | Detect deviations, act fast |
| **Analytical** | Analysts, product teams | Days / weeks | Explore patterns, form hypotheses |
| **Strategic / Executive** | Leadership | Weeks / quarters | Track goals, assess direction |

Getting this wrong renders all further design effort meaningless (UX Planet). Lower-tier managers need operational dashboards; senior leadership needs strategic ones. Mixing types on a single screen confuses every audience.

### 2. Establish purpose and audience before any layout work

- Write one sentence: "This dashboard helps [person] make [decision] by showing [data]."
- Identify all viewers and their mental models — use user interviews, not assumptions.
- Card-sort exercises reveal how users naturally group information, establishing a hierarchy aligned with real mental models (Smashing Magazine).
- Five user interviews provide enormous time savings downstream (Nielsen Norman Group, via Smashing Magazine).

### 3. Only include what matters

- Include only metrics directly aligned with stated business objectives or user decisions.
- If a metric does not prompt an action or a judgment, cut it.
- Maintain separate dashboards for secondary KPIs rather than overcrowding one screen (Geckoboard — Silbo example).
- Limit to 5–7 widgets maximum; beyond that, users cannot process everything at once (UX Planet).

### 4. Use size and position to communicate priority

- The most critical metric belongs in the **top left** — the first place the eye lands in left-to-right reading cultures.
- **Larger size = higher importance.** Use this consistently; do not enlarge things for aesthetics.
- Arrange dependent information sequentially so users never have to backtrack to understand context (UX Planet — JustPark example).
- Stratified layouts (top-down ordering) explicitly encode hierarchy; use them when one section is always more critical than others.

### 5. Give every number a frame of reference

A raw number without context is almost never actionable. Always provide at least one of:

- **Comparison to a target or goal** (the number relative to what it should be)
- **Historical trend** (sparkline, 30-day line, or period-over-period delta)
- **Threshold or status band** (green / amber / red categorisation)
- **Peer comparison** (vs. industry benchmark or other cohort)

Without context, a number like "1,247 signups" tells you nothing. "1,247 signups — 12% below the 30-day average, target 1,400" tells you everything you need to act (Geckoboard).

### 6. Choose the right chart for the data question

Match chart type to the analytical question, not to aesthetics:

| Question | Recommended charts |
|---|---|
| How does A compare to B? | Bar chart, grouped bar, small multiples |
| How does a value change over time? | Line chart, area chart, column chart |
| What is the composition of a whole? | Stacked bar, stacked column, treemap — not pie unless ≤ 3 segments |
| What is the distribution of values? | Histogram, scatter plot, box plot |
| Is there a correlation between two variables? | Scatter plot, bubble chart |
| What is the status against a range? | Gauge / progress bar — sparingly |

Never use:
- **3D charts** — the third dimension distorts perception without adding information
- **Pie charts with more than 3–4 segments** — humans cannot accurately compare arc sizes
- **Gauges for non-range data** — they waste space and imply a scale that may not exist
- **Line graphs with more than 5 series** — they become unreadable; use small multiples instead
- **Bar charts with more than 7 categories** — group or filter instead (UX Planet)

### 7. Design a coherent colour strategy

Colour is a data encoding channel — every colour decision must be intentional:

- **Two-to-three colour palette** for most dashboards; three maximum chart type variety (Geckoboard, Smashing Magazine)
- Use the **6:3:1 golden ratio**: ~60% dominant/neutral, ~30% secondary, ~10% accent (Smashing Magazine)
- **Monochromatic palettes** (single hue, varying intensity) work well for single-category data
- **Diverging palettes** (two-hue spectrums from a neutral midpoint) effectively show opposing values or above/below-zero comparisons
- **Semantic colour** — red/green carries strong connotations (failure/success). Use this intentionally for status indicators; avoid it for neutral comparisons where it misleads
- **Data encoding colour**: when colour represents a category or scale across widgets, keep it consistent throughout the entire dashboard — never reuse the same colour for a different meaning (Dashboard Design Patterns — Shared vs. Distinct colour patterns)
- **Emotive colour** (aesthetic warmth/coolness) is a valid tool but is always secondary to semantic and data-encoding needs

Red-green combinations trigger unintended pass/fail judgments. If your data comparison is neutral, choose a palette that does not imply evaluation (Smashing Magazine).

### 8. Declutter ruthlessly

Simplicity is not always the goal — complexity serves expert users. But visual noise harms everyone. The standard declutter checklist:

- Remove all chartjunk: unnecessary gridlines, background fills, 3D effects, decorative icons
- Remove duplicate axis labels where a title makes them redundant
- Remove legends when direct labels on the chart suffice
- Ensure every element has clear information hierarchy
- Use white space generously — double your default margins (UX Planet: 12px → 24px)
- Use modal/panel/hover-state patterns to hide detail until requested rather than displaying everything simultaneously (Smashing Magazine)

Caveat: test decluttering with real users. Over-simplification for expert users creates friction — what looks clean to a designer may feel information-starved to a data analyst.

### 9. Label clearly and consistently

- Use the naming conventions and abbreviations your audience already uses ("CTR" is correct for a marketing team; "Click-through Rate" wastes space and feels patronising — Geckoboard)
- Apply consistent date formats throughout — ISO 8601 (YYYY-MM-DD) or your organisation's standard, never a mix
- Consistent naming conventions across the entire dashboard provide data consistency and allow users to read at a glance (UX Planet)
- Every chart needs a clear, descriptive title — not "Chart 1" or "Sales", but "Monthly Revenue vs. Target, Jan–Dec 2026"
- Include data source and last-updated timestamp on any dashboard where data freshness matters — especially operational dashboards

### 10. Round numbers appropriately

Display the precision users actually need:

- KPI cards should show rounded values: "1.2M" not "1,247,382"
- Ultra-precision "isn't necessary and may exaggerate minor changes" — a 0.003% shift is usually noise, not signal (Geckoboard)
- Use consistent decimal places within a single metric across time periods — mixing "1.2" and "1.24" implies different levels of certainty
- Reserve full precision for data tables where users are performing their own calculations

### 11. Structure individual cards/widgets consistently

Every card or widget should follow the same internal layout convention:

- Title: top-left
- Controls / time-range selector: top-right
- Primary content: below header
- Secondary context (trend, comparison): below primary value

This consistency means users always know where to look for what. It also supports responsive design and future scalability (UX Planet).

### 12. Design for screenspace — choose a composition strategy

Dashboard Design Patterns (Bach et al., 2023) identifies five screenspace management strategies:

| Strategy | When to use |
|---|---|
| **Screenfit** | Operational dashboards, wall displays, TV dashboards — everything visible at once without interaction |
| **Overflow** | Analytical dashboards where completeness matters more than at-a-glance reading |
| **Detail-on-demand** | Any type — hide detail in tooltips, modals, or slide-outs to keep primary view clean |
| **Parameterized** | Dashboards with heavy filtering — users control what is shown via controls |
| **Multiple pages** | Strategic dashboards with clearly distinct sections (Overview → Department → Individual) |

Screenfit is the gold standard for operational and executive dashboards. Overflow is acceptable only when users expect to scroll.

### 13. Group connected metrics

Organise related metrics into clearly labelled groups — by business function, user journey stage, or data source. Visual grouping (proximity, dividers, background shading) should mirror the logical grouping. Users should be able to navigate to the section they need without reading every element (Geckoboard — Wordstream example).

### 14. Build interactivity purposefully

Interactions are powerful but add cognitive and interaction cost:

- **Filter and focus** (date ranges, segments, dimensions) — the most valuable interaction; always make the active filter state visible
- **Drill-down / hierarchical navigation** — use for strategic/analytical dashboards where users need to move from summary to detail; use breadcrumbs to show where they are in the hierarchy
- **Exploration** (brushing and linking, detail-on-demand tooltips) — valuable for analytical dashboards; expensive for operational ones
- **Personalization** — system-driven, role-appropriate defaults are more valuable than user-driven manual customisation; offer customisation as a supplement, not a substitute (UX Planet)

Do not hide critical information behind interactions. Content below the fold gets minimal attention. Maximum 5–7 widgets before requiring interaction to see more (UX Planet).

### 15. Design the dashboard last

Complete other application pages first. A dashboard is a summary view of everything else in the system. Designing it last provides the complete set of components, prevents constant rework, and ensures the dashboard accurately reflects the full system (UX Planet).

---

## Pattern guidance

### KPI card anatomy

A KPI card is the atomic unit of most dashboards. A well-formed KPI card contains:

1. **Metric name** — short, clear, consistent with the rest of the system
2. **Primary value** — large, prominent, correctly rounded
3. **Unit** — currency symbol, %, count suffix (never omit)
4. **Comparison delta** — period-over-period change with direction indicator (arrow or colour)
5. **Trend sparkline** — mini line chart showing the last N periods at a glance
6. **Status indicator** — optional; only when there is a meaningful threshold (on-track / at-risk / off-track)

Do not add more than one comparison. "vs. last month", "vs. last year", "vs. target", and "vs. industry average" on the same card is overwhelming.

### Sparklines

Sparklines are minimal, concise trend visualisations — no axes, no labels, no titles. They encode trend direction and volatility at a glance. Use them:
- Inside KPI cards to show historical trend without requiring a full chart
- In data tables to show per-row trends
- Never as a standalone chart — they lack the precision for detailed analysis

### Status indicators and alert design

Status indicators (traffic lights, coloured badges, threshold markers) are the fastest-reading element on a dashboard. Rules:
- Use consistently defined thresholds — document what red/amber/green means
- Never use colour as the only indicator — add an icon or text label for accessibility (colour-blind users)
- For real-time/operational dashboards, indicate data staleness: if data has not refreshed within expected intervals, surface a warning, not stale numbers presented as current

### Hierarchy patterns (Dashboard Design Patterns)

- **Single page**: all information in one view — best for screenfit operational dashboards
- **Hierarchical pages**: overview → department → individual; best for executive dashboards supporting drill-down
- **Parallel pages**: equal-level pages representing distinct facets (e.g., Sales / Marketing / Support); best for cross-functional dashboards
- **Semantic pages**: relationships determined by information meaning (e.g., a geographic schematic layout)

### Layout patterns

- **Stratified layout**: top-down ordering; most important section at top — the default for most dashboards
- **Grouped layout**: visible groupings via dividers or background shading — use when multiple independent topics appear on one page
- **Table layout**: aligned columns and rows with repeated encoding — use for operational dashboards tracking many uniform items
- **Schematic layout**: widget placement informed by an external property (e.g., a map or process flow diagram) — use for geographic or process dashboards

---

## Anti-patterns — never do these

1. **Dashboard without a defined purpose** — building before you can answer "what decision does this enable?"
2. **Metric overload** — more than 5–7 widgets on a screenfit dashboard; too many KPI cards that all feel equally important
3. **Chartjunk** — 3D effects, excessive gridlines, decorative shadows, gradient fills that serve no data purpose
4. **Inconsistent colour meaning** — using the same colour for different metrics, or different colours for the same metric across widgets
5. **Context-free numbers** — displaying raw values with no comparison, trend, or threshold
6. **Hiding critical data below the fold** — forcing users to scroll or click to see the most important information
7. **Pie chart abuse** — using pie charts with more than 3–4 segments, or where bar charts would communicate more clearly
8. **Gauge overuse** — gauge charts consume enormous space to convey a single number; replace with a KPI card + sparkline in almost every case
9. **Excessive precision** — showing 1,247,382 when "1.2M" is what the decision requires
10. **Cargo cult design** — copying the visual style of a well-known dashboard without understanding the research and decisions behind it
11. **Designing the dashboard first** — before the rest of the system is defined, this guarantees constant rework
12. **Skipping user research** — assuming you know what users need; at minimum, 5 user interviews before designing

---

## Do / don't checklist

### Purpose and audience
- [ ] Dashboard type is explicitly identified (operational / analytical / strategic)
- [ ] One-sentence purpose statement written and agreed with stakeholders
- [ ] Audience defined; their role, frequency of use, and decision context are documented
- [ ] User research conducted (interviews, card sort, or usability testing)

### Content
- [ ] Every metric on the dashboard maps to a specific decision or action
- [ ] Secondary / supporting KPIs are on a separate dashboard or behind drill-down
- [ ] Maximum 5–7 primary widgets on a screenfit view
- [ ] Every number has a frame of reference (target, trend, comparison, threshold)
- [ ] Numbers are appropriately rounded for the audience

### Charts
- [ ] Chart type matches the data question (comparison / change over time / distribution / relationship / composition)
- [ ] No 3D charts
- [ ] No pie charts with more than 3–4 slices
- [ ] Line charts have 5 or fewer series
- [ ] Bar charts have 7 or fewer categories
- [ ] Every chart has a clear, descriptive title
- [ ] Axes are labelled with units; labels are not duplicated unnecessarily

### Colour
- [ ] 2–3 colour palette maximum
- [ ] Colour meaning is consistent across all widgets
- [ ] Semantic colours (red/green) are used intentionally, not arbitrarily
- [ ] Status indicators use both colour AND an additional cue (icon/text) for accessibility
- [ ] No red-green encoding for neutral comparisons

### Layout and structure
- [ ] Most important metric is top-left and largest
- [ ] Related metrics are visually grouped
- [ ] Widget internal structure is consistent (title top-left, controls top-right)
- [ ] White space is generous (doubled default margins)
- [ ] All critical information is visible without scrolling (screenfit dashboards)

### Interactivity
- [ ] Active filter state is always visible
- [ ] Drill-down path is navigable with breadcrumbs
- [ ] Tooltips do not hide information required for the primary decision
- [ ] Personalisation provides intelligent defaults; customisation supplements it

### Labels and metadata
- [ ] Naming conventions match audience vocabulary
- [ ] Date formats are consistent throughout
- [ ] Data source is credited
- [ ] Last-updated timestamp is shown wherever data freshness matters

---

## Quick reference: the 30-second design review

Run through these six questions on any dashboard before presenting it:

1. **Can I state the purpose in one sentence?** If not, the scope is unclear.
2. **Does the most important metric appear first (top-left, largest)?** Visual hierarchy must reflect information hierarchy.
3. **Does every number have context?** Look for any standalone raw number — add a comparison, trend, or threshold.
4. **Is any chart type wrong for its data question?** Spot-check each chart against the selection matrix.
5. **Does colour mean the same thing throughout?** Scan for the same colour used for different things, or different colours for the same thing.
6. **Is any critical information hidden below the fold or behind an interaction?** If yes, promote it or rethink the layout.

All six should be "yes" (or "not applicable") before the dashboard ships.
