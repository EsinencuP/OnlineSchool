---
name: data-table-ux
description: Best-practice guidance for designing, building, auditing, or reviewing data tables and table-heavy interfaces — the full stack from process (user research, feature tree, framework constraints, atomic design from cell up) through layout (column and row alignment, tabular typography, row division styles, vertical alignment, display density, sticky headers and frozen columns, column management, "too many columns" problem, row details views, scroll behavior, container placement, mobile fallback to cards) through interaction (inline cell editing, multi-select and bulk actions, hover-revealed actions, sorting, toolbar command-state rules, input validation and auto-format, numeric precision and true-vs-display) through accessibility (WCAG 2.0 conformance, color-not-sole-channel, touch targets, font scaling, screen-reader title/summary, keyboard navigation). Use this skill whenever the user is touching a data table, list view, grid, spreadsheet-like UI, admin table, CRM contacts table, dashboard table, transactions list, inventory table, user-management table, log viewer, or any tabular display of records — including tables embedded inside dashboards, popup dialogs, or autonomous cards. Trigger on words like data table, table UX, table design, table layout, table column, table row, table header, sticky header, frozen column, freeze column, pinned column, column resize, column reorder, column hide, hide column, show columns, column management, row density, table density, condensed / regular / relaxed, zebra stripes, alternating rows, row divider, row stripe, inline editing, cell editing, row hover, row click, expandable row, row expand, row details, drawer, side panel, quick view, bulk actions, multi-select, select all, row checkbox, table sort, sort chevron, column header sort, tabular numbers, monospace numbers, right-align numbers, align text, tabular layout, admin table, CRM table, list view, grid view, spreadsheet UI, transactions table, logs table, records table, enterprise table, decimal precision, number format, thousand separator, input validation, validation rules, error message, auto-format, command states, toolbar states, table in dialog, popup table, mobile table, responsive table, table to cards, WCAG, table accessibility, keyboard navigation, screen reader table — or complaints like "the table feels cluttered", "users can't find columns", "scrolling feels jerky", "users lose context when scrolling", "the table is overwhelming", "edits are hard", "users can't tell which row they're acting on", "the table doesn't fit", "the table breaks on mobile", "errors aren't clear", "users keep entering the wrong format", even when none of these terms appear verbatim. Surface this skill proactively any time a screenshot, Pencil node, or component file contains a data table or grid layout — don't wait for the user to name the pattern. For filter sidebars / chips / range sliders that *belong to* a table, also load `filtering-ux`.
metadata:
  tags: ux, data-table, table-design, enterprise-ux, admin-ui, crm, dashboard, alignment, tabular-typography, row-density, sticky-header, frozen-column, column-management, row-details, inline-editing, multi-select, bulk-actions, sorting, list-view, grid-view, accessibility, wcag, input-validation, numeric-precision, design-review
sources:
  - Fanny Vassilatos and Ceara Crawshaw — "Data Table Design UX Patterns" (Pencil & Paper, 2023)
  - Slava Shestopalov — "How To Architect A Complex Web Table" (Smashing Magazine, 2019)
  - Andrew Coyle — "Design Better Data Tables" (Medium, 2017)
related-skills:
  - filtering-ux (for filter sidebars, chips, sliders that belong to a table)
  - search-and-content-ux (for in-table search highlighting and command-search patterns)
---

## When to use

Use this skill whenever a data table is in scope. Common entry points:

- **Designing or building** — a new admin list, CRM contacts table, transactions table, inventory grid, user-management table, dashboard table, log viewer, or any records UI
- **Auditing or reviewing** — a screenshot, Pencil node, Figma frame, or component file containing a tabular layout
- **Triaging complaints** — "the table feels cluttered / cold / overwhelming", "users miss columns", "scrolling is jerky", "users lose context", "edits feel awkward", "users can't tell which row their action applies to", "the table doesn't fit and users hate horizontal scroll"
- **Decisions** — sticky header vs not, frozen column or not, inline cell editing vs row drawer, zebra vs line dividers, density default, what to do when the table has 30+ columns

This skill is *not* the right fit for: filter-panel design (use `filtering-ux`), pagination strategy (separate concern), or pure visual styling with no information-architecture angle.

## How to use this skill

Two modes:

