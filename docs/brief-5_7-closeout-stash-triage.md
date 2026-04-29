# Brief 5.7 close-out — Stash triage refresh

**Read-only analysis — no stashes dropped in this deliverable.**
Awaiting Paul's explicit approval before executing drops.

---

## Why this doc exists

The stash table from `docs/brief-5_5-closeout-stash-triage.md` recommended **17 drops** and **10 escalations** but was never executed. Since that triage:

- One new entry was added during Brief 5.7 (`stash@{0}: 5.7-pre: layout WIP`). The layout WIP it preserved subsequently **landed on staging as commit `cbba3821`**, so this entry is now also redundant.
- All 27 prior entries shifted by +1 in the stash index space.

This doc presents the recommended drop list using **current indices**, so the drop commands can be run as-is.

---

## Recommended drops — 18 entries (was 17 + new `{0}`)

Drop highest index first to avoid mid-operation index shifting.

| Current index | Original index (5.5 doc) | Branch | Message | Disposition rationale |
|---:|---:|---|---|---|
| `{25}` | `{24}` | `feat/sandbox-templates` | cascade: temp stash to switch to base feat/explain-delta-v1 | Empty stash (no diff per 5.5 triage); safe drop unconditionally |
| `{24}` | `{23}` | `feat/export-report-html-pdf` | WIP on feat/export-report-html-pdf: 7bfbad6 chore(tsconfig)… | 7 months old; feature-branch stash superseded |
| `{23}` | `{22}` | `chore/ts-config-stabilise` | pre-finalise config stash | 7 months; chore complete |
| `{22}` | `{21}` | `chore/ts-alias-env-fix` | temp: alias/env config sync | 7 months; chore complete |
| `{20}` | `{19}` | `chore/types-supabase-minor` | warp-local-scaffolding-temporary | 7 months; warp scaffolding temp |
| `{19}` | `{18}` | `chore/sandbox-local-netlify-ready` | WIP: local dev changes | 6+ months; chore branch finished |
| `{17}` | `{16}` | staging | pre-merge-staging-20260217 | 10 weeks; pre-merge snapshot |
| `{16}` | `{15}` | staging | pre-existing: pre-analysis + conversation CSS changes | 7 weeks old; pre-existing changes superseded |
| `{15}` | `{14}` | staging | pre-existing staged: runtime envelope validation fixes | "Pre-existing staged"; superseded |
| `{14}` | `{13}` | staging | pre-existing turn-request-builder changes | "Pre-existing"; superseded |
| `{10}` | `{9}` | staging | staging local changes before switching to fix branch | Pre-switch stash; superseded |
| `{8}` | `{7}` | staging | Other session WIP | "Other session"; 27 days old; package.json deltas superseded |
| `{7}` | `{6}` | staging | unrelated: FactorNode/shared changes from previous session | Explicitly "other session unrelated"; 27 days old |
| `{6}` | `{5}` | staging | unrelated: pre-analysis + UI changes from other session | Explicitly "other session unrelated"; 25 days old |
| `{5}` | `{4}` | staging | unrelated: OutputsDock + results changes from other session | Explicitly "other session unrelated"; 24 days old |
| `{3}` | `{2}` | staging | pre-investigation tracked changes | .gitignore + generated file; superseded |
| `{1}` | `{0}` | staging | WIP: SeverityStyledCritiques test text update | 1-line test diagnostic; 8 days old at time of triage, now ~3 weeks |
| `{0}` | (new — 5.7) | staging | 5.7-pre: layout WIP | **NEW**: layout work landed on staging as `cbba3821`. Stash now redundant. |

---

## Recommended escalations — 10 entries (UNCHANGED from 5.5 triage)

These are NOT in scope for this brief. Reproduced for traceability.

| Current index | Original index | Branch | Status |
|---:|---:|---|---|
| `{2}` | `{1}` | `ui/ai-panel-tranche-1` | Confirm if branch is still active |
| `{4}` | `{3}` | staging | Large staging WIP (729 ins, 11 files); may contain valuable unreleased work |
| `{9}` | `{8}` | `fix/poc-testing-ui-fixes` | POC testing branch — confirm if needed |
| `{11}` | `{10}` | `fix/ui-quick-wins-review` | Feature branch — confirm status |
| `{12}` | `{11}` | `fix/ui-quick-wins-review` | Same branch as `{11}` |
| `{13}` | `{12}` | `fix/ui-quick-wins-review` | Same branch; was on wrong branch per message |
| `{18}` | `{17}` | `feature/plc-overnight-20251011` | PLC feature branch — confirm if PLC work still needed |
| `{21}` | `{20}` | `feat/plot-lite-ghost-flows` | Confirm `feat/plot-lite-ghost-flows` status |
| `{26}` | `{25}` | `feat/presence-idle-v1` | Confirm `feat/presence-idle-v1` status |
| `{27}` | `{26}` | `fix/tests-triggers-suite` | Confirm `fix/tests-triggers-suite` status |

---

## Drop sequence (when approval is given)

Execute from highest index to lowest. Safe to run as one block — each drop only affects its own index, and earlier indices shift downward only AFTER the drop completes, so by the time we reach lower numbers their indices are still as listed because we processed them last:

```bash
# Highest index first to avoid index shifting
git stash drop stash@{25}  # feat/sandbox-templates (empty)
git stash drop stash@{24}  # feat/export-report-html-pdf
git stash drop stash@{23}  # chore/ts-config-stabilise
git stash drop stash@{22}  # chore/ts-alias-env-fix
git stash drop stash@{20}  # chore/types-supabase-minor
git stash drop stash@{19}  # chore/sandbox-local-netlify-ready
git stash drop stash@{17}  # staging pre-merge-staging-20260217
git stash drop stash@{16}  # staging pre-existing CSS
git stash drop stash@{15}  # staging pre-existing envelope validation
git stash drop stash@{14}  # staging pre-existing turn-request-builder
git stash drop stash@{10}  # staging pre-switch
git stash drop stash@{8}   # staging Other session WIP
git stash drop stash@{7}   # staging FactorNode/shared
git stash drop stash@{6}   # staging pre-analysis + UI
git stash drop stash@{5}   # staging OutputsDock + results
git stash drop stash@{3}   # staging pre-investigation
git stash drop stash@{1}   # staging SeverityStyledCritiques 1-line
git stash drop stash@{0}   # 5.7-pre: layout WIP (now redundant)
```

After execution, the stash list should drop from 28 → 10 entries.

---

## Approval requested

**Paul:** please confirm whether to execute the 18 drops above. The drops are reversible only via `git stash` history within ~30 days (gc.reflogExpire), so this is a one-shot operation. Once dropped, the stashes cannot be recovered without dredging the reflog.

Per brief D4: this deliverable defers cleanly when approval is not given in this turn. Dropping deferred to a follow-up; this brief commits the documentation only.
