# Brief 5.6 — Precondition Check and Data-Availability Audit

Captured: 2026-04-26
Branch: `ui/analysis-tab-ia-reframe` (created from `staging` at commit `6216579f`)

---

## 1. Branch and working tree

| Check | Status |
|---|---|
| Branch | `ui/analysis-tab-ia-reframe` |
| Base commit | `6216579f` — Merge branch 'ui/brief-5_5-closeout' |
| Working tree | Clean — no uncommitted changes |
| Stale .js files in src/ | None |
| Stash entries | 27 pre-existing entries from prior sessions. All pre-date this brief. No action required. |

---

## 2. Path resolution

All in-repo paths referenced by the brief:

| Path | Exists |
|---|---|
| `docs/design/Olumi_Design_System_v5.md` | ✅ |
| `docs/brief-5_5-visual-system-spec.md` | ✅ |
| `docs/brief-5_5-final-review.md` | ✅ |
| `src/components/results/ResultsBody.tsx` | ✅ |
| `src/components/results/AdvancedSection.tsx` | ✅ |
| `src/components/results/DriversSection.tsx` | ✅ |
| `src/components/results/DecisionConfidencePanel.tsx` | ✅ |
| `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | ✅ |
| `src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts` | ✅ |
| `src/canvas/components/pre-analysis/ModelHealthCard.tsx` | ✅ |
| `src/canvas/components/pre-analysis/expertise/YourExpertise.tsx` | ✅ |
| `src/canvas/components/pre-analysis/expertise/AiEstimated.tsx` | ✅ |
| `src/canvas/components/pre-analysis/expertise/MissingData.tsx` | ✅ |
| `src/canvas/components/pre-analysis/hooks/deriveExpertiseGroups.ts` | ✅ |
| `src/components/shared/MissingKnowledgePrompt.tsx` | ✅ |
| `src/components/shared/TriageHealthHeader.tsx` | ✅ |
| `src/components/Tooltip.tsx` | ✅ |
| `src/canvas/hooks/useGraphReadiness.ts` | ✅ |
| `src/canvas/stores/readinessStore.ts` | ✅ |

Out-of-repo documents cited in brief (citation protocol applies — brief inline text treated as authoritative):

| Path | Status |
|---|---|
| `olumi-ai-architecture-v3-signal-registry-addendum-v3.md` | Not in repo — brief citation unverified against source |
| `olumi-boundary-contract-v1_1.md` | Not in repo — brief citation unverified against source |

---

## 3. Baselines

### Typecheck

```
npm run typecheck → tsc -p tsconfig.ci.json --noEmit
Exit: 0 (clean — no errors)
```

### Scoped vitest (`src/components/results` + `src/canvas/components/pre-analysis`)

```
Test Files  85 passed | 1 skipped (86)
      Tests  1545 passed | 13 skipped (1558)
   Duration  35.00s