- **Design / build mode** — answer the [scoping questions](#scope-the-table-first) first, then walk the [core principles](#core-principles) while sketching, and run the [Do / don't checklist](#do--dont-checklist) before declaring it done.
- **Audit / review mode** — run the [10-second scan](#quick-reference-the-10-second-design-review) against the artifact, then call out *why* each gap matters using the principles, and suggest the specific pattern fix from [Pattern guidance](#pattern-guidance).

In both modes, lead with **what the user is trying to do with the table**. The right design depends on whether the table is for scanning/comparing, taking action, or both.

## Scope the table first

Before any layout decision, answer these six questions. They eliminate most of the open variables.

1. **What kind of data lives in the cells?** Short numerical strings (dates, amounts, statuses) behave very differently from paragraphs of text, links, attachments, and rich content.
2. **What is the user's primary intent?** Scan and compare to *derive insights*? Or take *action* — edit, update statuses, assign people, run bulk operations?
3. **What devices?** Desktop monitor, laptop, tablet, mobile? The interaction surface varies enormously.
4. **Read-only or actionable?** Is this a report that's only consulted, or do users modify the data?
5. **Should the user be able to customize the view?** Sort, filter, search, density, column visibility, column order, frozen columns? Each one adds power and complexity.
6. **What's failing today (if anything exists)?** Audit the current state before redesigning — the gap between intent and reality is often where the answer hides.

Knowing the answers, you can pick a **table mode**:

| Mode | Description | Typical patterns |
|---|---|---|
| **Info-oriented** | Read-only consultation: reports, dashboards, analytics. Users scan and compare. | Dense rows, strong typography, light interactivity, sticky headers, sort, optional column visibility |
| **Action-oriented** | Users edit values, change statuses, assign people, run operations. | Inline editing, hover-revealed row actions, multi-select + bulk actions toolbar, row drawer for details |
| **Action & info (super-user)** | Power users doing both: enterprise admin, ops consoles. Maximum complexity. | All of the above, plus column management, density toggle, saved views, state preservation, fullscreen mode |

## Design process: needs → atomic → interaction

A complex table is one of the highest-cost components in an enterprise UI to redesign once it ships. Follow the process in order — skipping straight to wireframes is the path to endless re-drawing.

### Step 1 — Translate user observations into design questions

User interviews surface *needs*, but those needs don't tell you what to design. The translation step is to convert each observation into a design question (or several). Examples:

| Observation | Design question |
|---|---|
| "I need to operate on dozens of items at a time" | Cell multi-select? Row multi-select with checkboxes? Bulk action toolbar? |
| "We do all our calculations in Excel today" | What Excel behaviors must we match (keyboard navigation, fill-down, formula bar)? What can we deliberately not match? |
| "I need to know if this name is already on the server" | On-the-fly validation as the user types? Server-check on blur? Visible error or silent auto-correct? |
| "I usually enter the same kind of info" | Templates, default values, recent-value suggestions? |
| User never touches the mouse | All actions must be keyboard-reachable; design shortcuts beyond Cmd-C / Cmd-V |

Ask follow-up questions to separate *real needs* from passing wishes: *"What helps you work faster? What would change if you couldn't do X?"* — features that survive that question are the ones to build.

### Step 2 — Validate against frontend framework constraints early

Pick the table library / framework *before* finalizing the design, or at least sketch the design against the library you've chosen. Real example: a team designed a beautiful expandable-row interaction, only to discover ag-Grid (the chosen lib) didn't support nested child rows. Catching this at the mockup stage costs hours; catching it post-implementation costs weeks.

Practical checks against the library:
- Sorting, filtering, multi-select — supported?
- Frozen columns — leftmost, rightmost, both?
- Row expansion / nested rows / grouping?
- Virtualization for large row counts?
- Custom cell renderers?

### Step 3 — Build the feature tree

Before drawing any pixels, draw a tree: at the root is the table; branches are cells, rows, columns, top bar, keyboard shortcuts, error handling; leaves are the specific behaviors and states. The tree is a planning artifact that:

- Prevents extra work (you see all the states and types of cell *before* committing to a layout)
- Acts as a contract with engineering (they can match it against the library)
- Surfaces conflicts early (a feature that needs nested rows in a library that doesn't support them)

### Step 4 — Go atomic: cells → molecules → rows → table

Design the smallest pieces first, then assemble.

- **Atoms** — colors, fonts, icons, spacing tokens. Often inherited from the design system. Check that the palette covers warning / error / destructive / active / selected states for tables specifically.
- **Molecules — cell types.** Catalogue every cell type you need: text, numeric, dropdown, date picker, status badge, in-row commands, mixed read-only + editable. For each, design every state: default, hover, active, focused, disabled, error, read-only.
- **Cell accessories** — tooltips, input hints, error messages, placeholders, validation icons. Design these alongside the cell, not as an afterthought.
- **Rows** — combinations of cells. Test whether mixed read-only + editable rows work visually (different cursors, different hover hints).
- **Headers** — design for long titles, multi-line titles, and localized titles. English fits in one line; German or Hungarian often won't. Plan for two- and three-line headers from the start.
- **Top bar / toolbar** — title + commands (icon + text). Plan icon-only vs labeled, with disabled states per command.
- **Whole table** — assemble several variants (read-only, search-and-select, editable) to spot inconsistencies.

### Step 5 — Define the interaction logic

The visuals are only half of the table. The other half is *rules* that aren't in the mockup:

- **Numeric precision rules** (see [Principle 11](#11-numeric-precision-is-a-domain-decision))
- **Input validation rules** — what's valid, what's not, what the error says, whether to auto-correct (see [Pattern: input validation](#input-validation-and-auto-format))
- **Toolbar command states** — for each command, the conditions under which it's enabled vs disabled (see [Pattern: toolbar command states](#toolbar-command-state-rules))
- **Command results** — what happens when "Move up" is clicked with two non-adjacent rows selected? Define ahead of time, document in a flowchart or table.

Document these in writing or a flowchart — they won't fit in a mockup.

### Apply Occam's razor to features

Throughout the process, cut features that exist for hypothetical-future or one-in-a-hundred cases. The cost of an unused feature isn't zero — it's clutter, maintenance, and cognitive load for everyone who isn't in the one-in-a-hundred case. If a feature can't survive the question *"What changes if users can't do this?"*, it doesn't ship.

## Core principles

### 1. Align by data type — never by aesthetic preference

- **Text columns: left-align.** Western reading is left-to-right; respect it.
- **Quantitative numbers: right-align.** Amounts, percentages, measures — align by the decimal so users can compare magnitudes at a glance ($1,111.11 should not look smaller than $999.99).
- **Qualitative numbers can be left-aligned.** Dates, ZIP/postal codes, phone numbers — these are number-shaped but read like text. Use judgment; in the first column especially, left-align often looks better.
- **Headings match their column.** A right-aligned number column gets a right-aligned heading. Mismatching creates dead whitespace and visual noise.
- **Never use center-align in a data table.** Center alignment makes the eye jump between rows and prevents quick scanning for irregularities. There is no good reason to center cell content in a data table.

### 2. Use tabular (monospaced-digit) typography for numbers

Use a font with tabular figures for any column of numerical values. Tabular numbers have equal-width digits, so $1,111.11 and $999.99 occupy the same horizontal space and align by column. Most modern type systems expose `font-variant-numeric: tabular-nums;` — turn it on for number columns. Without this, the slimmer "1"s cause visual fishtailing that defeats the right-alignment.

### 3. Choose one row division style — and only one

The four options, with their tradeoffs:

| Style | Best for | Watch out for |
|---|---|---|
| **Line divisions** (thin light-grey horizontal rule between rows) | Most interactive tables. Safe default. | Border must be light enough to "melt into" the background — heavy borders are noise |
| **Zebra stripes** (alternating row backgrounds) | Static or read-only tables with no row states | Conflicts with hover / selected / disabled / focused row states — you end up with 4–5 shades of grey competing for meaning. Largely outdated for interactive tables |
| **Card approach** (each row is a tinted card, no borders) | Apps that already have a subtle background tint | Adds visual weight; not great for very dense tables |
| **Free form** (no separators at all) | Low-density tables, short rows, sparse data | Falls apart with 20+ rows or dense content |

Don't combine styles — pick one and commit.

### 4. Vertical alignment depends on row-height variance

- **Center-align vertically** when row heights vary only slightly (up to ~3 lines). Centering distributes whitespace evenly and eases scanning.
- **Top-align** when row heights vary more (multi-line cells, paragraph content). Bottom-alignment hides content behind the viewport edge and creates jerky scrolling.

A multi-line cell that sticks to the bottom of its row will get clipped or require row-scroll, both of which feel broken. Top is always the safer multi-line default.

### 5. Sticky headers, frozen columns — for context preservation

A user scrolling down row 200 needs to know what each column is. A user scrolling right past column 12 needs to know which row they're on.

- **Sticky header row** — non-negotiable for tables longer than the viewport. Includes any control panel / toolbar.
- **Frozen leftmost column** — when horizontal scroll is possible. Often the identifying column (name, ID, line item).
- **Frozen rightmost column** — sometimes the right side too, if it holds totals or per-row actions.
- **Multiple frozen columns** — advanced power-user feature. Let users pin several columns simultaneously to anchor on multiple identifiers when comparing data across many far-right columns. Implement only if comparison is a core use case.
- **For row-action toolbars** that appear only when rows are selected: stick them to the bottom of the viewport, not inside the table. Keeps context for the user.

Without these, scrolling becomes a memory test. With them, the table feels anchored.

### 6. Density is a setting, not a guess

Different users on different screens want different densities. Provide a density toggle (icon switcher outside the table is fine) with three tiers:

- **Condensed:** ~40px row height — power users on small screens, comparing lots of rows
- **Regular:** ~48px — default
- **Relaxed:** ~56px — desktop monitors, less-frequent use, complex cell content

Persist the user's choice (see Principle 9).

### 7. Hover discoverability — reveal actions where and when they're needed

Tables are dense; cramming a button into every cell creates visual noise. Instead, reveal interactions on hover:

- **Whole-row hover with a subtle highlight** hints that the row is clickable (often opens a details view)
- **Checkbox-on-hover** in the leftmost cell hints that rows are selectable for bulk actions
- **3-dot menu on hover** in the rightmost cell hints at per-row actions
- **Text-cursor on cell hover** hints that the cell is inline-editable

The principle: *afford*, don't *clutter*. The action exists; it appears when the user signals interest. The cost is discoverability — power users learn this fast, but novices may miss it, so keep at least one obvious affordance per intent (e.g., a visible "Edit" button somewhere) until the user is fluent.

### 8. Sort is table stakes; filter is a table feature

Every column header should be sortable unless it's actively meaningless to sort (e.g., a checkbox column or an actions column).

- **Click the header to sort**, with a chevron indicator showing direction.
- **The chevron must not break heading alignment relative to the column.** A right-aligned number heading keeps its right-alignment with the chevron tucked in.
- **Default sort matters.** Most-recent-first is right for activity logs, transactions, and timelines. Most-urgent-first is right for to-dos or alerts. Lowest-stock-first is right for inventory. Don't default to alphabetical-by-id unless that's actually what users want.
- **Typical sort modes:** A→Z / Z→A; newest→oldest / oldest→newest; largest→smallest / smallest→largest.

For filtering inside a table (column filters, applied-filter chips above the table, filter sidebars), use the `filtering-ux` skill alongside this one — they're peers.

### 9. Preserve state, and always allow reset

If users invest in customizing their view (column order, hidden columns, density, sort, filters), losing that on refresh feels like the system erased their work.

- **Preserve view state** at minimum across the browser session; ideally per-user-account across logins.
- **Always provide "Reset to default"** as a prominent action. The safety net is what gives users courage to customize in the first place — they need to know they can't permanently break it.

### 10. Default state beats endless controls

When facing a "too many columns" problem, the first instinct is to add column-management controls. The better first move is to **pick a great default**. Which 6–8 columns matter most at first glance? Show those, hide the rest behind a "Manage columns" control.

Involve users — especially power users — in choosing the default. The default state is the one 90% of users will see; it's worth more design attention than any setting.

### 11. Numeric precision is a domain decision

Decide decimal precision and number-format conventions per data type, not per column. Document the rules in the design spec. Examples from real domains:

| Quantity type | Decimals | Thousand separator |
|---|---|---|
| Money | 2 | comma (`$16,408,989.00`) |
| Length, weight | 2 | space (`403 456.56 m`) |
| Engineering measures (e.g., diameter) | 3 | none (`10.375 cm`) |
| Coordinates (lat/lng) | 8 | none, signed for hemispheres (`-78.05640132`) |
| Default | 2 | locale-appropriate |

These are illustrative — set the rules for *your* domain after talking to users.

**True-data vs display-data: the focus-to-reveal pattern.** Servers may store extremely precise values (calculation engines, sensor data, financial intermediate values). Users almost never need to see all of them all the time. Show the *rounded* approximation in the static cell; reveal the *full precision* only when the cell is focused/active. On blur, snap back to the rounded display.

Example flow: user enters `134432.97662301`, presses Enter, cell shows `134 432.98`. User clicks the cell again, full `134432.97662301` reappears for editing.

This pattern earns trust (engineers know the precision isn't being lost) without overwhelming everyone with digits that don't matter for scanning.

## Pattern guidance

### Column management — the four levers

When users need control over what they see across columns:

| Lever | When to provide | Note |
|---|---|---|
| **Freeze** (sticky column) | Tables with horizontal scroll | Leftmost is the most common; rightmost too if it holds totals or actions |
| **Reorder** (drag to rearrange) | Power-user tables, action-oriented mode | Often paired with column hiding in a popover; cheap to skip in info-only tables |
| **Hide / show** | Tables with 8+ columns | A "Manage columns" or "Columns shown" dropdown — usually a multi-select with checkboxes |
| **Resize** (drag column edge) | Editable tables with variable-width content | Ideal: don't need it because spacing is right. Show a drag handle on header hover |

For all of these: **persist the user's choices and always offer "Reset to default"**.

### The "too many columns" problem — solving it in order

When users complain about a too-wide table, try these in order before adding more controls:

1. **Improve the default state.** Which columns truly matter at first glance? Hide the rest by default. This is the highest-leverage move.
2. **Resize and tighten** what's left so columns fit better.
3. **Freeze the leftmost column** and accept some horizontal scroll for the rest.
4. **Add column hide/show controls** so users can build their own view.
5. **Last resort: redesign.** If a table genuinely needs 30 columns visible, it may not be a table — it may be a record-detail view with multiple sub-views.

### Row details — six patterns

Showing more about a row than fits in the cells. Pick by how much extra information there is, how often users need it, and how disruptive the reveal can be.

| Pattern | When to use | Cost |
|---|---|---|
| **Inline row expansion** (row grows, content appears below) | Moderate extra detail, users want it for several rows in sequence | Higher dev cost; great UX — full context retained |
| **Tooltip** (hover-triggered preview) | "Sneak peek" of a few extra fields, desktop only | Low cost; not usable on touch |
| **Modal / overlay** | Detail-heavy view, user is going to focus on one row at a time | Easy to build; breaks table context |
| **Quick-view sidebar / drawer** | Lots of additional content, possibly tabbed | Scalable; keeps the table visible alongside |
| **Master-detail layout** ("Row-to-details" — table collapses to a list on the left, detail panel on the right) | Users need to step through many rows in sequence (triage queues, inbox-style review, code review) | Reuses existing table real estate; the list stays scrollable while the detail fills the rest |
| **Fullscreen mode** | Dense, immersive viewing of a single record | Most disruptive; right for deep analysis sessions |

Trigger from a whole-row click, a 3-dot menu, or a "View more" link — be consistent. Whichever pattern, **the row the user is viewing should remain highlighted in the table** so they don't lose their place. For the master-detail pattern, keyboard `↑`/`↓` to step through the list while keeping the detail panel in sync is the hallmark of a great implementation.

### Input validation and auto-format

For editable tables, validation has two halves: the *rules* that classify input as valid or invalid, and the *response* — error message, blocked submission, or silent auto-correction.

**Auto-format generously, error-message reluctantly.** A date field that accepts `01/25/2017`, `6.12.17`, and `September 4 2016` and normalizes them into one canonical form beats one that throws "invalid format" three times. Reserve error messages for cases where the input is genuinely ambiguous or the user must make a choice.

**Validation message structure** — when an error is unavoidable, use a consistent template that names the rule, the bound, and optionally the reason:
- "Should be greater than `<value> <unit>`. `<optional explanation>`"
- "Should be between `<min>` and `<max> <unit>`."
- "Max must be greater than min."

**Where validation messages appear** — in or next to the cell that owns the error, not as a page-level toast that hides the cell. The user must see *which cell* is wrong without scrolling or hunting.

**When to validate** — on blur for most fields; on every keystroke for fields where instant feedback matters (uniqueness checks, password strength, format-as-you-type). Never block the user from leaving the cell purely on validation — let them navigate, but mark the cell as errored.

Document the full validation rule set in writing (or a flowchart) — it almost never fits in a mockup.

### Toolbar command state rules

For each command in a table toolbar, document the conditions that enable or disable it. Most toolbar commands have non-trivial state logic:

| Command | Typically enabled when |
|---|---|
| Add a row | Always (or when the user has create permission) |
| Delete | At least one row is selected |
| Move up | Exactly one row is selected, AND it's not already the first row |
| Move down | Exactly one row is selected, AND it's not already the last row |
| Duplicate | At least one row is selected |
| Recalculate | Always — or when the table has unsaved changes |
| Settings | Always |

When a command is disabled, **explain why on hover** ("Select a row to delete") — a greyed button with no explanation is a dead end for new users.

**Define the command result too.** What happens when "Move up" is invoked with two non-adjacent rows selected? Do they stack into adjacency, or do both move up one position independently? Decide and document — these edge cases bite later.

### Container placement: three contexts

Tables don't live in isolation. They sit in one of three containers, each with its own constraints:

| Container | When | Constraint |
|---|---|---|
| **Primary screen** (table fills the viewport) | The page is the table — admin lists, transactions, log viewers | Often no separate page title; the table's own header serves as the screen header. Maximum width available. |
| **Dashboard module** (table as one card among many) | The table is one of several views on a dashboard | The table's top bar becomes the card header. Width is constrained — design for fewer visible columns. |
| **Popup dialog** | A table inside a modal — e.g., "Select records to link" | Hard constraint on height and width. Define guardrails so dialogs don't blow up. Often limit to ≤10 visible rows, paginate or scroll the rest. |

Design the table for each container it'll appear in — the same table component may need three variants.

### Width strategy: defaults beat full-stretch

The naive answer to "how wide should columns be" is *make the table fill 100% of the available width*. This creates the proximity problem: large gaps appear between sparse columns, hurting scan-ability and violating the law of proximity.

Better:
- **Define rational default column widths** based on expected content length.
- **Set minimum widths** per column type so over-aggressive resize doesn't break the layout.
- **Let users resize manually** — drag handle on column-separator hover.
- **Empty space on the right of the table is acceptable** — better than wide gaps between columns.

Stretch-to-fit is fine for tables with many wide-text columns; rational defaults are better for tables with mixed content.

### Mobile fallback: convert table to cards

Complex enterprise tables don't survive a 375px-wide phone screen — they're built for the bird's-eye view that a desktop provides. For small tables on mobile, the standard fallback is to **render each row as a card**:

- Each card shows the primary identifier as the heading
- 3–5 most-important fields appear as labeled rows in the card body
- Actions (edit, delete, view) become buttons or a 3-dot menu on the card
- Tapping the card opens the full row detail

For large tables (50+ rows, many columns), accept that the experience will be degraded on mobile — the honest answer is often "show a read-only summary on mobile, link out to the desktop view for editing."

### Inline cell editing

When edits should be fast and contextual:

- **Hover affords editing** — text cursor appears on cell hover; click enters edit mode.
- **Confirm on Enter, on blur, or with an inline "Save" button.** Pick one and stay consistent.
- **Escape cancels** without saving. Always.
- **For high-stakes data** (financials, statuses with downstream effects), introduce a small amount of friction — require a click into a row detail view, or show a confirmation toast.
- **Validation feedback shows in or near the cell**, not as a global toast that hides what was wrong.

Inline is the lowest-friction option. For high-friction needs (audit trails, multi-field edits), use the row detail sidebar/modal as a form instead.

### Multi-select and bulk actions

- **Checkbox column on the far left**, appearing on hover or always-visible depending on the mode (always-visible for action-oriented tables).
- **"Select all" checkbox in the header.** When clicked, distinguish between "select all visible rows" and "select all matching rows" — the second is critical for paginated tables and is often missed.
- **Bulk action toolbar appears only when at least one row is selected.** It should be sticky (top of the table or bottom of the viewport), and show the count selected ("3 rows selected — Delete, Export, Duplicate"). Hide it when selection is cleared.
- **Destructive bulk actions need a confirmation step.** "Delete 47 rows" is the kind of action that benefits from a second click.

### Hover discoverability — what to surface where

| Hover target | Common affordance |
|---|---|
| Whole row | Subtle background; suggests row is clickable (opens details) |
| Leftmost cell | Checkbox appears; suggests row is selectable |
| Column header | Sort chevron and resize handle become visible |
| Individual cell with editable content | Text cursor / pencil icon; suggests editable |
| Rightmost cell | 3-dot menu or "View" link; suggests per-row actions |

Pick the conventions, then apply them consistently. Discoverability dies when each table uses a different gesture for the same action.

### Scroll behavior

- **Smooth scrolling on both axes.** Pixel-based, not row-based — row-based scrolling is jerky when rows have multi-line content.
- **Horizontal scroll is a smell, not a sin.** It's acceptable, but pair it with a frozen leftmost column so the user keeps context.
- **Scroll position should persist** when the user navigates into a row detail view and back. Losing scroll position on return is a common, fixable annoyance.

### Visual table summary

For analytical tables (financials, metrics, performance dashboards), place a small visual summary *above* the table — a sparkline, a donut, a bar chart, or a few aggregate stats (totals, averages, distribution). The summary lets users spot patterns and outliers in aggregate before drilling into rows.

- Keep the summary lightweight (single row of small charts, not a full dashboard)
- It should reflect the *currently filtered* view, not the entire dataset — when filters change, the summary updates
- For sortable / filterable tables, the summary anchors meaning: "you're now looking at 12 rows totalling $84K" is more useful than the bare 12 rows

Skip this for action-oriented tables — a CRUD admin table doesn't need a chart on top.

### Pagination vs infinite scroll

The two main strategies for large row counts:

- **Pagination** — fixed-size pages, explicit page navigation, predictable scroll position. Best for *prioritization* tasks where users return to specific rows ("the customer I was working on") and need to be able to find them again. Provide a row-count selector (25 / 50 / 100 per page).
- **Infinite scroll** — rows load progressively as the user scrolls. Best for *discovery* / browsing where users don't return to specific items.

Coyle's rule: **infinite scroll is great for discovery, usually disastrous for prioritization.** A user who scrolls through 400 rows and clicks one, then back-navigates, expects to be back at row ~400 — infinite scroll often resets them. For task-oriented enterprise tables, default to pagination.

A hybrid: load-more-button (manual progressive load) — combines pagination's predictability with infinite scroll's lighter feel.

### Saved views / presets

Once users have invested in a custom view (column visibility + order, sort, filters, density), let them **save it as a named preset**. Examples: "My open cases", "High-value accounts", "Last quarter".

- Saved views belong per-user (and optionally per-team if your product supports sharing)
- Show the active view name prominently — users need to know which view they're looking at
- A "Save as new view" + "Update current view" pattern is standard; mirror the file-save model users know
- Default views (created by admins, shipped by you) live alongside user views — clearly distinguished

Saved views are the highest-leverage state-preservation feature for power users. They turn a flexible table into a personal workspace.

### Search inside a table

Three scopes, often combined:

- **Global table search** — single input at the top, queries across all rows and columns. Use for general "find a row" tasks.
- **Per-column search** — small search input inside the column header. Use when users know which field they're searching in (e.g., "find by Customer ID", "find by Status"). More precise than global; less effort than building a filter UI.
- **Per-column filter** — filter widget (dropdown, range, date-picker) inside the column header for typed/structured queries. Different from a sidebar filter panel — these live in the header row of the table itself. For complex filter UIs (chips, sidebars, modals), use the `filtering-ux` skill alongside.

Across all three:
- **Highlight matched substrings** in the visible rows — the match is invisible without highlighting. (See also `search-and-content-ux`.)
- **Indicate how many rows match** ("12 of 248 matching").
- **Each per-column input should have a clear "×" or reset** so users can lift a single column constraint without clearing everything.

## Accessibility (WCAG 2.0)

Even a beautifully-designed table becomes a nightmare for users with disabilities if accessibility is an afterthought. The WCAG 2.0 chapter on tables is mostly about coding, but design has its own responsibilities:

- **Title and concise summary.** Screen-reader users need to understand what a table is *about* before processing every cell. Give every data table a visible title and a hidden (`aria-describedby`) summary.
- **Font size and scaling.** 16px (12pt) is the practical minimum for table body text. The user must be able to zoom to 200% without the layout breaking — test it.
- **Color contrast ≥ 3:1.** Text and controls against their background. Higher (4.5:1+) for body text. Use a contrast checker, don't eyeball it.
- **Color is never the only channel.** An errored cell can't communicate "error" through red text alone — pair it with an icon, an asterisk, or a textual indicator. Same for status badges, change indicators, and selection states.
- **Touch targets ≥ 40×40 px.** Icon buttons, checkboxes, sort chevrons — all of them. A 16px icon needs surrounding padding so the hit target is large enough for fingers.
- **Icon-only commands carry labels.** Either a visible label, a tooltip, or `aria-label` — never an unlabeled icon. Don't over-rely on icons; not every metaphor reads cleanly across cultures or domains.
- **All actions keyboard-reachable.** Power users (and screen-reader users) live on the keyboard. Tab to every interactive element. Provide shortcuts beyond the OS defaults — arrow-key cell navigation, Enter to edit, Escape to cancel, Space to select, Shift+Space for row select.
- **Headers programmatically associated with cells.** Use `<th scope="col">` and `<th scope="row">` correctly so screen readers can announce "Column: Status, Row: ACME Corp — value: Active."

Test with at least one tool (axe DevTools, WAVE) before shipping. These won't catch everything, but they catch the obvious gaps and explain how to fix each one.

## Anti-patterns — never do these

1. **Center-aligned cell content.** No exceptions in a data table.
2. **Right-aligned text or left-aligned numbers** (with the qualitative-number exceptions noted above).
3. **Proportional digits for number columns.** Always use tabular numbers.
4. **Mixing row-division styles** (zebra + lines + cards) in one table.
5. **Zebra stripes alongside heavy interactivity** — they fight with hover, selected, disabled, focused states.
6. **No sticky header on a long table.** Scrolling past the header strands the user.
7. **No frozen column when horizontal scroll is possible.** Same problem on the other axis.
8. **Bulk actions visible all the time** even when no row is selected. Reveals the toolbar only on selection.
9. **"Select all" that secretly only selects the current page.** Either be explicit about it ("Select 50 on this page") and offer "Select all 248 matching", or do the latter by default.
10. **Inline edits with no escape / no cancel.** Users must always be able to back out.
11. **Bulk destructive actions with no confirmation.** "Delete 200 rows" deserves a second click.
12. **Customizations that vanish on refresh.** Persist view state, or warn the user it's session-only.
13. **No "Reset to default" path.** Users won't customize if they fear they can't undo.
14. **A "too many columns" table fixed only by adding more controls.** Improve the default first.
15. **Row-snap scrolling on tall multi-line rows** — feels jerky and disorienting.
16. **"Invalid format" errors when auto-formatting would do.** A date field that accepts `01/25/2017` should also accept `6.12.17` and normalize — don't make the user guess your preferred form.
17. **Toolbar commands disabled with no explanation.** A greyed button with no tooltip is a dead end. Hover should say *why* it's disabled and what enables it.
18. **Color as the sole channel** for status / error / selection. Always pair with icon, text, or pattern.
19. **Unlabeled icon-only commands.** Either a visible label or at minimum a tooltip / `aria-label`.
20. **Tables designed without checking the chosen frontend library** — finding out at build time that nested rows / sticky columns / virtualization isn't supported.
21. **A table inside a popup dialog with no row-count or height guardrail.** Dialogs explode when content is unbounded.
22. **Mobile rendering that just compresses the desktop table** until it's unreadable. Either convert to cards or link out to desktop.

## Do / don't checklist

Run this as the final pass on any table — design or audit.

**Do — alignment & typography:**
- [ ] Text columns left-aligned; quantitative numbers right-aligned; headings match their column
- [ ] Tabular / monospaced-digit typography on number columns
- [ ] Vertical alignment matches row-height variance (center for ≤3 lines, top for more)
- [ ] One row-division style chosen (line divisions, or card, or free-form, or zebra), not mixed

**Do — structure & navigation:**
- [ ] Sticky header row (and any in-table toolbar) on tables longer than the viewport
- [ ] Frozen leftmost column whenever horizontal scroll is possible
- [ ] Smooth pixel-based scrolling on both axes
- [ ] Density toggle (Condensed / Regular / Relaxed) for data-heavy tables

**Do — interaction:**
- [ ] Sortable column headers with a chevron indicator that doesn't break alignment
- [ ] Default sort makes sense for the data (recent / urgent / lowest stock — not alphabetical by ID)
- [ ] Hover affordances are consistent: row-hover → details, leftmost → select, rightmost → actions
- [ ] Bulk action toolbar appears only when rows are selected, shows the count, supports "Select all matching" if paginated
- [ ] Destructive bulk actions require confirmation
- [ ] Inline edits support Enter to save and Escape to cancel
- [ ] Row details pattern (inline expand / modal / sidebar / fullscreen) chosen deliberately for the content volume

**Do — view state:**
- [ ] User customizations (column order, hidden columns, density, sort, filters) persist at least across the session
- [ ] "Reset to default" is available and prominent
- [ ] Scroll position persists when navigating into a row detail and back
- [ ] For power-user tables, named saved views / presets let users capture and switch between configurations

**Do — large datasets:**
- [ ] Pagination vs infinite scroll is chosen by task type (prioritization → paginate; discovery → infinite scroll OK)
- [ ] For analytical tables, a visual summary above the table reflects the currently-filtered view
- [ ] For sequential-review workflows (triage, inbox), the master-detail layout is on the table — not just modals

**Do — defaults:**
- [ ] Default column set is the 6–8 that matter most — not every column the database exposes
- [ ] Default sort, default density, default filters are intentional, not accidental

**Do — process & rules:**
- [ ] User research observations have been translated into specific design questions (multi-select? keyboard-first? auto-correct?) before mockups
- [ ] The design has been validated against the chosen frontend library's actual capabilities (sticky cols, nested rows, virtualization)
- [ ] Numeric precision rules are documented per data type, with the focus-to-reveal pattern for high-precision data
- [ ] Validation rules and error-message templates are documented in writing, not just in mockups
- [ ] Toolbar command states (enabled/disabled conditions) are explicit; disabled commands explain why on hover
- [ ] Container variants (primary screen / dashboard module / dialog) are designed if the table will appear in more than one

**Do — accessibility:**
- [ ] Table has a visible title and a screen-reader summary
- [ ] Body text ≥ 16px; layout survives a 200% zoom
- [ ] Color contrast ≥ 3:1 (4.5:1 for body text); color is never the sole channel
- [ ] All touch targets ≥ 40×40 px; icon-only commands have labels or tooltips
- [ ] Every interactive element is keyboard-reachable; keyboard shortcuts exist for the high-frequency actions
- [ ] Headers programmatically associated with cells (`<th scope=…>`)
- [ ] Mobile fallback (cards or read-only summary) is designed, not left to the browser

**Don't:**
- [ ] Center-aligned cell content
- [ ] Numbers in a proportional font
- [ ] Zebra stripes combined with row states (hover/selected/disabled)
- [ ] Mixed row-division styles
- [ ] No sticky header on a long table
- [ ] No frozen column when horizontal scrolling
- [ ] Bulk action toolbar visible with zero rows selected
- [ ] "Select all" that silently means "current page only"
- [ ] Customizations that don't survive a refresh
- [ ] Inline edits that can't be cancelled
- [ ] A 30-column table whose only answer is "scroll right"
- [ ] Infinite scroll on a prioritization / task-management table where users need to return to specific rows
- [ ] Saved views that don't show which view is currently active

## Quick reference: the 10-second design review

When someone drops a table screenshot in front of you, scan in this order. The groups go fundamentals → structure → interaction → state → accessibility.

**Fundamentals (4):**
1. **Is text left-aligned and are numbers right-aligned, with matching headings?** If not, this is the first fix.
2. **Are numbers in a tabular / monospaced-digit font with consistent decimal precision?** If they fishtail or mix 2-decimal and 5-decimal in one column, fix it.
3. **Is there any center-alignment?** Remove it.
4. **Only one row-division style?** Pick one and commit.

**Structure (3):**
5. **Sticky header on a long table?** Required.
6. **Horizontal scroll without a frozen leftmost column?** Add the freeze.
7. **Is the table showing 6–8 well-chosen columns by default, or every column in the schema?** Trim the default.

**Interaction (5):**
8. **Are all reasonable column headers sortable, with a chevron that respects alignment?**
9. **Hover affordances** — is there a clear "click row for details" and a clear way to multi-select?
10. **Is there a bulk action toolbar, and does it appear only when rows are selected?** Do disabled commands explain why on hover?
11. **For editable cells: auto-format generously, error-message only when ambiguous?** "Invalid format" errors that could've been auto-corrected are a smell.
12. **Is there a density toggle** for data-heavy tables?

**State (3):**
13. **Do user customizations persist across refresh / session?**
14. **Is "Reset to default" obvious?**
15. **For power-user tables: is there a saved-views mechanism, and is the active view visible?**

**Accessibility (3):**
16. **Table title + screen-reader summary present?**
17. **Is color carrying meaning alone** anywhere (status, error, selected)? If so, add icon / text.
18. **Are icon-only commands labeled** (visible text, tooltip, or `aria-label`)?

If 15+ pass, the table is in good shape. If five or more fail, it needs a redesign, not a patch.

If filters or chips are also in scope, load `filtering-ux` alongside — the two skills are designed to work together.
