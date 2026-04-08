# Blocked-readiness UX verification (post-2026-04-08 CEE fix)

Date: 8 April 2026
Context: CEE's `assist/v1/graph-readiness` endpoint was tightened on 2026-04-08 to treat `needs_encoding` options as a hard blocker (was: counted as "ready enough"). This document verifies that the UI surfaces the new blocked state correctly.

## Surfaces that read `readiness_level` / `can_run_analysis` / `readiness_score`

| File | Lines | Field read | Behaviour when readiness is blocked |
|---|---|---|---|
| [`PreAnalysisHealth.tsx`](../src/canvas/components/PreAnalysisHealth.tsx) | 127, 208, 227, 249-255 | `can_run_analysis`, `readiness_level`, `readiness_score`, `confidence_explanation` | "Analyse now" button **disabled**, aria-label switches to "Fix issues before running analysis", tier header shows level + score, confidence_explanation rendered as subtext. ✅ Correct propagation. |
| [`PreAnalysisReadinessPanel.legacy.tsx`](../src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx) | 1474 | `can_run_analysis` | `graphCanRun` derived correctly; `onCanRunChange` propagates to parent; `Analyse` button disabled. ✅ Correct propagation. Renders `needs_encoding` per-option with title "Options need numeric values" and a descriptive list of unresolved values (lines 105-114, 295-306). |
| [`canRunAnalysis.ts`](../src/canvas/utils/canRunAnalysis.ts) | 125-129, 153 | `can_run_analysis`, `confidence_explanation`, `readiness_level` | When blocked, pushes `readiness.confidence_explanation` (e.g. `"V3 analysis not ready: 1 option(s) blocked: opt_xyz"`) into `blockingReasons[]` and returns `{allowed: false, reason}`. ✅ Correct propagation. |
| [`usePreAnalysisData.ts`](../src/canvas/hooks/usePreAnalysisData.ts) | 618-621 | `can_run_analysis` | `graphCanRun` combined with `preRunValidation.canRun` and `hasBlockers` into a single `canRun` flag. When readiness is blocked, `canRun === false`. ✅ Correct propagation. |
| [`useGraphReadiness.ts`](../src/canvas/hooks/useGraphReadiness.ts) | 170-172 | Type definitions only | Schema for the readiness response — no behaviour change needed; the tightened endpoint still returns the same shape. ✅ Compatible. |
| [`readinessStore.ts`](../src/canvas/stores/readinessStore.ts) | 132-181, 336-344 | All three fields | Local store that mirrors the readiness response. The `can_run_analysis` field is forwarded as-is (line 343-344). ✅ Compatible. |
| [`useResultsSectionData.ts`](../src/components/results/useResultsSectionData.ts) | 584-598, 1624-1635 | `readiness_level`, `readiness_score` (no `can_run_analysis`) | Used post-run for quality summarisation. Doesn't gate any user action. ✅ Not relevant to blocking UX. |
| [`PipelineTab.tsx`](../src/components/debug/tabs/PipelineTab.tsx) | 1890 | `readiness_score` | Debug-only metric card. ✅ Not user-facing. |
| **`ResultsPanel.tsx`** | **112** | **HARDCODED `can_run_analysis: true`** | **⚠ Bypasses readiness gate.** See "Flagged surface" below. |

## Coached recovery rendering for `needs_encoding`

The PreAnalysisReadinessPanel maps each option's status to a user-friendly title and description ([PreAnalysisReadinessPanel.legacy.tsx:283-318](../src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx#L283-L318)):

- **Title**: `'Options need numeric values'` (from `ISSUE_TITLES.needs_encoding`)
- **Description (when `unresolved_targets` provided by CEE)**: `'These text values need converting: <comma-separated values>'`
- **Description (fallback)**: `'This option is not ready for analysis.'`

This works correctly today and is independent of the CEE fix — the UI was already prepared to render `needs_encoding` per-option even before the readiness route started flagging it as a hard blocker.

