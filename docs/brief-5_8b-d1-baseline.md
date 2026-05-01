# Brief 5.8B — D1 precondition check

Captured against branch `ui/post-analysis-tier-hierarchy-5_8b` (forked from `origin/staging` at `a307a044`).

## Tooling

- pnpm 10.x.

## Branch start point

- `origin/staging` head: `a307a044` — "Merge branch 'ui/pre-analysis-tier-hierarchy-5_8a' into staging"
- 5.8A merged (verified): pre-analysis T1 unified card present (`T1DecisionReadinessCard` symbol resolved at `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx`).
- Two follow-up commits since the original 5.8A merge `e45597c9`:
  - `a307a044` — re-merge of `ui/pre-analysis-tier-hierarchy-5_8a` (likely a fast-forward roll-up)
  - `6bf697e9` — `refactor(5.8a): tighten freshness boundary types + scope docs`

## Brief D6 "a307a04" orphan-text disposition (pre-flagged for D6)

The brief D6 cites `a307a04` as orphan text near the footer. **The current `staging` HEAD commit is `a307a044`** — the brief author was likely seeing the deploy commit hash rendered in the Advanced metadata `responseHash` row (`AdvancedSection.tsx:386-410`), not stray text. D6 will verify whether the rendering is the live `responseHash` field (correct) or a stale literal (orphan to remove).

## File baselines

| File | Lines | Bytes |
|---|---:|---:|
| `src/components/results/ResultsBody.tsx` | 413 | 19 245 |
| `src/components/results/DecisionConfidencePanel.tsx` | 639 | 27 155 |
| `src/components/results/DriversSection.tsx` | 906 | 38 309 |
| `src/components/results/ChallengeSection.tsx` | 439 | 19 340 |
| `src/components/results/OptionCards.tsx` | 622 | 24 425 |
| `src/components/results/AdvancedSection.tsx` | 454 | 19 069 |
| `src/components/results/useResultsSectionData.ts` | 2 508 | 109 934 |
| `src/components/results/utils/certaintyCopy.ts` | 216 | (LOCKED) |
| `src/components/results/utils/winnerChipCopy.ts` | 54 | (LOCKED) |
| `src/components/results/ResultsFooter.tsx` | 64 | 2 187 |
| `src/components/results/TornadoChart.tsx` | 736 | (DO NOT TOUCH) |

## Test baseline

`pnpm exec vitest run src/components/results/`:

- **Test files:** 52 passed (52 total).
- **Tests:** 974 passed. Zero failures.
- **Duration:** 22.92s.

`pnpm run typecheck`: pass (no errors).

## Architecture-invariant baselines

`rg "as any" src/components/results/`:

- **21 occurrences in production files** (not tests). D9 gate: must not exceed 21.
- 47 total including tests.

## D9 grep-gate baselines

| Gate | Pre-D0 count | Notes |
|---|---:|---|
| `rg "Highest-value evidence gaps" src/components/results/` | 9 (across 4 files) | DCP × 4, certaintyCopy × 2, plus 3 spec lines. D2b removes the production heading. |
| `rg "Suggested next actions" src/components/results/` | 5 (across 2 files) | DCP × 4 + 1 spec line. D2b removes. |
| `rg "Before you decide" src/components/results/` | 1 | ResultsBody only. D4 replaces with Stress-test. |
| `rg "Review next" src/canvas/components/pre-analysis/` | 7 (comment-only) | All `/** */` or `//` documentation. D0 cleans for D9 zero-hit gate. |
| `rg "Improve confidence" src/canvas/components/pre-analysis/` | 4 (comment-only) | All comments. D0 cleans. |

## Stash entries on machine (not relevant)

10 stash entries from prior sessions; all clearly tagged to other branches. None touched by this brief.

## Pending Paul-side step

Baseline screenshots — see `docs/brief-5_8b-baseline-screenshots/README.md` for capture instructions. These feed the D9 before/after comparison.

## Halt status

No halt conditions tripped. Proceeding to D0.
