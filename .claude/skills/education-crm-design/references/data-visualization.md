# Data visualization

Before any chart answer: question, decision, data source, formula, period, comparison, detail link.
If any answer is "unknown", show a table or nothing.

| Need | Chart | Component |
|---|---|---|
| Trend of a continuous measure | line | (add when a real series exists) |
| Small daily counts | columns | `DailyColumns` |
| Compare categories | horizontal bars, ranked | `HBarList` |
| Composition, ≤ 5 parts | segmented bar | `ShareBar` |
| Actual vs limit/target | bar + reference line | `Bars limit=` / bullet |
| Load over time grid | heatmap with classed tiers | — |
| Sequential conversion | funnel **only** for cohort data | not available: stage counts are a snapshot |
| Exact values | table | `.table-wrap` |

Rules:
- No smoothed curves for integer counts; no dashed "ghost" bars; no 3D, no decorative gradients.
- Bars start at zero. Axis max is labelled. Previous/secondary series in `--c-prev`.
- Colour by meaning: problem tier warm, intensity grows toward the problem.
- Pie/donut only for ≤ 4 parts of a real whole; prefer `ShareBar`.
- Every chart has an accessible name; `DailyColumns` also renders an sr-only table.
- Stage counts are labelled "сейчас" and never shown with step-to-step conversion percentages.
- Hard-coded denominators are forbidden (e.g. a ring "of 8" lessons): use `totalLessons`.
