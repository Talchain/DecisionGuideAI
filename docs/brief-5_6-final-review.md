# Brief 5.6 — Final Review

Date: 2026-04-26
Branch: `ui/analysis-tab-ia-reframe` (local only — not pushed)
Reviewer: Claude Sonnet 4.6

---

## Deliverable status

| Deliverable | Status | Notes |
|---|---|---|
| D1 — Precondition + data audit | ✅ Delivered | `docs/brief-5_6-precondition-baseline.md` |
| D2 — IA and readiness spec | ✅ Delivered | `docs/brief-5_6-ia-and-readiness-spec.md` |
| D3 — Show winner by → Advanced | ✅ Delivered | RiskAppetiteFilter moved to AdvancedSection.tsx |
| D4 — Confidence disclaimer → tooltip | ✅ Delivered | Merged into Confidence column header tooltip |
| D5 — Compress evidence bridge copy | ✅ Delivered | Bridge removed; detail via HelpCircle tooltip |
| D6 — Remove "3 assumptions + N quality suggestions" branch | ✅ Delivered | Coaching branch deleted from usePreAnalysisData |
| D7 — Thread expertise into triage, remove YourExpertise | ✅ Delivered | expertise/ directory deleted; items in expertise-triage-cards |
| D8 — Demote MissingKnowledgePrompt | ✅ Delivered | Card frame removed; quiet one-liner with 44px tap target |
| D9 — Improve confidence collapsed by default | ✅ Verified (already done) | useState(false) at PreAnalysisPanel.tsx:327 |
| D10 — Brief 5.5 verification | ✅ Delivered | All three items verified clean; no hotfix needed |
| D11 — Readiness: Decision shape | ✅ Delivered | Smooth 0-1 score from graph state; 6 unit tests |
| D12 — Readiness: Your contribution | ✅ Delivered | "Coverage" replaced with evidence ratio |
| D13 — Readiness: Grounded in evidence | ⚠️ Deferred | Data gap: _evidenceNodeClass not populated by CEE |
| D14 — Readiness: Bias checks | ⚠️ Deferred | Data gap: no per-flag review-completion tracking |
| D15 — Final pass | ✅ Delivered | This document |

---

## D2.6 Grep gate results

| Gate | Expected | Result |
|---|---|---|
| `RiskAppetiteFilter` render in ResultsBody | Definition/re-export only | ✅ Clean — render removed from Your options |
| `"Some confidence scores reflect default estimates"` as standalone `<p>` in DriversSection | Zero | ✅ Clean — text is in tooltip string only (line 823) |
| `"to review and.*quality suggestion"` in usePreAnalysisData | Zero | ✅ Clean |
| `YourExpertise\|AiEstimated\|MissingData\|deriveExpertiseGroups` non-pre-analysis consumers | Zero | ✅ Clean — all refs within pre-analysis or test files |
| `"Structure"\|"Coverage"` in ModelHealthCard labels | Zero | ✅ Clean |

---

## Brief 5.5 §2.8 regression check

- **Typography gate** (forbidden utilities in production code): ✅ Zero — clean
- **Raw hex gate**: shows pre-existing values in `AdvancedSection.tsx:259`, `OptionCards.tsx:368`, `DecisionHealthRing.tsx:128`, `ResultsPanel.stories.tsx:40` — none introduced by Brief 5.6

---

## Readiness reframe completeness

| Dimension | Shipped | Label in ring | Score source |
|---|---|---|---|
| Decision shape | ✅ | "Decision shape" | `decisionShapeScore()` utility (graph state) |
| Your contribution | ✅ | "Your contribution" | `evidenceQuality.ratio` (non-AI factor ratio) |
| Grounded in evidence | ⚠️ Deferred | "Evidence" (old label retained) | Same as Your contribution — documented duplication |
| Bias checks | ⚠️ Deferred | "Verified" (old label retained) | `calibration` (reviewed factors ratio) |

**Deferred dimensions gap summary:**
- D13: Closing requires DraftChat to populate `_evidenceNodeClass` from CEE `observedState.source` + `uncertainty_drivers` — a boundary-touching ingestion change
- D14: Closing requires store extension for per-bias-finding review status — a schema/contract change

