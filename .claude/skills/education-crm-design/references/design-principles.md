# Design principles

1. **One question per screen.** Write it in a comment at the top of the page component.
2. **Problems are warm, everything else is calm.** `--danger`/`--yellow` only for a state that needs
   action; healthy data is neutral grey or the entity hue (`--c-people`, `--c-money`).
3. **Every number has context** — a unit plus one baseline or period ("из 9 открытых", "за 30 дней").
4. **Honest by default.** `—` means no data; never `0`, `0%` or a hard-coded denominator. A chart
   and its KPI read from the same records.
5. **Action next to the signal.** An attention row carries its action ("Открыть задачу", "Принять").
6. **Progressive disclosure.** Level 1 KPI → level 2 breakdown → level 3 records; each KPI links to
   its records with the filter applied.
7. **Density without noise.** 13–14 px body, 24 px page title, 8–12 px radii, borders over shadows,
   no decorative shapes, mascots only in the student cabinet.
8. **Visible controls for small choices.** Segmented control/chips for ≤ 7 options; dropdown or
   searchable select only for long lists.
9. **No card-in-card.** A table inside a card uses `.table-wrap.flush`.
10. **Reuse before inventing.** New primitive only when two screens need it.
