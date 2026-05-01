# Brief 5.8A — D1 precondition check

Captured against branch `ui/pre-analysis-tier-hierarchy-5_8a` (forked from `origin/staging` at `af5fcb11`).

## Tooling

- pnpm 10.x (repo migrated; `pnpm run …` and `pnpm exec …` used throughout the brief).

## File baselines

| File | Lines | Bytes |
|---|---:|---:|
| `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | 2204 | 103 366 |
| `src/canvas/components/pre-analysis/ModelHealthCard.tsx` | 145 | 5 516 |
| `src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts` | 2040 | 87 619 |
| `src/canvas/components/pre-analysis/WhatOlumiAddedSection.tsx` | 117 | 4 426 |
| `src/canvas/components/pre-analysis/provenanceUtils.ts` | 9 | 380 |
| `src/components/shared/MissingKnowledgePrompt.tsx` | 71 | 2 717 |
| `src/components/shared/TriageCard.tsx` | 545 | 22 399 |
| `src/canvas/components/pre-analysis/DraftStrengthenSection.tsx` | 93 | 3 816 |

## Brief baseline assertions (verified)

- ✅ Wireframe present at `docs/wireframes/analysis-tab-v7.html` (502 lines).
- ✅ `WhatOlumiAddedSection` exists.
- ✅ Authority bias card filter is in place (`shouldSuppressBiasFinding` at `PreAnalysisPanel.tsx:246`); 11 dedicated tests pass.
- ✅ Thin influence bar (3px) confirmed in `TriageCard.tsx` (compact + default variants).
- ✅ "Model checks" floating card is gone (`rg "Model checks"` → 0 hits in `pre-analysis/`).
- ✅ Readiness ring labels are "Decision shape" (`ModelHealthCard.tsx:45`) and "Your contribution" (`ModelHealthCard.tsx:47`).

## Test baseline

`pnpm exec vitest run src/canvas/components/pre-analysis/ --reporter=verbose`:

- **Test files:** 40 passed, 1 skipped (41 total).
- **Tests:** 641 passed, 13 skipped (654 total). Zero failures.
- **Duration:** 19.46s.

`pnpm run typecheck`: pass (no errors).

## Removal-target string occurrences (D3b will eliminate the production headings)

- "Review next" — production heading at `PreAnalysisPanel.tsx:1760` (`<SectionHeader title="Review next" …>`); ~30 other matches in comments + tests will follow.
- "Improve confidence" — production heading at `PreAnalysisPanel.tsx:602` (`<h3>Improve confidence</h3>`); ~30 other matches in comments + tests will follow.

## Architecture-invariant baseline

`rg "as any" src/canvas/components/pre-analysis/`:

- 7 files contain `as any`.
- 27 total occurrences. **D7 gate: must not exceed 27.**

## Stash entries on machine (not relevant to this brief)

10 stash entries exist from prior sessions; all clearly tagged to other branches (`ui/ai-panel-tranche-1`, `fix/poc-testing-ui-fixes`, `feat/plot-lite-ghost-flows`, etc.). None touched by this brief.

## Pending Paul-side step

Baseline screenshots — see `docs/brief-5_8a-baseline-screenshots/README.md` for capture instructions. Dev server running at <http://localhost:5173/>.

## Halt status

No halt conditions tripped. Proceeding to D2 once D1 commits.
