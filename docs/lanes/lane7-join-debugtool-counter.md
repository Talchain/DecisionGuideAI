# Lane UI-J — factor-science join, debug-exporter false negatives, dropped-content counter

- **Branch:** `claude-lane7/join-debugtool-counter` (fresh worktree from `origin/staging` @ `0083ec54`)
- **Date:** 2026-07-07
- **Evidence source:** debug bundle `45c9b625` (captured this morning, `~/Downloads/olumi-debug-45c9b625-20260707.json`)
- **Scope discipline:** DecisionGuideAI only; all export changes additive (no field dropped/renamed); no product-rendering changes.

## A. Factor science join (display_state.rendered_factors)

**Observed:** all five `rendered_factors` reported `influence_source: "unmatched"` /
`sensitivity_source: "unmatched"` while
`payloads.cee_response.blocks[0].enrichment.factor_sensitivity` carried
`influence_score` 1 / 0.62 / 0.48 / 0.45 / 0.145 and sensitivity values for the
same factor ids.

**Root cause (verified, not the hypothesised id mismatch):** the enrichment's
`factor_id`s exactly equal the canvas node ids (`fac_*`), so the id matching was
fine — the join simply had NO source. `captureDisplayState` reads only
`state.rawV2Response.factor_sensitivity`, and `applyV5State` (results hydration
step 5) explicitly writes `rawV2Response: null` on the V5-canonical path.

**Fix:** `buildDebugBundleAsync` resolves the CEE-embedded enrichment via the
existing `resolveScientificEvidence` resolver (same recovered-earlier-turn
preference as scientific validation) and threads its `factor_sensitivity` into
`captureDisplayState` as a fallback join source. Store `rawV2Response` still
wins (top-level beats embedded). New `FactorMetricSource` members
`cee_embedded.analysis_result.enrichment.factor_sensitivity.{influence,sensitivity}_score`
keep provenance honest; `unmatched` again means "no source anywhere".

**RED→GREEN:** `src/components/debug/__tests__/exportBundle.factorScienceJoin.spec.ts`
uses the brief's exact ids (`fac_market_receptivity`, `fac_marketing_expertise`,
`fac_ad_spend`, `fac_founder_time`, `fac_personnel_cost`). Verified RED against
pre-fix code via stash run: 2 failed (embedded join + end-to-end); GREEN
post-fix: 5/5.

**Note on live factor cards:** the live DriversSection card renders influence
from the report path; the V5 mapper (`mapV5AnalysisToReport`) narrows
`report.factor_sensitivity` to `{factor_id, factor_label, sensitivity,
direction}` — `influence_score` is dropped before the store. Restoring
influence on the LIVE card is a mapper/report change with rendering impact —
out of this lane's no-rendering-changes scope; flagged as follow-up.

## B. Debug exporter false negatives (evidence-tooling)

All four sub-fixes verified against the trimmed real bundle shape in
`src/components/debug/__tests__/exportBundle.v5FalseNegatives.spec.ts`
(RED 9/11 pre-fix via stash run, GREEN 11/11 post-fix).

1. **Enrichment lift for diagnostic checks** — `extractDiagnosticChecks` now
   accepts the resolver-lifted PLoT-shaped body; plot-layer probes (edge
   e-values, factor_sensitivity bootstrap/confidence) read it when
   `payloads.plot_response` is null. Bundle evidence: `enrichment.edge_e_values`
   had 6 real entries while `e_values_present`/`plot_edge_e_values_exposed`/
   `ui_edge_e_values_available` said false. For the lifted body the UI-layer
   probe accepts robustness OR top-level e-values because
   `mapV5AnalysisToReport` lifts both (lines 428–443, 541–543).
   `isl_edge_e_values_present` stays honestly false (no ISL-layer evidence).
   New additive fields: `plot_evidence_source`
   (`top_level|cee_embedded|unavailable`), `plot_factor_voi_fields_present`
   (per-factor VOI/EVPI surface; `evpi_present` deliberately keeps its
   historical ISL `factor_evpi` semantics — on this bundle it stays false,
   truthfully, since no ISL factor_evpi exists anywhere).
   `isl_data_source` gains `cee_enrichment_extraction` (real embedded ISL body
   preferred over the PLoT-shaped projection; `_source` marker on the
   extracted object, mirroring the existing `plot_response_extraction`
   precedent). DataFlowTab labels the new value.
