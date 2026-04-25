# Brief 5.5 Close-Out — Precondition Baseline (D1)

Branch: `ui/brief-5_5-closeout` from `staging` HEAD `62b8bdb7`  
Captured: 2026-04-25

---

## CI full-suite result for Brief 5.5 push (7a561a99)

| Run ID | Workflow | Conclusion | Head SHA |
|---|---|---|---|
| 24896181042 | Staging Tests | **failure** | 7a561a99 |
| 24896181025 | Contract Validation | **failure** | 7a561a99 |

**Root cause: GitHub Actions infrastructure failure — not code.**

Job breakdown:
- Install & Cache: **FAILED** at step "Use Node.js from .nvmrc" — upstream GHA infra issue
- TypeScript + Lint: SKIPPED (blocked by install failure)
- Full Test Suite: SKIPPED (blocked by install failure)
- Production Build: SKIPPED (blocked by install failure)
- Staging Gate: FAILED (cascading)

The same "Use Node.js from .nvmrc" failure appears on every recent staging push (runs 24862646182, 24859391134, 24919713206) — this is a persistent GHA infra issue, not introduced by Brief 5.5. No test failures were reported; no test output was produced.

**Halt condition assessment:** brief halt fires on "CI full-suite failures caused by Brief 5.5." Root cause is GHA infrastructure failure predating Brief 5.5. Halt condition does NOT apply. Close-out proceeds.

**Action required:** Re-run CI when GHA infra is stable to confirm no test regressions. Local baseline below is the authoritative signal for now.

---

## Local baselines

### Typecheck
`npx tsc -p tsconfig.ci.json --noEmit` — **PASS** (exit 0, no errors)

### Analysis-tab test surface
`npx vitest run src/components/results src/canvas/components/pre-analysis`

| Metric | Count |
|---|---|
| Test files | 86 (85 passed, 1 skipped) |
| Tests passed | 1544 |
| Tests skipped | 13 |
| Tests failed | 0 |

### Lint warnings on Brief 5.5-touched files (D2 target)

**Total: 23 warnings across 5 files. All confirmed pre-existing on `staging` before Brief 5.5.**

#### src/canvas/components/pre-analysis/PreAnalysisPanel.tsx — 4 warnings
```
698:9   'handleFocusEdgeById' is assigned a value but never used
706:9   'handleAddEvidence' is assigned a value but never used
1137:9  'expertiseHasItems' is assigned a value but never used
1246:6  React Hook useMemo has an unnecessary dependency: 'data.enrichedBlockers'
```

#### src/components/results/DecisionConfidencePanel.tsx — 1 warning
```
440:3   'expertMode' is defined but never used
```

#### src/components/results/DriversSection.tsx — 10 warnings
```
25:28   'stripEncodingNotation' is defined but never used
186:10  'ExpandedDetails' is defined but never used
196:9   'handleFocusClick' is assigned a value but never used
384:3   'goalLabel' is defined but never used
411:43  'labelQualifier' is assigned a value but never used
845:3   'outcomeUnit' is defined but never used
846:3   'outcomeUnitSymbol' is defined but never used
847:3   'isNormalised' is defined but never used
852:35  'topDrivers' is assigned a value but never used
907:9   'hiddenCount' is assigned a value but never used
```

#### src/components/results/ResultsBody.tsx — 7 warnings
```
103:3   'isRunning' is defined but never used
104:3   'onAddStatusQuoBaseline' is defined but never used
105:3   'onApplyThreshold' is defined but never used
106:3   'onAddBaseline' is defined but never used
107:3   'onSetBaseline' is defined but never used
167:9   'hasGuidanceItems' is assigned a value but never used
171:9   'flashOptionCard' is assigned a value but never used
```

#### src/components/results/TornadoChart.tsx — 1 warning
```
286:3   'onApplyAndRerun' is defined but never used
```

---

## Git stash list (27 entries)

```
stash@{0}  2026-04-17  On staging: WIP: SeverityStyledCritiques test text update - unrelated to useconversation diagnosis
stash@{1}  2026-04-16  On ui/ai-panel-tranche-1: pre-brief-4-switch: ai-panel-tranche-1 WIP
stash@{2}  2026-04-16  On staging: pre-investigation tracked changes
stash@{3}  2026-04-09  WIP on staging: 867642a7 docs(audit): add AI experience + LLM context assembly audits
stash@{4}  2026-04-01  On staging: unrelated: OutputsDock + results changes from other session
stash@{5}  2026-03-31  On staging: unrelated: pre-analysis + UI changes from other session
stash@{6}  2026-03-29  On staging: unrelated: FactorNode/shared changes from previous session
stash@{7}  2026-03-29  On staging: Other session WIP
stash@{8}  2026-03-17  On fix/poc-testing-ui-fixes: poc-testing-branch local changes
stash@{9}  2026-03-17  On staging: staging local changes before switching to fix branch
stash@{10} 2026-03-16  WIP on fix/ui-quick-wins-review: ui-quick-wins-uncommitted
stash@{11} 2026-03-16  On fix/ui-quick-wins-review: ui-quick-wins-uncommitted
stash@{12} 2026-03-16  On fix/ui-quick-wins-review: uuid-enforcement-wip-on-wrong-branch
stash@{13} 2026-03-16  On staging: pre-existing turn-request-builder changes
stash@{14} 2026-03-16  On staging: pre-existing staged: runtime envelope validation fixes
stash@{15} 2026-03-09  On staging: pre-existing: pre-analysis + conversation CSS changes
stash@{16} 2026-02-17  On staging: pre-merge-staging-20260217
stash@{17} 2025-10-13  WIP on feature/plc-overnight-20251011
stash@{18} 2025-10-03  On chore/sandbox-local-netlify-ready: WIP: local dev changes
stash@{19} 2025-09-22  On chore/types-supabase-minor: warp-local-scaffolding-temporary
stash@{20} 2025-09-21  On feat/plot-lite-ghost-flows: wip: temp for switching branches
stash@{21} 2025-09-21  On chore/ts-alias-env-fix: temp: alias/env config sync
stash@{22} 2025-09-21  On chore/ts-config-stabilise: pre-finalise config stash
stash@{23} 2025-09-15  WIP on feat/export-report-html-pdf
stash@{24} 2025-09-14  On feat/sandbox-templates: cascade temp stash
stash@{25} 2025-09-14  On feat/presence-idle-v1: cascade temp work
stash@{26} 2025-09-12  On fix/tests-triggers-suite: mvp-ui
```
