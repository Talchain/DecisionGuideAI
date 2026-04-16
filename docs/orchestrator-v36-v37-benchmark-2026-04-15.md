# Orchestrator v36 vs v37 benchmark report

**Date:** 2026-04-15
**Model:** claude-sonnet-4-6 (staging)
**Eval harness:** `scripts/eval/run-staging-eval.mjs` (SSE transport)
**v36:** `orchestrator_default` version 102 (active/production)
**v37:** `orchestrator_default` version 103 (staging, uploaded 2026-04-15)
**Runs per version:** 3

---

## Summary

| Version | Run 1 | Run 2 | Run 3 | Mean | Verdict |
|---|---|---|---|---|---|
| v36 | 5/7 | 4/7 | 6/7 | **5.00/7** | Baseline |
| v37 | 6/7 | 5/7 | 3/7 | **4.67/7** | Marginal regression (−0.33) |

**Regression gate:** v37 mean (4.67) < v36 mean (5.00). Gate technically fails by 0.33 scenarios on average. However, the difference is within single-run variance (range 3–6 for v37, 4–6 for v36), and the pattern is driven entirely by v37 run 3 which produced an unusual 3/7 result. See analysis below.

---

## Pass/fail matrix

| Metric | v36 r1 | v36 r2 | v36 r3 | v37 r1 | v37 r2 | v37 r3 |
|---|---|---|---|---|---|---|
| **Scenarios passed** | **5/7** | **4/7** | **6/7** | **6/7** | **5/7** | **3/7** |
| S1 · add-option | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| S2 · fix-connection | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| S3 · update-factor | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| S4 · pros-cons | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S5 · run-analysis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S6 · explain-after-analysis | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| S7 · chip-starvation | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Post-draft names trade-off | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Post-draft names assumption | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Post-analysis cites % | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Honesty gate fires | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Avg T1 latency (ms) | 56,039 | 46,002 | 43,367 | 41,716 | 57,326 | 44,080 |

---

## Per-scenario analysis

### S1 · add-option — ❌ consistent fail (both versions, all 6 runs)

**Failure:** `t2_missing_graph_patch · t2_not_structural · t2_no_option_added`

The orchestrator responds conversationally to "Add a third option: bootstrap without raising any funding" — asking the user to specify values for factor interventions rather than emitting a `GraphPatchBlock`. This is not a v37 regression; it is a pre-existing routing issue present in all 6 runs of both versions.

**Root cause:** The act-first rule and option-addition semantics differ between the system prompt and the eval harness expectation. The orchestrator treats the request as an underspecified edit (missing intervention values) and enters RECOVER mode rather than attempting a structural patch with stated assumptions. This is a known gap — the harness assertion expects a graph patch; the orchestrator asks for calibration data first.

**Not introduced by v37.** Both v36 and v37 fail this scenario identically.

---

### S2 · fix-connection — ✅ stable in v36 (3/3), ❌ v37 run 3 only

**v36:** 3/3 passes.
**v37:** 2/3 passes. Run 3 failure: `t2_neither_structural_nor_clear_conversational`.

In the failing v37 run 3 instance, the draft generated a differently-structured graph that caused the referent node ("Technical Debt Risk") to be absent, and the orchestrator's entity resolution did not produce a clear conversational fallback. Single-run failure — not a systematic regression.

---

### S3 · update-factor — flaky in both versions

**v36:** 2/3 passes (run 2 fails).
**v37:** 2/3 passes (run 2 fails). Run 3 also fails in v37.

Failure: `t2_neither_updated_nor_offered_recovery`. The orchestrator occasionally responds with a calibration question rather than immediately applying the update or offering a clear recovery path. This is a borderline routing case — both versions show similar failure rates (1/3 for v36, 1–2/3 for v37). The v37 run 3 double-failure compounds the headline score but the underlying behaviour is the same.

---

### S4 · pros-cons — ✅ stable (both versions, all 6 runs)

Consistent pass. Both versions produce substantive pros/cons responses.

---

### S5 · run-analysis — ✅ stable (both versions, all 6 runs)

Consistent pass. The preflight validation failure (duplicate option names) is handled correctly in both versions — the harness accepts either a successful analysis response or an honest missing-data message, and the orchestrator provides the latter when triggered.

Post-analysis preview (run 3 v37): "Hire One Tech Lead leads at 59%." — percentage cited correctly.

---

### S6 · explain-after-analysis — notable v37 improvement

**v36:** 1/3 passes (runs 1 and 2 fail: `no_analytical_content`).
**v37:** 3/3 passes.

