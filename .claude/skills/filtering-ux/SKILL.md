---
name: filtering-ux
description: Best-practice guidance for designing, building, auditing, or reviewing filter UIs across three layers — the *interaction* (filter sidebars/panels, filter modals and drawers, filter chips, applied-filters bars, range sliders, multi-select groups, mobile filter sheets, sort-vs-filter, apply/auto-apply behavior), the *taxonomy* (which filter categories to expose, how to name them, what values they should contain, label clarity, jargon, hierarchy, prioritization), and the *layout* (sidebar vs horizontal filter bar, how to present values inside a category, unfiltered first-load state, visual/image filter values, e-commerce category-page layout). Use this skill whenever the user is touching any filter UI, including e-commerce category and search-results filtering, data-table column filters, dashboard filter bars, or admin/CRM list filters. Trigger on words like filter, filters, filtering, filter UX, filter sidebar, filter panel, filter modal, filter drawer, filter sheet, filter chip, applied filters, faceted search, facets, refine results, refine search, narrow results, sort and filter, multi-select filter, range slider, slider input, stepper, clear filters, clear all, apply filters, apply button, auto-apply, batch filter, interactive filter, filter category, filter value, facet name, filter label, filter taxonomy, filter layout, horizontal filter bar, filter location, first-load state, no-filter state, color swatch, image swatch, visual filter, zero results, no results, disabled filter option — or complaints like "users can't find what they want", "too many results", "filters are confusing", "filters feel slow", "filters keep snapping back", "the filter labels don't make sense", "users don't know what to click", "users keep getting empty results", "the landing page is just a wall of filters", even when none of these terms appear verbatim. Surface this skill proactively any time a screenshot, Pencil node, or component file contains a filter sidebar, modal, chip row, slider, facet list, or e-commerce category-page layout — don't wait for the user to name the pattern.
metadata:
  tags: ux, filters, faceted-search, filter-sidebar, filter-modal, filter-chips, applied-filters, sliders, multi-select, mobile-filter-sheet, sort-vs-filter, filter-taxonomy, filter-categories, filter-labels, filter-layout, horizontal-filter-bar, visual-filters, zero-results, ecommerce, design-review
sources:
  - Laura Cunha — "How to craft a kickass filtering UX" (UX Collective)
  - Kate Moran — "Defining Helpful Filter Categories and Values for Better UX" (Nielsen Norman Group, 2018)
  - Kostya Stepanov — "9 Filtering Design Best Practices to Improve E-Commerce UX" (UX Planet, 2020), drawing on Baymard Institute research
---

## When to use

Use this skill whenever filters are in scope. Common entry points:

- **Designing or building** — a new filter sidebar, modal, drawer, mobile sheet, or chip row; new range slider or multi-select group; an "Apply" button or auto-apply behavior
- **Auditing or reviewing** — a screenshot, Pencil node, Figma frame, or component file containing filters; a design-review request for an e-commerce listing, search results page, dashboard, admin list, or data table
- **Triaging complaints** — "users can't narrow down results", "the filters feel slow / janky / jumpy", "users abandon mid-filter", "filters keep collapsing", "the slider is unusable on mobile", "results don't match the filters"
- **Sort-vs-filter ambiguity** — when the user is combining sort and filter into one control, or when filters are doing the job of sort (or vice versa)

This skill is *not* the right fit for: pure visual aesthetics with no filter behavior in scope, search ranking / relevance tuning (server-side), or query parsing / advanced search syntax — for those, see `search-and-content-ux`.

## How to use this skill

Two modes. Pick the one that matches the task.

