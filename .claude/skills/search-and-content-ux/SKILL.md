---
name: search-and-content-ux
description: Best-practice guidance for three related UX problems — (1) autocomplete and typeahead dropdowns, (2) how users scan and read on the web (F-pattern, Layer-Cake, content scanability), and (3) end-to-end search experiences (search input, dropdown, results page, command search, advanced search, find-in-page, AI-driven search). Use this skill whenever the user is designing, building, auditing, or reviewing any search or autocomplete UI; planning whether to add search at all; choosing between search and navigation; or working on content layout / scanability. Trigger on words like search UX, search experience, search results page, search bar, command search, Spotlight search, command palette, advanced search, query builder, find-in-page, CMD+F, AI search, natural-language search, autocomplete, typeahead, search suggestions, suggestions dropdown, search-as-you-type, F-pattern, F-shape, Layer-Cake, scanability, scanning, reading pattern, content hierarchy, landing-page layout — or when the user complains "users can't find things", "users miss important content", or "users don't read the page", even when none of these terms appear verbatim.
metadata:
  tags: ux, search, autocomplete, typeahead, command-palette, advanced-search, find-in-page, scanning, f-pattern, layer-cake, content-layout, design-system, design-review
---

## When to use

This skill covers three related UX domains. Use the section(s) that match the user's task.

**A. Autocomplete / typeahead work** — designing, building, auditing, or fixing a suggestions dropdown:

- "design / build / audit / review an autocomplete / typeahead / search suggestions"
- a screenshot, Pencil node, or component file containing a search input with a dropdown of suggestions
- complaints like "users ignore the suggestions", "suggestions feel like ads", "users still get 0-results pages"
- search-bar work where the user hasn't said "autocomplete" yet — surface this skill proactively if a suggestions dropdown is in scope

**B. Reading and scanning patterns** — content layout, page structure, or scanability work:

- "users miss important content", "users don't read the page", "engagement drops below the fold"
- complaints about long unformatted text walls, dense landing pages, hard-to-scan dashboards or data tables
- explicit mentions of F-pattern, F-shape, Layer-Cake, scanability, content hierarchy
- design reviews of landing pages, blog/article layouts, marketing pages, or dashboard summary sections

**C. End-to-end search experiences** — broader than just the dropdown: input, submit, results page, search types:

- "design a search experience", "should we add search", "users can't find things in our product"
- work on the search results page (tabs, filters, sorting, empty state, match highlighting)
- decisions about command palette / Spotlight-style search (Cmd+K patterns)
- advanced/expert search with inclusion/exclusion/AND/OR query logic
- find-in-page (Cmd+F) functionality
- AI-driven search, natural-language queries, generative search workflows
- the question "should this be search or navigation?"

This skill is *not* the right fit for: pure visual aesthetics with no UX angle, server-side search infrastructure (Elasticsearch tuning, ranking algorithms), or accessibility audits unrelated to search/autocomplete/content scanning.

## How to use this skill

Three domains, two modes per domain. First decide which **domain** applies, then which **mode**.

**Domain selection:**
- If the question is *specifically* about a suggestions dropdown or search-as-you-type input → use **Domain A — Autocomplete**.
- If the question is about page layout, content hierarchy, scanability, or how users move through a screen → use **Domain B — Scanning / F-pattern**.
- If the question is about the broader search experience (input, results page, command palette, advanced search, find-in-page, AI search, or "should we build search at all") → use **Domain C — Search experiences end-to-end**. Domain C and Domain A pair naturally — Domain C is the *whole flow* and Domain A is the dropdown inside it.
- If two domains apply (e.g., a full search-page redesign needs both end-to-end thinking and dropdown details), do C first to frame the system, then A for the dropdown specifics, and note the interaction. Add B if scanability of the results page is also in scope.

**Modes (apply to either domain):**

**Review mode** — user shared something to audit. Walk through the relevant audit checklist and return findings as: *what's good*, *what's broken*, *what's missing*, with one concrete suggested fix per issue. Reference the principle being violated so the user can reason about it themselves.

**Design mode** — user is building something new. Apply the principles inline as you design. Don't dump the whole checklist — pick the 3–5 principles most relevant to what they're doing and weave them into your suggestions. If they're using Pencil, the Pencil MCP tools handle the design execution; this skill provides the *what* and *why*.

In both modes, lead with the *why* behind each principle. The user is a designer, not a checklist-filler — they need to make judgment calls on edge cases.

---

# Domain A — Autocomplete / typeahead

## Autocomplete: core principles

Organized into four clusters. Read these as guidance, not as rigid rules — many real autocompletes break one or two of these on purpose.

### 1. Purpose: autocomplete is not just a typing accelerator

The cheap framing is "autocomplete makes typing faster." The valuable framing is that autocomplete *guides users toward better results and prevents zero-result pages*. That reframe drives most of the other principles.

- Users are surprisingly faithful to suggestions. Many will refuse to submit a query that doesn't appear as a suggestion. So suggestions are not just hints — they shape what users believe is searchable.
- The best autocomplete lets users skip the search-results page entirely (e.g., jump straight to a product, a setting, a doc page).
- Suggest filters, sub-categories, and presets — not just keyword completions. "Shoes under $50" beats "shoes" if the user's intent is shoppable.
- Treat zero-results prevention as a primary job of autocomplete, not an afterthought.

### 2. Discoverability: many users never realize autocomplete exists

A meaningful share of users look at the keyboard while typing and will never see suggestions appear. Design for them.

