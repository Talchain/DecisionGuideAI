# Brief 5.5 Close-Out — Final Review (D6)

Branch: `ui/brief-5_5-closeout` (5 commits, local only)  
Completed: 2026-04-25

---

## Deliverable status

| D# | Description | Status | Commit |
|---|---|---|---|
| D1 | Precondition + CI baseline | **Delivered** | 6d5a002a |
| D2 | Lint warning cleanup (23 warnings) | **Delivered** | 9fb7b1f6 |
| D3 | MissingKnowledgePrompt dependency inversion | **Delivered** | f965c084 |
| D4 | ResultsBody caption/code typography resolution | **Delivered** | ed60bf1b |
| D5 | Stash list triage | **Delivered** | 4716fd47 |

---

## D1 — CI full-suite result for Brief 5.5 push

- CI run 24896181042 (SHA 7a561a99): **FAILED** at "Use Node.js from .nvmrc" step
- **Root cause: persistent GitHub Actions infra issue** (same failure on runs 24862646182, 24919713206 — before and after Brief 5.5). Not caused by Brief 5.5 code.
- All downstream jobs (typecheck, tests, build) were SKIPPED — no test failures produced.
- Halt condition does not apply. Close-out proceeded on local baseline.
- Action: re-run CI when GHA infra is stable to confirm zero test regressions.

---

## D2 — Lint warnings before/after

| File | Before | After | Resolutions |
|---|---|---|---|
| PreAnalysisPanel.tsx | 4 | 0 | Cat-B: removed 3 dead callbacks (handleFocusEdgeById, handleAddEvidence, expertiseHasItems). Cat-E: removed redundant data.enrichedBlockers from useMemo deps. Cascaded: removed focusEdgeById import, selectEdgeWithoutHistory. ESLint disable on mustFixCards (pre-existing array-in-deps pattern). |
| DecisionConfidencePanel.tsx | 1 | 0 | Cat-C: prefixed _expertMode (OutputsDock passes it, component ignores). |
| DriversSection.tsx | 10 | 0 | Cat-A: removed stripEncodingNotation import. Cat-D: removed ExpandedDetails dead component (186-309). Cascaded removals: useUIStore, formatPercent, ShieldCheck, ShieldAlert imports; BootstrapStabilityIndicator function; goalLabel→_goalLabel in DriverRow. Cat-B: labelQualifier, topDrivers, hiddenCount. Cat-C: _outcomeUnit/_outcomeUnitSymbol/_isNormalised. |
| ResultsBody.tsx | 7 | 0 | Cat-C: prefixed _isRunning and 4 other callback props (all passed by OutputsDock). Cat-B: removed hasGuidanceItems, flashOptionCard. Cascaded: useCallback import, _guidanceItems. |
| TornadoChart.tsx | 1 | 0 | Cat-C-remove: onApplyAndRerun — zero callers; removed from interface + destructuring. |
| **Total** | **23** | **0** | |

No behaviour changes. All Category C-prefix decisions confirmed: callers identified, component does not use the received value.

---

## D3 — MissingKnowledgePrompt dependency inversion

**Option chosen: B (prop injection)**

Rationale: DiscussWithAiButton imports `@/canvas/stores/guidanceStore`. Moving it to shared (Option A) would pull canvas-store infrastructure into `src/components/shared/` — same class of violation in the other direction. Option B (inject AI affordance via `aiAffordance?: ReactNode`) eliminates the direct import, achieves zero canvas imports in MissingKnowledgePrompt, and matches React composition patterns.

Changes:
- `MissingKnowledgePrompt.tsx`: removed DiscussWithAiButton import + render; removed dead `onSendMessage` prop; added `aiAffordance?: ReactNode`
- `PreAnalysisPanel.tsx`: passes `aiAffordance={<DiscussWithAiButton ... />}`
- `ResultsBody.tsx`: unchanged (no AI affordance on results surface — guidance store not wired)
- Test file: 3 test updates (tests 1+2 now pass button as prop; test 3 renamed to reflect new explicit contract)

Grep gate: `rg "from '@/canvas" src/components/shared/MissingKnowledgePrompt.tsx` → CLEAN.

