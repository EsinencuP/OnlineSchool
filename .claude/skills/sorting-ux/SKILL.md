---
name: sorting-ux
description: Best-practice guidance for designing, building, auditing, or reviewing sorting UX — the "soft boundary" sibling to filtering that re-arranges options rather than reducing them. Covers when sorting matters (the 20–75-option "comfortable range"), where to place sort controls (above and repeated below the list, never hidden in a sidebar), how to label sort options in plain user-value language (avoid DESC/ASC, avoid "high-to-low" jargon), what to default to (rarely alphabetical — design a default that frames the entire list and shows category diversity in the first 10–20 items), category-specific sorting, column sorting and multi-column / priority sort in data tables and grids, faceted sorting, and how to combine sorting with filtering (keep them close or merge into a single "Sort and Filter" menu). Use this skill whenever the user is touching any control that re-orders a list — product listings, search results, dashboards, data tables, admin lists, inbox/queue views, leaderboards, CRM records, e-commerce category pages, or any "Sort by" dropdown / sort button / sort menu / column sort header. Trigger on words like sort, sorting, sort UX, sort by, sort order, sort menu, sort dropdown, sort button, "sort and filter", default sort, default order, ordering, reorder list, list ordering, ascending, descending, asc, desc, low to high, high to low, oldest to newest, newest to oldest, alphabetical, A-Z, Z-A, column sort, sortable column, sort header, sort chevron, multi-column sort, multi-sort, sort priority, secondary sort, tiebreaker sort, sort stability, faceted sorting, category-specific sort, sort label, sort options — or complaints like "users can't find a useful order", "the default sort is wrong", "alphabetical doesn't help here", "users don't know which way the sort goes", "users keep sorting the wrong column", "users miss the sort control", "users have to scroll back up to re-sort", even when none of these terms appear verbatim. Surface this skill proactively any time a screenshot, Pencil node, or component file contains a "Sort by" control, a sortable column header, or a list that has a non-obvious default order. For filter sidebars / chips / range sliders that live next to the sort control, also load `filtering-ux`. For sortable column headers inside a data table, also load `data-table-ux`.
metadata:
  tags: ux, sorting, sort-ux, sort-by, list-ordering, default-sort, column-sort, multi-column-sort, faceted-sorting, category-specific-sort, sort-labels, sort-and-filter, design-review
sources:
  - User-supplied summary "Designing Better Sorting UX" (checklist on when and how people sort, with practical UX techniques)
  - Baymard Institute, "Category-Specific Sorting: A New Way to Sort Products" (Jamie Holst, 2015) — usability research on soft vs. hard boundaries, why users prefer sorting over filtering for preference-based decisions, numeric attribute constraint, 3–5 curation rule, spec jumps, product gaps
  - Baymard Institute, "Faceted Sorting — A New Method for Sorting Search Results" (Jamie Holst, 2014) — the scope problem in search-result sorting, 3 graded solutions (scope widget / scope+sort / faceted sorting), relevance threshold, labelling format ("TVs by: Screen size" not "Sort by: Screen size")
  - Redd XF / Rozann Peter, "UX Design Patterns #6: Search, Sort and Filter Sorted" (Medium, 2020) — business rationale (time-to-find inversely proportional to purchase likelihood), over-categorisation problem with rigid category hierarchies, fluid combinable filters as the alternative
related-skills:
  - filtering-ux (filter is the hard boundary; sort is the soft boundary — these UIs usually sit next to each other)
  - data-table-ux (column sorting, sort chevrons, multi-column / priority sort)
  - search-and-content-ux (sort on search results pages)
---

## When to use

Use this skill whenever sorting is in scope. Common entry points:

