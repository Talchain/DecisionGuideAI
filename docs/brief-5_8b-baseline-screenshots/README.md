# Brief 5.8B — D1 baseline screenshots

This folder is the staging area for **before** screenshots captured against branch `ui/post-analysis-tier-hierarchy-5_8b` at the D1 commit. Pair with **after** screenshots captured at D9 for the final review's before/after comparison (per Paul's directive).

## Capture instructions (Paul)

Dev server: `pnpm run dev` → <http://localhost:5173/>.

Capture five panel states and save into this folder with the exact filenames below. For each, capture the entire scrollable panel:

1. `01-baseline-post-stable.png` — Post-analysis with high stability + low evidence gaps (a "stable result" run).
2. `02-baseline-post-fragile.png` — Post-analysis with low stability, evidence gaps, and a dominant factor (a "fragile result" run).
3. `03-baseline-post-expert-on.png` — Post-analysis with the existing expert-mode hidden state visible (whatever path currently injects `expertMode={true}` — may require dev-tools tweak).
4. `04-baseline-pre-full.png` — Pre-analysis full-data state (CEE coaching present, widening_log + bias_signals + multiple unverified estimates) — for D0 before/after.
5. `05-baseline-pre-sparse.png` — Pre-analysis sparse state (no widening_log, no bias_signals, no contributions confirmed, goal target unset) — to verify D0 doesn't regress empty states.

## Why these are committed

Brief D9 requires a true before/after comparison embedded side-by-side in the final review doc. Capturing baselines at the D1 commit hash ensures the comparison is against the pre-change state, not a remembered approximation.

## Branch + commit at capture time

- Branch: `ui/post-analysis-tier-hierarchy-5_8b`
- D1 commit hash: see `git log --oneline -1` immediately after the D1 commit lands
- Forked from `origin/staging` at `a307a044`
