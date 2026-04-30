# Brief 5.8A — D1 baseline screenshots

This folder is the staging area for **before** screenshots captured against branch `ui/pre-analysis-tier-hierarchy-5_8a` at the D1 commit. Pair these with the **after** screenshots captured at D7 for the final review's before/after comparison.

## Capture instructions (Paul)

Dev server runs at <http://localhost:5173/>.

Capture three pre-analysis panel states and save into this folder with the exact filenames below:

1. `01-baseline-full.png` — open a draft with full coaching data populated (CEE response landed; `widening_log`, `bias_signals`, several `strengthen_items`; multiple unverified estimates; multiple edges flagged).
2. `02-baseline-sparse.png` — same panel but force a sparse state: no `widening_log`, no `bias_signals`, no contributions confirmed yet, goal target unset.
3. `03-baseline-all-verified.png` — same panel after every triage item has been confirmed/edited (green state, "Analyse now" should be active).

Each screenshot should capture the entire scrollable pre-analysis panel (use the browser's full-page capture, e.g. Cmd+Shift+4 area selection or a full-page tool).

## Why these are committed

The brief 5.8A D7 review requires a true before/after comparison. Capturing baselines at commit time ensures the comparison is against the pre-change state, not a remembered approximation.

## Branch + commit at capture time

- Branch: `ui/pre-analysis-tier-hierarchy-5_8a`
- D1 commit hash: see `git log --oneline -1` immediately after the D1 commit lands
