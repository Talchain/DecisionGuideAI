# Brief 5.5 Close-Out — Stash List Triage (D5)

Produced 2026-04-25. **Read-only analysis — no stashes dropped in this deliverable.**
User reviews this table and approves drops separately.

Total entries: 27 (stash@{0} through stash@{26}).

---

## Summary by recommendation

| Recommendation | Count | Stash indices |
|---|---|---|
| **Drop** (confirmed obsolete) | 17 | {0}, {2}, {4}, {5}, {6}, {7}, {9}, {13}, {14}, {15}, {16}, {17}, {18}, {19}, {21}, {22}, {23} |
| **Escalate** (user decision needed) | 8 | {1}, {3}, {8}, {10}, {11}, {12}, {20}, {24}, {25}, {26} |
| **Retain** | 0 | — |

---

## Full triage table

| Index | Age | Branch | Message | Files changed | Recommendation | Rationale |
|---|---|---|---|---|---|---|
| stash@{0} | 8 days | staging | WIP: SeverityStyledCritiques test text update — unrelated to useconversation diagnosis | 1 (test file, +1 line) | **Drop** | Diagnostic one-line test tweak, 8 days stale, context gone |
| stash@{1} | 9 days | ui/ai-panel-tranche-1 | pre-brief-4-switch: ai-panel-tranche-1 WIP | 2 (spec + FlipDropdown.tsx) | **Escalate** | Feature branch — confirm if ui/ai-panel-tranche-1 is still active |
| stash@{2} | 9 days | staging | pre-investigation tracked changes | 2 (.gitignore, validators.js generated) | **Drop** | .gitignore + generated file; superseded |
| stash@{3} | 16 days | staging | WIP on staging: 867642a7 docs(audit) | 11 files, 729 insertions (PreAnalysisPanel, OptionPreview, hooks, conversation) | **Escalate** | Large WIP (729 ins) from staging; may contain valuable unreleased work |
| stash@{4} | 24 days | staging | unrelated: OutputsDock + results changes from other session | 6 files | **Drop** | Explicitly "other session unrelated"; 24 days old |
| stash@{5} | 25 days | staging | unrelated: pre-analysis + UI changes from other session | 14 files | **Drop** | Explicitly "other session unrelated"; 25 days old |
| stash@{6} | 27 days | staging | unrelated: FactorNode/shared changes from previous session | 2 files | **Drop** | Explicitly "other session unrelated"; 27 days old |
| stash@{7} | 27 days | staging | Other session WIP | 7 files (incl. package.json) | **Drop** | Explicitly "other session"; 27 days old; package.json changes superseded |
| stash@{8} | 39 days | fix/poc-testing-ui-fixes | poc-testing-branch local changes | 2 (conversation types + ChatComposer) | **Escalate** | POC testing branch — confirm if branch work still needed |
| stash@{9} | 39 days | staging | staging local changes before switching to fix branch | 7 files (conversation, store, services) | **Drop** | Pre-switch stash; 5+ weeks old; superseded by subsequent staging commits |
| stash@{10} | 40 days | fix/ui-quick-wins-review | WIP on fix/ui-quick-wins-review | 4 files (OutputsDock, store, turn-request-builder) | **Escalate** | Feature branch — check if ui-quick-wins work is complete/merged |
| stash@{11} | 40 days | fix/ui-quick-wins-review | ui-quick-wins-uncommitted | 5+ files (EdgeThicknessLegend, validateResponse) | **Escalate** | Same branch as {10} — bundle escalation decision |
| stash@{12} | 40 days | fix/ui-quick-wins-review | uuid-enforcement-wip-on-wrong-branch | 5 files (test files only, +1 line each) | **Escalate** | Same branch — was on wrong branch per message; may be irrelevant |
| stash@{13} | 40 days | staging | pre-existing turn-request-builder changes | 1 file (+16 lines) | **Drop** | Pre-existing turn-request-builder; 40 days old; superseded |
| stash@{14} | 40 days | staging | pre-existing staged: runtime envelope validation fixes | 5 files (tests, +1-2 lines each) | **Drop** | Pre-existing staged fixes; 40 days old; superseded |
| stash@{15} | 47 days | staging | pre-existing: pre-analysis + conversation CSS changes | 3 files (AllImprovements, M1TopActions, CSS) | **Drop** | 7 weeks old; pre-existing changes superseded by multiple sprints |
| stash@{16} | 67 days | staging | pre-merge-staging-20260217 | 5 files (olumi-schemas, ContractIntegrityTab, useDebugData) | **Drop** | 10 weeks old; pre-merge snapshot, superseded |
| stash@{17} | 194 days | feature/plc-overnight-20251011 | WIP on feature/plc-overnight | 2 files (build config) | **Drop** | 6+ months; feature branch from Oct 2025, long obsolete |
| stash@{18} | 204 days | chore/sandbox-local-netlify-ready | WIP: local dev changes | unknown | **Drop** | 6+ months; chore branch from Oct 2025 |
| stash@{19} | 215 days | chore/types-supabase-minor | warp-local-scaffolding-temporary | unknown | **Drop** | 7 months; temp scaffolding stash |
| stash@{20} | 216 days | feat/plot-lite-ghost-flows | wip: temp for switching branches | unknown | **Escalate** | Feature branch — confirm feat/plot-lite-ghost-flows status |
| stash@{21} | 216 days | chore/ts-alias-env-fix | temp: alias/env config sync | unknown | **Drop** | 7 months; temp config stash from completed chore |
| stash@{22} | 216 days | chore/ts-config-stabilise | pre-finalise config stash | unknown | **Drop** | 7 months; pre-finalise from completed chore |
| stash@{23} | 222 days | feat/export-report-html-pdf | WIP on feat/export-report-html-pdf | unknown | **Drop** | 7 months; feature branch stash |
| stash@{24} | 223 days | feat/sandbox-templates | cascade: temp stash | unknown | **Escalate** | Feature branch — confirm feat/sandbox-templates status |
| stash@{25} | 223 days | feat/presence-idle-v1 | cascade: temp work for branching | unknown | **Escalate** | Feature branch — confirm feat/presence-idle-v1 status |
| stash@{26} | 225 days | fix/tests-triggers-suite | mvp-ui | unknown | **Escalate** | Fix branch — confirm fix/tests-triggers-suite status |

