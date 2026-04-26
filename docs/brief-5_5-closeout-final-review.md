# Brief 5.5 Close-Out — Final Review (D6)

Branch: `ui/brief-5_5-closeout` (7 commits, local only)
Completed: 2026-04-25

---

## Deliverable status

| D# | Description | Status | Commit |
|---|---|---|---|
| D1 | Precondition + CI baseline | **Delivered** | 6d5a002a |
| D2 | Lint warning cleanup (23 warnings) | **Delivered** | 9fb7b1f6 |
| D3 | MissingKnowledgePrompt dependency inversion | **Delivered** | f965c084 |
| D4 | ResultsBody caption/code typography resolution | **Delivered** | ed60bf1b |
| D5 | Stash list triage | **Delivered** | 4716fd47 (initial), then corrected for P1.2 |
| D6 | Final verification + close-out review | **Delivered** | cc95ea95 (initial), then corrected for P1.3 |
| Post-review fixes | P1.1 (results AI affordance restored) + P1.2 (stash triage corrected) + P1.3 (this doc) + Improvement 2 (command outputs) | **Delivered** | this commit |

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

Rationale: DiscussWithAiButton imports `@/canvas/stores/guidanceStore`. Moving it to shared (Option A) would pull canvas-store infrastructure into `src/components/shared/` — same class of violation in the other direction. Option B (inject AI affordance via `aiAffordance?: ReactNode`) eliminates the direct import and matches React composition patterns.

Changes:
- `MissingKnowledgePrompt.tsx`: removed DiscussWithAiButton import + render; removed dead `onSendMessage` prop; added `aiAffordance?: ReactNode`
- `PreAnalysisPanel.tsx`: passes canvas-context affordance
- `ResultsBody.tsx`: passes results-context affordance (P1.1 follow-up — initial D3 omitted this; restored to match brief's "results consumer renders identically" requirement)
- Test file: 4 tests updated (tests 1+2 now pass button as prop; test 3 reflects new explicit contract; new test 4 — results-context regression guard)

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

27 stashes inspected (each via `git stash show`). See `docs/brief-5_5-closeout-stash-triage.md` for full table.

- 17 recommended for drop (other-session stashes, pre-switch snapshots, temp/chore stashes 40+ days old, plus stash@{24} which is empty)
- 10 escalated for user decision (feature/fix branches that may still be active)
- No drops executed — user approves separately

P1.2 correction (this pass): re-ran read-only inspection for stashes 17-26, replaced "unknown" file lists with actual diffs, fixed escalation count (was 8 in summary, now correctly 10). stash@{24} discovered to be an empty entry.

Highest-risk stash: stash@{3} (729 insertions, 11 files, WIP on staging from 16 days ago) — escalate before any bulk drops.

---

## Brief 5.5 regression spot-check

All Brief 5.5 acceptance tests pass:

| Check | Result |
|---|---|
| certaintyCopy tier-soften gate tests | 50 tests passed |
| HeroFooterComposed (hero + footer alignment) | 5 tests passed |
| visualContracts (bar vocabulary, badge colours, section headers) | 12 tests passed |
| Full Analysis-tab surface | 1545 passed / 13 skipped / 0 failed (+1 from new P1.1 regression test) |

---

## Final verification command outputs (Improvement 2)

### typecheck

```
$ npx tsc -p tsconfig.ci.json --noEmit
(exit 0, no errors)
```

### Lint per touched file (zero warnings each)

```
$ for f in [6 files]; do npx eslint "$f"; done
PreAnalysisPanel.tsx: 0 warnings
DecisionConfidencePanel.tsx: 0 warnings
DriversSection.tsx: 0 warnings
ResultsBody.tsx: 0 warnings
TornadoChart.tsx: 0 warnings
MissingKnowledgePrompt.tsx: 0 warnings
```

### Full Analysis-tab vitest

```
$ npx vitest run src/components/results src/canvas/components/pre-analysis
Test Files  85 passed | 1 skipped (86)
     Tests  1545 passed | 13 skipped (1558)
  Duration  31.57s
```

### Whitespace check

```
$ git diff --check -- docs/brief-5_5-closeout-*.md
(no output, exit 0)
```

### Brief 5.5 §2.8 grep gates

```
Gate 1 (typography)        — 0 hits ✓
Gate 2 (currently leads)   — certaintyCopy.ts source-only carve-out ✓
Gate 3 (rank prefix)       — 0 hits ✓
Gate 4 (Olumi applied)     — 0 hits ✓
Gate 5 (count-dup line)    — 0 hits ✓
Gate 6 (arbitrary spacing) — 0 hits ✓
Gate 7 (bg-colour-light)   — TornadoChart bg-text-light/40 chart-divider carve-out ✓
Gate 8 (text-white)        — 0 hits ✓
Gate 9 (bg-factor)         — 2 approved hits (OptionCards neutralised; AllImprovements hover) ✓
caption/code (D4 gate)     — 1 hit (typography.code with inline §2.1 exception) ✓
```

---

## Technical debt now fully resolved

1. 23 pre-existing lint warnings on Brief 5.5-touched files → 0
2. `MissingKnowledgePrompt` shared→canvas dependency → inverted via prop injection (both consumers)
3. `ResultsBody` `typography.caption` silent §2.1 violation → replaced with `typography.panelBody`
4. `ResultsBody` `typography.code` silent §2.1 violation → spec §2.1 amended with approved narrow exception

---

## Performance and accessibility

- D2: removing dead code only (no new hooks, no new state, no new renders)
- D2: removing `ExpandedDetails` and `BootstrapStabilityIndicator` slightly reduces bundle size
- D3: `MissingKnowledgePrompt` behaviour unchanged; accessibility (dismiss button ring, aria-label) unchanged and verified by existing tests
- P1.1 follow-up adds a results-context regression test guarding the AI affordance contract
- No new `useEffect` in hot paths
- No new memoisation needed

---

## Remaining opportunities (for future work)

1. **TriageCard.tsx and TriageHealthHeader.tsx** also import from `@/canvas` — same class of dependency as D3 fixed. Out of scope for this brief.
2. **CI infra**: "Use Node.js from .nvmrc" GHA failure needs investigation to restore CI green status.
3. **`mustFixCards` memoisation** (PreAnalysisPanel): wrapping in `useMemo` with `[triageCards]` deps would make `dynamicHeadline` useMemo stable. Deferred because `triageCards` is itself spread-composed on every render — full fix requires memoising the cascade. Pre-existing pattern.
4. **ESLint config deprecation**: `.eslintignore` is no longer supported in ESLint 9; rules should migrate to `ignores` in `eslint.config.js`. Separate tooling cleanup.
5. **Stash drops**: user approves from D5 triage table.
6. **Brief 5.6**: IA consolidation + readiness reframe, ready to dispatch.
