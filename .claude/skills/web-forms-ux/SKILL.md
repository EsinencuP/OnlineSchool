---
name: web-forms-ux
description: "Best-practice guidance for designing, building, auditing, or reviewing web forms — covering form layout, field ordering, label placement, input types, validation, error messages, disabled states, button placement, date pickers, multi-step forms, conditional reveals, accessible form components, and mobile form UX. Use this skill whenever the user is working on any form — login forms, registration forms, checkout forms, contact forms, search forms, filter forms, settings forms, profile forms, onboarding forms, multi-step wizards, or any collection of input fields. Trigger on words like form, form design, form UX, form layout, input field, text field, label, placeholder, validation, error message, inline error, form error, disabled button, disabled state, date picker, date input, birthday input, multi-step form, wizard, conditional reveal, progressive disclosure, form button placement, submit button, call to action, CTA button, single-column form, multi-column form, radio button, checkbox, toggle, segmented control, dropdown, select, combobox, accessible form, form accessibility, required field, optional field, hint text, helper text — or complaints like 'users skip fields', 'users don't understand errors', 'users don't know where to click', 'form is too long', 'form is confusing'."
metadata:
  tags: forms, form-design, form-ux, input, validation, error-handling, button-placement, date-picker, accessibility, mobile-forms, single-column, disabled-state, conditional-reveal, progressive-disclosure
sources:
  - https://www.smashingmagazine.com/2021/08/frustrating-design-patterns-disabled-buttons/ — Vitaly Friedman, "Frustrating Design Patterns: Disabled Buttons" (Smashing Magazine, 2021)
  - https://adamsilver.io/blog/where-to-put-buttons-on-forms/ — Adam Silver, "Where To Put Buttons On Forms" (adamsilver.io)
  - https://baymard.com/blog/avoid-multi-column-forms — Baymard Institute, "Avoid Multi-Column Forms" (Baymard Institute UX Research)
  - https://www.smashingmagazine.com/2017/07/designing-perfect-date-time-picker/ — Vitaly Friedman, "Designing The Perfect Date And Time Picker" (Smashing Magazine, 2017)
  - https://www.smashingmagazine.com/2021/05/frustrating-design-patterns-birthday-picker/ — Vitaly Friedman, "Frustrating Design Patterns: Birthday Picker" (Smashing Magazine, 2021)
  - https://design-system.service.gov.uk/components/ — GOV.UK Design System, "Components" (Government Digital Service)
related-skills:
  - data-table-ux (tables often appear inside forms or admin interfaces)
  - filtering-ux (filter panels often use form controls)
---

## When to use

Load this skill whenever the task involves designing, reviewing, building, or auditing any form or form component. This includes:

- New form design (checkout, registration, onboarding, settings, contact, search)
- Auditing an existing form for usability or conversion issues
- Choosing input types (text, date, dropdown, radio, checkbox)
- Designing or placing submit, cancel, or back buttons
- Writing or reviewing error messages and validation logic
- Deciding whether to use a date picker, and which kind
- Handling disabled states in forms
- Building multi-step wizards or forms with conditional reveals
- Making forms accessible (keyboard navigation, screen readers, color contrast)
- Optimizing forms for mobile or touch devices

---

## How to use this skill

1. Read the Core Principles relevant to the form type in scope.
2. Check the Pattern Guidance for the specific component being designed (buttons, date inputs, layout).
3. Run the Do / Don't checklist before finalizing any form design.
4. Use the Quick Reference review at handoff or during code review.

---

## Core concept

A form is a conversation between the product and the user. Every field asks a question; every input is an answer. The job of form design is to make that conversation as fast, clear, and error-free as possible — then get out of the way. Most form failures are not technical; they are caused by layout confusion, unexplained blocked states, ambiguous labels, and error messages that tell users what went wrong without telling them how to fix it.

---

## Core principles

### 1. Use single-column layouts by default

Baymard Institute research shows 16% of e-commerce sites still use multi-column checkout forms, despite usability evidence against them. Multi-column layouts divide user attention across the page, increase the risk of skipped required fields, and make it harder to review autocompleted values before submission.

**Rule:** Default to a single column. Guide the user's eye straight down the page — one question at a time.

**Acceptable exceptions** (and only when the fields are conceptually bound):
- Day / Month / Year fields for a date
- First name / Last name (2 fields maximum)
- City / State / ZIP code
- Credit card expiry month / year
- A ZIP code that auto-fills a city field