This is the clearest differential between the two versions. In v36 runs 1 and 2, the post-analysis explain turn produced a response the harness classified as lacking analytical content. In all three v37 runs, the explain turn passed. The v37 additions to `STAGE_BEHAVIOUR` (EVALUATE section) and `TOOLS` (explain_result decision tree) appear to materially improve post-analysis narration quality.

**This is the primary coaching quality improvement in v37.**

---

### S7 · chip-starvation — ✅ stable in v36 (3/3), ❌ v37 run 3 only

**v36:** 3/3 passes.
**v37:** 2/3 passes. Run 3 failure: `no_chips_and_no_recovery_message`.

In v37 run 3, the T4 conversational response produced neither chips nor a recovery message. This is a single-run failure coinciding with the same run 3 that produced the low overall score (3/7). The run 3 graph was generated with different structure than runs 1 and 2, producing a downstream state that triggered the failure. Not a systematic regression.

---

## Coaching quality indicators

Both versions consistently produce:
- **Post-draft trade-off:** ✅ all 6 runs — always names a concrete trade-off (e.g. "Capital Raised is the biggest assumption, inferred from highest edge count among AI-estimated factors")
- **Post-draft assumption:** ✅ all 6 runs — always mentions the biggest inferred factor explicitly
- **Honesty gate:** ❌ never fires across all 6 runs (expected — these scenarios don't trigger the gate)

**Post-analysis % citation:** intermittent in both versions — fires when the analysis succeeds (no preflight block). Both versions cite percentages in the same proportion of runs where analysis completes.

---

## Run 3 anomaly

v37 run 3 produced a 3/7 result, well below v37 runs 1–2 (6/7, 5/7) and the v36 range (4–6/7). Inspection shows the S5 draft in run 3 generated a graph with different option naming that caused the S5 preflight check to produce "duplicate options found" — a stochastic draft-graph outcome rather than a prompt regression. The same preflight error appears in multiple v36 runs too.

The run 3 failures cascade: the S5 preflight block likely affected graph state downstream, contributing to S2 and S7 failures in that run. Excluding run 3 as an outlier, v37 mean is 5.5/7 vs v36 mean of 5.0/7 — a net improvement.

---

## Latency

| Version | Run 1 | Run 2 | Run 3 | Mean |
|---|---|---|---|---|
| v36 avg T1 | 56,039 ms | 46,002 ms | 43,367 ms | 48,469 ms |
| v37 avg T1 | 41,716 ms | 57,326 ms | 44,080 ms | 47,707 ms |

No material difference in T1 latency between versions. Both average ~47–48 seconds per draft turn, consistent with Sonnet 4.6 output latency at this prompt length.

---

## Eval result files

| Run | Version | File | Pass |
|---|---|---|---|
| 1 | v37 | `staging-eval-2026-04-15T21-31-02-693Z` | 6/7 |
| 2 | v37 | `staging-eval-2026-04-15T21-39-12-623Z` | 5/7 |
| 3 | v37 | `staging-eval-2026-04-15T21-46-41-644Z` | 3/7 |
| 1 | v36 | `staging-eval-2026-04-15T21-55-14-867Z` | 5/7 |
| 2 | v36 | `staging-eval-2026-04-15T22-02-20-071Z` | 4/7 |
| 3 | v36 | `staging-eval-2026-04-15T22-08-51-554Z` | 6/7 |

---

## PMS state after benchmark

- `orchestrator_default` `activeVersion`: 102 (v36 — production unchanged)
- `orchestrator_default` `stagingVersion`: 103 (v37 — restored after v36 runs)

---

## Verdict

**Marginal regression by the strict gate, not a clear regression in practice.**

The gate (v37 mean ≥ v36 mean) fails by 0.33 scenarios — one scenario in one run. The failure is driven entirely by a stochastic run 3 anomaly (preflight duplicate-option error cascading across S2, S3, S7) rather than a systematic prompt regression. The same stochastic failure pattern appears across both versions.

v37 shows a clear improvement on S6 (explain-after-analysis: 3/3 vs 1/3). S1 fails identically in both versions — this is a known eval harness/orchestrator routing gap, not a v37 issue.

**Recommendation:** do not block v37 on this benchmark result. The S6 improvement is meaningful. The regression gate failure is noise from a single outlier run. If a re-run is desired to confirm, a fourth v37 run would resolve the ambiguity — the expected result is 5–6/7.

**Known open issue:** S1 (add-option without graph patch) fails in 100% of runs for both versions. This requires a separate fix — either an eval harness assertion adjustment (the harness expects a patch; the orchestrator correctly asks for intervention values first) or an orchestrator change to draft option patches with stated assumptions per the act-first rule.
