---
name: navigation-ux
description: Best-practice guidance for designing, building, auditing, or reviewing navigation UX — covering primary nav, secondary nav, breadcrumbs, mega-menus, context menus, hover menus, mobile navigation (hamburger, bottom nav, drawer), top tasks prioritization, information architecture, wayfinding, and multi-layer navigation. Use this skill whenever the user is touching any navigation structure — global nav bars, side navs, breadcrumbs, tab bars, dropdown menus, flyout menus, mega-menus, context menus, hover menus, mobile hamburger menus, bottom navigation bars, drawer navigation, pagination, back buttons, skip links, or any wayfinding element. Trigger on words like navigation, nav, navbar, navigation bar, breadcrumb, breadcrumbs, menu, dropdown menu, flyout menu, mega-menu, context menu, hover menu, hamburger menu, sidebar navigation, side nav, tab bar, bottom nav, mobile nav, drawer navigation, information architecture, IA, wayfinding, top tasks, primary navigation, secondary navigation, navigation patterns, navigation UX, navigation design, nav restructure, menu redesign, right-click menu, context actions, action menu, task-based navigation, user journey, site structure, site map, IA audit, nav audit, nav overhaul, link labels, nav labels, menu labels, navigation labels, navigation hierarchy, nav depth, nav breadth, navigation tree, navigation taxonomy, progressive disclosure, navigation progressive disclosure, navigation discoverability, findability, learnability, navigation accessibility, skip navigation, keyboard navigation, focus management, WCAG navigation.
metadata:
  tags: navigation, information architecture, top tasks, context menus, wayfinding, UX, mobile navigation, breadcrumbs, mega-menus, IA, nav bar, sidebar
sources:
  - Gerry McGovern, "What Really Matters: Focusing on Top Tasks", A List Apart, 2015 — https://alistapart.com/article/what-really-matters-focusing-on-top-tasks/ — top tasks prioritization framework, voting methodology, league table analysis
  - Kara Pernice, "F-Shaped Pattern of Reading Web Content", Nielsen Norman Group, 2017 — https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ — scanning behavior research, implications for nav label placement and content hierarchy
  - Height.app, "Guide to Building Context Menus", Height Blog — https://height.app/blog/guide-to-build-context-menus — context menu design patterns, triggering, placement, and action grouping
related-skills:
  - search-and-content-ux (search and navigation work together)
  - filtering-ux (faceted navigation and filtering often combine)
---

## When to use

- You are designing or redesigning a global nav bar, sidebar, or tab bar
- You are auditing an existing navigation structure for discoverability problems
- You are deciding what goes in a nav vs. what belongs in search or filtering
- You are building a context menu (right-click, long-press, or ellipsis trigger)
- You are choosing labels for nav items or menu entries
- You are restructuring information architecture after user research
- You are implementing mobile navigation (hamburger, bottom bar, or drawer)
- You are evaluating whether a mega-menu is appropriate for a complex site
- You are adding breadcrumbs or other wayfinding elements
- You are running a top-tasks analysis to find what actually matters to users
- You are deciding nav depth (flat vs. deep hierarchy)

**This skill is NOT for:**
- Pure search UI design (use search-and-content-ux)
- Data table row/column actions unrelated to nav (use data-table-ux)
- Filter panels that operate on search results (use filtering-ux)
- In-page anchor links within a single long article

---

## How to use this skill

### Design / build mode
Use the principles and patterns below to make decisions from scratch. Start with the Top Tasks framework to establish priority order, then apply the structural patterns for your surface (desktop nav bar, mobile bottom nav, context menu, etc.). Cross-reference the do/don't checklist before shipping.

### Audit / review mode
Run the Quick Reference 10-second design review at the bottom of this file. Flag every item that fails. If three or more fail, the navigation needs a structural rethink — not a label polish or color tweak.

---

## Core concept

Navigation is a promise. Every label in a nav structure promises the user that clicking it will get them closer to what they need. When that promise is broken — through poor labels, wrong hierarchy, buried top tasks, or excessive depth — users lose trust and resort to search or abandon the site entirely. Good navigation UX is not about showing everything; it is about making the most important few tasks effortlessly findable, and making everything else reachable with one extra step.

---

## Core principles