- **Designing or building** — a new "Sort by" dropdown, sort buttons, "Sort and Filter" combined menu, sortable column headers, multi-column sort UI, or default-sort logic
- **Auditing or reviewing** — a screenshot, Pencil node, Figma frame, or component file containing a sort control or a list with a non-obvious order
- **Triaging complaints** — "the default order is wrong", "users can't find sorting", "users keep sorting the wrong field", "users have to scroll back up to change the sort", "alphabetical isn't useful here", "the labels are confusing (ASC/DESC, descending)"
- **Decisions** — what to default to, whether to merge sort with filter, what labels to use, where to place the control, whether to expose multi-column sort, what to do on mobile

This skill is *not* the right fit for: filter design (use `filtering-ux`), sort algorithms / server-side ranking, or relevance scoring for search (those are search-and-content-ux + backend concerns).

## How to use this skill

Two modes:

- **Design / build mode** — read the [core concept](#core-concept-filter-vs-sort--the-comfortable-range), walk the [principles](#core-principles), then run the [Do/Don't checklist](#do--dont-checklist) before declaring it done.
- **Audit / review mode** — run the [10-second scan](#quick-reference-the-10-second-design-review) against the artifact, name the gaps using the principles, and suggest the specific fix from [Pattern guidance](#pattern-guidance).

In both modes, lead with **what the user is trying to do**. Sorting is most valuable when the user doesn't have a hard constraint in mind (filter wouldn't help) or lacks the domain knowledge to know which constraint to apply. The right sort design depends on the decision the user is trying to make.

## Core concept: filter vs sort + the "comfortable range"

**Why sort UX matters for conversion.** The time a user spends searching is inversely proportional to the likelihood of a purchase — less time searching means more time browsing, which means more chances to convert. Sort and filter are the primary tools that compress search time, which makes their design disproportionately high-leverage.

Filter and sort do different jobs:

- **Filter is a hard boundary.** It *reduces* the option set. "Price under $500" eliminates everything above it.
- **Sort is a soft boundary.** It *re-arranges* the option set. Nothing is removed; the order changes the user's path through the list.

Most users don't experience them as separate features — they "swoosh-scroll", sort once, scroll again, paginate ahead, sort again. The two controls should sit close together (or merge into a single "Sort and Filter" menu) because that matches how users move.

**The "comfortable range" is where sorting earns its keep.** Sorting matters most when users face roughly **20–75 options on desktop** (fewer on mobile) — too many to scan in one glance, too few to need aggressive filtering. Below 20, sort is largely cosmetic; above ~75, sort alone can't save the user — they need filters too.

Design intuition:
- **< 20 items:** sort barely matters; default is fine
- **20–75 items (the sweet spot):** invest heavily in sort defaults, labels, and category-specific options
- **75+ items:** pair sort with filters; sort alone won't surface insight

**Avoid over-categorisation.** On sites with a large catalog, rigid category hierarchies make sense. On smaller or more focused catalogs, forcing users through fixed category pages creates unnecessary friction. Combinable, fluid filters — where users layer criteria without being locked into a single category path — are more effective when the content breadth doesn't justify a deep category tree.

## Core principles

### 1. Default sort frames the entire list

The first 10–20 items establish the user's mental model of *what's in this list and how varied it is*. If the default sort shows ten near-duplicates at the top, the user concludes "this list is monotonous" and stops scrolling. If the default sort shows ten visibly different items, the user concludes "this list is rich" and engages.

Design the default to show **the diversity of the list**, not just one extreme of it. For an apartments list, that might mean mixing price tiers in the first ten cards. For a product catalog, mixing categories. For a music app, mixing genres.

**Why it matters:** the default is the only view the median user ever sees. It's worth more design attention than any sort option.

### 2. Alphabetical is rarely the most useful default

A→Z is the lazy default — it's safe, predictable, and almost never matches user intent. Real defaults that beat alphabetical:

- **Most recent / newest** — activity logs, transactions, articles, tickets, anything time-sensitive
- **Most urgent / highest priority** — to-dos, inboxes, queues, alerts
- **Most relevant / best match** — search results
- **Lowest stock / nearest deadline** — operational lists where action is required
- **Best customer rating / most popular** — e-commerce browsing
- **Curated / editorial pick** — discovery surfaces

Reach for alphabetical only when users genuinely arrive knowing the name (a directory of states, a list of brands they already know). Otherwise, the default is a design decision, not a fallback.

### 3. Category-specific sorting is the most valuable — and most underutilized — pattern

Different categories of items invite different decisions. A site that sells laptops, cameras, and refrigerators shouldn't share one sort set across all three. Each category gets its own sorts:

- **Laptops:** Best performance · Lightest · Longest battery · Best customer rating
- **TVs:** Largest screen · Thinnest display · Best picture quality · Best value
- **Refrigerators:** Largest capacity · Most energy-efficient · Quietest

The same "feature" (sort by depth) reads differently per category — for TVs, "thinnest" is desirable; for refrigerators, "deepest" might be desirable for fit. Category-specific sort options dwarf generic ones in conversion because they match the actual decision criteria.

**Why users need soft boundaries, not just filters.** Consider a user who wants "a lightweight road bike under $2,000." The budget is a hard boundary — a price filter handles it cleanly. But "lightweight" is a *preference*, not a cutoff. If the user sets a narrow weight filter, they risk eliminating relevant bikes; if they set a broad one, they get noise. What they actually need is a sort by weight *within* the filtered list — the soft boundary lets them express a preference without committing to a cutoff they can't confidently define. Baymard's usability research identifies three reasons users prefer soft boundaries in these situations:

1. **Fear of missing out** — users don't want to accidentally exclude items that fall just outside the cutoff they set
2. **Lack of domain knowledge** — users may not know where meaningful thresholds are (e.g., what's a "light" bike in absolute terms, and what's the natural weight tier break in this catalog?)
3. **Unclear own preferences** — users are often willing to flex their criteria once they see what's available

Soft-boundary sorting lets users *discriminate* rather than *eliminate* — they can browse heavily toward a preference (lightest, largest, fastest) while still seeing everything else. Beyond preference-matching, sorting by a category-specific attribute also teaches users the domain: they can see where "spec jumps" occur (e.g., the gap between $1,800 lightweight bikes and a heavier $900 tier) and where the site has "product gaps" in its catalog. This helps both novices (who are still learning the domain) and experts (who know the domain but not the site's inventory).

**Numeric attributes only.** Category-specific sort only makes sense for numeric or ordinal attributes with a natural progression — weight, screen size, storage capacity, battery life, focal length. Non-numeric discrete attributes (color, lens mount, bike type, material) have no natural ordering and should not be implemented as sorts. A DSLR lens category can be sorted by "Focal length" or "Angle of view" but not by "Lens type" or "Camera mount."

**Curate 3–5 attributes per category** to avoid choice paralysis in the sort dropdown. The right candidates are already identified: take your most important category-specific *filters* and expose those same attributes as sort options too. The data is already structured for filtering — sort is a nearly free second use of the same investment. Add category-specific sorts alongside (not replacing) site-wide sorts like Price and Best Seller.

**How to apply:** for any category with meaningful numeric attributes, take the top 3–5 filters by importance and add them as sort options. High-traffic categories get custom sorts first; the long tail falls back to generic site-wide sorts.

### 4. Let users combine hard and soft boundaries simultaneously — and reuse filter data for sorts

A filter like "Pet-friendly" or "Has parking" can also be implemented as a sort that floats matching items to the top instead of removing the rest. This is gentler than a filter — it doesn't hide alternatives, just prioritizes — and is great for criteria where "must-have" and "nice-to-have" blend.

The deeper power comes when users can apply *both* a filter and a category-specific sort at the same time: a price filter (hard boundary: "road bikes under $2,000") combined with a sort by weight (soft boundary: "lightest first"). The filter narrows the set to what the user won't compromise on; the sort orders what remains by what the user *prefers*. This combination — hard restrictions + soft preferences — is what lets a complex real-world goal like "lightweight road bike under $2,000" resolve cleanly as a product-finding task.

**Implementation note:** category-specific filters and category-specific sorts draw from the same structured product data. If category-specific filters are already in place, adding sort is largely a reuse of existing data structures — a one-time investment that permanently multiplies the value of the filter data already collected, curated, and maintained.

### 5. Sort controls go above the list — and repeated below

Users look for sort controls **above the list, not in the sidebar.** The sidebar is filter territory; the area immediately above the list (and often the area right below the results count) is sort territory.

For long lists, **repeat the sort control at the bottom of the page** so a user who scrolled all the way down doesn't have to scroll back up to change the sort. This is a tiny detail with disproportionate impact on perceived usability.

### 6. Keep sort and filter close — or merge them

Users don't experience sort and filter as separate tasks. Two layout patterns work:

- **Side-by-side:** sort dropdown immediately next to (or just above) the filter chips or the filter sidebar toggle
- **Merged "Sort and Filter" menu:** a single button opens a sheet/dropdown with both — especially common on mobile

Don't bury sort in a settings menu, a footer, or a different tab from filter. They belong on the same horizon line.

### 7. Use user-value labels, not direction labels

The biggest avoidable mistake in sort UX is labels that describe *direction* instead of *user value*:

| Avoid | Prefer |
|---|---|
| "Ratings (high to low)" | "Best customer ratings" or "Highest rated" |
| "Price: low to high" | "Cheapest first" or "Best value" |
| "TV display depth: low to high" | "TVs by thinnest display" |
| "Date (descending)" | "Newest first" |
| "Reviews count (DESC)" | "Most reviewed" |

The user-value label tells you *what you'll see at the top*. The direction label asks you to do the math.

**If a direction label is unavoidable** (technical tables, financial data, anything where the metric is the point):
- Use **"Low to high ↑" / "High to low ↓"** with explicit arrows
- Never use DESC / ASC abbreviations
- Avoid the words "Descending" / "Ascending" — they're correct but slower to parse

### 8. Show what's currently sorted by — visibly and unambiguously

The active sort must be visible without opening any menu. Standard patterns:

- The sort label is shown on the button: `Sort: Best rated ▼` rather than `Sort ▼`
- For column sort: the sorted column has a clear chevron (↑ or ↓) and visual treatment distinct from "sortable but not active"
- For multi-column sort: each active column shows its position in the priority (1, 2, 3) alongside its direction

If users can't tell the current sort, they re-apply the one they wanted (which then becomes a no-op and feels broken).

### 9. In data tables and grids: column sort, plus combinable multi-sort

For tabular data, give every meaningful column a click-to-sort header. Beyond that:

- **Click toggles direction** (asc → desc → optionally off)
- **Shift-click adds the column as a secondary sort** (multi-column sort by priority — "first by Status, then by Date")
- **Show the priority number** next to each active sort column so the user can read the sort sentence
- **Provide a "Clear sort" action** to return to the default

See `data-table-ux` for the full data-table treatment; multi-column sort lives there as a column-sort feature.

### 10. Faceted sorting: scope first, then sort — and handle search results carefully

For very large catalogs on category pages, **faceted sorting** lets users narrow the scope before sorting takes effect. "Sort within laptops" beats "sort the entire 50,000-product catalog by price." This is a hybrid of filter + sort and is the right move when the catalog is too big for a single sort to be meaningful.

**The search-results sorting problem.** On category pages, a scope is usually already applied — the problem doesn't arise. But on *search results pages*, sorting without a scope is a common and severe usability failure. A user searches for "Plasma TV" and sorts by price. The result: TV cables, mounting brackets, and cleaning cloths — anything with those keywords that happens to be cheap — float to the top. The user's obviously relevant results are buried. This is technically correct but completely contradicts user expectations. Baymard's research found only 10% of top e-commerce sites actively address this.

**Three graded solutions, matched to your catalog type:**

**Solution 1 — Scope-first (best for mass-merchants with highly diverse catalogs):** Replace the sort dropdown with scope suggestions. Users must pick a category scope first; sorting options appear after. Amazon does this: "Choose a department to enable sorting." This works when your catalog is so diverse that sorting across all categories is almost never meaningful. Do *not* do this if 68% of your products could legitimately belong to multiple categories — users then need cross-scope sorting.

**Solution 2 — Scope + sort together (best for focused-catalog sites):** Show scope suggestions prominently inside the sort widget *alongside* the standard site-wide sort options. Users are nudged toward scoping but not blocked from sorting across categories when they genuinely need it. Right for apparel, electronics, or any site with overlapping category memberships.

**Solution 3 — Faceted sorting (best experience when a scope is clearly relevant):** Combine scope selection and sort criteria into a single action. A "Plasma TV" search surfaces suggestions like "TVs by: Lowest price" and "TVs by: Screen size" — choosing one applies the TVs scope *and* the sort simultaneously. This also enables category-specific sort types (screen size, display depth) that would never be available in an unscoped sort dropdown.

**Two implementation requirements for faceted sorting:**

1. **Relevance threshold** — only surface faceted sorting suggestions when a scope can be determined as clearly, highly relevant to the query. Use relevancy scores alongside result counts; don't surface suggestions for vaguely matching scopes. If no scope clears the threshold, show no faceted sorting suggestions at all — spurious suggestions are worse than none.

2. **Labelling** — the label must include *both* the scope and the sort attribute so the user understands that selecting this option will restrict the result set. "Sort by: Screen size" is wrong — it hides the scope change. "TVs by: Screen size" is correct — it makes clear the results will be restricted to TVs, sorted by screen size.

**When faceted sorting is most valuable:** product-type search queries ("Plasma TV", "road bike", "washing machine"), where the user hasn't committed to a specific product yet and is most likely to want to sort by product attributes within a well-defined scope.

### 11. Don't bury popular sort options

Don't hide the most-used sort options behind an icon, an "Advanced" menu, or a settings overlay. The top 2–3 sort options (the ones analytics will show are used 80% of the time) should be reachable in one click.

If you must hide *some* options to control complexity, hide the rare ones. Don't bury "Best rated" or "Cheapest first" behind a generic ⚙ icon.

## Pattern guidance

Pick the pattern that matches the surface.

### Sort dropdown (the standard pattern)

A `Sort by: [Best rated ▼]` button above the list. Clicking opens a dropdown with the sort options.

- The label of the currently-active sort appears on the button (not just the word "Sort")
- Options are ordered by usage frequency, not alphabetical
- 4–7 options is the sweet spot; more than that and users won't scan
- Group with dividers when options fall into categories (e.g., "Price" group, "Popularity" group)

### Sort buttons / chip row

When there are 2–4 dominant sort options and you want them visible at all times: render them as a row of chips/buttons above the list, with the active one visually distinguished. Best for mobile and for surfaces where speed matters more than density.

### "Sort and Filter" merged menu

A single button (often a 3-bar icon labeled "Sort & Filter") opens a sheet that contains both. Common on mobile where sidebar filters don't fit. Inside the sheet:

- Sort options at the top (a single-select list)
- Filter facets below (multi-select groups)
- Sticky "Apply" button with the live result count (see `filtering-ux`)

### Column sort (tables and grids)

- Every meaningful column header is clickable
- A chevron (↑ ↓) indicates active sort and direction; absence indicates sortable-but-not-active
- The chevron must not break the header's alignment with the column content (right-aligned number column → right-aligned chevron)
- For multi-column sort: shift-click adds a column; show a small priority number (1, 2, 3) next to each chevron

See `data-table-ux` for the full treatment.

### Faceted sort

Two distinct contexts — handle them differently.

**On a category page:** A pill or chip ("In Laptops") sets the scope. The sort dropdown's options reflect that scope's relevant sorts ("Best performance", "Lightest", "Longest battery"). Changing the scope changes the sort options — they're not a fixed list.

**On a search results page:** Sorting without a scope propels accessories and tangentially related products to the top — a documented usability failure that surprises users even though it is technically correct. Three solutions in order of sophistication:

- **Scope-first** (mass-merchants): replace the sort widget with scope suggestions; sorting is enabled after a scope is selected. Simple, but blocks legitimate cross-category sorting — only appropriate for highly diverse catalogs.
- **Scope + sort** (focused catalogs): show scope suggestions prominently inside the sort widget alongside standard site-wide options. Users are nudged but not blocked.
- **Faceted sorting** (best experience): combine scope + sort into one selectable option. "TVs by: Screen size" applies the TVs scope and sorts by screen size in a single click. Enables category-specific sort types that wouldn't exist in an unscoped dropdown.

**Labelling rule for faceted sorting:** always include both the scope and the attribute — "TVs by: Screen size", never just "Sort by: Screen size". The label must make clear that the result set will be restricted.

**Relevance gate:** only surface faceted sorting suggestions when a scope is clearly, highly relevant to the query (use relevancy scores, not just result counts). If no scope clears the threshold, show nothing — vague suggestions are worse than none.

Most valuable for **product-type queries** ("road bike", "plasma TV"), where the user hasn't committed to a specific product and most wants to browse by attributes within a well-defined scope.

### Sort repeated below a long list

Place a smaller version of the sort control at the bottom of the list (immediately above pagination / "load more"). Useful even when the top control is sticky — users sometimes scroll past the sticky behavior on tall lists. The bottom-of-list sort echoes the top; changing one updates the other.

### Mobile sort UX

- Sort lives in a bottom sheet, not a tiny dropdown
- Pair with filter in a "Sort & Filter" sheet when both apply
- The active sort is shown on the trigger button: `Sort: Newest ▼`
- One-handed reach: place the trigger near the bottom of the viewport when possible

## Anti-patterns — never do these

1. **Defaulting to alphabetical when the domain doesn't warrant it.** A→Z is the wrong default for almost every list.
2. **Labels that describe direction, not user value.** "Price: low to high" loses to "Cheapest first" every time.
3. **DESC / ASC abbreviations.** Never in user-facing UI.
4. **The word "Descending" / "Ascending" without arrows.** Even when spelled out, it's slower to parse than "Low to high ↑" / "High to low ↓".
5. **Burying the most-used sort options behind an icon or overlay.** Especially common on mobile — designers hide everything behind ⚙ "for cleanliness" and tank usage.
6. **Putting sort controls in the filter sidebar.** Users don't look there for sort.
7. **No visible indicator of the current sort.** Users have to open the menu to find out what's active.
8. **A single sort set across all categories** when items in those categories are decided by very different criteria.
9. **Sort and filter on opposite sides of the screen.** They belong together; users want both within one eye-movement.
10. **A long list with sort only at the very top.** Users who scrolled down won't scroll back up.
11. **A default that shows 10 near-duplicates** at the top of the list. The user's mental model of the whole list comes from those first 10 items — make them diverse.
12. **Multi-column sort without priority indicators.** If three columns are active, users need to see which is primary, secondary, tertiary.
13. **Category-specific sort on non-numeric attributes.** Sorting by "Color", "Lens type", or "Camera mount" has no natural progression and produces a sequence that is meaningless to users. Only sort by attributes with a numeric or ordinal ordering.
14. **Offering price/ratings sort on unscoped search results without scope guidance.** This propels accessories and tangentially related products to the top of the list. Always pair sort with scope selection on search results pages.
15. **Labelling faceted sort suggestions without the scope.** "Sort by: Screen size" hides the fact that a scope will be applied. The correct format is "TVs by: Screen size" — both scope and attribute must appear in the label.

## Do / don't checklist

Run this as the final pass on any sorting UX — design or audit.

**Do — defaults & content:**
- [ ] Default sort is chosen deliberately (newest / urgent / popular / curated — not alphabetical as fallback)
- [ ] The first 10–20 items under the default sort show the *diversity* of the list, not one extreme
- [ ] For lists with multiple categories, each category has its own sort set
- [ ] Category-specific sorts use only numeric/ordinal attributes (weight, size, capacity, focal length) — not discrete attributes (color, type, mount)
- [ ] No more than 3–5 category-specific sort options per category (to avoid choice paralysis in the dropdown)
- [ ] Category-specific sort attributes are also still available as filters — both hard and soft boundaries apply simultaneously
- [ ] Labels describe user value ("Best rated", "Cheapest first") not direction ("High to low")
- [ ] No DESC / ASC abbreviations; "Low to high ↑" / "High to low ↓" if direction is unavoidable

**Do — placement & visibility:**
- [ ] Sort control is above the list, near the results count — not in the sidebar
- [ ] The active sort is visible on the trigger button (`Sort: Best rated ▼`, not just `Sort ▼`)
- [ ] For long lists, sort is repeated near the bottom of the list
- [ ] Sort and filter are physically close — side-by-side or merged into one menu
- [ ] On mobile, sort lives in a bottom sheet (often paired with filter) and the trigger is reachable one-handed

**Do — power features:**
- [ ] Top 2–3 sort options are reachable in one click — never buried behind an icon
- [ ] For data tables: every meaningful column header is sortable; chevron + direction visible; multi-column sort via shift-click with priority numbers
- [ ] For very large catalogs, faceted sorting lets users scope the area before sorting
- [ ] On search results pages: scope guidance is offered before or alongside sort options (scope-first, scope+sort, or faceted sorting — matched to catalog type)
- [ ] Faceted sorting suggestions only surface when a scope is clearly highly relevant (relevance threshold applied, not just result count)
- [ ] Faceted sort labels include both scope and attribute ("TVs by: Screen size", not "Sort by: Screen size")
- [ ] "Clear sort" / "Reset to default" is available where users have changed the sort

**Don't:**
- [ ] Alphabetical as the default in a domain where it doesn't help
- [ ] Direction-only labels ("Price: low to high") in place of value labels ("Cheapest first")
- [ ] DESC / ASC / "Descending" / "Ascending" in user-facing copy
- [ ] Sort hidden behind a ⚙ icon, especially on mobile
- [ ] Sort in the filter sidebar
- [ ] No indication of which sort is currently active
- [ ] Sort only at the top of a long list (no bottom repeat)
- [ ] Sort and filter visually disconnected (opposite sides of the page)
- [ ] First 10 items all look the same under the default sort (monotonous-list perception)
- [ ] Multi-column sort with no priority indicators

## Quick reference: the 10-second design review

When someone drops a sort control or a sort-having list in front of you, scan in this order:

1. **What's the default sort, and does it show the list's diversity in the first 10 items?** If it's alphabetical or all-look-alike, that's the biggest fix.
2. **Do the sort labels describe user value or direction?** "Cheapest first" beats "Price: low to high"; rewrite if needed.
3. **Are there any DESC/ASC abbreviations or "Descending/Ascending" words?** Replace with arrows.
4. **Is the sort control above the list, near the results count?** Not in the sidebar.
5. **Is the currently-active sort visible on the trigger button** without opening the menu?
6. **For a list with multiple categories: does each category get its own sort set (3–5 numeric attributes)?** Generic-only is a missed opportunity; discrete attributes (color, type) are not valid sort candidates.
7. **For a long list, is sort repeated near the bottom?** Add it if missing.
8. **Are sort and filter physically close (or merged on mobile)?** Disconnected = friction.
9. **Are the top sort options reachable in one click**, not buried behind an icon?
10. **For data tables: are column headers sortable with visible chevrons; is multi-column sort surfaced if relevant?**
11. **For search results pages: does sorting without a scope produce garbage results (accessories floating to top)?** If yes, apply scope-first, scope+sort, or faceted sorting — matched to catalog type. Check that faceted sort labels read "TVs by: Screen size", not just "Sort by: Screen size".

If 9+ pass, the sort UX is in good shape. If three or more fail, it needs a rethink, not a tweak.

If filters or a data table are also in scope, load `filtering-ux` and `data-table-ux` alongside — the three skills are designed to work together as the list-view trio.