Even these exceptions work only when the overall form remains single-column. Never apply them as a general layout strategy.

### 2. Place labels above inputs — not beside or inside them

Top-aligned labels:
- Keep label and input visually close, reducing cognitive load
- Are never obscured when the user starts typing (unlike placeholder-as-label)
- Scale cleanly on mobile without requiring layout changes
- Allow longer label text without truncation

Avoid floating labels. They appear above the field only after the user has already clicked in, meaning users must click to discover what the field is for. This creates an interaction cost and harms users with cognitive disabilities.

Avoid placeholder-only labels. Placeholders disappear on input, leaving users unable to check what a field asks for while reviewing their answers.

**Rule:** Label above. Always. Hint text (helper text) goes between the label and the input.

### 3. Never rely on disabled buttons for form validation

Disabled buttons are one of the most frustrating patterns in form design. Research shows users experiencing a disabled submit button systematically troubleshoot: they retry inputs in different formats, re-enter data from scratch, open new browser tabs to preserve their work, and sometimes abandon entirely.

The fundamental problem: a disabled button communicates blockage without explaining why or what the user must do to proceed. Even well-designed inline validation fails on edge cases — unconventional address formats, non-standard tax numbers, anti-spam blocking, or browser extensions interfering with field detection.

**When disabled buttons ARE appropriate:**
- Preventing double submission (disable after first click, show "Processing…")
- Indicating unavailable inventory or features that are genuinely unavailable regardless of user action
- Confirming high-stakes transactions where deliberate friction is intentional (e.g., confirming a large fund transfer)

**When to avoid them:**
- Form submission workflows where users must complete fields
- Any situation where the reason for blockage cannot be immediately, clearly explained in the UI

**If you must use a disabled button:**
- Keep it focusable via keyboard and announce `aria-disabled="true"` (not `disabled`)
- Change cursor to `not-allowed`
- Display clear text below the button explaining exactly what action the user must take
- Provide a customer support link for users who believe they have completed all requirements
- Use loading indicators and updated button text during processing

**Preferred alternative:** Keep the button enabled. Validate on submission. Display an error summary with links directly to each problematic field. Allow submission to proceed with warnings for edge-case values that may be legitimately correct.

### 4. Place the primary button at the left edge, aligned with the form fields

Based on Adam Silver's research drawing on Luke Wroblewski's eye-tracking studies: users scan forms top-to-bottom along the left edge. A submit button aligned left continues that natural path. A centered or right-aligned button forces a scan-interrupting jump.

**Button placement rules by type:**

| Button type | Placement |
|---|---|
| Primary submit | Left-aligned, below the last field |
| Back / previous | Above the form, not beside the submit button |
| Cancel | Below the primary button, styled less prominently |
| "Forgot password" and other tangential links | Above the form, outside the form flow |
| "Add another" | Just above submit, next to the affected field group |
| "Save and exit" | Beside the primary button (equal weight action) |
| Multi-select list actions | Above the list |

**Back button rationale:** Placing "Back" beside "Submit" means keyboard users must tab past it to reach Submit from the last field. Placing it above removes it from the tab order of the form, speeds forward flow, and mirrors the position of the browser back button — which users already trust for navigation.

**Destructive buttons (Delete, Remove):** Style less prominently than the primary action. Caroline Jarrett's principle: "make it harder to find destructive buttons."

### 5. Design error messages that explain and direct — not just flag

Error messages must answer two questions: (1) what is wrong, and (2) what should the user do about it.

**Error summary:** When a form is submitted with errors, display a summary at the top of the page (GOV.UK pattern) with an anchor link to each failing field. This surfaces all errors at once, sets clear expectations, and helps screen reader users navigate directly to the problem.

**Inline errors:** Also display errors inline, directly below the relevant field. Do not use color alone — add an error icon and visible error text. Red border alone is insufficient for color-blind users.

**Error message language rules:**
- Do: "Enter a valid email address, for example name@example.com"
- Do: "Date of birth must include a year"
- Do not: "Invalid input" or "Error in field 3"
- Do not: "Please enter your email address correctly" (too vague)

**Validation timing:**
- Validate on blur (when the user leaves a field), not on every keystroke — keystroke validation is jarring and flags errors before the user has finished typing
- Re-validate on submission to catch anything missed
- Never remove an error message until the user has corrected the issue

### 6. Match input type to the data being collected

Choosing the right input type reduces errors, improves mobile keyboard experience, and communicates format expectations before the user types.

