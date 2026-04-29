# Brief 5.7 close-out — Stash triage refresh (RESOLVED — drops executed)

**RESOLVED.** Both Section A (17 drops) and Section B (1 drop) approved by Paul and executed. Stash list went 28 → 10 entries. This doc remains as a resolution log; the drop sequences below were run verbatim.

---

## Why this doc exists

The stash table from `docs/brief-5_5-closeout-stash-triage.md` recommended **17 drops** and **10 escalations** but was never executed. Since that triage:

- One new entry was added during Brief 5.7 (`stash@{0}: 5.7-pre: layout WIP`). The layout WIP it preserved subsequently **landed on staging as commit `cbba3821`**, so this entry is now also redundant.
- All 27 prior entries shifted by +1 in the stash index space.

The brief D4 scope is the original 17 drops only. The new entry is presented separately as an addendum requesting its own approval, so the original triage is not silently expanded mid-flight.

---

## Section A — Original 17 drops from approved Brief 5.5 triage (current indices)

Brief 5.5 close-out approved these as drop candidates. Indices below are the **current** state (offset +1 from the 5.5 doc due to the new `stash@{0}` entry).

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

---

## Section B — Addendum: 1 new drop candidate (NOT in the original 17)

This entry was added during Brief 5.7 and is **not** part of the Brief 5.5 approved triage. It is presented separately so the original 17 stay intact.

| Current index | Branch | Message | Disposition rationale |
|---:|---|---|---|
| `{0}` | staging | 5.7-pre: layout WIP | The layout WIP it preserved landed on staging as `cbba3821`. The stash is now redundant. **Requires its own approval, separate from Section A.** |

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

## Drop sequences (when approval is given)

**The Section A and Section B sequences are independent.** Run only the section(s) Paul approves.

### Section A — original 17-drop sequence (approved-triage scope)

Execute from highest index to lowest. The `{0}` entry from Section B is intentionally NOT included; if approved separately, run that drop AFTER Section A completes (its index does not shift because everything dropped here is at a higher index).

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
```

After Section A: stash list 28 → 11 entries.

### Section B — addendum drop (separate approval)

```bash
git stash drop stash@{0}   # 5.7-pre: layout WIP (now redundant after cbba3821 landed on staging)
```

If both Section A AND Section B are approved, run Section A first, then Section B (Section B's `{0}` index is unaffected because A drops are all at higher indices). Final stash list 28 → 10 entries.

---

## Approval — GRANTED + executed

Both approvals granted by Paul:
1. **Section A — original 17 drops from the Brief 5.5 approved triage.** Approved and executed.
2. **Section B — 1 new drop candidate** (`stash@{0}: 5.7-pre: layout WIP`). Approved and executed.

Both sequences ran highest-index-first. Final state: stash list 28 → 10 entries. The 10 remaining entries are the escalation candidates listed above; they were intentionally NOT touched and stay for a separate decision.