- Hint that autocomplete exists *before* the user types. Use **at least two** of: a chevron or search icon inside the input, a sensible placeholder ("Select an option...", "Try: 'invoices from 2024'"), and suggestions appearing on focus. One signal alone is missable.
- **Show suggestions on focus, before any keystrokes** — frequent searches, recent history, popular queries, or featured destinations. Many teams delay suggestions until 2–3 characters are typed; this is the single most common cause of "users don't know autocomplete exists." Show on focus instead.
- Scope default (pre-typing) suggestions to the user's current category or context. Generic top-10 lists feel like ads; context-aware suggestions feel useful.
- Support full keyboard navigation: ↑↓ to move through suggestions, Enter to select, Esc to dismiss, looping at the ends.
- **Copy the focused suggestion into the input field when it receives keyboard focus.** A subtle but high-impact detail: as the user arrow-keys through the list, the suggestion text appears in the search box itself. This (a) makes the autocomplete mechanic instantly legible to less-experienced users and (b) lets the user *continue typing* after the suggestion to refine it — e.g., focus "Nikon D7100" → type "lenses" → submit "Nikon D7100 lenses". Baymard's testing flagged this as one of the moves that separates good autocomplete from frustrating autocomplete.
- Use the **hand/pointer cursor on hover** so it's unmistakable that suggestions are clickable links. Background shading on hover/focus reinforces the same signal. Don't rely on cursor alone (HP's site does this — users miss it).
- Accessibility specifics: visually highlight the currently-focused suggestion (not just hover state), expose it as an ARIA-active option, and ensure the selection is announced by screen readers. Keyboard nav that "works" but is silent to assistive tech is broken.

### 3. Layout and density: mobile constraints dominate

40–50% of the mobile viewport is keyboard. Treat that as a hard constraint.

- Suggestion count: **4–8 on mobile, ≤10 on desktop** (Baymard's e-commerce testing converges on the same numbers — beyond ~10 desktop / ~8 mobile, users either ignore suggestions or stall reading them).
- Input width: **≥40ch on mobile, ≥60ch on desktop**. Below that, queries truncate mid-word and users can't see what they typed.
- Show useful detail inside each suggestion — match count, price, current status, last-updated, category. A suggestion that says "Acme Invoice #4421 — $1,240 — paid" beats one that says "Acme Invoice #4421".
- Show the number of matches per suggestion when the suggestion is a query/category rather than a direct destination. "Shoes (1,284)" tells the user whether the click is worth it.
- **Reduce visual noise *inside* the dropdown.** Alternating row colors, heavy separators, embedded product thumbnails, "trending searches" cards, recent-articles panels — when you pile them on, the actual query suggestions get visually overpowered. Desktop is especially prone to this because there's space to fill. Default to a quiet design and add embedded content only if testing shows users use it.
- **Style scoped suggestions distinctly from query suggestions.** When autocomplete mixes unscoped queries ("red rugs") with scope-narrowed ones ("red rugs in Bathroom"), the scoped variants must look visually different — italics, indentation, a muted text color, or all three. Without distinction users overlook the scope entirely. (Cross-references Domain C's scoped-search guidance — same anti-pattern, different layer.)
- **Visual depth on desktop: dim the page background when autocomplete is active.** Without dimming, autocomplete competes for attention with ads, carousels, headers, and homepage content. With dimming, the suggestions pop and the rest fades. Target does this; Banana Republic doesn't (and pays for it).
- **Mobile hit-area, font, and casing.** Tap targets ≥44px square. Use **title case** for suggestions, not ALL CAPS — easier to read at small sizes. Adequate line spacing prevents mistaps. Insufficient spacing + small font is the most common cause of mobile mis-selections.
- **Mobile sticky-element crowding.** On mobile, the suggestion area is already sandwiched between the search input above and the keyboard below. Sticky headers, sticky CTAs, live-chat bubbles, and install-app banners eat further into that window — sometimes leaving only 2 partial suggestions visible. Test with every sticky element turned on; if autocomplete is essential to the experience, those stickies need to hide while it's open.

### 4. Patterns and anti-patterns

- **Cluster suggestions** by type and present clusters separately: "Recent searches", "Products", "Pages", "Help articles". A single flat list forces users to mentally classify each row.
- **Highlight differences, not matches.** If the user typed "iph", don't bold the "iph" in every row — they already know they typed that. Highlight what's *different* between suggestions ("iPhone **15 Pro**", "iPhone **15**", "iPhone **case**"), so users can quickly disambiguate. Baymard's testing across major e-commerce sites confirms this directly: sites that bold the user's typed text (Restoration Hardware, Macy's) make the list harder to scan, while sites that bold the predictive completion (Amazon, Grainger) make differences pop. Across all 9 of Baymard's autocomplete best practices, only **19% of e-commerce sites get everything right** — so even minor deviations are worth catching during review.
- **Use tap-ahead to build queries.** Let users chain suggestions to compose richer queries — e.g., select "Invoices" → then "from 2024" → then "unpaid" — rather than typing the whole thing.
  - *Anti-pattern:* a tiny arrow icon on the right side of each suggestion row that "appends to the query" instead of executing search. The two affordances (click the row = search, click the arrow = append) look almost identical and almost nobody discovers the difference. Mediamarkt and many older eCommerce sites do this — don't copy it.
  - *Better pattern:* render appendable suggestions as **chips/pills underneath the search box** (Google's current pattern). The visual distinction between "row = jump to result" and "chip = add to query" is obvious, and chips invite tapping.
- **Avoid multiple search boxes on the same page.** Users get confused about which one searches what. NN/g research finds this is *consistently problematic* — the only documented case where two search boxes with different scopes work is intranet employee directories (where the two scopes are obviously distinct: "find a person" vs. "find content"). Everywhere else, expect users to pick one at random and hope. If you genuinely need two, make their scope visually unmistakable (different placeholder, different icon, ideally different placement) — but first ask whether faceted filters on a single search results page would do the job.
- **Avoid tiny scrollable suggestion areas.** A scroll inside a dropdown inside a page is a usability trap. Either show more, or show fewer with a "see all results" affordance.

### 5. Enriched suggestions: usually ignored, often worse than nothing

This principle pulls against a tempting design impulse, so it deserves its own callout. **Enriched site-search suggestions** are the expanded panels that sit alongside or below the text autocomplete list: image-based product cards, "trending searches", "featured items", "recently viewed", category callouts. NN/g's 2022 ecommerce study found users interacted with them in only **7 of 60 instances** observed — across both known-item tasks ("find red flat shoes") and open-ended ones ("see if anything interests you"). Four reasons converge:

- **Search mindset ≠ explore mindset.** Users at the search box have a known item in mind and want to get to it fast. Enriched content that isn't directly tied to their typed query reads as distraction, not value — "if I'm looking for a tennis racquet, I'm not looking for clothes."
- **Loading is too slow.** Image-heavy enriched results often don't render before the user finishes typing and hits Enter. While typing, they update against stale intermediate queries (a "watering can" appearing during a "coconut candles" search). By the time relevant images load, the user has already submitted.
- **Banner blindness.** Users fixate on the search bar and the text suggestion list — visual attention is locked there. Image-rich panels look like ads and get filtered out, even when they contain exact matches. NN/g observed a user click "PlayStation 5 in PS5 consoles" (extra navigation step) while ignoring an actual PlayStation 5 thumbnail sitting two inches to the right.
- **Misread as promotional content.** When users *are* prompted to notice enriched results, they usually guess they're upsells, "suggested for you" panels, or sponsored placements. Once that frame is set, users ignore them on principle.

**What to do:**

- **Default to text-only autocomplete.** It's used heavily. It's fast. It aligns with the search mindset. Don't break it.
- **Resolve the tension with earlier "diversity of suggestions" guidance:** *text-based* diversity (keyword suggestions + category suggestions + filter suggestions, all in the autocomplete list) works well. *Image-based enriched panels* mostly don't. The Hema.nl / IKEA-style product-card panels look great in screenshots and underperform in testing.
- If you ship enriched content anyway, meet all four bars: (a) every item directly relevant to the typed query, (b) loads fast enough to not flicker mid-typing (sub-200ms), (c) every section explicitly **labeled** ("Top sellers", "Recently viewed", "Recommended for you") so users don't have to guess, (d) sections sit in **stable dedicated positions** that don't shift based on query.
- **Don't bet on users learning over time.** NN/g found they didn't — even across multiple search sessions in the same study.

### 6. Power-user mode: autocomplete as a query builder

For products where a meaningful share of users are experts (developer tools, admin consoles, financial dashboards, complex catalogs), the search box can do far more than complete keywords. Treat it as a **scoped query builder**: filters, sorting, attributes, and operators that the user defines inline.

- **Inline filter syntax.** Stack Overflow's search box accepts tokens like `is:question score:5..` directly. Stripe surfaces suggested filters and search tips as the user types. The autocomplete dropdown teaches the syntax — users discover the power by seeing it.
- **Suggested filter chips** alongside keyword suggestions, so expert users can compose a query without ever leaving the search box.
- This is unambiguously a tradeoff: too complex for new users, indispensable for experts. The right move is usually to show power-user affordances *progressively* — basic users see keyword suggestions, expert syntax surfaces only after the user types `:` or otherwise signals intent.
- Skip this entirely if your audience is mostly casual users — it adds cognitive cost for everyone in exchange for value only experts capture.

## Autocomplete: audit checklist (Review mode)

Walk through these in order. For each, answer yes / no / partial, and cite the principle.

1. **Discoverability** — Is there a visible hint that autocomplete exists before typing? Do suggestions appear on focus?
2. **Default suggestions** — On empty input, are suggestions context-aware (scoped to category, recent history, frequent), or generic?
3. **Suggestion content** — Do suggestions include match counts, status, or other decision-relevant detail? Or are they bare keywords?
4. **Clustering** — Are different suggestion *types* (recent, products, help, filters) visually separated?
5. **Highlighting** — Does the UI highlight matches (low value) or differences (high value)?
6. **Suggestion count** — Within 4–8 (mobile) or 8–10 (desktop)?
7. **Input width** — ≥40ch mobile, ≥60ch desktop?
8. **Keyboard nav** — ↑↓, Enter, Esc, looping all work? Is the focused suggestion visually highlighted (distinct from hover) and announced by screen readers?
9. **Beyond keywords** — Does autocomplete suggest filters, categories, or destinations — or only keyword completions?
10. **Multiple search boxes** — Is there more than one search box on the page? If yes, are their scopes obvious?
11. **Tiny scrollable area** — Is the dropdown scrollable in a way that hides options below the fold?
12. **Zero-results prevention** — Do suggestions actively steer users away from queries that will return nothing?
13. **Tap-ahead pattern** — Can users build a query incrementally? If so, is the appendable affordance a visually distinct chip/pill under the input (good), or a tiny right-arrow icon that looks identical to a "select" action (bad)?
14. **Power-user mode** — If the audience includes experts, does the search box accept inline filter syntax with autocompleted operators (e.g., `status:open`, `tag:react`)? If not, is that a missed opportunity for this product, or correct restraint for a casual audience?
15. **Sensible placeholder** — Does the input placeholder hint at *what* can be searched ("Search invoices, contacts, settings...") rather than a generic "Search"?
16. **Scoped-suggestion styling** — If autocomplete mixes unscoped and scope-narrowed suggestions, are the scoped versions visually distinct (italics / indent / color)?
17. **Visual noise inside the dropdown** — Is the dropdown overloaded with thumbnails, alternating rows, embedded articles, or kept lean and focused on the suggestions themselves?
18. **Visual depth (desktop)** — When autocomplete opens, does the surrounding page dim so suggestions stand out from ads, carousels, and other content?
19. **Keyboard-focus copy** — Does arrow-keying onto a suggestion copy its text into the input, letting users continue refining the query?
20. **Mobile crowding** — When autocomplete is open on mobile, is the suggestion area unobstructed by sticky headers, CTAs, chat bubbles, or banners?
21. **Mobile hit-area & typography** — Tap targets ≥44px, adequate line spacing, title case (not ALL CAPS)?
22. **Enriched-content necessity** — If the autocomplete includes image panels / "trending" / "featured" sections, is there evidence (analytics, testing) that users actually use them? If not, recommend cutting them — defaults are *don't include*.
23. **Enriched-content labeling** — If shipped, is every enriched section explicitly labeled ("Top sellers", "Recently viewed", etc.) so users don't have to infer what it is?
24. **Enriched-content loading speed** — If shipped, do enriched results render fast enough (≤200ms) to not flicker against stale intermediate queries while the user is still typing?
25. **Enriched-content stability** — If shipped, do enriched section types/positions stay constant across queries, or do they shift around (anti-pattern)?

Return findings grouped by severity (broken / missing / could-be-better), with one suggested fix per finding and a one-line citation of the principle behind it.

## Autocomplete: design mode notes

When building new autocomplete UI:

- Start from the *user's job*, not from a generic dropdown. "What does the user actually want to reach?" determines whether suggestions should be destinations, filters, keywords, or a mix.
- If you're working in Pencil, use `mcp__pencil__batch_design` for layout and `mcp__pencil__get_variables` to pull design-system tokens for spacing/typography. The principles in this skill tell you *what* to design; Pencil tools handle *how* to draw it.
- If you're working in code, name the suggestion clusters explicitly (e.g., `RecentSuggestions`, `EntitySuggestions`, `FilterSuggestions`) — it forces you to think about clustering up front.
- For customgpt.ai V3 surfaces specifically, pair this skill with `/customgpt-design` so output stays on-brand.

---

# Domain B — Scanning, F-pattern, and Layer-Cake reading

## Scanning: core principles

The foundational truth: **users rarely read on the web — they scan.** Once you accept that, the rest follows. Every paragraph the user "skips" is content you paid to produce that earned zero return. Designing for scanability isn't an accessibility nicety; it's how content reaches eyeballs at all.

### 1. The F-pattern is what happens when you don't design

The F-shape is the *default* scanning pattern users fall into when content is poorly structured: a horizontal sweep across the top, a shorter horizontal sweep further down, then a vertical scan down the left edge. It's not a goal — it's a failure mode. Two consequences matter:

- Users spend roughly **80% of viewing time on the left half** of a page. Anything important that lives on the right is at risk of being ignored.
- Long blocks of unformatted text trigger F-scanning, which means users miss most of the body. Sales copy, key features, calls-to-action, and disclaimers all get skipped.

Bad for users (they miss what they came for) AND bad for businesses (conversions, comprehension, support burden all suffer). Treat any wall of text in a primary surface as a defect.

### 2. Layer-Cake is the pattern you want instead

When content is well-formatted — clear headings, subheadings, short paragraphs, visual rhythm — users switch to a **Layer-Cake pattern**: they scan headings top-to-bottom, dipping into body text only where a heading earns their attention. This is dramatically more efficient and surfaces more of your content.

The shift is entirely in *your* control. Layer-Cake is what good formatting produces.

### 3. Formatting moves that promote Layer-Cake

- Add **headings and subheadings** that genuinely summarize what follows. A heading is a contract: it promises the user what they'll find if they keep reading. If the body doesn't deliver, scanability collapses.
- **Front-load headings with keywords and key points.** Users read the first 2–3 words of a heading and decide whether to continue. "Pricing for teams of 50+" beats "How our pricing works for larger organizations".
- Use **few but noticeable accents** — bold key phrases, callouts, pull quotes. Sparse accents draw the eye; over-accenting (everything bold) collapses back into a wall.
- **Visually group small chunks of related content.** Cards, dividers, background tints, or just generous whitespace all work. Grouping lets users scan-by-block instead of scan-by-line.
- **Alternate sizes, spacing, and patterns** to create rhythm. A page that looks uniform top-to-bottom invites F-scanning; a page with visible variation invites Layer-Cake scanning.
- On **landing pages, alternate points of interest** — image left + text right, then text left + image right, then a centered testimonial, etc. Variation pulls the eye further down the page.
- **Add useful visuals as anchors.** Icons, illustrations, charts, screenshots all give the eye a place to land. Decorative-only visuals don't count — they have to mean something.

### 4. Navigation and layout follow the same logic

- **Horizontal attention leans left.** Favor top-bar and left-sidebar navigation; right-sidebar nav is consistently under-used.
- For **large or complex data tables**, keep **headers floating (sticky)**. Users who've scrolled twenty rows down still need to know what each column means; without sticky headers they scroll back up, lose context, and bail.
- Anything load-bearing — primary CTA, price, status — should live in the upper-left or along the left edge of its container, where eyes go first.

## Scanning: audit checklist (Review mode)

Walk through these in order. For each, answer yes / no / partial, and cite the principle.

1. **Wall-of-text check** — Are there any unformatted paragraphs longer than ~4 lines in a primary surface? If yes, that section is being F-scanned.
2. **Heading coverage** — Does every significant section have a heading or subheading that summarizes it?
3. **Heading front-loading** — Do headings start with keywords that signal content, or do they bury the point at the end?
4. **Accent discipline** — Are bold/highlighted phrases sparse and meaningful, or is "everything important" → "nothing stands out"?
5. **Visual grouping** — Are related items visually grouped (cards, dividers, whitespace) so users can scan-by-block?
6. **Page rhythm** — Does the page alternate sizes, spacing, or patterns, or does it read as a uniform slab?
7. **Landing-page variation** — On marketing pages, do sections alternate layouts and points of interest?
8. **Anchor visuals** — Are there meaningful images/icons/charts roughly every 1–2 screens to give the eye a resting point?
9. **Left-bias of important content** — Is the primary content/CTA on the left side of its container, where eyes go first?
10. **Sticky headers in tables** — Do large/complex tables keep column headers visible on scroll?
11. **Navigation placement** — Is primary nav top or left (not right-only)?
12. **First-screen test** — If a user only sees the top ~600px and scans for 5 seconds, can they tell what this page is about and what to do next?

Return findings grouped by severity (broken / missing / could-be-better), with one suggested fix per finding and a one-line citation of the principle behind it.

## Scanning: design mode notes

When designing or restructuring a content-heavy surface:

- Build the heading outline *first*, before writing body copy or laying out blocks. If the outline alone tells the story, the page will scan well. If the outline is vague, no amount of body copy will save it.
- Treat every paragraph longer than 4 lines as suspect — either break it up, pull out a subheading, or convert it to a list.
- For dashboards and data-heavy screens, reserve the upper-left quadrant for the *single most important number or status*. Users will see it whether they read the page or not.
- On landing pages, sketch the "alternating rhythm" before committing to copy: imagine the page as a stack of blocks where every block looks visibly different from its neighbors above and below.
- For long-form content (blog posts, docs, case studies), a useful self-check: scroll through the rendered page with your eyes squinted so you can't read the words. Do you still see clear structure? If it looks like a uniform gray rectangle, formatting work is needed.

---

# Domain C — Search experiences (end-to-end)

This domain is for the *whole* search experience, not just the dropdown. Autocomplete (Domain A) sits *inside* this — when work involves both the dropdown and the surrounding flow, use C to frame the system and A for the dropdown specifics.

## Search: before you build (planning questions)

Search is one of the most-requested and most-misused enterprise features. Before designing it, force these questions. Many "we need search" briefs collapse on closer look.

- **State of the data.** What can be indexed? Is the data clean enough to surface useful results? If the underlying data is a mess, no UX work fixes it — search will just expose the mess faster.
- **Do you actually need search?** Smaller products often add search "to be safe" before there's enough content to justify it. Test with users before assuming.
- **Search vs. navigation: is search a band-aid for bad IA?** Among the most common UX crimes. If the real problem is that the product has too many pages and nobody can navigate it, adding search papers over the wound without healing it. Different users navigate differently — keyboard-power-users, casual clickers, mobile thumb-users — and search alone never satisfies all of them. Fix navigation first when navigation is broken; add search on top, not instead.
- **"Search, then what?"** Trace the flow past the results page. What does the user *do* with a result? Open it? Bulk-select? Pivot to a filter? Search that dead-ends at an unactionable results page is worse than no search.

## Search: use-case taxonomy

Users come to search with one of four distinct goals. Each demands different result-page structure. Identify which dominate your product before designing.

1. **Find one specific result** — user already knows it exists. e.g., "Sample ID 12342-22". Wants the exact hit, fast. Optimize for top-result accuracy and direct navigation.
2. **Find a range of results** — user wants to compare and contrast. e.g., "blood samples gene 125". Optimize for filtering, sorting, and scannable result cards.
3. **Verify nothing exists** — user uses search to confirm a *negative*. e.g., "duplicate sample 3201-000". Optimize for confident empty states ("0 results — definitely nothing here, here's how we searched").
4. **Find a place to go** — search-as-navigation. e.g., "samples" to jump to a section of the app. Optimize for fast destination jumping (command-palette style).

A single product often serves all four. The mix tells you whether to lead with a results page (#1, #2, #3) or a command-palette overlay (#4).

## Search: end-to-end anatomy

The flow has more moments than people realize. Each is a chance to derail the experience.

**1. The search input itself**
- Use a recognizable search icon with a clear hover state, and a keyboard shortcut (Cmd+K is the de facto standard for app search; / is common too).
- Visible focus state — not optional.
- **Placeholder hints what is searchable AND the scope.** "Search" alone is useless. "Search invoices, contacts, settings…" is useful. "Search items in table below" tells users this isn't a global search.
- The input often expands on focus to give room for query construction. That's fine if the transition is fast and predictable.

**2. The dropdown** (see Domain A for full coverage — the highlights):
- Header categories for scanning when results span types
- Autofocus the top result so Enter "just works"
- Show keyboard hotkeys inline so power-users discover them
- Allow scrolling, with reasonable height limits
- Loading feedback when results take measurable time
- Highlight where each result matches the query

**3. Submit and loading state**
- Indexes don't always return instantly. **Show that the system is working** — skeleton results, progress indicator, or spinner. Without feedback users assume something broke and bail.
- Calibrate loading affordance to expected duration. <300ms: nothing or a subtle pulse. 300ms–2s: spinner or skeleton. >2s: progress feedback or staged result streaming. Long waits without feedback are the single biggest cause of users perceiving search as broken.

**4. The search results page**
- **Tabs** when results span data types (e.g., "All · Docs · People · Files"). Users want to pivot to a single type quickly.
- **Show totals** per tab and overall ("245 results across 3 categories"). Totals frame whether to refine or commit.
- **Highlight matches** within each result. Yellow/bold the matched substring inside the title and snippet so users can see *why* this result came up.
- **Filtering and sorting controls** — see filters as a sister pattern. Faceted filters convert a long results list into a refinable workspace.
- **Pagination** or infinite scroll, sized for the dataset. Large datasets need pagination; smaller ones can scroll.
- **Empty state** when results = 0. Tell users what was searched, suggest fixes (broaden filters, fix typos, try synonyms), and offer a fallback ("Browse all" or "Contact support").

## Search: types of search experiences

Four distinct patterns. They aren't mutually exclusive — many products run two or three in parallel.

### Command search (Spotlight / Cmd+K palettes)
A keyboard-summoned overlay that mixes "go somewhere" with "do something" — jump to a page, run an action, change a setting. Examples: macOS Spotlight, VS Code command palette, Linear's Cmd+K, Notion's quick switcher.

- **Action-oriented.** The distinction between "find content" and "execute action" disappears — users can search for "New invoice" and trigger creation directly. This is the most modern shift in search UX.
- **Keyboard-first.** Designed for users who keep hands on home row. Mouse-only users can still use it, but speed comes from hotkeys.
- **Power-user speed.** Discoverable hotkeys (shown inline in the palette) let users graduate from typing to muscle memory. Big productivity multiplier for daily users.
- **When to consider as primary:** developer tools, admin consoles, design tools, and any product whose users spend hours a day in it. For consumer or first-time-user products, keep command search as a *secondary* affordance.

### Advanced search
Explicit query construction for users who know exactly what they want.

- **Inclusion criteria** — must contain X.
- **Exclusion criteria** — must NOT contain Y.
- **OR criteria** — X or Y (mutually exclusive options).
- **AND criteria** — X and Y (additive).
- **Two UI flavors:** form-based (Google Drive's advanced search dialog with discrete fields) or syntax-based (Jira's JQL, Stack Overflow's `is:question score:5..`). Form-based is approachable; syntax-based is powerful but requires training. Many products offer both, with the form acting as a query-builder that emits syntax.

### Find-in-page (Cmd+F)
String-exact, in-page navigation. Browsers and document tools.

- **No fuzzy matching, no spelling correction.** Find "UX" finds literal "UX". Predictability is the feature.
- **Skip-to-hit navigation.** Arrow keys (or Enter) move between hits with visual emphasis on the current match.
- **When to build:** content-heavy pages where users may know the exact phrase but not the location. Long docs, log viewers, large tables.

### AI / natural-language search
Generative or NLP-driven query understanding. Increasingly merging with command search.

- **Generative workflows.** Query → answer, sometimes with citations and follow-up suggestions. The result is sometimes a synthesized response, sometimes the traditional list, sometimes both.
- **Trust through accuracy.** Hallucinated answers in search erode trust fast. Show sources, expose the underlying retrieval, allow users to "see the raw results" as an escape hatch.
- **Interaction shift.** Search becomes conversational: users refine queries in natural language rather than tweaking filters. Plan for multi-turn flows and history.
- **Caution:** the trust gauge varies wildly between products. Without strong retrieval and accuracy, natural-language search underperforms keyword search and frustrates users.

## Search: scoped search (use with caution)

**Scoped search** restricts the query to a section or content-type rather than the whole site — typically via a dropdown next to the search box, or via category suggestions in the autocomplete list. In theory it saves users a step by pre-filtering. In practice NN/g's research finds it's one of the most error-prone patterns in search UX. Treat it as a sharp tool.

When it backfires, users either keyword-thrash through irrelevant results trying to find content that *was excluded by the scope*, or they conclude the site doesn't have what they want and leave for a competitor. Both outcomes are silent — no error message tells the user "you scoped yourself out of the answer."

### Five failure modes (each with a fix)

1. **Users expect search to cover the whole site.** Most users treat any one site as a single entity and expect search to span everything (including informational content like shipping policies, hours, contact info — not just products). Sites that select a non-global scope *by default* are the worst offenders, because users never made that choice.
   - *Fix:* always default to "all" / the broadest scope. Any scoping must be a deliberate user action.

2. **Users overlook scope widgets.** Task-focused users type and hit Enter without examining dropdowns or auto-suggestions. They don't expect a search box to need configuration.
   - *Fix:* if scope is active, make it unmistakable. Put the scope label adjacent to the search box AND at the top of the results page ("Searching in: Music"). On the results page, offer a one-click escape: "Expand to entire site."

3. **Scoped search forces a decision too early.** Users decide how to refine *after* seeing a bad result list, not before — they're stubborn about typing their query first and refining later. Asking them to pick a scope upfront adds cognitive load they're unwilling to pay.
   - *Fix:* the first / default autocomplete suggestion should always be unscoped. Let users see broad results first, then offer scope refinement on the results page (filters, facets, scope chips that can be removed with one click).

4. **Scope is usually single-select when multi-select would be more appropriate.** A dropdown forces one choice; many real queries straddle two or three categories.
   - *Fix:* evaluate whether faceted **multi-select filters on the results page** (checkboxes for each category) replace the need for upfront scoping entirely. Almost always, they do. If you keep upfront scope, make scope-removal one click.

5. **Indistinct or overlapping scope labels.** When category names are vague or overlap ("Titles" vs. "Names" vs. "TV Episodes" vs. "Keywords" on IMDb), users pause to decode the menu — and the pause itself is the failure. Often this signals a deeper IA problem.
   - *Fix:* scope labels must be clear, distinct, and reflect the user's mental model — not the company's internal org chart. If you can't write clean labels, the underlying IA is the real problem.

### When scoped search is *actually* a good idea

- The dataset is genuinely too large to index at full breadth with acceptable latency (legitimate performance reason — not "we'd rather not"). Even then, default to "all" and let users opt into a scope.
- The user is deep inside a clearly-bounded section where a section-scoped search is the obvious local expectation (e.g., searching *within* a single ticket's comments, or *within* one folder of a file system).
- Intranet employee directory is the one documented case where two side-by-side search boxes ("find person" vs. "find content") work — the two scopes are categorically distinct and users learn the distinction quickly.

If none of those apply, prefer a single search box with **faceted filters on the results page** instead.

## Search: representing matches (often missed)

When one query (e.g., `1232`) could match multiple attributes — a barcode, a lot number, a sample ID, a price, a row inside an image — *tell the user which attribute matched*. Don't make them guess. Show "matched: lot number" or color-code the matched field. This single move is what separates "search that feels smart" from "search that feels random." It's especially critical in data-heavy and scientific tools where the same number can carry many meanings.

## Search: common mistakes

1. **Bad result quality.** Users probe a product's quality via search. Dumb results = lost trust. Use off-the-shelf relevance frameworks where you can.
2. **Timing misfires.** Fuzzy results updating as the user types can shift selection out from under the cursor. Symptoms: user mouses toward a result, it moves, they click the wrong thing. Mitigation: disable selection updates for a brief window during active mouse/keyboard navigation, debounce result updates, or lock the focused row.
3. **Weak discoverability of what's searchable.** Users don't know what's IN the system. Surface examples in the placeholder, in empty-state copy, and in zero-result fallbacks ("Try searching for: invoice, contact, settings").
4. **No loading feedback.** Silent waits read as broken software. Always show the system is working when latency exceeds ~300ms.
5. **No empty state.** Zero results without explanation is a dead end. See the results-page section above for what to include.
6. **Match representation missing.** See above — when one query could match multiple attributes, show which.

## Search: AI's effect on the interaction model

Worth noting because it changes the underlying assumptions:

- Modern search increasingly merges *information access* and *action execution*. Command palettes are the leading edge — search becomes a unified input for "find" and "do."
- This is, oddly, a return to the command-line model — but conversational rather than literal syntax. Users type intent, system interprets.
- For products being designed now: assume the search input will eventually need to handle natural-language commands, multi-turn refinement, and action execution alongside lookup. Architecturally, leave room.

## Search: end-to-end audit checklist (Review mode)

Walk through these for a full search experience.

1. **Justification** — Has the team articulated *why* search is needed vs. fixing navigation/IA?
2. **Use cases** — Are the four user goals (one result / range / verify nothing / where) identified, and does the design serve the dominant ones?
3. **Input** — Search icon, focus state, hotkey, and a placeholder that hints WHAT and the SCOPE?
4. **Dropdown** — See Domain A audit checklist.
5. **Loading feedback** — Calibrated to expected duration? Visible at >300ms latency?
6. **Results page — tabs** — Are different result types separated into tabs or groups?
7. **Results page — totals** — Are match counts shown per tab and overall?
8. **Results page — highlighting** — Are matches highlighted inline in titles/snippets?
9. **Results page — filters & sorting** — Available where the dataset warrants?
10. **Results page — empty state** — When 0 results, is there guidance and a fallback?
11. **Match representation** — When one query could match multiple attributes (barcode vs. lot vs. ID), is the matched attribute shown?
12. **Command-palette opportunity** — Does the product audience (power users, daily users) justify a Cmd+K palette as primary or secondary?
13. **Advanced-search opportunity** — Do users need AND/OR/inclusion/exclusion query construction? If yes, form-based, syntax-based, or both?
14. **Find-in-page** — On long content surfaces, is in-page find supported beyond browser-default Cmd+F?
15. **AI/NLP search** — If using natural-language queries, are sources cited, raw results accessible, and trust signals visible?
16. **Search-then-what** — Does the flow continue beyond the results page (open, refine, bulk-action, pivot), or dead-end?
17. **Scoped search — default scope** — If scoped search exists, does it default to "all" / the broadest scope, or is a narrower scope pre-selected (worst offender)?
18. **Scoped search — visibility** — If a non-global scope is active, is it shown adjacent to the input AND at the top of the results page, with a one-click "expand to entire site" option?
19. **Scoped search — autocomplete default** — Is the first/default autocomplete suggestion *unscoped*, so users only enter a scope by deliberate action?
20. **Scoped search vs. faceted filters** — Could the scope dropdown be replaced by multi-select filters on the results page? (Usually yes — and usually better.)
21. **Scope label clarity** — Are scope categories distinct and aligned with user mental models, or do they overlap and require decoding (a signal of deeper IA problems)?

## Search: design mode notes

When designing search from scratch or rebuilding:

- Start with the four use cases. Sketch a one-line answer to "what does the user *do* once they find it?" for each one. If you can't answer, the design isn't ready.
- Run a quick "is this a navigation problem?" test before committing to search. If the answer is partly yes, do both: improve nav AND add search.
- Involve back-end and data engineers early. What can be indexed, how fast, and how relevance-tunable will shape what's even possible.
- For data-heavy products, the **command palette** + **filters on the results page** combo handles 80% of real use cases. Start there; add advanced/AI patterns when use cases justify them.
- For customgpt.ai V3 surfaces specifically, search is likely a primary interaction — pair this skill with `/customgpt-design` for brand-consistent execution.

## References

External sources backing the principles above. Pull these into context only if the user wants to go deeper on a specific principle — don't summarize them up front.

### Autocomplete

**NN/g (Nielsen Norman Group):**
- Enriched Site-Search Suggestions: Rarely Used — Kate Kaplan (2022) — primary source for the new "enriched suggestions" principle; documents the 7/60 utilization rate and the four failure modes (search-mindset mismatch, slow loading, banner blindness, ad-misinterpretation)
- Site Search Suggestions — Kate Moran

**Long-form articles:**
- 9 UX Best Practice Design Patterns for Autocomplete Suggestions (Only 19% Get Everything Right) — Edward Scott (Baymard Institute, 2022) — research-backed source for scope-suggestion styling, visual-noise reduction, visual-depth/background-dimming, mobile crowding by sticky elements, and the predictive-vs-typed highlighting rule
- Design Patterns For Autocomplete UX — Edward Scott (earlier Baymard piece)
- Building An Accessible Autocomplete — Adam Silver
- Better Autocomplete UX — Vitaly Friedman (Smashing Magazine)
- Five Simple Steps For Better Autocomplete UX — Vitaly Friedman (Smart Interface Design Patterns) — source for the tap-ahead pill pattern, expert query-builder mode, and the focus-suggestions rationale
- Avoid Inline Scroll Areas (26% Get it Wrong) — Baymard — backs up the "no scrollbar in autocomplete" rule
- Streamlining Checkout Experience (Case Study) — DKO

**Real-world implementations worth studying (referenced in the source articles):**
- Google search box — current chip-based tap-ahead pattern
- Stack Overflow search — inline filter syntax (`is:question`, `score:5..`) as power-user mode
- Stripe Dashboard search — suggested filters + search tips for expert users
- Mediamarkt — *cautionary example* of the low-discoverability right-arrow tap-ahead
- IKEA, Prisma.fi, Hema.nl — diversity of suggestion types (keywords + categories + products with thumbnails)

**Design system implementations to compare against:**
- Goldman Sachs Design System
- Gov.uk Design System
- Gusto Workbench
- Shopify Polaris
- Spark (NYT) Design System

**Adjacent interface patterns** (when the work spills beyond the dropdown itself):
- Filters
- Search
- Sorting

### Scanning, F-pattern, and Layer-Cake

**NN/g (Nielsen Norman Group):**
- F-Shaped Pattern of Reading on the Web: Misunderstood, But Still Relevant — Kara Pernice
- Text Scanning Patterns: Eyetracking Evidence — Therese Fessenden
- The Layer-Cake Pattern of Scanning Content on the Web — Kara Pernice
- How People Read Online: New and Old Findings — Kara Pernice

**Foundational:**
- Don't Make Me Think — Steve Krug (chapter on scanning)
- Letting Go of the Words — Janice Redish (heading and chunking guidance)

### Search experiences (end-to-end)

**Long-form articles:**
- Search UX Best Practices — Fanny Vassilatos & Ceara Crawshaw (Pencil & Paper) — primary source for the use-case taxonomy, end-to-end anatomy, search types, and the search-vs-nav anti-pattern
- Scoped Search: Dangerous, but Sometimes Useful — Katie Sherwin (NN/g) — primary source for the scoped-search section; covers the five failure modes and when scoping is actually justified
- Smashing Magazine articles on search and filtering UX

**NN/g (additional search-specific):**
- Site Search Suggestions — Kate Moran
- 7 Ways to Improve Your Website's or Intranet's Built-In Search Engine — Page Laubheimer
- How to Design a Good Search UI — Kara Pernice
- The Pinball Pattern of Scanning Search Results Pages — Kate Moran

**Real-world implementations worth studying:**
- macOS Spotlight, Raycast — gold standard for command search
- VS Code command palette, Linear Cmd+K, Notion quick switcher — app-level command search patterns
- Google Drive advanced search — form-based query construction
- Jira (JQL) — syntax-based advanced search with autocomplete-assisted syntax discovery
- Safari / Chrome find-in-page — minimal pattern for in-page string search
- Algolia — out-of-the-box search framework, useful for studying result-page patterns
- Perplexity, ChatGPT search, Arc Search — current AI-search interaction patterns worth comparing

**Adjacent patterns (sister articles in the Pencil & Paper series):**
- Filters
- Data tables
- Loading UX
- Empty states
- Navigation

If the user asks for any of these by name, surface the URL via web search rather than guessing — links rot and NN/g / Pencil & Paper re-slug articles periodically.
