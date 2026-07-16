# Archived: dead canvas components (2026-07-16)

Eight components moved here from `src/canvas/components/` (plus their
specs — four co-located in `src/.../__tests__/`, one in the root
`tests/` mirror, which the first sweep missed and CI caught) after a full reference census at staging `8762a9b4`
found **zero live references** for each — no static import, no lazy
`import()`, no JSX use, no re-export; the only mentions in `src/` were
comments. `DriversSignal` and `OutcomesSignal` were imported solely by
`DetailedAnalysisSection`, itself dead, so the chain moves together.

| File | Last live context |
|---|---|
| `CanvasEmptyState.tsx` | Never mounted; advertised a fabricated `R` shortcut; DS-legacy tokens throughout |
| `EmptyStateOverlay.tsx` | Never mounted (FirstUseComposer owns the first-run surface) |
| `InputsDock.tsx` | Superseded by the pre-analysis panel; only mention is a JSX comment in ReactFlowGraph |
| `DecisionReviewPanel.tsx` | Superseded by the Decision overview card |
| `MultiGoalParetoPanel.tsx` | No mount since the multi-goal experiment ended |
| `DetailedAnalysisSection.tsx` + `DriversSignal.tsx` + `OutcomesSignal.tsx` | Dead chain — section unmounted, signals only reachable through it |

## Why archived rather than deleted

These carry ~340 legacy design-token usages — the bulk of the DS
ratchet's violation count — and were polluting every "how much does the
UI deviate" measurement. Archiving (a) removes them from builds, tests,
and metrics (`archive/` is outside the `src/` globs of tsconfig.app,
vitest, and the DS compliance guard), (b) keeps them one `git mv` away
from resurrection, and (c) records WHY they left, which a bare deletion
buries in a commit message.

## Not archived, deliberately

- `DebugDrawer.tsx` — lazy-loaded by `App.tsx`. App.tsx is itself the
  dead legacy shell (live app is AppPoC), but retiring it is its own
  ruling; archiving the drawer alone would break App.tsx's build.
- `ComparisonCanvasLayout.tsx`, `DecisionSummary.tsx` — the liveness
  census proved these ARE live (rendered by ReactFlowGraph / type+helper
  consumers). An earlier static-import audit wrongly flagged them:
  a symbol grep is not a liveness proof.

## Resurrection

`git mv` the file back and re-run the census on its imports. Full
pre-archive history: `git log --follow -- 'archive/dead-canvas-components-2026-07/<file>'`.
Archived at staging tip `8762a9b4` by the UI/Experience workstream.
