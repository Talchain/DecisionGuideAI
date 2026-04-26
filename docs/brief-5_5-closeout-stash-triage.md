# Brief 5.5 Close-Out — Stash List Triage (D5)

Produced 2026-04-25. Updated 2026-04-25 (P1.2 correction: re-inspected all 27 entries; corrected counts).
**Read-only analysis — no stashes dropped in this deliverable.**
User reviews this table and approves drops separately.

Total entries: 27 (stash@{0} through stash@{26}).

---

## Summary by recommendation

| Recommendation | Count | Stash indices |
|---|---|---|
| **Drop** (confirmed obsolete) | 17 | {0}, {2}, {4}, {5}, {6}, {7}, {9}, {13}, {14}, {15}, {16}, {18}, {19}, {21}, {22}, {23}, {24} |
| **Escalate** (user decision needed) | 10 | {1}, {3}, {8}, {10}, {11}, {12}, {17}, {20}, {25}, {26} |
| **Retain** | 0 | — |

---

## Full triage table (all entries inspected)

| Index | Age | Branch | Files changed | Recommendation | Rationale |
|---|---|---|---|---|---|
| stash@{0} | 8 days | staging | 1 (test file, +1 line) | **Drop** | Diagnostic one-line test tweak; 8 days stale |
| stash@{1} | 9 days | ui/ai-panel-tranche-1 | 2 (aiPanelTranche1 spec, FlipDropdown.tsx) | **Escalate** | Confirm if ui/ai-panel-tranche-1 is still active |
| stash@{2} | 9 days | staging | 2 (.gitignore, validators.js generated) | **Drop** | .gitignore + generated file; superseded |
| stash@{3} | 16 days | staging | 11 files, 729 ins (PreAnalysisPanel, OptionPreview, hooks, conversation, ChatComposer, GraphPatchBlock, useComposerState, store) | **Escalate** | Large staging WIP; may contain valuable unreleased work |
| stash@{4} | 24 days | staging | 6 (OutputsDock, ChallengeSection, DecisionConfidencePanel, OptionCards, TornadoChart, TriageCard) | **Drop** | Explicitly "other session unrelated"; 24 days old |
| stash@{5} | 25 days | staging | 14 (ReactFlowGraph, OptionPreview, PreAnalysisPanel, SuccessTarget, mapImprovementToTriageCard, buildTriageNarrative, LeftSidebar, TriageCard, TriageHealthHeader, index.css, …) | **Drop** | Explicitly "other session unrelated"; 25 days old |
| stash@{6} | 27 days | staging | 2 (FactorNode, shared/index.ts) | **Drop** | Explicitly "other session unrelated"; 27 days old |
| stash@{7} | 27 days | staging | 7 (package-lock.json, package.json, DraftChat, OutputsDock, store, applyDraftResult, AuthContext) | **Drop** | "Other session"; 27 days old; package.json deltas superseded |
| stash@{8} | 39 days | fix/poc-testing-ui-fixes | 2 (conversation/types.ts, ChatComposer.tsx) | **Escalate** | POC testing branch — confirm if needed |
| stash@{9} | 39 days | staging | 7 (InlineBlocks, useThreadPersistence, types, useConversation, ChatComposer, store, scenarioService) | **Drop** | Pre-switch stash; superseded |
| stash@{10} | 40 days | fix/ui-quick-wins-review | 4 (OutputsDock, useEscapePanel, store, turn-request-builder) | **Escalate** | Feature branch — confirm status |
| stash@{11} | 40 days | fix/ui-quick-wins-review | 5+ (EdgeThicknessLegend, OutputsDock, validateResponse, useEscapePanel, store) | **Escalate** | Same branch as {10} |
| stash@{12} | 40 days | fix/ui-quick-wins-review | 5 (test files only, +1 line each) | **Escalate** | Same branch; was on wrong branch per message |
| stash@{13} | 40 days | staging | 1 (turn-request-builder.ts, +16 lines) | **Drop** | "Pre-existing"; superseded |
| stash@{14} | 40 days | staging | 5 (test files, +1-2 lines each — runtime envelope validation) | **Drop** | "Pre-existing staged"; superseded |
| stash@{15} | 47 days | staging | 3 (AllImprovements, M1TopActions, Conversation.module.css) | **Drop** | 7 weeks old; pre-existing changes superseded |
| stash@{16} | 67 days | staging | 5 (olumi-schemas, ContractIntegrityTab spec + tab, useDebugData, request-chain) | **Drop** | 10 weeks old; pre-merge snapshot |
| stash@{17} | 194 days | feature/plc-overnight-20251011 | 14 (e2e PLC specs, GraphCanvasPlc, history, guides, snap, PlcLab, PlotShowcase, main.tsx) | **Escalate** | PLC feature branch — confirm if PLC work still needed |
| stash@{18} | 204 days | chore/sandbox-local-netlify-ready | 5 (.gitignore, package.json, tsconfig.app.json, tsconfig.node.json, vite.config.ts) | **Drop** | 6+ months; chore branch finished |
| stash@{19} | 215 days | chore/types-supabase-minor | 3 (README.md, package.json, App.tsx) | **Drop** | 7 months; warp scaffolding temp |
| stash@{20} | 216 days | feat/plot-lite-ghost-flows | 5 (package-lock.json, package.json, Analysis.tsx, GhostPanel.tsx, ghost.panel.test.tsx) | **Escalate** | Confirm feat/plot-lite-ghost-flows status |
| stash@{21} | 216 days | chore/ts-alias-env-fix | 2 (tsconfig.app.json, vite.config.ts) | **Drop** | 7 months; chore complete |
| stash@{22} | 216 days | chore/ts-config-stabilise | 1 (tsconfig.base.json, +1 line) | **Drop** | 7 months; chore complete |
| stash@{23} | 222 days | feat/export-report-html-pdf | 7 (.env.example, sandbox_state.md, flags, useTelemetry, overridesStore, CombinedSandboxRoute, ExplainDeltaPanel) | **Drop** | 7 months; feature branch stash |
| stash@{24} | 223 days | feat/sandbox-templates | **0 (empty stash — no diff)** | **Drop** | Empty stash entry; safe to drop unconditionally |
| stash@{25} | 223 days | feat/presence-idle-v1 | 12 (App, config, flags, InspectorPanel, test/setup, Canvas, CompareView, Palette, ScorePill, debounce-edit test, persistence, .env.example) | **Escalate** | Confirm feat/presence-idle-v1 status |
| stash@{26} | 225 days | fix/tests-triggers-suite | 2 (Canvas, CombinedSandboxRoute) | **Escalate** | Confirm fix/tests-triggers-suite status |

