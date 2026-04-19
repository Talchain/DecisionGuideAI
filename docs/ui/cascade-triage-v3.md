# Cascade triage v3 — post PR #127/#128 failures

**Branch:** `ui/cascade-triage-v3` off staging (HEAD `7798fd5e` — "Merge branch 'ui/analysis-tab-brief-5' into staging")
**Baseline captured:** 2026-04-18 (JSON at `/tmp/cascade-baseline.json`)
**Scope:** investigation only. No tests or production code modified. Task 1 of the
original brief (D4b env-drift helper) was abandoned after its premise was
invalidated — the two named files did not use `VITE_CEE_BFF_BASE` and did not use
MSW. See conversation log for Paul's disposition.

---

## Current execution state

| | |
|---|---|
| **Ready for bulk fix PR** | **Yes** |
| Remaining blockers | **0** |
| Packet A (wave2 cast budget) | ✅ Resolved 2026-04-19 — Option A |
| Packet B (sse-params) | ✅ Resolved 2026-04-19 — Option A (source-trace) |
| Failing tests to address | **28** across **10 files** |
| Recommendation split | **25 fix test · 3 fix both · 0 halt** |
| Severity split | **23 cosmetic · 5 architectural-debt · 0 user-blocking** |
| Technical debt registered | PLoT adapter type gap (Option C resolution path) |