```

No failures. This is the D1 baseline — all subsequent deliverables must hold these numbers.

### Pre-existing known failures (from MEMORY.md — not in scoped suite)

These failures exist in the full test suite and are tracked:

| Test file | Failure count | Notes |
|---|---|---|
| `responseMapper.spec.ts` | ? | goal_probability mapping |
| `bff-only.spec.ts` | ? | Unrelated to V3 field work |
| `DecisionQualityChecks.spec.tsx` | 6 | References removed "Sharpen your thinking" header — KNOWN-BROKEN |
| `ConfidenceSection.voi.spec.tsx` | 1 | "Could change the recommendation" topAction.couldFlip path — KNOWN-BROKEN |
| `no-message-render.spec.ts` | 1 | ChallengeSection.tsx renders critique .message in JSX — KNOWN-BROKEN |
| 29 excluded files | varied | Listed in `vitest.config.ts` excludes |

None of the above are in `src/components/results` or `src/canvas/components/pre-analysis` — all are outside scoped suite scope.

---

## 4. Readiness reframe data audit (gates D11–D14)

### D11 — Decision shape (replaces "Structure" label)

**Verdict: ✅ SHIP**

Canvas store exposes `.nodes` and `.edges` arrays directly. Node `type` field categorises as `'option' | 'outcome' | 'goal' | 'factor' | 'risk' | 'decision'`. A deterministic 0–100 smooth score can be computed from graph-state counts without any CEE call. Score formula to be locked in D2 spec (finer-grained than three-boolean per plan correction).

Existing structural heuristics in `readinessStore.ts:118-122` confirm feasibility.

### D12 — Your contribution (replaces "Coverage" label)

**Verdict: ✅ SHIP — reuses existing `evidence` computation**

The `observedState.source` field on each canvas node tracks origin as a string enum. `usePreAnalysisData.ts:345` already defines:

```ts
const AI_SOURCES = new Set(['ai', 'cee_inference', 'inferred', 'engine', 'ai_estimate'])
```

The existing `evidence` score at `usePreAnalysisData.ts:1237-1268` computes `nonAiCount / totalFactors` — which is exactly the "user-set ÷ total" ratio the brief specifies. D12 reuses this computation verbatim; only the label slot ("Coverage" → "Your contribution") and tooltip/action copy change.

**Note:** This means D12 repurposes the existing `evidence` dimension computation. The `balance` (Coverage) computation at lines 1965-1987 becomes orphaned and can be removed along with D12.

### D13 — Grounded in evidence (replaces "Evidence" label)

**Verdict: ⚠️ DEFERRED**

`_evidenceNodeClass: Map<string, 'grounded' | 'assumed' | 'none' | 'na'>` exists in canvas store (`store.ts:110`) but is **never populated by CEE during draft ingestion**. `DraftChat.tsx` does not write to this map when processing CEE responses — it is only written by explicit user actions (evidence panel reviews). Without per-factor grounding data from CEE, no deterministic UI-side "grounded in evidence" score is computable.

D13 will be a doc-only commit. The "Evidence" label is retained in the ring. The existing `evidence` ratio (which was the old "Evidence" score) has been redirected to D12's "Your contribution" — meaning if D12 ships, the old "Evidence" slot must either receive a new computation or remain displaying the **same** evidence ratio under the old label until CEE provides a true grounding signal.

**Documented gap:** CEE does not emit a canonical `has_evidence` boolean per factor. Closing this dimension requires DraftChat to populate `_evidenceNodeClass` from CEE response fields (`observedState.source`, `uncertainty_drivers`, edge `provenance`) — a boundary-touching ingestion change outside this brief's scope.

### D14 — Bias checks (replaces "Verified" label)

**Verdict: ⚠️ DEFERRED**

`CEEAnalysisReady.bias_findings?: CEEBiasFinding[]` is emitted by CEE and threaded into canvas store. However, there is no per-flag `reviewed: boolean` or `cleared_at` state. `bias_findings` is immutable post-CEE-generation. The "completed_reviews ÷ total_flags" ratio specified in the brief cannot be computed.

D14 will be a doc-only commit. The "Verified" label is retained in the ring (keeping its existing `calibration` computation = reviewed factors / total reviewable factors as proxy).

**Documented gap:** Closing this dimension requires either (a) a store extension adding `biasReviewStatus: Map<id, boolean>` with corresponding UI mutation handlers, or (b) a schema extension marking findings reviewed — both are Boundary Contract changes, out of this brief's scope.

---

## 5. IA audit — render sites

### Pre-analysis

| Item | Status | Location |
|---|---|---|
| "3 assumptions to review and N quality suggestions" line | **Present** (dynamic, not hardcoded) | `usePreAnalysisData.ts:2007-2008` — template literal in `coachingSummary` memo. Fires when both `qCheckCount > 0` AND `verifyCount > 0`. D6 removes this branch. |
| "Your expertise" section | **Present** | `src/canvas/components/pre-analysis/expertise/YourExpertise.tsx`. Rendered inside Improve confidence at `PreAnalysisPanel.tsx:1758`. Contains unique Confirm/Set value actions on AI-estimated and missing-data factors (via `AiEstimated.tsx`, `MissingData.tsx`). These actions are NOT present in triage cards. D7 threads them into triage before removal. |
| "Improve confidence" accordion default state | **Already collapsed** (`useState(false)` at `PreAnalysisPanel.tsx:327`) | D9 is verification-only. |
| "Something missing from the model?" | **Present** — card-styled | `src/components/shared/MissingKnowledgePrompt.tsx:44-65`. Currently `rounded-lg border border-panel-border bg-panel px-4 py-2` — a card frame. Two consumers: `PreAnalysisPanel.tsx:1778` (pre-analysis, context='model') and `ResultsBody.tsx:356` (post-analysis, context='results'). Brief 5.5 D12 unification confirmed in place. D8 demotes card to quiet one-liner. |
| Readiness ring dimension labels | **Present** | Defined at `ModelHealthCard.tsx:44-49`. Ring SVG at `TriageHealthHeader.tsx:82-139`. Score computations in `usePreAnalysisData.ts`. |

### Post-analysis

| Item | Status | Location |
|---|---|---|
| "Show winner by" filter | **Present** | `RiskAppetiteFilter` function at `ResultsBody.tsx:432-461`. Rendered at line 218-220 (conditional on p10 data). Local state at line 140. Comment at line 212-217 notes it is a "display filter" distinct from persistent "Risk profile" in AdvancedSection. D3 relocates to AdvancedSection. |
| "Some confidence scores reflect default estimates..." disclaimer | **Present** | `DriversSection.tsx:887-891`. Section-level `<p>` conditional on `displayDrivers.some(d => d.isDefaultedConfidence)`. Confidence column header already has tooltip at lines 823-829. D4 merges disclaimer text into tooltip. |
| "Highest-value evidence gaps" bridge copy | **Present** | `DecisionConfidencePanel.tsx:242-250`. Conditional 4-line `<p>` (2 sentences). The brief's proposed single-line replacement ("Factors where new information would most reduce uncertainty") is already the subtitle at line 240. D5 removes conditional bridge `<p>`, surfaces detail via tooltip on a "What's this?" affordance when `showBridge` is true. |
| "Olumi applied N adjustments" | **Model tab only** | `src/canvas/components/model-tab/ModelAdjustments.tsx:271,305`. NOT in results panel. Per plan correction, Brief 5.5 D14 targeted results-panel removal; Model tab display is intentional. **D10 verification: CLEAN.** |
| Option card `#N of M` prefix | **Absent** (correctly removed) | `OptionCards.tsx:320-330` — only colour marker, no rank prefix. D10 verification: CLEAN. |
| Fragility alt-winner grouping | **Present** | `useResultsSectionData.ts:1431-1457`. Fragile edges map with `alternativeWinnerLabel`. D10 verification: CLEAN (structure in place). |