**Input type reference:**

| Data type | Input type | Notes |
|---|---|---|
| Email address | `type="email"` | Triggers email keyboard on mobile |
| Phone number | `type="tel"` | Triggers numeric keyboard; do NOT use `type="number"` |
| Numeric values (quantities, codes) | `type="text"` with `inputmode="numeric"` | `type="number"` adds spinners and has poor accessibility |
| Currency | `type="text"` | Strip currency symbols in JS, not via input constraints |
| Passwords | `type="password"` with visible toggle | Always allow show/hide |
| Dates (near future / appointment) | Custom date input (3 fields or styled input) | See Date Input principle |
| Dates (date of birth / historical) | Three separate labeled text inputs | See Birthday Input principle |
| Few fixed options (≤5) | Radio buttons | Never a dropdown when ≤5 options |
| Many options | `<select>` or combobox with search | Combobox preferred when list > 10 items |
| Boolean yes/no | Checkbox or toggle | Use toggle only for settings that take effect immediately |

### 7. Design date inputs based on the user's mental model, not the calendar widget's model

The date picker is one of the most misapplied patterns in form design. Whether to use a calendar overlay, a text input, or separate day/month/year fields depends entirely on what the user already knows.

**Four distinct date scenarios:**

**A. Known exact date (date of birth, document expiry, event date the user already knows)**
Use three separate labeled text inputs: Day, Month, Year. This matches the user's mental model of a date they have memorized. It supports keyboard-only input, clear field-level validation, and browser autofill.

Never use `<input type="date">` for date of birth — native date pickers force users into calendar navigation through decades of history, require dozens of taps to reach a year in the past, and carry significant accessibility problems across screen readers.

Never use three dropdowns — dropdowns require excessive scrolling (especially for year), create zooming and pinching issues on mobile, and are the "UI of last resort" (GOV.UK).

**B. Browsing for available dates (travel, appointments, hotel booking)**
Use a calendar overlay. Users do not know which dates are available — they need to see availability. Key requirements:
- Show current day clearly
- Disable unavailable dates visually (never show a zero-results page after selection)
- Distinguish weekdays from weekends
- Show 2 months simultaneously to reduce navigation
- Indicate pricing or availability with color and dot indicators
- Support keyboard navigation

**C. Date range selection (travel, reporting, date-filtered search)**
Use a dual-month calendar that visualizes the selected range immediately by connecting start and end dates with a background color. Trigger the end-date picker automatically after start-date is selected. Announce range changes to screen readers.

Target ≤6 taps for range selection. Testing shows frustration rises sharply beyond 10 taps.

**D. Relative or flexible dates ("next month," "anytime in summer")**
Consider alternative patterns: radio buttons for predefined ranges ("This week / Next week / This month"), a heatmap for flexible exploration, or natural language input ("next Friday") processed server-side.

**Universal date input rules:**
- Accept flexible formatting (with or without separators: 01/06/2025, 01-06-2025, 01 06 2025)
- Keep format hint visible in placeholder when field is active
- Inline validation should suggest corrections, not just reject input
- Prepopulate only when confident the default is correct; random defaults force users to "fix" values that were never theirs
- Support keyboard navigation throughout all picker states

### 8. Mark only one class of fields — mark optional, not required

The convention of marking every required field with a red asterisk creates visual noise, implies the unmarked fields are somehow less important, and burdens users with decoding a legend on every form.

**GOV.UK rule (widely adopted):** If most fields are required, mark the optional ones with "(optional)" in the label. If most fields are optional, mark the required ones with "(required)". Eliminate required fields where possible — only ask for what you need.

Avoid asterisks entirely. Use the word "(optional)" — it is unambiguous, does not require a legend, and works with screen readers without additional ARIA.

### 9. Use conditional reveals instead of pre-disabling entire sections

When a form has fields that only appear based on a previous answer, show them progressively — do not render them disabled with a visual hint. Progressive disclosure (conditional reveal) keeps the form visually short, prevents users from attempting to fill in fields that do not apply to them, and reduces cognitive load.

**Implementation:**
- Use JavaScript to show/hide field groups based on radio button or checkbox selection
- The revealed fields must be keyboard-focusable and screen-reader-announced when they appear
- Never animate the reveal too slowly — users tap the radio and expect the new fields to be immediately available
- GOV.UK Design System's "Details" and "Accordion" components implement accessible conditional reveals