---

## Drop justification criteria used

1. Message explicitly says "unrelated" or "other session" — confirmed not this session's work
2. Age > 30 days AND on staging without active branch context — superseded by subsequent commits
3. Temp/scaffold/config chores from completed branches (6+ months old)
4. Pre-switch or pre-merge snapshots where the target was subsequently merged
5. Empty stash entry ({24}) — no content to lose

## Escalation criteria used

Feature branches where the branch may still be active and the stash represents uncommitted feature work. User should confirm whether the branch is still in use before dropping. Specifically: ui/ai-panel-tranche-1, fix/poc-testing-ui-fixes, fix/ui-quick-wins-review (3 stashes), feature/plc-overnight-20251011, feat/plot-lite-ghost-flows, feat/presence-idle-v1, fix/tests-triggers-suite, plus stash@{3} (large staging WIP).

## Safe bulk-drop sequence (recommended first action)

These 6 are the safest to drop first — all explicitly labelled "other session" or one-line/empty entries:

```bash
# Drop highest index first to avoid index shifting
git stash drop stash@{24}  # Empty stash, no diff
git stash drop stash@{7}   # "Other session WIP"
git stash drop stash@{6}   # "unrelated: previous session"
git stash drop stash@{5}   # "unrelated: other session"
git stash drop stash@{4}   # "unrelated: other session"
git stash drop stash@{2}   # .gitignore + generated file
git stash drop stash@{0}   # 1-line test diagnostic
```

After this batch, indices shift down. Re-list with `git stash list --format='%gd %ci %gs'` before further drops.