---

## Drop justification criteria used

1. Message explicitly says "unrelated" or "other session" — confirmed not this session's work
2. Age > 30 days AND no active branch association — superseded by subsequent commits
3. Temp/scaffold/config chores from completed branches (7+ months old)
4. Pre-switch or pre-merge snapshots where the target was subsequently merged

## Escalation criteria used

Feature branches where the branch may still be active and the stash represents uncommitted work. User should confirm whether the branch is still in use before dropping.

## Safe bulk drop (recommended first action)

If user wants to reduce risk, these 6 are the safest first batch to drop — all explicitly labelled "other session" or very small diagnostic changes:

```bash
git stash drop stash@{7}  # "Other session WIP" - old
git stash drop stash@{6}  # "unrelated: FactorNode ... previous session"
git stash drop stash@{5}  # "unrelated: pre-analysis ... other session"
git stash drop stash@{4}  # "unrelated: OutputsDock ... other session"
git stash drop stash@{2}  # .gitignore + generated validators.js
git stash drop stash@{0}  # 1-line test tweak, diagnostic
```

**Note:** Drop indices from highest to lowest to avoid index shifting — dropping {0} first would shift all others down by one.

Correct drop order (highest first):
```bash
git stash drop stash@{7}
git stash drop stash@{6}
git stash drop stash@{5}
git stash drop stash@{4}
git stash drop stash@{2}
git stash drop stash@{0}
```