2. **`cee_trace_present` / `_unavailable_reason`** — the V5 parser demotes
   unknown top-level keys (including `_diagnostic_trace`) into the
   `__additive__` sidecar, which is exactly where the trace sat in the bundle
   while the export claimed "CEE diagnostic trace not present in response".
   New pure `readCeeDiagnosticTrace` (store > top-level > sidecar) feeds
   `data.diagnostic_trace` (and thus `cee_trace`, `llm_metadata`, the V2
   sections) and `extractDiagnosticChecks` probes the sidecar directly.
3. **`schema_versions`** — always decorated with
   `ui_vendored_talchain_schemas` (new build-time constant
   `TALCHAIN_SCHEMAS_VENDORED_VERSION = '0.13.1'`, drift-guarded by
   `src/lib/__tests__/talchainSchemasVersion.spec.ts` against the package.json
   tarball pin) and `build_ids` mirroring `bundle.builds`. Six-wire-field
   consistency semantics unchanged (still `unknown` when wire versions are
   absent — the UI fact does not fake wire consistency).
4. **`gates.run`** — only writers are legacy PLoT-direct paths
   (`useV2Run.ts:833/839`, `plot/v1/http.ts:623`); on the V5-canonical path the
   gate sits at its default `fail` forever. It cannot be made truthful from the
   exporter (no writer exists on this path), so per the brief a message-less
   default `fail` beside `pipeline.status: success` is relabeled
   `legacy_check_unreliable` with an explanatory message (tagged
   `provisional_doctrine_v0`). Export label only — gate store/UI blocking
   untouched; attributed failures and non-success pipelines are left as-is.

## C. Track C Step 1 — dropped-content counter (approved D-5)

- `src/lib/droppedContentCounter.ts`: session-scoped, privacy-safe aggregator
  (type labels + counts + timestamps only; labels clamped; never throws).
- Wired at the parser's defensive-hardening drop point: each truly-unknown
  `blocks[]` type dropped pre-validation records
  `{source: 'v5_response_parser', rationale:
  'unknown_block_type_dropped_pre_validation'}` + a `console.info`
  observability line.
- Debug export: additive `bundle.dropped_content_counter`, always emitted,
  with `per_turn_truth` pointer at
  `payloads.cee_response.__additive__.unknown_blocks`.
- NO rendering changes, no reinterpretation; parse results and the per-turn
  sidecar are byte-identical to before (asserted in the parser wiring spec).

## Verification

| Gate | Result |
|---|---|
| Focused vitest (all `src/components/debug/__tests__` + parser + lib specs) | 613 passed / 1 failed — the 1 failure (`exportBundle.displayState.spec.ts` `results_stale`) **pre-exists on clean origin/staging** (verified by stash run before any lane change) |
| New specs | 26/26 green (factorScienceJoin 5, v5FalseNegatives 11, droppedContentCounter 5+2+2, talchainSchemasVersion 1) |
| RED evidence | A: 2 failures pre-fix; B: 9/11 failures pre-fix (stash runs) |
| `pnpm run typecheck` (repo ci gate) | green |
| `npx tsc -p tsconfig.app.json --noEmit` | 2331 errors with lane commits = 2331 on clean origin/staging (fresh detached worktree) — **zero added** |
| ESLint on changed files | 0 errors; remaining 4 warnings pre-exist in untouched exportBundle.ts code |

## provisional_doctrine_v0 wording surfaces

- `exportBundle.ts` — `gates.run` `legacy_check_unreliable` message.
- `DataFlowTab.tsx` — `cee_enrichment_extraction` headline + detail strings.

## Follow-ups (not in this lane)

- Live factor-card influence: V5 mapper drops `influence_score` before the
  store (`mapV5AnalysisToReport` narrows factor_sensitivity), so DriversSection
  cannot show influence on the canonical path — needs a mapper/report additive
  field + rendering decision.
- `rendered_options` already joins via `results.report.option_probabilities`
  (worked in bundle 45c9b625); no change made.
- Pre-existing failing test `exportBundle.displayState.spec.ts > results_stale`
  (spec expects `graphEditedSinceLastRun` semantics; capture reads
  `classifyFreshnessForDisplay`) — needs its own decision.
- Dropped-content counter sources: extend beyond the parser (e.g.
  schema-known-but-unrendered block types at the render dispatch) in Track C
  Step 2.
