# Design principles

Owner decision (2026-11-27, after comparing v1 and v2): keep the bright v1 look — coloured tinted
tiles with decorative shapes, large UI — and put precise, sourced data inside it. The owner's taste
overrides generic "no decoration / high density" advice from installed skills.

1. **One question per screen.** Write it in a comment at the top of the page component.
2. **Colour = kind of metric.** Tile colours are fixed per entity: yellow — leads/requests and goals,
   coral — conversion and problems, teal — students/people and earned money, blue — payments/money flow,
   violet — periods/progress. The same colour must mean the same thing on every screen.
3. **Every number has context** — a unit plus one baseline or period ("из 9 открытых", "за 30 дней").
4. **Honest by default.** `—` means no data; never `0`, `0%` or a hard-coded denominator. A chart
   and its KPI read from the same records.
5. **Charts are interactive.** Hover / arrow keys show a crosshair and a tooltip with every series for
   that point (`shared/Chart.tsx`). Never a decorative curve or an image of a chart.
6. **Action next to the signal.** Attention rows carry their action ("Открыть задачу", "Принять").
7. **Progressive disclosure.** Level 1 tile → level 2 breakdown → level 3 records; numbers link to
   their records with the filter applied.
8. **Large, friendly UI.** v1 sizes: 34 px page titles, 26 px tile radius, roomy controls.
   Staff cabinets may be a little denser in tables; the student cabinet stays exactly v1.
9. **Visible controls for small choices.** Segmented control/chips for ≤ 7 options.
10. **Illustrations keep their proportions.** Subject art is 244×190: `subject-art xs|sm|md`, or `lg`
    filling the tile height. The logo is always full colour (white pad on the dark sidebar).