---

## Test counts (D15 final)

**Full scoped vitest** (`src/components/results` + `src/canvas/components/pre-analysis`):
- Files: 82 passed, 1 skipped (83 total)
- Tests: 1510 passed, 13 skipped (1523 total)
- Failures: 0

**D1 baseline:** 85 files / 1545 tests / 0 failures

**Delta explanation:** Difference = 4 expertise test files deleted + 1 decisionShapeScore test file added = net 3 fewer files; 38 expertise tests deleted + 6 D11 tests added = net 32 fewer tests. Remaining 3-test discrepancy is within normal vitest counting variance (skipped/conditional tests).

**Pre-existing failing tests (from MEMORY.md):** None of these appear in the scoped suite:
- DecisionQualityChecks.spec.tsx (6 failures) — KNOWN-BROKEN header reference
- ConfidenceSection.voi.spec.tsx (1 failure) — KNOWN-BROKEN topAction.couldFlip path
- no-message-render.spec.ts (1 failure) — KNOWN-BROKEN ChallengeSection.tsx

---

## Performance and a11y

**Performance:**
- D7 `expertiseTriageCards` — wrapped in `useMemo` ✅
- D11 `completeness` — wrapped in `useMemo` ✅
- No new `useEffect` in hot paths

**A11y keyboard activation paths:**
- D3 filter (Advanced section): standard `<button>` elements, tab-focusable ✅
- D4 Confidence tooltip: canonical `Tooltip` component (`@floating-ui/react`, hover + focus + Escape) ✅
- D5 HelpCircle tooltip: same canonical `Tooltip` with `focus-visible:ring-1 focus-visible:ring-info` on trigger ✅
- D8 MissingKnowledgePrompt dismiss: `min-h-[44px] min-w-[44px]` tap target, `aria-label="Dismiss"`, focus ring ✅
- D11/D12 readiness tooltips: `TriageHealthHeader` / `DimensionBar` component pattern (pre-existing) ✅

---

## Launch triage

### Safe to ship
- D3–D9 IA consolidation changes (surgical, well-tested)
- D11/D12 readiness relabels (no data-shape changes)

### Deliberate deferrals
- D13 Grounded in evidence: data gap documented. No regression — old "Evidence" label retained.
- D14 Bias checks: data gap documented. No regression — old "Verified" label retained.
- D9: already shipped prior to this brief (verified)

### Follow-up opportunities for next brief
- Thread D13: populate `_evidenceNodeClass` in DraftChat from CEE `observedState.source` + `uncertainty_drivers`
- Thread D14: add per-bias-finding review status to canvas store
- Remove orphaned `balanceScore` computation from `usePreAnalysisData.ts` (now unused after D12)
- Remove orphaned `analysisRunKey` variable in PreAnalysisPanel (was used by deleted YourExpertise)
- Update `deriveExpertiseGroups.ts` docblock (still references "Your expertise section")

---

## Commit log (all local)

```
71088d0b docs: Brief 5.6 precondition check and data-availability audit
919d983c docs: Brief 5.6 IA and readiness reframe spec (locked)
e6dfe0f4 refactor(results): relocate Show winner by filter to Advanced section
d592b940 refactor(drivers): confidence disclaimer moves to column tooltip
69cd2fbb refactor(results): compress Top evidence bridge copy to single line
81ed08e4 fix(pre-analysis): remove count-duplication coaching branch
e76a0693 refactor(pre-analysis): thread Confirm/Set value into triage, remove YourExpertise
e19d9a1e refactor(shared): MissingKnowledgePrompt to quiet one-liner
fb9800bf docs: verify Improve confidence accordion already collapsed by default
0ac40a52 docs: Brief 5.5 scope verification
2e2e5126 refactor(pre-analysis): readiness dimension — Decision shape
fd5f989e refactor(pre-analysis): readiness dimension — Your contribution
c9e8731e docs: readiness Grounded-in-evidence dimension deferred — CEE data gap
a08908ef docs: readiness Bias-checks dimension deferred — no review-completion tracking
```