**Note:** TriageCard.tsx and TriageHealthHeader.tsx in shared also import from canvas — out of scope for this deliverable but registered as follow-up.

---

## D4 — Typography resolution

| Line | Before | After | Rationale |
|---|---|---|---|
| ResultsBody.tsx:395 | `typography.caption` (12px sans) | `typography.panelBody` (12px sans) | Option A — exact visual match, zero user impact |
| ResultsBody.tsx:390 | `typography.code` (12px mono) | `typography.code` + §2.1 amendment | Option B — mono semantically appropriate for formatted old→new values |

Spec §2.1 amended: narrow exception for `typography.code` in `<details>` blocks displaying technical formatted data (edge-strength correction summaries). Amendment confirmed as scope clarification, not pattern change — §2.9 schema freeze intact.

Grep gate: `rg "typography.(caption|code)" src/components/results/` → 1 hit (code token with inline §2.1 exception comment). `typography.caption` → 0 hits.

---

## D5 — Stash triage

27 stashes analysed. See `docs/brief-5_5-closeout-stash-triage.md` for full table.

- 17 recommended for drop (other-session stashes, pre-switch snapshots, temp/chore stashes 40+ days old)
- 10 escalated for user decision (feature/fix branches that may still be active)
- No drops executed — user approves separately

Highest-risk stash: stash@{3} (729 insertions, 11 files, WIP on staging from 16 days ago) — escalate before any bulk drops.

---

## Brief 5.5 regression spot-check

All Brief 5.5 acceptance tests pass:

| Check | Result |
|---|---|
| certaintyCopy tier-soften gate tests | 50 tests passed |
| HeroFooterComposed (hero + footer alignment) | 5 tests passed |
| visualContracts (bar vocabulary, badge colours, section headers) | 12 tests passed |
| Full Analysis-tab surface | 1544 passed / 13 skipped / 0 failed |

---

## Grep gates (Brief 5.5 §2.8)

| Gate | Result |
|---|---|
| Gate 1 (typography) | 0 hits ✓ |
| Gate 2 (currently leads) | certaintyCopy.ts carve-out only ✓ |
| Gate 3 (rank prefix) | 0 hits ✓ |
| Gate 4 (Olumi applied) | 0 hits ✓ |
| Gate 5 (count-dup line) | 0 hits ✓ |
| Gate 6 (arbitrary spacing) | 0 hits ✓ |
| Gate 7 (bg-colour-light) | TornadoChart dividers carve-out only ✓ |
| Gate 8 (text-white) | 0 hits ✓ |
| Gate 9 (bg-factor) | 2 approved hits (OptionCards neutralised bar, AllImprovements hover) ✓ |

---

## Technical debt now fully resolved

1. 23 pre-existing lint warnings on Brief 5.5-touched files → 0
2. `MissingKnowledgePrompt` shared→canvas dependency → inverted via prop injection
3. `ResultsBody` `typography.caption` silent §2.1 violation → replaced with `typography.panelBody`
4. `ResultsBody` `typography.code` silent §2.1 violation → spec §2.1 amended with approved narrow exception

---

## Performance and accessibility

- D2: removing dead code only (no new hooks, no new state, no new renders)
- D2: removing `ExpandedDetails` and `BootstrapStabilityIndicator` slightly reduces bundle size
- D3: `MissingKnowledgePrompt` behaviour unchanged; accessibility (dismiss button ring, aria-label) unchanged and verified by existing tests
- No new `useEffect` in hot paths
- No new memoisation needed

---

## Remaining opportunities (for future work)

1. **TriageCard.tsx and TriageHealthHeader.tsx** also import from `@/canvas` — same class of dependency as D3 fixed. Out of scope for this brief.
2. **CI infra**: "Use Node.js from .nvmrc" GHA failure needs investigation to restore CI green status.
3. **`mustFixCards` memoisation** (PreAnalysisPanel): wrapped in `useMemo` with `[triageCards]` deps would make `dynamicHeadline` useMemo stable. Deferred because `triageCards` itself is spread-composed on every render — full fix requires memoising the entire cascade. Pre-existing pattern.
4. **Stash drops**: user approves from D5 triage table.
5. **Brief 5.6**: IA consolidation + readiness reframe, ready to dispatch.