- **Design / build mode** — you are producing a filter UI. Walk the principles below in order while sketching, then run the [Do / don't checklist](#do--dont-checklist) before declaring it done.
- **Audit / review mode** — you are critiquing an existing filter UI. Run the [Do / don't checklist](#do--dont-checklist) against the artifact first, then call out *why* each gap matters using the principles, and suggest the specific pattern fix from [Pattern guidance](#pattern-guidance).

In both modes, lead with what the **user is trying to do** with the filters — narrow a huge result set fast, compare across a few attributes, or refine an already-small set. The right pattern depends on that intent, not on a generic template.

## Core principles

### 1. Filters must be domain-specific, not generic

Off-the-shelf filter lists (price, rating, brand, color) are a starting point, not a finished design. The filters that actually move conversion are the ones that match how users in *this* domain decide. A wine shop benefits from "food pairing" and "occasion"; a B2B SaaS list benefits from "team size" and "integration"; a real-estate site benefits from "commute time" and "school district".

Even within a single site, different content types need different facets — washing machines and dishwashers can't share the same filter set. Customizing per category is time-consuming but worthwhile; it's also where specialized sites out-perform generalists like Amazon.

**How to apply:** Before picking filter facets, ask what the top 3–5 decision criteria are in this domain. If you can't name them, the filter set isn't designed yet — it's defaulted. See the [Filter taxonomy](#filter-taxonomy-categories--values) section for how to pick categories and values rigorously.

### 2. Allow multiple selections within a group

Inside a single facet (e.g., "Color"), users almost always want to express "any of these," not "exactly one." Default to multi-select (checkboxes), and reserve single-select (radios) for genuinely exclusive choices like "sort order" or mutually exclusive modes.

**Why it matters:** Forcing single-select inside a facet creates "death by re-filter" — the user runs the query, sees too few results, clears the filter, picks the next option, repeats.

### 3. Plain, real-input language

Label filters with the words users say out loud, not the words in your database schema. "Under $50" beats "Price tier 1". "Ships in 2 days" beats "fulfillment_sla≤48h". Match the granularity of the user's mental model — if shoppers think in shoe sizes 7/8/9, don't show "size_code: SK_42_EU".

**Internal codes belong nowhere near a filter UI.** A pet adoption site that labels behavior as "Purple / Orange / Green" (real example) has shipped staff jargon as the user-facing taxonomy. If the underlying terms are coded, translate them — or replace them.

**When a domain term is unavoidable, explain it in place.** Some filters genuinely require expert vocabulary (laptop processor families, camera lens mounts, medication classes). For those, attach an info-icon tooltip next to the filter category label that pops a short plain-English explanation — ideally with a metaphor and a "what this means for your choice" line. Don't strip the expert filter; just make it legible to novices.

See [Filter taxonomy](#filter-taxonomy-categories--values) for the deeper guidance on label clarity.

### 4. Sliders need steppers and text inputs alongside

A bare slider is fine for casual exploration but hostile for precise targets. Always pair a range slider with explicit min/max text fields (and ideally +/− steppers for small adjustments). Users who know their target value type it; users who are browsing drag.

**Why it matters:** A user who wants "exactly $499 max" cannot reliably hit it with a thumb drag, especially on mobile. The text input is the escape hatch that prevents abandonment.

### 5. Always show what's applied (applied-filters bar / chips)

When filters are active, show them as removable chips/tags above (or near) the results. Each chip is a one-click removal for that single filter; a separate "Clear all" wipes everything. This is the single highest-leverage pattern in filter UX — it answers "why am I seeing these results?" without making the user reopen the panel.

**How to apply:** Chips go *outside* the filter panel, in the results area. They must be removable directly (an "×" on each chip). Mirror them inside the panel so the panel state stays in sync.

### 6. Filtering ≠ sorting — keep them distinct

Filtering reduces the set; sorting reorders it. Don't merge them into one dropdown ("Price low to high" alongside "Under $50"). Users reach for them at different moments and merging them hides both.

**How to apply:** Put sort as its own control (usually a dropdown near the results count). Filters get their own panel/sidebar/sheet.

### 7. Surface most-used parameters first

Order facets by how often they're used, not alphabetically and not by database column order. The top 2–3 facets should be visible without scrolling or expanding. Long-tail facets can go below or behind a "More filters" affordance.

### 8. Efficient clearing — both granular and bulk

Every filter UI needs two clearing affordances:
- **Clear all** (one click, removes every applied filter)
- **Clear one** (× on each chip, or an "X" next to each filter group)

Without "Clear all," users abandon when they want to restart. Without per-filter clear, they're forced into nuclear reset for one mistake.

### 9. Predict the next movement — don't surprise the user

After a filter input, the user's eye is already moving toward the results. Don't pull it back: don't auto-scroll the panel, don't collapse the group they just used, don't reorder the facets, don't shift the layout. The filter UI should feel like a quiet tool the user controls — not a thing that grabs the wheel.

### 10. Apply behavior depends on speed

Filter application is a spectrum from **interactive** (each input re-queries instantly) to **batch** (user picks a set, then clicks Apply). Pick by latency and intent — not by aesthetic preference.

- **Interactive / auto-apply** is the best UX *if and only if* results refresh in under ~300ms with no jank. Below that threshold, users feel the system is alive. Interactive is also better for users who don't yet know what they want — they explore the structure by picking and watching results react.
- **Batch / manual apply** is the safe default when results are slow, network-dependent, or expensive to compute. It also wins when the user has 10+ criteria in mind upfront — one wait beats fifteen. With batch, the **count of matching results must appear on the Apply button itself** — e.g., "Apply (124 results)" — so users get feedback without committing. **Batch's hidden risk:** users can assemble a combination that returns zero results and only discover it after Apply. Guard against this by either (a) live-updating the Apply count as filters change, or (b) disabling values that would zero the result set (see [Principle 11](#11-prevent-zero-result-dead-ends), below).
- **On mobile**, the Apply button must be sticky to the bottom of the sheet, with the filter content scrolling behind it. The user must never have to scroll to find Apply.

### 11. Prevent zero-result dead-ends

A user who selects a combination that returns nothing has lost — both their time and their trust that the filter knows what's in the catalog. Prevent this proactively, don't recover from it.

The pattern: for every filter value, the system knows how many results it would yield given the *currently applied* filters. Use that count to:

- **Show counts next to every value** ("Red (24)", "Blue (3)") so users see scarcity before clicking.
- **Visually disable (greyed out, non-clickable) any value whose count is 0** under the current selection. Don't hide them — disabled-with-a-zero-count is more informative than absence.
- **Recompute on every selection.** If picking "Size: 12" zeroes out three colors, those colors go disabled the moment Size: 12 is selected.

Done right, the user never sees a "No results" screen from filter combinations — the impossible combinations were never clickable. The recovery-mode empty state still matters (see [Pattern guidance](#empty--zero-results-state)) but it should fire rarely.

### 12. Design the unfiltered state — don't lead with filters

The first thing a user lands on shouldn't be a wall of filter controls and an empty results pane. They should land on *content* — featured products, top categories, promoted picks, recent activity — and reach for filters as the *second* move, when they've decided to narrow.

Think of a physical store: customers walk in and see the window display, not the price list. The salesperson "clarifies the request" after the customer has formed one. Same online: the unfiltered state is the "window display" — make it informative and inviting, not a giant form.

**How to apply:**
- On category landing pages, render a meaningful default ordering (best-sellers, new arrivals, editorial picks) above any prompt to filter.
- If the catalog is large, offer **a small set of top sub-categories or use-cases as click-tiles** ("Cameras under $500", "Mirrorless", "Lenses by mount") above the full grid, so users can navigate into a smaller world before they filter.
- Keep filters present and visible but secondary — collapsed, in the sidebar, or behind a "Filters" button — until the user reaches for them.

This principle reframes the relationship: filters refine an already-meaningful view, they don't define one from scratch.

## Filter taxonomy: categories & values

The principles above govern *how* the filter behaves. This section governs *what* it filters on and *what it's called* — the content layer that the interaction layer sits on top of. A behaviorally perfect filter UI built on the wrong taxonomy is still a bad filter.

### Categories vs. values

A clear vocabulary matters when discussing or reviewing filters:

- **Filter category** = a *property* of the items (Color, Price, Brand, Amenities, Behavior).
- **Filter value** = a specific *value or range* of that property (Red; Under $50; Nike; Swimming pool; "good with cats").

Most filter problems are either a category problem (the wrong category, or no category at all for the thing users care about) or a value problem (vague labels, hidden options, alphabetic ordering when priority order is needed).

### The four criteria for good taxonomy

#### 1. Appropriate — cover the real decision criteria

The categories your filter exposes must cover the most important aspects of what users are actually deciding between. Generic categories (Brand, Price, Rating, Color, Size, Availability) are table stakes; they don't differentiate. The categories that earn their keep are domain-specific and content-type-specific.

Different content types within one site need different categories — washing machines and dishwashers can't share a filter set. Customizing per type is expensive but it's the lever specialized sites use to beat generalists.

**Diagnostic question:** "If a critical filter were missing, would users notice and complain?" Real-user quote from a usability study, missing a size filter on a shoe site: *"They have them for color and price and brand, but not size. So that turns me off."* If the answer is yes for any plausible facet, the taxonomy is incomplete.

#### 2. Predictable — users guess right about what's inside

Given just the category label, users should be able to roughly predict the values they'll find and tell two categories apart. Predictability is especially load-bearing on mobile, where categories collapse into accordions and the label is all the user sees before tapping.

The classic anti-example is two categories that overlap or compete:

> DSW's mobile filter offered both "Item Type" and "Style" for shoes. A shopper looking for sandals tapped "Style" — it sounded more concrete — and found "Gladiator" and "Flip Flop" but no "Sandals." She gave up on the filter, ran a search, and only later discovered "Sandals" was hidden inside "Item Type." Two competing categories, neither label specific enough, no way to predict which held what.

Guidelines:
- Avoid vague meta-labels: "Item Type", "Other", "Misc", "Category" (when nested inside an already-categorized page). Prefer concrete labels: "Genre" for movies, "Material" for furniture, "Occasion" for clothing, "Cuisine" for restaurants.
- If two categories' values could plausibly belong to either, you have a hierarchy, not two categories. Collapse into one parent category with sub-values (e.g., **Style** → Sandals → Gladiator / Flip-Flop / Slide).
- Names should be precise enough that a user could finish the sentence "Inside this category I expect to find…" before opening it.

#### 3. Free of jargon — translate or explain

Three failure modes, three different fixes:

| Failure | Fix |
|---|---|
| Internal codes leaked into the UI (color-coded behavior, SKU-style values, schema names) | **Translate** to user language. Never ship internal codes. |
| Expert terms that some users need and others don't (Processor model, Lens mount, Drug class) | **Keep the filter, attach an info-icon tooltip** with a short plain-English explanation. Best Buy's "Your computer's brain… determines the complexity of the software you can run" is the model — use a metaphor + "what this means for your choice." |
| Domain language a target user actually knows (Mid-century modern, IPA, OLED) | **Keep as-is.** Don't dumb down for an audience that's already fluent. |

Decide per category, not site-wide. The same site can have plain labels for casual filters and expert labels with tooltips for power-user filters.

#### 4. Prioritized — order signals importance

Order matters because top-of-list categories get more attention. Two rules and one override:

1. **General before specific.** Broad, widely-used facets (Brand, Price, Rating, Color, Size) go at the top. Domain-specific or expert facets (Lens Mount, Maximum Aperture, BTU rating) go lower. This serves novices without hiding tools from experts.
2. **Within a category, order values to match how users reach for them.**
   - **Numerical**: low-to-high for price/distance/weight; high-to-low for ratings/popularity.
   - **Known proper nouns** (brand names): alphabetical — users scan for the one they want.
   - **Domain-meaningful sets** (grocery aisles, content genres, departments): priority order, *not* alphabetical. Alphabetizing "Produce, Meats, Dairy, Bakery" doesn't help anyone.
3. **Override:** if one specific attribute dominates the decision in this domain, promote it. Interior capacity matters more than color for a washing machine; it goes above color. *Relevance to the user is the ultimate prioritization criterion.*

### Hierarchy beats parallel categories

If you find yourself drafting two filter categories whose values could plausibly cross over, you almost certainly need one category with a hierarchy of values. Tier 1: the broad choice (Boots / Pumps / Sandals). Once selected, tier 2 reveals (Flip-Flop / Gladiator / Slide). This is how Amazon handles overlapping product taxonomies and it scales far better than competing flat categories.

### How to validate the taxonomy (research)

A filter taxonomy is a content-design problem, not a layout problem. Validate it with research, not opinion:

- **Interview or survey users** about how they think about and shop for these products. What attributes do they name unprompted? In what order?
- **Talk to salespeople and customer-service reps** — they hear the words customers actually use.
- **Mine search logs** to find the language users already type, and which attributes drive queries.
- **If a filter UI exists, read analytics**: which categories are used, which are ignored, which values are tapped vs. abandoned.
- **A/B test labels.** "Genre" vs. "Category" vs. "Type" can move usage materially. Test rather than argue.

If none of these have been done and the filter set was picked from the schema, treat the taxonomy as a draft, not a design.

## Anti-patterns — never do these

These are the recurring filter-UX mistakes. If you see any of them in a design review, call them out by name.

1. **Never freeze the UI on a single input.** A checkbox click should not lock the page while results reload. Stream results in or keep the filter panel responsive — let the user keep filtering while the previous query resolves.
2. **Never auto-scroll the user on a single input.** Don't snap the page back to the top, don't jump the filter panel to a new section, don't refocus the input. The user's eye is going where the user's eye wants to go.
3. **Never auto-collapse a filter group the user just touched** (or any group). If the user opened "Brand" and ticked three boxes, leave it open. Auto-collapse on input is the single most disorienting filter behavior.
4. **Avoid tiny scrollable panes inside the filter panel.** A 4-line scrollbox inside an already-scrollable sidebar creates nested scroll traps. Use an accordion (expand/collapse the whole group) instead of an inner scroll.
5. **Avoid layout shifts on filter input.** Width, height, ordering — none of these should change when the user ticks a box. Reserve space for "applied filter" chip rows so they don't push content down when they appear.
6. **Decouple filters and results, but never freeze the filter panel.** Results can lag (loading state) but the filter UI must stay interactive. Users will keep refining while the previous query resolves — let them.
7. **Don't ship a long filter list without search.** Anything over ~10–12 options in a single facet (brands, categories, tags) needs an in-facet search/autocomplete. Endless scrolling inside a sidebar is a dead pattern.
8. **Don't ship a bare slider.** See principle 4 — pair with text inputs and steppers.
9. **Don't merge sort into filters.** See principle 6.
10. **Don't hide the applied-filters chips behind a "View active filters" expand.** Chips must be visible by default whenever any filter is active.
11. **Don't let users click into a zero-result combination.** Filter values that would yield 0 results under the current selection must be disabled or annotated with a "(0)" count *before* the click, not surfaced as a "No results" page after the click. The "No results" page is recovery — getting there means the filter UI failed to warn.
12. **Don't open the page on a wall of filters with no content.** The unfiltered state must show actual products / items / content, not an empty grid with "Apply filters to see results." Filters refine an already-meaningful view; they don't define one from scratch.
13. **Don't truncate the *popular* filter values.** When using "Show more" to hide long facet lists, hide the long-tail values, not the ones users actually click. Run analytics or user research before deciding what to bury.

## Do / don't checklist

Run this as the final pass on any filter UI — design or audit.

**Do — interaction:**
- [ ] Multi-select is the default inside each facet
- [ ] Every slider has min/max text inputs (and ideally steppers)
- [ ] Applied filters appear as removable chips in the results area
- [ ] Sort is a separate control from filter
- [ ] "Clear all" exists and each chip / facet has its own clear
- [ ] Long facets (>~10 items) have in-facet search/autocomplete
- [ ] Apply behavior matches speed: auto-apply if <300ms, manual + result count on button otherwise
- [ ] On mobile, Apply is sticky to the bottom of the sheet
- [ ] Every filter value shows a result count, and zero-count values are disabled (not just discoverable post-click)
- [ ] Empty / zero-results state guides the user to a recovery action (relax which filter?) — but it should fire rarely because zero-counts are pre-disabled

**Do — taxonomy:**
- [ ] Filter categories are domain-specific (cover the top 3–5 decision criteria for this content type)
- [ ] Each category label is specific enough to predict its contents (no "Item Type" / "Other" / "Misc")
- [ ] No two categories overlap; overlapping values are restructured as a hierarchy
- [ ] No internal codes or schema names in labels (translate to user language)
- [ ] Expert/jargon filters carry an info-icon tooltip with a plain-English explanation
- [ ] Categories are ordered general → specific, with one override allowed if a specific attribute dominates the decision
- [ ] Values inside a category are ordered intentionally: numerical low-high (or rating high-low), alphabetical for brand-like values, priority order for domain sets — never alphabetical by default
- [ ] Labels and ordering have been validated against real user language (interviews, search logs, or test) — not picked from the schema
- [ ] Most-used facets are visible without scrolling/expanding

**Do — layout:**
- [ ] The unfiltered / first-load state shows actual content (featured products, sub-categories, editorial picks) — not an empty grid waiting on filters
- [ ] Layout choice (sidebar / horizontal bar / hybrid) matches catalog size and number of facets — not just copied from a previous project
- [ ] Each category's value-presentation pattern (all / inner-scroll / accordion / truncated) is picked deliberately by value count and importance
- [ ] When "Show more" hides values, the hidden ones are the long-tail, not the popular ones
- [ ] Where words don't carry meaning (color, shape, style, layout), filter values are rendered as image swatches or thumbnails alongside the text label

**Don't:**
- [ ] UI freezes during a filter input
- [ ] Page or panel auto-scrolls on a single input
- [ ] Filter groups auto-collapse when the user interacts with them
- [ ] Tiny nested scrollboxes inside the filter panel
- [ ] Layout shifts (chip row appearing pushes results down)
- [ ] Filter panel disabled while results are loading
- [ ] Bare slider with no numeric input
- [ ] Sort merged into the filter dropdown
- [ ] Applied-filters chips hidden behind an expand
- [ ] Zero-result combinations remain clickable (must be disabled with a "(0)" or removed from the current view)
- [ ] First load is a wall of filters and an empty results pane
- [ ] "Show more" hides the popular values instead of the long tail

## Pattern guidance

Pick the pattern that matches the scenario.

### Choose the layout: sidebar vs horizontal filter bar (desktop)

Two dominant desktop layouts, with real tradeoffs. Baymard research finds the **horizontal filter bar** above the results outperforms the left sidebar on raw efficiency — users keep their eyes in one place and scan filters and results in a single visual field. But ~80% of e-commerce sites use the left sidebar, and that ubiquity makes it the *predictable* default users look for.

| | Left sidebar | Horizontal bar above results |
|---|---|---|
| **Predictability** | High — what users expect | Lower — users may not look up |
| **Efficiency (Baymard)** | Lower | Higher |
| **Scalability** (many facets) | High — vertical space is cheap | Lower — gets crowded fast |
| **Re-filtering** (tweak after seeing results) | Easy — sidebar persists | Slightly worse — eye has to travel up |
| **Visual coupling with results** | Weaker — sidebar feels separate | Stronger — filters and results share a column |

**Choose horizontal when:** the filter set is small and stable (under ~5–6 facets), the product line is narrow, and you want maximum attention on results. Wayfair-style or Victoria's Secret-style.

**Choose sidebar when:** the filter set is large, varies by sub-category, or includes long facet lists. Most large e-commerce defaults to this for a reason — it scales.

**Hybrid:** sidebar for the long list of facets, plus a horizontal strip above results for the most-used 2–3 filters (often sort + category + price). Best of both for big catalogs.

### Desktop faceted sidebar (e-commerce, search results, admin lists)
- Left sidebar, persistent, ~240–320px wide
- Top-most facet is the most-used; below the fold, facets collapse into accordions
- Each facet shows count next to each option (e.g., "Red (124)")
- Applied-filter chips render *above the results grid*, not inside the sidebar
- Auto-apply if backend latency allows; otherwise manual Apply button at the bottom of the sidebar with `Apply (N results)`
- Sort is a dropdown above the results, not in the sidebar

### Mobile filter sheet
- Full-height bottom sheet or full-screen modal
- Filter facets are accordions, one expanded at a time (or all collapsed by default if there are many)
- "Apply (N results)" is sticky to the bottom — never scrolls out of view
- "Clear all" is sticky to the top, often paired with the close affordance
- Tapping a chip in the results returns the user to the sheet with that facet expanded

### Filter modal (complex / nested filtering)
- Use when filters have sub-options, dependent fields, or query-builder semantics (AND/OR/NOT)
- Open as a centered modal, not a sidebar — gives room for nested groups
- Preview the result count live inside the modal
- "Apply" closes the modal and applies; "Cancel" discards in-progress changes
- The modal should remember the last applied state if reopened

### Range slider (price, dates, distance, ratings)
- Slider + two numeric inputs (min, max), inline
- Optional +/− steppers for ±1 unit precision adjustments
- Show the active range as text: "$45 – $180"
- Snap to sensible buckets only if buckets match user intent (don't snap "price" — users want precise; do snap "ratings" — 1/2/3/4/5 stars)

### Presenting filter values inside a category

Four patterns for showing the values that belong to a single filter category. Pick by value count and decision importance.

| Pattern | When to use | Watch out for |
|---|---|---|
| **All values visible** | ≤ ~7 values; the whole set is decision-critical (e.g., Size for clothing) | Don't pad with rare values just to look complete — keep the list real |
| **Inner scroll (fixed-height scrollable list)** | 8–30 values where most are roughly equal in popularity | Don't nest this inside a panel that itself scrolls — nested scroll traps are a known anti-pattern (see [#4](#anti-patterns--never-do-these)). Use this only when the surrounding container is scroll-free |
| **Header-only (accordion collapsed by default)** | Mobile, or desktop with many categories — values revealed only on expand | Each header label must be specific enough to predict its contents (see [Filter taxonomy](#filter-taxonomy-categories--values)) |
| **Truncated with "Show more"** | Long-tail facets like Brand or Tag with 30+ values | Don't hide *popular* values — analytics-rank or user-research the order before deciding what's buried. The "Show more" affordance must be visually unambiguous (a "+", "Show all (N)", or arrow — not a faint chevron) |

For any pattern, **show a count next to every value** so users see scarcity before clicking ("Red (24)") — this is also the foundation for disabling zero-count values ([Principle 11](#11-prevent-zero-result-dead-ends)).

### Long facet list (brands, categories, tags)
- In-facet search input at the top of the group
- Show top ~5–8 by default (the most-used, not the alphabetically-first), then "Show all (N)" expand
- Selected items pin to the top of the list inside the facet (so the user doesn't lose them when searching)
- Multi-select with checkboxes; matched search text highlighted

### Visual filter values (image swatches, color chips, thumbnails)

For some categories, *words don't carry the meaning* — color, neckline shape, pattern, frame style, room layout, hairstyle. Show the thing, not its name.

- **Color filters** — render the actual color as a swatch, not (or in addition to) the word. "Forest Green" + a green square is fine; just "Forest Green" with no swatch makes users guess.
- **Shape / style filters** — small thumbnail icons for things like neckline, sleeve length, sofa shape, picture-frame style. AliExpress uses this well for clothing details.
- **Sample-image filters** — for room layouts, hairstyles, design styles, a tiny photo or illustration outperforms any word.

Keep the text label too: visual + text together serves both familiar and unfamiliar users, and ensures screen-reader and keyboard users get the filter. Disabled state (zero-results) applies the same way — desaturate the swatch and mute the label.

### Applied-filters chip row
- Appears above the results grid as soon as one filter is active
- Each chip: `{Facet}: {Value} ×`  (e.g., `Color: Red ×`)
- A final `Clear all` chip or button on the right
- Reserve vertical space for this row even when empty (prevents layout shift when filters activate)

### Empty / zero-results state
- Don't just say "No results" — name *which filter* is most restrictive and offer to relax it
- Show the applied filters as removable chips right in the empty state
- Offer "Clear all filters" as a primary action

## Quick reference: the 10-second design review

When someone drops a filter screenshot in front of you, scan in this order. The groups go interaction → layout → taxonomy.

**Interaction (6):**
1. **Are applied filters visible as chips?** If not, that's the biggest fix.
2. **Is there a slider with no text input?** Add the input.
3. **Is sort merged into filter?** Split them.
4. **Is there an "Apply" button without a result count?** Add the count.
5. **On mobile, is Apply sticky?** It must be.
6. **"Clear all" + per-chip "×"?** Both must exist.

**Layout (4):**
7. **Does each filter value show a count, and are zero-count values disabled?** If users can click into "No results", that's a major fix.
8. **Is the unfiltered first-load state showing content, or just an empty grid waiting on filters?** Lead with content.
9. **Long facet list with no in-facet search?** Add it. And confirm the truncated values are the long tail, not the popular ones.
10. **Where words don't carry meaning** (color, shape, style), are there image swatches alongside the labels?

**Taxonomy (4):**
11. **Any category labels that are vague or overlap** (Item Type, Misc, Other; two categories whose values could cross)? Rename or merge into a hierarchy.
12. **Any internal codes or schema names** visible in labels (color-coded behavior, SKU-ish values, snake_case)? Translate to user language.
13. **Any obvious expert jargon without a tooltip** (lens mount, processor model, drug class)? Add an info icon with a plain explanation.
14. **Sidebar vs horizontal vs hybrid** — is the layout choice intentional for this catalog size and facet count, or just copy-pasted?

If 12+ pass, the filter UI is in good shape. If four or more fail, it needs a redesign, not a patch.