Next action: dispatch bulk fix PR using the [Bulk fix manifest](#bulk-fix-manifest)
below. Findings doc + fix PR land atomically on staging per Paul's instruction.

---

## Authoritative baseline

Computed from `assertionResults.status` in `/tmp/cascade-summary.json` — not from
the vitest Jest-compat footer, which is internally inconsistent (footer reports
`numPassedTests: 11721, numPendingTests: 1` but sums to 11,750 against a total
of 11,749; footer silently folds `pending`/`skipped` assertion statuses into
other buckets).

Authoritative counts (recount reconciles cleanly to 11,749):

| Status | Count |
|--------|-------|
| passed | **11,634** |
| failed | **28** |
| pending | **38** |
| skipped | **49** |
| todo | 0 |
| **total** | **11,749** ✓ |

- Failing **files**: **10** (sum of per-file failures = 28 ✓)
- Failing **tests**: **28** (only metric that matters for triage)

### Reproducible counts extraction

```bash
# Assumes /tmp/cascade-summary.json is the line from the vitest run output
# containing the full reporter JSON (see vitest run --reporter=json).
node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("/tmp/cascade-summary.json", "utf8"));
let pass=0, fail=0, pending=0, skipped=0, todo=0;
const failedByFile = {};
for (const file of data.testResults) {
  for (const a of (file.assertionResults || [])) {
    if (a.status === "passed") pass++;
    else if (a.status === "failed") { fail++; failedByFile[file.name] = (failedByFile[file.name]||0)+1; }
    else if (a.status === "pending") pending++;
    else if (a.status === "skipped") skipped++;
    else if (a.status === "todo") todo++;
  }
}
console.log({passed:pass, failed:fail, pending, skipped, todo, total:pass+fail+pending+skipped+todo});
console.log("Failing files:", Object.keys(failedByFile).length);
console.log(failedByFile);
'
```

Run after any future suite capture to verify counts before building a new
findings doc.

---

## Summary table

Categories are drawn from a single canonical set used throughout the doc: `copy drift`,
`mock mismatch + copy drift`, `threshold drift`, `design-token drift`,
`threshold breach`, `mock mismatch`, `intentional size change`.

| File | Failing tests | Category | Recommendation | Blocker severity |
|------|---------------|----------|----------------|------------------|
| [VerificationBadge.test.tsx](src/pages/sandbox-guide/components/panel/sections/__tests__/VerificationBadge.test.tsx) | 9 | copy drift | fix test | cosmetic |
| [ScenarioListPage.spec.tsx](src/pages/__tests__/ScenarioListPage.spec.tsx) | 4 | mock mismatch + copy drift | fix test | cosmetic |
| [edgeIdentity.regression.spec.ts](src/canvas/utils/__tests__/edgeIdentity.regression.spec.ts) | 3 | threshold drift | fix both | architectural-debt |
| [RecommendationCard.spec.tsx](src/canvas/components/RecommendationCard/__tests__/RecommendationCard.spec.tsx) | 3 | copy drift | fix test | cosmetic |
| [wave2-replay-gate.spec.ts](src/__tests__/wave2-replay-gate.spec.ts) | 2 | threshold breach | fix test (Packet A: Option A) | architectural-debt |
| [conversationCss.spec.ts](src/canvas/conversation/__tests__/conversationCss.spec.ts) | 2 | design-token drift | fix test | cosmetic |
| [InsightsPanel.spec.tsx](src/canvas/components/__tests__/InsightsPanel.spec.tsx) | 2 | copy drift | fix test | cosmetic |
| [sse-params.test.tsx](src/lib/__tests__/sse-params.test.tsx) | 1 | mock mismatch | fix test | cosmetic |
| [nodes.spec.ts](src/canvas/domain/__tests__/nodes.spec.ts) | 1 | intentional size change | fix test | cosmetic |
| [ClarifierPanel.spec.tsx](src/components/assistants/__tests__/ClarifierPanel.spec.tsx) | 1 | mock mismatch | fix test | cosmetic |

**Totals reconcile:** 9 + 4 + 3 + 3 + 2 + 2 + 2 + 1 + 1 + 1 = 28 ✓

### Category counts

| Category | Files | Failing tests |
|----------|-------|---------------|
| copy drift | 3 (VerificationBadge, RecommendationCard, InsightsPanel) | 14 |
| mock mismatch + copy drift | 1 (ScenarioListPage) | 4 |
| threshold drift | 1 (edgeIdentity) | 3 |
| design-token drift | 1 (conversationCss) | 2 |
| threshold breach | 1 (wave2-replay-gate) | 2 |
| mock mismatch | 2 (sse-params, ClarifierPanel) | 2 (ClarifierPanel selector; sse-params drawer-state + incomplete mock) |
| intentional size change | 1 (nodes.spec) | 1 |
| **Total** | **10** | **28** ✓ |

*Hybrid note:* ScenarioListPage has both testid-rename (mock mismatch on 3 tests)
and copy drift (1 test); grouped under the dominant mock-mismatch category.
conversationCss has one design-decision drift (graphPatchBlockApplied border) and
one Tailwind utility drift (PreAnalysisPanel spacing); grouped as design-token
drift.

### Recommendation counts

| Recommendation | Files | Failing tests |
|----------------|-------|---------------|
| fix test | 9 | 25 |
| fix both | 1 | 3 |
| halt for Paul judgement | 0 | 0 |

Totals reconcile: 9+1+0 = 10 files ✓; 25+3+0 = 28 tests ✓.

**Notes (2026-04-19):**
- sse-params was reclassified from `halt` to `fix test` after source-level
  trace resolved Packet B (see Decision Packet B).
- wave2-replay-gate was reclassified from `halt` to `fix test` after Paul
  approved Option A (raise budget 6 → 14 with documented rationale) in
  Packet A. Fix is test-file-only (edit budget constant + add comment in
  `wave2-replay-gate.spec.ts`), hence `fix test`.
- **Zero `halt` items remain.** Bulk fix PR is fully unblocked.

### Blocker severity counts

| Severity | Files | Failing tests |
|----------|-------|---------------|
| cosmetic | 8 | 23 |
| architectural-debt | 2 | 5 |
| user-blocking | 0 | 0 |

Severity totals reconcile: 8+2 = 10 files ✓; 23+5 = 28 tests ✓.

**Note (2026-04-19):** sse-params upgraded from `unclear` to `cosmetic` after
the Packet B trace ruled out user impact.

### Recommended action sequence (ordered by value)

**Decisions recorded 2026-04-19** — both Decision Packets resolved. All 28
failures have an assigned disposition. Single bulk fix PR is now unblocked.

1. **wave2-replay-gate (decided, now actionable):** `wave2-replay-gate.spec.ts`
   (2) — Option A chosen: raise budget 6 → 14 with inline comment citing the
   **8 net-new casts across 5 PLoT-adapter boundary sites** (lines 1027, 1663,
   2363, 2381, 2396). Technical debt registered under Option C for future
   resolution. See Packet A.
2. **Copy drift (bulk fix test):** VerificationBadge (9), RecommendationCard (3),
   InsightsPanel (2), ScenarioListPage/copy portion (1) — 15 tests total stemming
   from commit `ea8d23a7` (copy sweep 2026-04-06). Can be bundled as a single PR.
3. **Threshold drift (edgeIdentity, `fix both`):** `edgeIdentity.regression.spec.ts`
   (3) — threshold intentionally lowered from 0.3 to 0.15 in commit `ec41006e`
   (2026-03-30, Phase 6 — edge spec compliance). Update test data points; also
   update stale doc comment at `constants.ts:18` from "(>=0.3 shown)" to
   "(>0.15 shown)" (production-comment touch — hence `fix both`, not `fix test`).
4. **Mock/testid drift:** ScenarioListPage testids (3), ClarifierPanel (1),
   sse-params drawer-state + incomplete mock (1) — 5 tests. sse-params resolved
   via Packet B source-level trace.
5. **Design-token and size drift:** `nodes.spec.ts` (1), `conversationCss.spec.ts` (2).

All five groups can land as **one bulk PR** (Paul's dispatch instruction) plus
the wave2 cast-budget edit, for a single batch covering all 28 failures.

---

## Evidence-completeness matrix

One row per failing file. Columns audit the D2.3 evidence bar for that file's
recommendation. `n/a` = column does not apply to that recommendation category
(e.g. invariant column is only meaningful for `fix product` / `fix both`).

| File | Recommendation | Commit confirmed | Intent confirmed | Invariant confirmed | Blocker severity |
|------|----------------|------------------|------------------|---------------------|------------------|
| VerificationBadge | fix test | ✓ `ea8d23a7` | ✓ commit msg | n/a | cosmetic |
| ScenarioListPage | fix test | ✓ `ea8d23a7` (copy) + `f5d5fedf` (testids) | ✓ feat-commit scope both | n/a | cosmetic |
| edgeIdentity | fix both | ✓ `ec41006e` | ✓ "Phase 6 edge spec compliance" + in-code spec reference | ✓ Spec §6.3 cited in code | architectural-debt |
| RecommendationCard | fix test | ✓ `ea8d23a7` | ✓ commit msg | n/a | cosmetic |
| wave2-replay-gate | fix test (Packet A) | n/a (budget raise, no commit cites) | ✓ Paul's disposition 2026-04-19 — raise 6 → 14 | ✓ budget invariant reset to 14 with documented rationale | architectural-debt |
| conversationCss | fix test | ✓ `e193d2d7` (border) + `0be59e99` (spacing) | ✓ DS v5 §21.2 in code comment + "pre-analysis polish" commit msg | n/a | cosmetic |
| InsightsPanel | fix test | ✓ `ea8d23a7` | ✓ commit msg | n/a | cosmetic |
| sse-params | fix test | ✓ `337d9474` (confirmed no auto-fetch-on-done path ever existed) | ✓ test asserts on a flow that was never implemented | ✓ integration contract now documented in Packet B: SSE done → user opens drawer → fetch fires | cosmetic |
| nodes.spec | fix test | ✓ `176674c0` | ✓ feat commit msg | n/a | cosmetic |
| ClarifierPanel | fix test | ✓ `529a42dc` | ✓ "design-system token sweep" | n/a | cosmetic |

All `fix test` and `fix both` recommendations meet the D2.3 bar (commit hash +
intent confirmed via commit message or adjacent in-code documentation). Both
original `halt` items (wave2-replay-gate, sse-params) were resolved by Paul's
decisions on 2026-04-19 and are now actionable.

---

## Decision packets and resolutions

Both packets recorded and resolved as of 2026-04-19. No halt items remain.

### Packet A — wave2-replay-gate cast budget

**Decision (2026-04-19): Option A — raise budget 6 → 14.**

Paul's disposition: raise the budget with a documented rationale, register
the PLoT adapter type gap as technical debt, and defer Option C to the next
adapter/schema work that touches this area.

- **Question:** cast budget in `useResultsSectionData.ts` is 6; actual is 14. Raise the
  budget, fix the casts, or type the PLoT response?
- **Decided action:** raise the budget in `wave2-replay-gate.spec.ts` to 14, add
  an inline comment citing the **8 net-new casts across 5 PLoT-adapter boundary
  sites** (`useResultsSectionData.ts` lines 1027, 1663, 2363, 2381, 2396 —
  reading `probability_of_joint_goal`, `nonZeroImpactDrivers`, `conditional_winners`,
  `inference_warnings`, `edge_e_values`). The comment should reference the
  technical-debt item so future maintainers can trace the decision.
- **Options (for record):**
  - A — raise to 14 with documented rationale ← **CHOSEN**
  - B — add `__OLUMI_DEBUG` guards to the 5 unguarded casts. Rejected: some are
    real data reads, not debug access; the rule would become fuzzy.
  - C — type the PLoT response surface properly. Deferred as technical debt
    (see "Technical debt" section below).
- **Severity if unaddressed:** architectural-debt — preserved at new floor.

### Technical debt — PLoT adapter type gap

**Registered 2026-04-19 via Packet A decision.**

**8 net-new `as any` casts across 5 boundary sites** in
[useResultsSectionData.ts](src/components/results/useResultsSectionData.ts)
read optional PLoT response fields that are not in the typed adapter
interface. Sites and fields:

| Line | Occurrences | Field(s) read |
|------|-------------|---------------|
| 1027 | 2 | `probability_of_joint_goal` |
| 1663 | 1 | `nonZeroImpactDrivers` (helper arg, distinct shape) |
| 2363 | 2 | `conditional_winners` (+ its `robustness.*` nested read) |
| 2381 | 2 | `inference_warnings` (+ its `robustness.*` nested read) |
| 2396 | 1 | `edge_e_values` |
| **Total** | **8** | **5 sites** |

**Resolution path:** Option C from Packet A — type the PLoT response surface.
Trigger: when adapter/CEE schema work next touches the robustness or
probability-of-joint-goal fields. Expected outcome: casts eliminate, budget
returns to a floor reflecting genuinely debug-only usage (roughly 6, the
pre-wave2 floor, now that `__OLUMI_DEBUG`-guarded sites are the only
legitimate remaining pattern).

### Packet B — sse-params integration contract

**Resolution (2026-04-19): Option A (fix test with drawer state + mock both
functions). Code-trace sufficed; browser smoke check not required.**

Source-level evidence resolves the ambiguity without needing to run the app:

1. [RunReportDrawer.tsx:80](src/components/RunReportDrawer.tsx#L80) —
   `useEffect(() => { if (!open || !enabled) return; … fetch …; }, [open, ...])`.
   The fetch only fires when the drawer's `open` prop flips to `true`.
2. [SandboxStreamPanel.tsx:237](src/components/SandboxStreamPanel.tsx#L237) —
   `const [reportOpen, setReportOpen] = useState(false)`. Drawer starts closed.
3. The drawer is opened from three sites:
   - Line 725 — keyboard shortcut `r`
   - Line 1190 — button click in the status area
   - Line 1404 — button click in the report trigger
4. None of these are triggered by the SSE `done` event. The test does not
   simulate any of them.
5. Commit `337d9474` removed only the dead confidence-chips block + the unused
   `reportData` alias (verified via `git show 337d9474 -- src/components/SandboxStreamPanel.tsx`).
   It did **not** remove an auto-fetch-on-done path — that path did not exist.

**Conclusion:** the integration contract is "SSE ends → user opens drawer →
fetch fires". The test was asserting on an auto-fetch-on-done flow that was
never implemented in this component. This is a **test-side bug**, not a
product regression. No user-impact risk.

**Fix scope** (to be included in the bulk fix-brief PR):

- Update [sse-params.test.tsx:37-39](src/lib/__tests__/sse-params.test.tsx#L37-L39)
  to mock both `fetchRunReport` and `fetchRunReportEnhanced` (current mock only
  provides `fetchRunReport`, so the drawer's preferred-enhanced path short-circuits
  the spy-under-test via the ternary at RunReportDrawer.tsx:89-91).
- After emitting `es.emit('done')`, simulate the user action that opens the
  drawer: either `fireEvent.keyDown(document.body, { key: 'r' })` or
  `fireEvent.click(screen.getByTestId('open-report-btn'))` (whichever testid
  the report trigger uses — executor to grep).
- Then assert the spy was called with the expected params.

**Severity (final):** cosmetic. Upgrades from "unclear" now that source-level
evidence rules out user impact.

**Options (for record):**
- A — fix test with drawer state + mock both functions ← **CHOSEN**
- B — fix product: rejected, no product regression surfaced.
- C — delete if redundant: unnecessary — the test is valuable once the drawer
  action is added; it exercises the SSE-done → drawer-open → fetch-with-params
  integration which nothing else covers at unit scope.

---

## Bulk fix manifest

Compact one-pass list for the fix-brief executor. Each row is an atomic edit
unit. All file paths are test files except the edgeIdentity row's second
location (a comment-only edit in `constants.ts`) and the optional
`CLAUDE.md` UI-SEM-013 refresh.

| # | File | Tests | Action type | Specific edits |
|---|------|-------|-------------|-----------------|
| 1 | [VerificationBadge.test.tsx](src/pages/sandbox-guide/components/panel/sections/__tests__/VerificationBadge.test.tsx) | 9 | fix test (copy) | Replace 6 occurrences of `'Review Recommended'` with `'Review Suggested'` at lines 42, 119, 145, 179, 205, 248, 284, 327, 358; replace `'Verification: Review Recommended'` with `'Verification: Review Suggested'` at line 43. |
| 2 | [ScenarioListPage.spec.tsx](src/pages/__tests__/ScenarioListPage.spec.tsx) | 4 | fix test (testid + copy) | Replace `data-testid="empty-state"` queries with `data-testid="first-run"` (2 sites); replace `data-testid="scenario-row"` with `data-testid="scenario-card"` (1 site); update subtitle regex from `/Analysis run — Option A won at 73%/` to `/Analysis run — Option A led at 73%/`. |
| 3 | [edgeIdentity.regression.spec.ts](src/canvas/utils/__tests__/edgeIdentity.regression.spec.ts) + [constants.ts](src/lib/mappers/constants.ts) | 3 | fix both | In spec: change `0.25` → `0.10` at lines 39, 66; change `0.30` → `0.15` at line 51 (with updated "at threshold" comment — `0.15 > 0.15` is false, still excluded); update docstring at lines 4–6 from "0.3" to "0.15". In constants: update comment at `constants.ts:18` from `(>=0.3 shown)` to `(>0.15 shown)`. Optionally refresh CLAUDE.md UI-SEM-013 reference from 0.3 to 0.15. |
| 4 | [RecommendationCard.spec.tsx](src/canvas/components/RecommendationCard/__tests__/RecommendationCard.spec.tsx) | 3 | fix test (copy) | Replace `"Generating recommendation..."` → `"Generating result..."`; `"Could not generate recommendation"` → `"Could not generate result"`; `"Recommended Action"` → `"Suggested Action"`. |
| 5 | [wave2-replay-gate.spec.ts](src/__tests__/wave2-replay-gate.spec.ts) | 2 | fix test (budget raise — Packet A) | Raise the `as any` budget constant from 6 to 14. Add inline comment: 8 net-new casts across 5 PLoT-adapter boundary sites (lines 1027, 1663, 2363, 2381, 2396 in useResultsSectionData.ts) — deferred typing, see cascade-triage-v3 "Technical debt — PLoT adapter type gap". |
| 6 | [conversationCss.spec.ts](src/canvas/conversation/__tests__/conversationCss.spec.ts) | 2 | fix test (design-token) | Test 1 (graphPatchBlockApplied): flip assertion from `.toContain('--success')` to assert `--border-default` instead, per DS v5 §21.2 (status = icon + eyebrow, not a second colour channel). Test 2 (PreAnalysisPanel utility): change expected class string from `px-2 py-3 space-y-4` to `px-3 py-3 space-y-3`. |
| 7 | [InsightsPanel.spec.tsx](src/canvas/components/__tests__/InsightsPanel.spec.tsx) | 2 | fix test (copy) | Replace `"Recommended Next Steps"` → `"Suggested Next Steps"`; replace aria-label `"Recommended next steps"` → `"Suggested next steps"`. |
| 8 | [sse-params.test.tsx](src/lib/__tests__/sse-params.test.tsx) | 1 | fix test (mock + drawer-state — Packet B) | Expand `vi.mock('../runReport', …)` to stub both `fetchRunReport` and `fetchRunReportEnhanced` (same `reportSpy`). After `es.emit('done')`, simulate drawer-open action (`fireEvent.keyDown(document.body, { key: 'r' })` or click the report trigger — executor to grep for the testid). Then assert `reportSpy` was called with the expected params. |
| 9 | [nodes.spec.ts](src/canvas/domain/__tests__/nodes.spec.ts) | 1 | fix test (size change) | Change action node default assertion from `{ width: 180, height: 70 }` to `{ width: 220, height: 100 }` at line 147. |
| 10 | [ClarifierPanel.spec.tsx](src/components/assistants/__tests__/ClarifierPanel.spec.tsx) | 1 | fix test (selector) | Replace selector `.bg-blue-600` with `.bg-primary` (or a data-testid-based query if available). Production at [ClarifierPanel.tsx:222](src/components/assistants/ClarifierPanel.tsx#L222) renders `bg-primary`. |

**Totals reconcile:** 9+4+3+3+2+2+2+1+1+1 = **28** ✓

**Execution notes:**

- All 10 rows can land in a single PR per Paul's instruction. Recommended commit
  structure: one commit per row (clear audit trail, clean revertability) or
  grouped by category (copy, testid, threshold, design-token, mock-state).
  Executor's call.
- Row 3 (edgeIdentity) is the only row touching a production file (`constants.ts`
  comment) — flag this in the PR description so reviewers know to look there.
- Row 5 (wave2) carries the Packet A rationale in its inline comment; also flag
  this as an architectural-debt carrying decision in the PR description so
  future grep-gate reviews can find it.
- Row 8 (sse-params) needs the executor to grep for the exact drawer-trigger
  testid before writing the `fireEvent.click` line — checking
  [SandboxStreamPanel.tsx:1190,1404](src/components/SandboxStreamPanel.tsx)
  will yield the right selector.

---

## Doc consistency checklist (for the fix-brief executor)

Before amending this findings doc to note PR landing, re-verify:

- [ ] `halt` count is still 0 in all tables (Current execution state, Summary,
  Recommendation counts, Evidence matrix, Cross-cutting).
- [ ] Category labels in per-file sections match the canonical set declared in
  the Summary table (copy drift, mock mismatch + copy drift, threshold drift,
  design-token drift, threshold breach, mock mismatch, intentional size change).
- [ ] Cast-count phrasing is "8 net-new casts across 5 boundary sites"
  everywhere (action sequence, Packet A, section 5, technical-debt item).
- [ ] Recommendation counts sum to 10 files / 28 tests across all three axes
  (recommendation, severity, category). Authoritative baseline numbers
  (11,634 passed, 28 failed, 38 pending, 49 skipped, 11,749 total) are
  unchanged unless a new suite capture landed.
- [ ] No lingering "halt for Paul judgement" or "What Paul needs to decide"
  wording in the per-file sections — both Packet A and Packet B are decided.

---

## Per-file findings

### 1. VerificationBadge.test.tsx — 9 failures

**Category:** copy drift

**Assertions (exact):**
Six `getByText('Review Recommended')` lookups across lines 42, 119, 145, 179, 205,
248, 284, 327, 358; one `getByLabelText('Verification: Review Recommended')` at
line 43.

**Production reality:**
- [VerificationBadge.tsx:64](src/pages/sandbox-guide/components/panel/sections/VerificationBadge.tsx#L64) renders `label: 'Review Suggested'`
- `aria-label="Verification: Review Suggested"` matches

**Evidence:**
- Commit `ea8d23a7` ("copy(ui): replace recommend/winner framing with neutral
  language", 2026-04-06) introduced the copy change, replacing ~125 user-facing
  instances of "recommend/winner" framing across 53 files.
- Test file last touched by commit `529a42dc` (design-system token sweep) which
  predates `ea8d23a7` — test was not part of the copy sweep.
- Line 7 JSDoc in the production file still reads "Review Recommended" in a
  comment, which should also flip to "Suggested" for consistency (not captured
  by the tests, but worth noting as cleanup during the fix).

**Recommendation:** `fix test` — update 6 test strings to "Review Suggested".

**Evidence bar met:**
- ✓ Production changed intentionally (copy sweep commit message confirms intent)
- ✓ Commit hash identified: `ea8d23a7`
- ✓ Commit message confirms intent: "replace recommend/winner framing with
  neutral language"
- ✓ Why assertion is now wrong: test asserts old "Recommended" copy; production
  is intentional "Suggested"

---

### 2. ScenarioListPage.spec.tsx — 4 failures

**Category:** mock mismatch (3 tests) + copy drift (1 test)

**Assertions and production reality:**

| Test | Test queries | Production | Mismatch |
|------|--------------|------------|----------|
| empty state | `data-testid="empty-state"` | `data-testid="first-run"` at [line 371](src/pages/ScenarioListPage.tsx#L371) | testid renamed |
| row click | `data-testid="scenario-row"` | `data-testid="scenario-card"` at [line 460](src/pages/ScenarioListPage.tsx#L460) | testid renamed |
| new scenario | `data-testid="empty-state"` | `data-testid="first-run"` | testid renamed |
| subtitle copy | `/Analysis run — Option A won at 73%/` | `Analysis run — ${winner} led at ${pct}%` at [line 82](src/pages/ScenarioListPage.tsx#L82) | "won at" → "led at" |

**Evidence:**
- Testids: production uses `first-run`, `scenario-list`, `scenario-card`,
  `scenario-list-skeleton`. "empty-state" and "scenario-row" appear nowhere in
  the production file (verified via Grep).
- Copy change: commit `ea8d23a7` ("replace recommend/winner framing with neutral
  language") — "won/winner" framing is the exact target of that sweep.

**Recommendation:** `fix test` — update testid queries (3) and subtitle regex (1).

**Evidence bar met:**
- ✓ Copy change commit: `ea8d23a7` ("replace recommend/winner framing with neutral
  language"). Covers the "won" → "led" subtitle.
- ✓ Testid introduction commit: `f5d5fedf` ("feat: auth, scenario hub, profile
  settings, PostHog, Sentry user context, conversation UI enhancements") —
  verified via `git log -S 'data-testid="first-run"' -- src/pages/ScenarioListPage.tsx`
  and `git log -S 'data-testid="scenario-card"' -- src/pages/ScenarioListPage.tsx`,
  both returning the same commit. Intent: feature commit building the scenario
  hub from scratch; the testids `first-run`/`scenario-card` are semantic names
  chosen at the time, not a rename from an earlier `empty-state`/`scenario-row`.
- ✓ Testids confirmed absent from production via direct grep.
- Both halves of the root cause (copy drift + testid mismatch) have commit +
  intent evidence.

---

### 3. edgeIdentity.regression.spec.ts — 3 failures

**Category:** threshold drift

**Assertions:**
- At `switchProbability=0.25`: expect `undefined`; got edge object (returned)
- At `switchProbability=0.30`: expect `undefined`; got edge object (returned)
- `buildFragileEdgeLookup` at 0.25: expect `lookup.has('e1')` to be `false`; got `true`

**Production reality (isolated-run confirmed):**
- [edgeIdentity.ts:46](src/canvas/utils/edgeIdentity.ts#L46): `fe.switchProbability > THRESHOLDS.FRAGILE_EDGE_FILTER`
- [constants.ts:19](src/lib/mappers/constants.ts#L19): `FRAGILE_EDGE_FILTER: 0.15, // Spec Section 6.3: switch_probability > 0.15`
- At 0.25: `0.25 > 0.15` → **true** → NOT filtered → returned ✓ (matches failure)
- At 0.30: `0.30 > 0.15` → **true** → NOT filtered → returned ✓ (matches failure)

**Evidence:**
- **Threshold drift**, not operator drift. Production threshold was lowered from
  0.3 to 0.15 in commit `ec41006e` ("feat(canvas): Phase 6 — edge spec
  compliance", 2026-03-30). Verified by `git log -p -S "FRAGILE_EDGE_FILTER: 0.15"`:
  ```diff
  -  FRAGILE_EDGE_FILTER: 0.3,
  +  FRAGILE_EDGE_FILTER: 0.15, // Spec Section 6.3: switch_probability > 0.15
  ```
- **Test was added before the threshold change.** The regression test was added
  in commit `1bed6552` ("fix(ui): resolve 4 critical + 4 medium cross-surface
  data alignment inconsistencies", 2026-03-23), encoding the 0.3 invariant that
  was canonical at the time.
- **Stale documentation in the same constants file:** line 18 doc-comment reads
  "(>=0.3 shown)" but the value below it is 0.15. This comment was not updated
  when the value changed.

**Recommendation:** `fix both` — test-side data-point update + a small
production-comment update. Listed as `fix both` rather than `fix test` because
the production file (`constants.ts`) is touched, even if only for a comment.

**Test-side changes** in [edgeIdentity.regression.spec.ts](src/canvas/utils/__tests__/edgeIdentity.regression.spec.ts):

- Lines 39, 51, 66: "below threshold" at 0.25 → change to a value below 0.15
  (e.g., 0.10). Line 51's "at threshold, <=" case should become "at threshold"
  with 0.15, since `0.15 > 0.15` is false (still excluded, matching the test
  intent).
- Line 45: "above threshold" at 0.35 → keep (0.35 > 0.15 still true).
- Line 76: `makeFragile(…, 0.10)` "all edges below threshold" → unchanged.
- Docstring at lines 4–6 should update "0.3" reference to "0.15".

**Production-side changes** (comment only, no behaviour change):

- [constants.ts:18](src/lib/mappers/constants.ts#L18): doc-comment
  `"(>=0.3 shown)"` → `"(>0.15 shown)"`.
- [CLAUDE.md UI-SEM-013](CLAUDE.md) currently describes "Fragile edge filter
  threshold (0.3)"; worth updating to 0.15 as part of the fix, to keep the
  governance index consistent with the actual threshold.

**Why this is not `fix product`:** the threshold change (0.3 → 0.15) was
intentional, spec-referenced (Section 6.3 in the code comment), and landed
3+ weeks ago. No user-facing regression was reported in that window. The
`fix both` label reflects that the product file is touched for a comment
refresh, not a behavioural change.

**Evidence bar met:**
- ✓ Production behaviour changed intentionally: commit `ec41006e` with explicit
  spec reference in the code comment
- ✓ Commit hash: `ec41006e` (feat/Phase 6 edge spec compliance)
- ✓ Isolated run confirms the test fails exactly as math predicts given the 0.15
  threshold (0.25 > 0.15 is true, so returned; 0.30 > 0.15 is true, so returned)
- ✓ Why assertion is now wrong: test data was chosen to straddle the old 0.3
  threshold; both 0.25 and 0.30 are now above the current 0.15 threshold

---

### 4. RecommendationCard.spec.tsx — 3 failures

**Category:** copy drift

**Assertions and production reality:**

| Failure | Test expects | Production (index.tsx) | Mismatch |
|---------|--------------|------------------------|----------|
| Loading | `"Generating recommendation..."` | `"Generating result..."` at line 265 | "recommendation" → "result" |
| Error | `"Could not generate recommendation"` | `"Could not generate result"` at line 283 | "recommendation" → "result" |
| AI badge | `"Recommended Action"` | `"Suggested Action"` at line 321 | "Recommended" → "Suggested" |

**Evidence:**
- Same commit `ea8d23a7` ("replace recommend/winner framing with neutral
  language"). The commit description notes "recommendation" (prescriptive) →
  "result" (analytical) was part of the vocabulary shift.
- Test last touched by commit `34e2db52` (comparison-store refactor, 2026-04-12)
  which post-dates `ea8d23a7` but didn't touch these string assertions.

**Recommendation:** `fix test` — update 3 strings.

**Evidence bar met:** same as VerificationBadge — commit identified, intent
confirmed, production verified.

---

### 5. wave2-replay-gate.spec.ts — 2 failures

**Category:** threshold breach (cast budget governance)

**Assertions:**
1. `src/components/results/useResultsSectionData.ts` should have ≤ 6 `as any`
   casts. Actual: **14** (verified via `grep -o "as any" | wc -l`).
2. All remaining casts should contain the `__OLUMI_DEBUG` marker. Fails on
   `const jointGoalProb = typeof (prob as any).probability_of_joint_goal` at
   line 1027 (verified via grep).

**Production reality (14 occurrences across 12 lines):**

| Line | Cast | Guarded? |
|------|------|----------|
| 1027 (×2) | `(prob as any).probability_of_joint_goal` | No — runtime field access |
| 1321 | `(window as any).__OLUMI_DEBUG` | Yes (the marker itself) |
| 1663 | `nonZeroImpactDrivers as any` | No — helper arg |
| 1744, 1925, 1947, 1959, 2013 | `(window as any).__OLUMI_DEBUG` | Yes |
| 2363 (×2), 2381 (×2), 2396 | `(report as any)?.conditional_winners` / `?.inference_warnings` / `?.edge_e_values` | No — defensive optional field access |

**Evidence:**
- Budget set to 6 in the test; actual is 14. The gap is **8 net-new casts across
  5 boundary sites**, neither `__OLUMI_DEBUG`-guarded nor justified by existing
  governance.
- No recent commit surfaced as the introducer — agent's `git log -10` showed
  no single cast-adding refactor. Debt accumulated over multiple commits.
- The unguarded casts at 1027, 1663, 2363, 2381, 2396 access `probability_of_joint_goal`,
  legacy drivers, and robustness sub-fields — these are reading fields from PLoT
  responses that aren't in the typed interface.

**This was a governance question, resolved 2026-04-19.** See Decision Packet A
for full rationale. Summary:

- **Option A chosen:** raise budget 6 → 14 in the test, add inline comment
  citing the 8 net-new casts across 5 PLoT-adapter boundary sites
  (lines 1027, 1663, 2363, 2381, 2396) as deferred-typing rationale.
- Option B (guards) rejected: some casts read real data, not debug state.
- Option C (type the PLoT response) deferred to next adapter/schema work
  touching this area; registered under "Technical debt — PLoT adapter type
  gap" below.

**Recommendation:** `fix test` — test-file edits only. Specifically:

1. Update the budget constant in `wave2-replay-gate.spec.ts` from 6 to 14.
2. Add an inline comment citing the 8 casts across 5 sites as
   PLoT-adapter-boundary reads awaiting typing, referencing the technical
   debt item in this doc.

**Evidence bar met:**
- ✓ Decision recorded: Paul's disposition 2026-04-19 (Packet A)
- ✓ Rationale documented in Packet A (defensive reads of optional PLoT fields)
- ✓ Technical debt registered for future Option C resolution

**Severity:** architectural-debt — budget-raise holds the guardrail at a new
floor; the underlying PLoT adapter type gap remains as registered debt, not a
user-facing regression.

---

### 6. conversationCss.spec.ts — 2 failures

**Category:** design-token drift (both sub-tests — one border-token decision,
one Tailwind utility drift; grouped under the canonical label)

**Test 1:** `graphPatchBlockApplied recolours the full border to success`
- **Test expects:** `.graphPatchBlockApplied` rule body to contain `--success`
- **Production at [Conversation.module.css:360-362](src/canvas/conversation/Conversation.module.css#L360-L362):**
  ```css
  .graphPatchBlockApplied {
    border-color: var(--border-default, #EEE6D8);
  }
  ```
- **Comment at lines 357–359** (verbatim, verified via grep):
  ```
  /* When a patch is applied the border reverts to the same neutral as the default
     patch block. Status is signalled by the muted "Changes applied" eyebrow text
     + Check icon; a second colour channel is redundant (DS v5 §21.2). */
  ```
- **Commit:** `e193d2d7` ("fix(ui): conversation blocks — full thin border +
  shadow-1 (DS v5 override)") — this commit intentionally reverted the applied
  state away from `--success` to align with DS v5 §21.2 (status = icon + eyebrow,
  not a second colour channel).

**Recommendation for test 1:** `fix test` — the CSS reflects an intentional DS v5
decision documented both in the CSS comment and the commit message.

**Test 2:** `olumi scrollbar utility is applied to the AI thread and right-hand panel sources`
- **Test expects** (per agent): PreAnalysisPanel to contain exactly
  `'olumi-scrollbar flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4'`
- **Production:** `'olumi-scrollbar flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3'`
- **Diff:** `px-2` → `px-3`, `space-y-4` → `space-y-3`

**Recommendation for test 2:** `fix test` — minor spacing change. Agent did not
identify the commit; fix-brief executor should `git log -p` the PreAnalysisPanel
file to pin the change commit. Low risk.

**Evidence bar met:**
- ✓ Test 1: commit `e193d2d7` identified; intent in commit message and CSS comment.
- ✓ Test 2: commit `0be59e99` ("feat(pre-analysis): six polish fixes (padding,
  icons, density, zero, truncation, debug)") — verified via
  `git log -S "px-3 py-3 space-y-3" -- src/canvas/components/pre-analysis/PreAnalysisPanel.tsx`.
  Intent: deliberate padding/density polish; the spacing diff (`px-2`→`px-3`,
  `space-y-4`→`space-y-3`) is exactly the "padding" + "density" items in the
  commit message.

---

### 7. InsightsPanel.spec.tsx — 2 failures

**Category:** copy drift

**Assertions and production:**

| Failure | Test expects | Production | Mismatch |
|---------|--------------|------------|----------|
| Heading | `"Recommended Next Steps"` | `"Suggested Next Steps"` (line 473) | "Recommended" → "Suggested" |
| aria-label | `"Recommended next steps"` | `"Suggested next steps"` (line 479) | same pattern |

**Evidence:** Commit `ea8d23a7` — same copy sweep. Verified.

**Recommendation:** `fix test` — two string updates.

**Evidence bar met:** same pattern as VerificationBadge.

---

### 8. sse-params.test.tsx — 1 failure

**Category:** mock mismatch (incomplete mock)

**Assertion:** `expected "spy" to be called 1 times, but got 0 times` — the
`fetchRunReport` mock should be invoked after an SSE run ends.

**Production reality (isolated-run + source read):**
- `SandboxStreamPanel.tsx` does not import `fetchRunReport` directly, but it
  renders `RunReportDrawer` at [line 1370](src/components/SandboxStreamPanel.tsx#L1370).
- `RunReportDrawer.tsx` imports `RunReportMod` via namespace (`import * as RunReportMod from '../lib/runReport'`)
  and at [line 87–88](src/components/RunReportDrawer.tsx#L87-L88) prefers
  `fetchRunReportEnhanced` over `fetchRunReport`:
  ```ts
  const fnEnhanced = (RunReportMod as any).fetchRunReportEnhanced as undefined | ((args) => Promise<…>)
  const fnLegacy = RunReportMod.fetchRunReport
  ```
- The test mock at [sse-params.test.tsx:37-39](src/lib/__tests__/sse-params.test.tsx#L37-L39)
  only stubs `fetchRunReport` — it does NOT provide `fetchRunReportEnhanced`:
  ```ts
  vi.mock('../runReport', () => ({
    fetchRunReport: (args: any) => reportSpy(args),
  }))
  ```
- When `vi.mock` replaces the module entirely, `RunReportMod.fetchRunReportEnhanced`
  resolves to `undefined`, the code should fall through to `fnLegacy` — but the
  spy still isn't called. This means the "done" path isn't triggering
  `RunReportDrawer`'s fetch at all.

**Resolution (2026-04-19):** source-level trace of RunReportDrawer (line 80) and
SandboxStreamPanel (lines 237, 725, 1190, 1404) confirms the integration contract
is "SSE ends → user opens drawer (keyboard `r` or report button) → fetch fires".
The drawer does **not** auto-fetch on SSE `done`. Commit `337d9474` removed only
the dead chips block + unused `reportData` alias (verified via `git show`) — no
auto-fetch path was removed, because none existed. The test was asserting on a
flow that was never implemented.

**Recommendation:** `fix test` (Option A) — update the test to mock both
`fetchRunReport` and `fetchRunReportEnhanced`, and simulate the drawer-open
action (keyboard `r` or button click) after emitting `done`. See Decision
Packet B for full fix scope.

**Evidence bar met:**
- ✓ Production behaviour: the drawer has never auto-fetched on SSE `done` in
  this component. Verified via `grep` on `setReportOpen` + read of
  `RunReportDrawer.tsx:80` (open-prop-gated `useEffect`).
- ✓ Commit `337d9474` trace: removed 52 lines of dead code unrelated to the
  fetch path. Verified via `git show 337d9474 -- src/components/SandboxStreamPanel.tsx`.
- ✓ Why assertion is now wrong: the test assumes auto-fetch-on-done; the
  contract is user-action-triggered fetch.

**Severity:** cosmetic — no user-impact risk. Upgraded from `unclear` after
the source-level trace resolved the ambiguity without needing a browser
smoke check.

---

### 9. nodes.spec.ts — 1 failure

**Category:** intentional size change

**Assertion:** `NODE_REGISTRY` action node should default to `{ width: 180, height: 70 }`
at [nodes.spec.ts:147](src/canvas/domain/__tests__/nodes.spec.ts#L147).

**Production:** [nodes.ts:305](src/canvas/domain/nodes.ts#L305) — `{ width: 220, height: 100 }`.

**Evidence:**
- Commit `176674c0` ("feat(layout): improve ELK layout — larger node sizes,
  spacing, adaptive scaling", 2026-03-18).
- Intentionally scaled all 7 node types uniformly for ELK-layout readability.

**Recommendation:** `fix test` — update to `{ width: 220, height: 100 }`.

**Evidence bar met:**
- ✓ Production changed intentionally: feat commit for layout improvement
- ✓ Commit hash: `176674c0`
- ✓ Commit message confirms intent

---

### 10. ClarifierPanel.spec.tsx — 1 failure

**Category:** mock mismatch (selector drift)

**Assertion:** test counts elements with class `.bg-blue-600`, expects ≥ 2 filled
progress bars, gets 0.

**Production (per agent):** [ClarifierPanel.tsx:222](src/components/assistants/ClarifierPanel.tsx#L222)
renders progress bars with class `bg-primary` (design-system token), not the raw
Tailwind `bg-blue-600`.

**Evidence:**
- Commit `25126533` ("fix(m2-m3): Address M2-M6 audit findings — clarifier
  multi-select & form UX") likely touched this during a design-token sweep.
- Broader pattern: the repo's design system prefers `bg-primary` over raw
  `bg-blue-600` per CLAUDE.md §"Design System" rules.

**Recommendation:** `fix test` — update selector from `.bg-blue-600` to
`.bg-primary` (or a more stable query like a data-testid if one exists).

**Evidence bar met:**
- ✓ Commit `529a42dc` ("feat(ui): design-system token sweep, thread hydration
  (Track 3), and context menu improvements") — verified via
  `git log -S 'bg-primary' -- src/components/assistants/ClarifierPanel.tsx`.
  Intent: explicit design-system token migration; the commit message literally
  says "design-system token sweep".
- ✓ Production verified to render `bg-primary` (not `bg-blue-600`).
- ✓ Aligns with CLAUDE.md design-system rule: "New code should use semantic
  names (`text-info`, `bg-panel`), not legacy aliases (`sky-500`, `mint-500`)" —
  same principle applies to `bg-primary` vs raw `bg-blue-600`.

---

## Cross-cutting observations

1. **Copy sweep `ea8d23a7` is the single biggest driver.** 4 files (16 tests)
   directly attributable. A bulk "fix test: update copy to match ea8d23a7" PR
   would close ~57% of the cascade.

2. **No user-blocking regressions surfaced.** All 28 failures are mechanical
   test-side updates (25 `fix test` + 3 `fix both`): copy drift, testid rename,
   threshold-value drift, design-token update, drawer-state mock fix, and the
   wave2 cast-budget raise. Both original `halt` items have Paul's dispositions
   recorded — sse-params resolved via Packet B source-level trace (no product
   regression); wave2-replay-gate resolved via Packet A (Option A — raise
   budget 6 → 14). No user-impact path broken.

3. **Two semantic threshold items worth Paul's attention:**
   - `edgeIdentity` threshold dropped from 0.3 to 0.15 on 2026-03-30. The
     `constants.ts:18` doc-comment still reads "(>=0.3 shown)" — consider
     flipping it as part of the test fix to prevent future confusion.
     `CLAUDE.md` UI-SEM-013 also references 0.3 as the canonical threshold;
     it may need updating to 0.15.
   - `wave2-replay-gate` cast budget (6) breached to 14. The unguarded casts
     at `useResultsSectionData.ts:1027`, `1663`, `2363`, `2381`, `2396` all
     read PLoT-adapter sub-fields not present in the typed interface. This
     suggests the PLoT response shape has evolved ahead of the adapter types.

4. **One untyped PLoT integration surface:** in the cast-budget investigation
   I noticed `probability_of_joint_goal`, `conditional_winners`,
   `inference_warnings`, and `edge_e_values` are all accessed via `as any`
   on PLoT responses. Not in scope for this task, but a candidate for a
   typing pass.

5. **Agent verification caveats:** I cross-checked commit existence, the
   `as any` count (14 via `grep -o`), the edgeIdentity `>` operator, the 0.15
   threshold value, production testids in ScenarioListPage, the
   conversationCss rule, and ran edgeIdentity and sse-params in isolation
   per brief §D2.2 ("isolated runs are evidence capture, not validation").
   For items I did not verify directly (RecommendationCard line numbers,
   ClarifierPanel commit), the fix-brief executor should re-grep before
   changing code. Flagged per entry.

---

## Out of scope for this task

- Fixing any of the 28 tests (investigation only per brief §2.2)
- Fixing any of the production code touched by `ea8d23a7` or the feat/fix
  commits listed above
- Raising or lowering the cast budget in `wave2-replay-gate.spec.ts`
- Running the suite a second time to validate anything; the D2.1 capture is the
  authoritative evidence

## Not halted on

- Mixed-root-cause files (ScenarioListPage, conversationCss) — both continue
  through enumeration with both components documented, per brief §D2.7 "not a halt".
- No cascade-derived failures spotted where one failing test masks others — each
  file's failures were independently attributable.

---

*End of findings.*