---

## 6. Component inventory for modified files

| File | Role in brief |
|---|---|
| `src/components/results/ResultsBody.tsx` | D3 — lift `RiskAppetiteFilter` out; state lift |
| `src/components/results/AdvancedSection.tsx` | D3 — receive `RiskAppetiteFilter` |
| `src/components/results/DriversSection.tsx` | D4 — disclaimer → tooltip content |
| `src/components/results/DecisionConfidencePanel.tsx` | D5 — remove bridge `<p>` |
| `src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts` | D6 (coachingSummary branch), D12 (relabel evidence computation) |
| `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` | D7 — remove YourExpertise render after threading; D11/D12 label sites |
| `src/canvas/components/pre-analysis/ModelHealthCard.tsx` | D11, D12 — label + tooltip copy |
| `src/components/shared/TriageHealthHeader.tsx` | D11, D12 — ring dimension bar rendering |
| `src/components/shared/MissingKnowledgePrompt.tsx` | D8 — demote card to one-liner |
| `src/canvas/components/pre-analysis/expertise/YourExpertise.tsx` | D7 — remove after threading |
| `src/canvas/components/pre-analysis/expertise/AiEstimated.tsx` | D7 — action logic to extract |
| `src/canvas/components/pre-analysis/expertise/MissingData.tsx` | D7 — action logic to extract |
| `src/canvas/components/pre-analysis/hooks/deriveExpertiseGroups.ts` | D7 — delete if unused after merge |

---

## 7. D2 spec lock dependencies

The following must be locked in D2 spec before any code changes:

1. **D11 Decision shape score formula** — smooth 0–100 from graph-state counts (not 0/33/66/100 jumps per plan correction). Formula TBD in D2.
2. **D12 Your contribution reuse confirmation** — D12 slot takes existing `evidence` computation. Old `balance` (Coverage) computation orphaned and removed.
3. **D6 grep gate text** — since the phrase is a template literal, the gate must search `"to review and.*quality suggestion"` not the literal string from the brief.
4. **D13/D14 deferral confirmed** — old "Evidence" and "Verified" labels retained pending data gap closure.
5. **D10 "Olumi applied"** — verified CLEAN (Model tab only, intentional).