### 1. Top tasks first — always
The most common mistake in navigation design is organizational thinking: teams assign nav slots to departments, products, or internal processes rather than to the tasks users actually come to complete. Gerry McGovern's Top Tasks Management research (400+ surveys, ~400,000 voters) consistently finds that 3–6 tasks capture 25% of all user intent, while the bottom 40–50 tasks together capture only 25%. In one Cisco study, a single top task ("Download software") outweighed the bottom 23 tasks combined. Navigation must reflect this distribution: top tasks get the most prominent, shallowest positions; low-priority tasks may be demoted, merged, or removed from primary nav entirely.

**Actionable implication:** Before any nav redesign, run a task-voting exercise. Survey users asking them to select their top 5 tasks from a shortlist of ≤100 items. Build a league table. Structure the nav around the top of that table, not around the org chart.

### 2. Labels must match users' words, not the organization's words
Nav labels written in product or company jargon create a mismatch between user mental models and site structure. Users scan for the word that matches their goal. If their goal is "download the software" but the nav reads "Resource Center", they will not make the connection. McGovern's shortlist methodology explicitly removes jargon, brand names, and product format names from task candidates — the same discipline applies to nav labels.

**Actionable implication:** Test labels with card sorting or first-click tests. If fewer than 70% of users click the correct item in a first-click test, the label or its parent category needs revision.

### 3. Navigation reflects scanning, not reading
Kara Pernice's F-pattern research (NNg, 2017) documents that users rarely read navigation linearly. On a horizontal nav bar, items on the far right receive significantly fewer fixations than items on the left. On a vertical sidebar, only the first few items in each group get consistent attention; items below the fold are rarely seen. Users scan until they find a word that matches their goal, then stop.

**Actionable implication:**
- Put the highest-priority nav items leftmost (horizontal) or topmost (vertical).
- Do not rely on position alone to communicate importance — use visual weight (bold, icon, color) to reinforce the top task.
- Keep nav groups short (5–7 items). Long ungrouped lists cause scanning to break down into the F-pattern's vertical stem: only the first word of each item gets read.

### 4. Progressive disclosure over completeness
Showing every possible destination in primary nav creates cognitive overload. Good navigation reveals options in layers: primary nav shows the top 5–8 categories; secondary nav or mega-menu reveals the next layer only when the user signals intent. Context menus surface object-level actions only on demand.

**Actionable implication:** Test with tree testing. If users consistently fail to predict where an item lives, the hierarchy is wrong — more levels are not the solution; better grouping and labeling is.

### 5. Context menus are discoverability-neutral — design them as a power-user shortcut, not a primary affordance
Context menus (right-click, long-press, ellipsis `…`) are invisible until triggered. Users who do not know the gesture will never discover these options. Therefore, every critical action must also be reachable through a visible path. Context menus are a speed layer for returning users, not the only path to an action.

**Actionable implication:** Audit every action in your context menu. If any of them is a top task and it is only available in the context menu, it must be promoted to a visible inline or toolbar control.

### 6. Mobile navigation requires surface-specific patterns
Desktop navigation patterns (wide horizontal nav bar, hover mega-menu) break on mobile. The three dominant mobile patterns each carry trade-offs:
- **Hamburger menu / drawer**: Maximizes content space; reduces nav discoverability. Best when users have a clear primary goal and return repeatedly (they will learn the hidden nav). Worst for first-time visitors or sites with diverse, competing top tasks.
- **Bottom tab bar**: High discoverability; limits primary nav to 4–5 items. Best for apps with a small number of equally important sections. Used by most native apps (iOS, Android system guidelines).
- **Priority+ / progressive disclosure**: Shows the top 3–4 items inline; collapses the rest into a "More" overflow. Best for medium-complexity sites where 3–4 tasks dominate heavily.

### 7. Breadcrumbs are wayfinding, not decoration
Breadcrumbs communicate current location within a hierarchy and enable one-step backtracking to any ancestor level. They are most valuable in deep hierarchies (3+ levels) and in sites where users arrive deep via search engines. They are redundant overhead on flat, single-level sites or inside tightly scoped apps.

