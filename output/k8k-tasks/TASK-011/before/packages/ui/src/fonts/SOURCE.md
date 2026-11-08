# Golos Text — Romanian supplement

Derived from `@fontsource-variable/golos-text@5.2.8`,
`files/golos-text-latin-ext-wght-normal.woff2` (19,180 bytes).
Copyright 2019 The Golos Text Project Authors. OFL-1.1: see [LICENSE](LICENSE).
Exact source/output SHA256, retained codepoints and weight axis: [provenance.json](provenance.json).

This is the same Golos Text family, not a second UI font. The original Cyrillic and
Latin assets remain unmodified. Only missing Romanian letters and supported legacy
S-cedilla variants are added (3,544 bytes, wght400–900).
Legacy T-cedilla and decomposed combining marks absent from upstream cmap retain
readable system fallback; human-provided text is not normalized or rewritten.

Regeneration/check tooling is isolated; no JS/runtime dependencies:

```powershell
python -m pip install --no-deps --only-binary=:all: --target output/k8k-tasks/TASK-006/tooling -r scripts/k8k-font-requirements.txt
pnpm k8k:fonts:check
```

Initial generation used `python -B scripts/k8k-font-assets.py generate` before the
asset existed. It refuses overwrites; check regenerates in memory and compares bytes.
Use the original Fontsource package and pinned tools when reviewing future changes.

CSS uses `?no-inline` so Vite emits the WOFF2 once and route budgets count its raw
bytes separately. All three subsets are included in k8k-route-v2 totals, regardless
of which subset a particular locale actually requests.
