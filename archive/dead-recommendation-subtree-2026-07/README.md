# Archived: the `useRecommendation` / `RecommendationCard` subtree (2026-07-27)

Twenty-two files (15 source + 7 specs) moved here from `src/canvas/` after a reachability census at
staging `6d474415` found the subtree has **zero production importers**. Source
layout is mirrored under `canvas/` so relative imports *within* the subtree
still resolve; imports reaching *out* to still-live `src/` modules are broken
by the move, exactly as in `../dead-canvas-components-2026-07/`.

Verdict, method, and the served-bundle evidence:
`docs-designs/USERECOMMENDATION-REACHABILITY-2026-07-27.md` (pinned `13cca490`;
re-derived at `6d474415` before this move — see "Re-derived" below).

## What moved

| File(s) | Why it died |
|---|---|
| `hooks/useRecommendation.ts` | Only production importer was `RecommendationCard/index.tsx`, itself dead |
| `components/RecommendationCard/index.tsx` | Zero production importers; one test-only importer (its own spec) |
| `RecommendationCard/{Assumptions,ConstraintViolations,Drivers,Tradeoffs}Section.tsx`, `ExpandableSection.tsx`, `RobustnessIndicator.tsx`, `RobustnessBlock.tsx` | Mounted only by `index.tsx` |
| `RecommendationCard/ParetoMiniChart.tsx` | Second-round cascade — imported only by `RobustnessBlock.tsx` |
| `components/ConditionalGuidance/{index.tsx,types.ts}` | `index.tsx` mounted only by `RecommendationCard/index.tsx`; `types.ts` then had no live importer |
| `hooks/useConditionalRecommendations.ts` | Imported only by `RecommendationCard/index.tsx` and `ConditionalGuidance/index.tsx` — both dead |
| `utils/coherenceCheck.ts`, `utils/cleanInsightText.ts` | Second-round cascade — production importer was `index.tsx` only; each retained just its own spec |
| the 7 co-located specs | Coverage of the above; no live subject remains |

## KEPT in `src/`, deliberately — the trap in this slice

**`src/canvas/components/RecommendationCard/types.ts` is LIVE and stays.** It
has zero runtime exports (type-only, no runtime footprint), which makes it look
archivable, but **10 live modules import types from it** after this change:
`canvas/types/robustness.ts`, `canvas/adapters/{islRobustnessAdapter,ceeSynthesisAdapter}.ts`,
`canvas/components/ResultsPanel/{SensitivityList,ValueOfInformationList,KeyDriversPanel,TippingPointsList}.tsx`,
`canvas/hooks/useRobustness.ts`, `adapters/plot/enrichment.ts`,
`hooks/useResultsPanelData.ts`. Moving it breaks the build. The directory is now
what it always effectively was: a live *types* module that happened to have a
dead *component* next to it.

**`src/canvas/hooks/useRobustness.ts` also stays** — still imported by
`canvas/components/OutputsDock.tsx` and `hooks/useResultsPanelData.ts`.

## Re-derived at this tip, not inherited

The reachability doc was pinned at `13cca490`; this move happened at
`6d474415`. The cascade was re-derived from an exact reverse-dependency map
(every import specifier resolved to a real path, then inverted) rather than a
symbol grep, because four name collisions make a symbol grep wrong here:

- TWO `DriversSection.tsx` (this one; `components/results/DriversSection.tsx` is LIVE)
- TWO `ExpandableSection.tsx` (this one; `pages/sandbox-guide/components/shared/` is LIVE)
- `useRobustness` (this hook vs an unrelated export of `inspector-v2/useAnalysisResults`)
- `RobustnessIndicator` (this component vs a LOCAL function declared at
  `canvas/conversation/InlineBlocks.tsx:815` — the JSX mount at `:752` is its own,
  and would read as a live importer of this file to any grep)

The re-derivation also found the cascade runs **wider** than the pinned doc's
co-fate list: `ConditionalGuidance/`, `useConditionalRecommendations.ts`,
`coherenceCheck.ts` and `cleanInsightText.ts` are all only reachable through
`index.tsx` and were not on it.

## Consequence worth stating

`useRecommendation.ts` held the UI's **only** call site of
`/bff/engine/v1/recommend/generate`. That endpoint is now **UI-unconsumed**.
This is deliberate, not incidental — do not read the UI's silence as evidence
the endpoint is unused by other services.

## Why archived rather than deleted

Same rationale as `../dead-canvas-components-2026-07/README.md`: `archive/` sits
outside the `src/` globs of `tsconfig.app`, vitest, and the DS compliance guard,
so these files leave builds, tests and metrics while staying one `git mv` from
resurrection — and the reason they left is recorded here rather than buried in a
commit message.

Note the one baseline this *raises*: `scripts/ci/typecheck-uncovered.txt` is a
per-file exception list for tracked TypeScript that no tsconfig loads, and it is
**bidirectional** (a stale entry fails the gate too). Archiving therefore *must*
add an entry per moved file. That growth is the gate correctly accounting for
files that left the compiled set — not a suppressed regression. The ratchet
(`typecheck-baseline.txt`) and the DS baseline both shrink.

## Resurrection

`git mv` the file back, restore its relative import paths, and re-run the
census on its importers. Full pre-archive history:
`git log --follow -- 'archive/dead-recommendation-subtree-2026-07/<path>'`.
Archived at staging tip `6d474415`.