### 10. Design for autofill — do not fight it

Browser autofill is the single most effective time-saver in form completion. Fighting it (with `autocomplete="off"`, custom field names, or JavaScript that clears fields) destroys user trust and dramatically increases completion time.

**Rules:**
- Use correct `autocomplete` attribute values on every field (`name`, `email`, `tel`, `bday-day`, `bday-month`, `bday-year`, `cc-number`, `cc-exp`, `cc-csc`, `postal-code`, `address-line1`, etc.)
- Use standard field name attributes that browsers recognize
- Review autocompleted values clearly before submission — in single-column layouts, users can easily scan down; in multi-column layouts they routinely miss an autocompleted field that filled incorrectly

### 11. Ensure keyboard and screen reader accessibility throughout

Forms are the highest-stakes accessibility surface on any website. A visually polished form that cannot be completed by keyboard or screen reader is inaccessible.

**Keyboard requirements:**
- Every interactive element (inputs, buttons, toggles, date pickers, file uploads) must be reachable and operable by Tab / Shift+Tab / Enter / Space / arrow keys
- Focus order must follow visual reading order (top to bottom, left to right)
- Focus indicator must be clearly visible (do not remove browser default without a strong replacement)
- Tab from the last field must land on the primary submit button without passing through back or cancel buttons (see button placement principle above)

**Screen reader requirements:**
- Every input must have a programmatic label (`<label for>` or `aria-label` or `aria-labelledby`)
- Error messages must be associated with their fields via `aria-describedby`
- Error summaries must be announced on submission (use `role="alert"` or move focus to the summary)
- Required fields: use `aria-required="true"` or native `required` attribute
- Disabled vs. unavailable: use `aria-disabled="true"` for buttons that should remain keyboard-focusable but not active; use `disabled` only when removing from tab order is intentional
- Date range pickers must announce selected ranges as they change

**Color and contrast:**
- Error states must not rely on color alone — always combine color with an icon or text label
- Input borders and focus rings must meet WCAG 2.1 AA contrast requirements (3:1 for non-text, 4.5:1 for text)

### 12. Multi-step forms: show progress, persist data, support back navigation

Multi-step forms (wizards) reduce perceived complexity by breaking long forms into manageable chunks. They work well for onboarding, checkout, and multi-topic data collection — but only when implemented correctly.

**Rules:**
- Show a step indicator ("Step 2 of 4") — users need to know how far they are and how much remains
- Persist entered data across steps — never lose a user's input when they go back
- Support browser back button — users expect it to go to the previous step, not away from the form
- Allow editing of earlier steps — show a summary/review screen before final submission
- Keep each step focused on a single topic or decision (address, then payment, then review — not mixed)
- Validate each step on "Next" click, not only at final submission

---

## Pattern guidance

### Login forms
- Label above username/email; label above password
- Show/hide password toggle is mandatory
- "Forgot password" link goes above the form, outside the flow — not between fields
- Error message: "The email address or password is incorrect" (intentionally vague for security)
- Autofill: `autocomplete="current-password"` on password field

### Registration / signup forms
- Ask for the minimum required to create an account — defer profile data collection to after first login
- Password: show strength indicator, show requirements before the user types (not as an error)
- Email confirmation field: research shows it increases errors without improving accuracy — omit it; rely on a confirmation email instead
- Autofill: `autocomplete="new-password"` on password creation field

### Checkout forms
- Single column throughout
- Group fields by topic with headings (Contact / Shipping / Payment) — but do not use tabs that hide sections
- Expiry month + year can be 2 columns (mirrors the physical card); CVV can be on the same line
- Billing address: offer "Same as shipping" toggle to avoid re-entry
- Never disable the submit button — validate on submission

### Contact / feedback forms
- Minimum viable: name, email, message
- Textarea: show a character count if there is a limit (GOV.UK character count component)
- File upload: show accepted file types and size limits before the user selects a file, not as an error afterward

### Settings / profile forms
- Use inline save (save each section independently) or a clear Save button per section — do not rely on a single global Save for an entire settings page
- Show current values pre-filled
- Destructive actions (delete account, remove data) require separate confirmation step — never on the same button press

---

## Anti-patterns — never do these