The complementary Layer 1 client-side gate at [`usePreRunValidation.ts:181-244`](../src/canvas/hooks/usePreRunValidation.ts#L181-L244) **also** detects `needs_encoding` and emits a blocker via `validateOverallStatus`, with `statusMessages.needs_encoding = 'Some options have categorical values that need encoding'`. This is the run-path counterpart to the readiness route — it engages when the user actually tries to run, irrespective of which surface they came from.

**Conclusion**: The coached recovery story for `needs_encoding` was already complete before the CEE fix. The fix simply makes the readiness *score* agree with the run-path *gate*, so the user no longer sees "Analyse now" enabled while the run path would reject.

## Flagged surface: `ResultsPanel.tsx:112`

```tsx
const runGateResult = canRunAnalysisUtil({
  graphHealth: graphHealth ?? null,
  readiness: ceeAnalysisReady ? { can_run_analysis: true, readiness_level: 'strong', confidence_explanation: '' } : null,
  hasBlockers: hasValidationBlockers,
  nodeCount: nodes.length,
  isRunning,
})
```

The ResultsPanel constructs a **synthetic** readiness object that hardcodes `can_run_analysis: true` and `readiness_level: 'strong'` whenever `ceeAnalysisReady` is non-null in the store. This bypasses the V1 readiness endpoint entirely.

### Behaviour analysis

- **Pre-CEE-fix**: The readiness endpoint counted `needs_encoding` as ready, so this synthetic shortcut and the real endpoint agreed. Hardcoding `true` produced the same answer as the endpoint would have.
- **Post-CEE-fix**: The readiness endpoint now returns `false` for `needs_encoding`. The synthetic shortcut still returns `true`. **They disagree.**

Concretely: a user can be on the Results panel, see the "Run again" button enabled because of this synthetic shortcut, click it, and reach `usePreRunValidation` (the run-path gate). The run gate has its own `needs_encoding` handling at [`usePreRunValidation.ts:212-238`](../src/canvas/hooks/usePreRunValidation.ts#L212-L238) — soft-bypass if every option's per-option `status === 'ready'`, otherwise hard-block. So the user does NOT silently send a bad request to PLoT; they hit the run-path gate and see a blocker message.

### Severity

**Low** — the run-path gate catches it. The user sees a button that's enabled where strictly it should be disabled, but if they click, they get a clean blocker message with a recovery action. No bad PLoT request, no silent failure.

### Recommendation (out of scope for this Risk-Tier-A brief)

Replace the synthetic readiness object at line 112 with an actual `useGraphReadiness()` call, or pass the real `readiness` from a parent component. Estimated change: 5-10 lines, low risk. Should be tracked as a separate fix because it's a pre-existing divergence rather than something the CEE fix introduced.

Per the brief: "Do not change UX code unless a clear bug is found." This is a pre-existing low-severity divergence that the run-path gate already mitigates, so I'm flagging it but not patching.

## Other observations

### `usePreRunValidation.ts` soft-bypass logic

[Lines 195-238](../src/canvas/hooks/usePreRunValidation.ts#L195-L238) implement an "LLM omission resilience" soft-bypass: when `analysis_ready.status === 'needs_encoding'` BUT every per-option `status === 'ready'` AND has interventions, the gate downgrades to a warning instead of a hard blocker. This is independent of the CEE readiness route and is unaffected by the fix.

The soft-bypass exists because the LLM occasionally produces `needs_encoding` at the top level even when the per-option statuses are all `ready` — typically when category metadata was dropped during pipeline processing. The bypass lets analysis proceed in that case while the panel still surfaces a warning.

After the CEE fix, this asymmetry is sharper: the readiness route blocks, but the run gate may soft-bypass. In practice these can't both be triggered for the same user click, because a blocked readiness disables "Analyse now" upstream. But if a future surface (like the flagged `ResultsPanel.tsx`) bypasses the readiness gate, the soft-bypass becomes the actual behaviour.

This is correct as designed and does not require any change.

### `confidence_explanation` rendering

`PreAnalysisHealth.tsx:234` renders `readiness.confidence_explanation` as the subtext under the tier header. With my CEE change, when readiness is blocked the explanation is one of:

- `"Goal node \"<id>\" not found in graph"` (if goal validation failed)
- `"Only N options ready (need at least 2)"` (if not enough options)
- `"V3 analysis not ready: N option(s) blocked: opt_x, opt_y"` (general blocker)

These are user-readable but a little terse. Could be improved with a fuller explanation citing specific blocker reasons, but this is unchanged behaviour from before the CEE fix.

## Findings summary

| Finding | Severity | Action |
|---|---|---|
| Eight readiness consumers all correctly propagate `can_run_analysis: false` | n/a | None — already correct |
| Coached recovery for `needs_encoding` already in place at PreAnalysisReadinessPanel | n/a | None — already correct |
| `ResultsPanel.tsx:112` bypasses readiness via hardcoded synthetic object | Low (mitigated by run-path gate) | Flag for separate fix; not in scope |
| `usePreRunValidation` soft-bypass for `needs_encoding`+all-options-ready | n/a | Correct as designed |
| `confidence_explanation` text from CEE could be more descriptive | n/a (terse but functional) | Future polish |

No UX changes were made as part of this brief, per the "do not change UX code unless a clear bug is found" instruction. The flagged ResultsPanel divergence is a pre-existing issue rather than a bug introduced by the CEE fix.

## Cross-reference

- Source-of-truth contract: [olumi-assistants-service/Docs/intervention-authority-contract.md](../../olumi-assistants-service/Docs/intervention-authority-contract.md)
- Handler matrix: [olumi-assistants-service/Docs/graph-patch-handler-matrix.md](../../olumi-assistants-service/Docs/graph-patch-handler-matrix.md)
- CEE readiness fix: [olumi-assistants-service/src/routes/assist.v1.graph-readiness.ts](../../olumi-assistants-service/src/routes/assist.v1.graph-readiness.ts)