**Actionable implication:** If your IA has 3+ levels and users regularly land deep via search, implement breadcrumbs. Use location-based breadcrumbs (reflecting the site hierarchy), not history-based breadcrumbs (reflecting the user's click trail) — history-based breadcrumbs are confusing and unreliable.

### 8. Navigation accessibility is non-negotiable
Users who rely on keyboards, screen readers, or switch devices depend on predictable focus order, visible focus indicators, correct ARIA roles (`nav`, `menu`, `menuitem`), and skip-navigation links. These are not enhancements — they are baseline requirements under WCAG 2.1 AA.

---

## Pattern guidance

### Global horizontal nav bar
**When to use:** Desktop-first sites and apps with 5–8 top-level sections of roughly equal importance.
**Key rules:**
- Limit to 7 items maximum (Miller's Law; beyond this, users stop scanning the full set).
- Use single-word or two-word labels wherever possible.
- Active state must be visually unambiguous — not just a subtle color change.
- Avoid hover-only dropdowns with no click affordance; they fail on touch screens and break keyboard access.

### Sidebar / side navigation
**When to use:** Apps with a persistent left-rail structure (dashboards, admin panels, SaaS products).
**Key rules:**
- Group items into sections of 5–7 max. Use a section header label that matches user vocabulary.
- Top task(s) belong at the top of the top section — not under "Other" or at the bottom.
- Collapsible sidebar (icon-only rail) is acceptable only if icon + tooltip reliably communicate the item label.
- Visual active state should be a full-width highlight, not just icon color — makes it readable at a glance.

### Mega-menu
**When to use:** E-commerce sites or large portals with 4+ top-level categories, each with 10+ subcategories.
**Key rules:**
- Organize by user task/topic, not by product catalog structure.
- Use visual grouping (columns, headings, icons) to allow rapid scanning. The F-pattern research shows users scan vertically down the first column before reading across — design for that.
- Include a "featured" or "most popular" section that surfaces top tasks directly in the mega-menu, without requiring the user to navigate into a subcategory.
- Always provide a fallback link to the category landing page (for users who want to browse, not jump directly).

### Context menu (right-click / long-press / ellipsis)
**When to use:** Object-level actions in apps (files, rows, messages, cards).
**Key rules:**
- Group related actions. Order: most-used actions first within each group, separated by dividers.
- Destructive actions (delete, remove, archive) must be visually distinguished (red text or icon) and placed at the bottom of the list or in a separate group — never at the top where accidental clicks occur.
- Keep the menu to 10 items maximum. Beyond 10, users stop reading the full list and miss options.
- Every item must be a verb phrase or a noun that implies an action. Avoid ambiguous nouns ("Settings" is acceptable; "Details" without context is not).
- Disable (gray out) unavailable actions rather than hiding them. Hiding breaks the user's mental model of what is possible.
- Position the menu so it does not overflow the viewport — check all four edges, not just top/bottom.

### Breadcrumbs
**When to use:** Sites with 3+ levels of hierarchy; any site where users arrive deep via external links or search.
**Key rules:**
- Show the full path from root to current page.
- The current page may be shown as non-clickable text (it is already loaded) or as a link (for accessibility tools that need a complete path).
- Separate items with a visually distinct separator (›, /, or an icon). Do not use just whitespace.
- Do not use breadcrumbs to replace back-button behavior — they are parallel to, not a substitute for, browser navigation.

### Mobile bottom tab bar
**When to use:** Native-like apps with 3–5 primary sections of roughly equal daily use.
**Key rules:**
- 3 tabs minimum, 5 maximum. Below 3, the bar adds no navigation value. Above 5, icons become too small and labels too cramped.
- Each tab must have an icon AND a label. Icon-only tabs fail accessibility and discoverability tests.
- The active tab must have a distinct visual state (color fill, underline, or indicator dot).
- Use the "Home" or primary landing tab as the leftmost (or first) item.

### Mobile hamburger / drawer
**When to use:** Navigation with 6+ items that do not fit in a bottom tab bar; content-first layouts where nav is secondary.
**Key rules:**
- The hamburger icon (☰) must be in the top-left corner on LTR languages. Top-right is a common anti-pattern that slows discoverability.
- Consider labeling it "Menu" alongside the icon — research consistently shows the labeled version is found faster by new users.
- When the drawer opens, focus must move to the first item in the drawer (keyboard / screen reader requirement).
- Include a visible close affordance (X button or tap-outside-to-dismiss with clear visual instruction).

---

## Anti-patterns — never do these

1. **Org-chart navigation.** Structuring nav around internal departments or product team boundaries rather than user tasks. Users do not know or care how your company is organized.
2. **Hiding top tasks behind "More" or an overflow menu.** If a top task is in the overflow menu, it is invisible to most users. The nav failed its primary job.
3. **Mega-menus on mobile without a mobile-specific treatment.** A desktop mega-menu opened by hover cannot work on touch. Provide a distinct mobile nav pattern.
4. **Hover-only dropdowns.** Hover menus are inaccessible on keyboards and touch devices. All dropdown content must also be reachable via click/tap and keyboard.
5. **Duplicate top-level items for the same concept.** "Help", "Support", "FAQ", and "Troubleshooting" as four separate top-level items is a sign of organizational politics, not user focus. Merge them; let top-tasks data decide which label to use.
6. **Navigation labels that describe format, not outcome.** "Videos", "PDFs", "Whitepapers" — users search for outcomes, not formats. Labels like "How-to guides" or "Technical documentation" are outcome-oriented.
7. **Destructive context menu actions at the top of the list.** Users scan quickly; a "Delete" item at position 1 is an accidental-click catastrophe waiting to happen.
8. **Icon-only navigation with no labels and no tooltips.** Icons alone are ambiguous for all but a handful of universally understood symbols (home, search, settings). Always pair with a label or a persistent tooltip.
9. **Navigation depth beyond 3 levels.** If users need to click more than 3 times to reach any destination, the IA needs flattening, not more sub-levels.
10. **Changing navigation structure based on A/B tests with inadequate sample sizes.** Nav changes have a long learning curve; short-window A/B tests routinely under-estimate the harm of nav restructuring.

---

## Do / don't checklist

### Top tasks and structure
- [ ] Top 3–5 user tasks are in the primary nav, not buried in dropdowns or secondary pages
- [ ] Nav items are ordered by task frequency/importance (data-driven), not alphabetically or by org structure
- [ ] A task-voting or first-click study has been run (or is planned) to validate the nav structure
- [ ] Nav has no more than 7 top-level items in the primary horizontal or vertical nav

### Labels
- [ ] Every label uses user vocabulary, verified through research or testing
- [ ] No label describes a format (Videos, PDFs) when an outcome label is possible
- [ ] No jargon or internal product names used as primary labels
- [ ] Labels are ≤3 words; scanning-friendly
- [ ] Active/current page label is visually distinct and matches the page heading

### Hierarchy and depth
- [ ] Maximum 3 levels of navigation depth
- [ ] Items are grouped into logical categories of 5–7 items each
- [ ] Breadcrumbs implemented for sites with 3+ hierarchy levels
- [ ] Breadcrumbs use location-based structure, not history-based

### Context menus
- [ ] Destructive actions are visually distinguished and placed last, not first
- [ ] Unavailable actions are disabled (grayed), not hidden
- [ ] All context menu actions are also reachable through a visible path for top tasks
- [ ] Context menu has ≤10 items; grouped by dividers
- [ ] Menu positioning checked against all four viewport edges

### Mobile navigation
- [ ] Mobile nav pattern matches the complexity of the site (tab bar for 3–5 items; drawer for 6+)
- [ ] Hamburger icon is in the top-left corner (LTR), labeled "Menu" or has tooltip
- [ ] Bottom tab bar items include both icon and label
- [ ] Drawer opens with focus on first item; has visible close affordance

### Accessibility
- [ ] All nav is keyboard-navigable (tab order, arrow-key support for dropdowns)
- [ ] Skip-navigation link is present and visible on focus
- [ ] ARIA roles: `<nav>`, `role="menu"`, `role="menuitem"` used correctly
- [ ] Focus indicators are visible (not removed by CSS `outline: none` without replacement)
- [ ] Color is not the sole differentiator for active vs. inactive nav states

### Scanning and visual hierarchy
- [ ] Most important nav item is leftmost (horizontal) or topmost (vertical)
- [ ] Visual weight (bold, icon, color) reinforces top tasks, not decorative items
- [ ] Nav groups are visually separated (dividers, whitespace, section headers)
- [ ] No important information is placed far right in a horizontal nav (low attention zone per F-pattern research)

---

## Quick reference: the 10-second design review

Scan the navigation surface in front of you and answer each question yes or no.

1. Can you identify the site/app's single most important user task within 3 seconds of looking at the nav?
2. Does the nav label vocabulary match how a first-time user would describe their goals?
3. Are top-level items ≤7 in the primary nav?
4. Is the active/current location visually unambiguous?
5. Are there zero hover-only interactions required to reach any navigation item?
6. Is the nav fully operable with a keyboard (Tab, Enter, arrow keys)?
7. Are destructive actions (if any) at the bottom of their context menu, visually distinguished?
8. Is max navigation depth ≤3 levels?
9. Does mobile have a surface-appropriate pattern (tab bar or labeled hamburger)?
10. Are there no nav items that describe internal org structure rather than user outcomes?

**If 8 or more pass, navigation UX is in good shape. If three or more fail, it needs a rethink, not a tweak.**