1. **Disabled submit button without explanation** — Users cannot tell what is wrong or how to fix it. Use enabled button + submission-time validation instead.
2. **Multi-column form layout for unrelated fields** — Divides attention, increases errors, causes skipped fields.
3. **Placeholder text as the only label** — Disappears on typing; not a label; fails accessibility.
4. **Floating labels** — Users must click to see what the field asks; harms users with cognitive disabilities.
5. **`<input type="date">` for date of birth** — Forces slow calendar navigation through decades; accessibility failures across screen readers.
6. **Three dropdowns for date of birth** — Excessive scrolling for year; mobile usability failure; the "UI of last resort."
7. **Red asterisk on every required field** — Visual noise; decodes to "avoid the unmarked fields." Mark optional fields instead.
8. **`autocomplete="off"` on standard form fields** — Destroys autofill, dramatically increases completion time.
9. **Keystroke-level validation** — Flags errors before the user finishes typing; creates anxiety and interrupts flow.
10. **"Invalid input" as an error message** — Tells the user nothing actionable. Always explain what is wrong and how to fix it.
11. **Back button beside the submit button** — Forces keyboard users to tab past Back to reach Submit. Place Back above the form.
12. **Cancel button styled identically to Submit** — Equal visual weight implies equal intent; style cancel as a secondary or text link.
13. **Random default dates in date pickers** — Forces users to fix values they never set; only prepopulate when confident.
14. **Hiding form sections in tabs** — Users miss required fields in inactive tabs; use a single-column accordion or multi-step wizard instead.
15. **Sliders for precise value selection (including time)** — Too imprecise; use steppers or text input for exact values.

---

## Do / don't checklist

### Layout
- [ ] Single-column layout used throughout (with only tightly bound exceptions)
- [ ] Labels are above their inputs, not beside or inside
- [ ] Hint text appears between the label and the input
- [ ] Fields are grouped logically with visible headings
- [ ] No placeholder-only labels

### Buttons
- [ ] Primary submit button is left-aligned with the form fields
- [ ] Back button is above the form, not beside the submit button
- [ ] Destructive buttons are styled less prominently than the primary action
- [ ] "Forgot password" and tangential links are above the form
- [ ] Submit button remains enabled; validation happens on submit

### Validation and errors
- [ ] Error summary shown at top of page on submission failure, with links to each field
- [ ] Inline errors shown below each failing field
- [ ] Error messages explain what is wrong AND how to fix it
- [ ] Errors use icon + text + color (not color alone)
- [ ] Validation fires on blur, not on every keystroke
- [ ] Error messages are associated with fields via `aria-describedby`

### Date inputs
- [ ] Date of birth uses three separate labeled text inputs (Day / Month / Year), not a calendar or three dropdowns
- [ ] Appointment / availability date uses a calendar overlay with disabled unavailable dates
- [ ] Date range uses a dual-month connected calendar
- [ ] All date inputs accept flexible separator formats
- [ ] No random default date values

### Input types
- [ ] Email field uses `type="email"`
- [ ] Phone field uses `type="tel"` (not `type="number"`)
- [ ] `autocomplete` attributes set correctly on all fields
- [ ] Passwords have show/hide toggle
- [ ] ≤5 options use radio buttons, not a dropdown

### Required / optional fields
- [ ] Optional fields marked "(optional)" — required fields NOT marked with asterisk (unless most fields are optional)
- [ ] Only necessary fields are included

### Accessibility
- [ ] Every input has a programmatic label
- [ ] Focus order follows visual reading order
- [ ] Focus indicator is clearly visible
- [ ] All interactive elements are keyboard-operable
- [ ] `aria-required` or native `required` set on required fields
- [ ] Screen reader announcement on error summary display

### Mobile
- [ ] Touch targets are at minimum 44×44px
- [ ] Calendar overlays are full-screen on narrow viewports
- [ ] No sliders used for precise input
- [ ] Form tested on real device, not just browser resize

---

## Quick reference: the 60-second form design review

Run these six questions at handoff or in code review:

1. **Layout:** Is the form single-column? Are there any side-by-side fields that are not conceptually bound?
2. **Labels:** Are all labels above their inputs? Is there any placeholder-only labeling?
3. **Submit button:** Is it enabled? Is it left-aligned? Is Back above the form, not beside Submit?
4. **Errors:** Do error messages explain what is wrong AND what to do? Is there an error summary with anchor links?
5. **Date inputs:** Is date of birth three separate text fields? Is the date picker used only for availability/browsing scenarios?
6. **Accessibility:** Does every input have a label? Are errors associated with fields? Is the focus order correct?

If any answer is "no," refer to the relevant Core Principle above.
