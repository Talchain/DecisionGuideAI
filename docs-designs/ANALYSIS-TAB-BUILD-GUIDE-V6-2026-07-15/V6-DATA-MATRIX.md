# V6 Data Availability Matrix

**Scope.** Every data element the v6 build guide (`analysis-tab-prototype-build-ready-v6.html`, this directory) renders, with a verdict:

- **AVAILABLE** — the field exists on the wire today (vendored `@talchain/schemas` 0.15.0 type and/or mapper + fixture evidence).
- **DERIVABLE** — the UI can compute it honestly from existing fields (the derivation is stated).
- **PRODUCER-GAP** — no honest source exists; ships as a fail-closed placeholder. Cross-referenced to asks-ledger items 8–16 in `parallel-briefs/UI-CROSS-REPO-ASKS-2026-07-15.md`.

**Evidence base.** All code citations are against `origin/staging` @ `dbd6be9d` of `DecisionGuideAI` (the working tree is dirty/behind and was not used). Wire-shape evidence comes from the vendored contract (`vendor/talchain-schemas-0.15.0.tgz`, pinned by `src/lib/talchainSchemasVersion.ts:14` — `TALCHAIN_SCHEMAS_VENDORED_VERSION = '0.15.0'`; schema line numbers below are the tarball's compact `package/dist/*.js` sources), the golden fixture `src/test/fixtures/golden-path-staging-2026-04-05.json` (real staging bundle, v2.6), and the CEE V5 fixture `src/v5/__tests__/fixtures/cee-response-b82c89dd-trimmed.json`.

A significant portion of v6 is **already implemented on staging** (DecisionOverviewCard, analysis-hero, Strengthen panel, Define-success / Decision-record modals) — where that is true the matrix cites the shipped honest-interim behaviour rather than speculating.

**Path-conditionality (applies to every AVAILABLE verdict below).** Analysis data reaches the UI on two wire paths:

1. **V2 run path** — a full PLoT `/v2/run` response, either direct (`rawV2Response`) or embedded on a CEE turn as `envelope.analysis_response` (`src/canvas/conversation/types.ts:752-758`; hydrated `useConversation.ts:2222+`). Carries `meta` (seed / n_samples / hashes / request-id chain), `decision_brief`, top-level `flip_thresholds`.
2. **V5 conversational path** — the CEE `analysis_result` block's `enrichment`, reduced to the CEE→UI keep-list: `option_comparison, factor_sensitivity, results, robustness, decision_review, option_comparison_status, conditional_probabilities, edge_e_values, inference_warnings, confidence_tier, flip_thresholds` (`CEE_UI_ENRICHMENT_KEEP_LIST`, vendored `dist/boundary/enrichment.js:534-546`). **`meta` and `m1_coaching` are deliberately deep-stripped on this path** ("internal carriers (`_meta`, `meta`, `downstream_calls`, graph hashes, ...) deep-stripped" — `enrichment.js:51-57`). Anything sourced from `meta` (seed, n_samples) or `m1_coaching` (story headlines, readiness) is therefore **V2-path-only**; the V5 path must fail closed for those fields.

---

## Summary table

| # | v6 element | Verdict |
|---|---|---|
| 1 | Calibrated headline + subline | **AVAILABLE** (producer band, newer PLoT) with **DERIVABLE** fallback (shipped) |
| 2 | Expected-change % per option + plausible ranges | **AVAILABLE** (ranges/centres); delta-vs-current-approach **DERIVABLE only when a baseline is flagged** |
| 3 | Goal-fit % per option + success-measure gating | **AVAILABLE** (probabilities) + **DERIVABLE** gate (shipped); rich measure structure is ask #14 |
| 4 | Flip risks (relationship + switch % + "option 2 leads" line) | **AVAILABLE** |
| 5 | Drivers — signed direction, ranked magnitude | **AVAILABLE** |
| 5b | Drivers — per-factor evidence quality | **PRODUCER-GAP** (ask #10; raw `confidence` exists but is ruled not display-safe) |
| 6 | Trade-offs content | **PRODUCER-GAP** (ask #11) |
| 7 | Adaptive priority | **DERIVABLE** interim (stage_indicator bridge, shipped) + **PRODUCER-GAP** for the canonical signal (ask #8) |
| 8 | Option-similarity ("diversity") | **PRODUCER-GAP** (ask #9); narrow-framing bias-signal channel exists as the only honest gate |
| 9 | Brief quality ready/thin/conflict + chips + framing question | **DERIVABLE** (partial, shipped) + **PRODUCER-GAP** for conflict/unverified and explicit `framing_question` (ask #1) |
| 10 | Decision classification pills (stakes/reversibility/horizon/risk) | **PRODUCER-GAP** (3 of 4); horizon **DERIVABLE** from the decision-node brief timeframe |
| 11 | Freshness verdict + reason string | **AVAILABLE** (both); reason-as-receipt needs the ask #16 doctrine ruling |
| 12 | Receipts: simulations / result stability / result hash | **AVAILABLE** (all three, V2 path; V5 path strips `meta`); stability must key on `level`/`display_verdict`, NOT the deprecated `recommendation_stability`; seed row correctly dropped by v6 (ask #5; `?? 0` fabrication still live at `mapV5AnalysisToReport.ts:319`) |
| 13 | Strengthen recommendation fields | **AVAILABLE/DERIVABLE** per-trigger (shipped); producer one-line `signal` is ask #12 |
| 14 | Option stable numbers | **DERIVABLE** (shipped, UI-local identity-anchored ordinals) |
| 15 | "Answer directly" direct-brief-edit path | **PRODUCER-GAP** — no brief-edit write path exists (asks #14/#15 adjacent) |
| — | Stability lens / What-changed lens (v6 ships honest-unavailable) | **PRODUCER-GAP** (ask #13; producer gaps 211/212) — v6 agrees |

---

## 1. Calibrated headline + subline ("slightly ahead", "the top two remain close")

**Verdict: AVAILABLE (producer band) with a shipped DERIVABLE fallback.**

- **Producer path (preferred):** PLoT `decision_brief.headline_banded` carries a closed set of band tokens `'very_close' | 'slightly_ahead' | 'clearly_ahead'` plus `leader_option_id` and `robustness_gated` — `src/components/results/types.ts:459` ("PLoT #200"), type at `types.ts:461-472`, fail-closed normaliser `normalizeHeadlineBanded` at `types.ts:488-500` (unknown token / missing leader id → `null`, never guessed into copy). Band → copy mapping in `buildHeroModel.ts:437-440`: `clearly_ahead → 'strong'`, `slightly_ahead → 'ahead'` ("is slightly ahead", `heroCopy.ts:86`), `very_close → 'none'` ("No option is clearly ahead.", `heroCopy.ts:88`). The band applies **only when it names the same leader the hero headlines** (`buildHeroModel.ts:444-448`).
- **Caveat:** the golden fixture's `plot_response` (2026-04-05 build `0d93364`) has **no** `decision_brief` key — the band exists only on newer PLoT builds. The UI therefore keeps the fallback below.
- **Fallback thresholds (UI-SEM-060 residual, exactly answering "what thresholds derive this honestly"):** `buildHeroModel.ts:456-470` — leader's own `win_probability` ≥ `WIN_STRONG_LEADER = 0.65` → "most likely to be strongest overall"; ≥ `WIN_MAJORITY = 0.5` → "slightly ahead"; below majority, "ahead" only if `leadWinP − rivalWinP ≥ GAP_THRESHOLD` (`0.10`, shared with the panel's indeterminate state — `buildResultsVM.ts:31`); otherwise "No option is clearly ahead." `win_probability` per option is on the wire: golden fixture `plot_response.option_comparison[0].win_probability = 0.4375`.
- **Subline ("top two remain close"):** the runner-up is named only when the top-two expected-outcome **centres** differ by ≤ `OUTCOME_CLOSE_RATIO = 0.15` of the larger magnitude (`buildHeroModel.ts:140`, applied at `:491-500`; copy `closeOnOutcome` `heroCopy.ts:119`). A readout-tie (identical rendered readouts) switches to the neutral plural "The top options are close on expected outcome." (UI-SEM-070, `buildHeroModel.ts:503-514`; copy `heroCopy.ts:126`). Range overlap alone never produces a "close" claim — it only appends the overlap advisory (`heroCopy.ts:131`-region, gate at `buildHeroModel.ts:481-489`). The aligned-leader subline "also has the strongest expected outcome" is `heroCopy.ts:112`.
- PLoT `robustness.near_tie` (`{is_tie, top_option_id, second_option_id, gap, threshold}`) is also on the wire (golden fixture; mapper `src/lib/mappers/mapRobustness.ts:124-155`) but the hero's closeness claims deliberately key off win-prob/centres, not near_tie.

## 2. Expected-change % per option + plausible ranges (lo/hi)

**Verdict: AVAILABLE for centres and ranges; the "+26% versus the current approach" DELTA framing is DERIVABLE only when a baseline option is flagged.**

- **Wire:** every `option_comparison[i].outcome` carries `mean, std, p10, p50, p90, n_samples, n_valid_samples, validity_ratio` — golden fixture `plot_response.option_comparison[0].outcome` (`mean 0.3599…, p10 0.0378…, p90 0.6536…`). (`FactorSensitivity`/`FragileEdge` are the only response schemas in vendored 0.15.0 `dist/responses.js`; option outcomes flow through the passthrough report mappers — `useResultsSectionData.ts` fallback chain at `:1226` "expected_outcome > expected > outcome.mean > bands > goal_probability".)
- **Ranges:** hero row lo/hi = `getPessimistic(o) ?? o.p10` / `getOptimistic(o) ?? o.p90` (`buildHeroModel.ts:95-100`); centre = `getExpectedValue ?? getMedian ?? p50` (`:92-94`). Rendered as the range bar + dot (v6 `.range-track`) — AVAILABLE.
- **Delta vs "current approach":** `deltaFromBaseline = optionOutcome − baselineOutcome` is computed at `useResultsSectionData.ts:1352-1360`, but **only** when `resolveBaselineId` (`:138-159`) finds a baseline: precedence is PLoT `is_baseline: true` on an option node > user selection; the label heuristic was **removed in v7.5** (`:155-156` comment) so no baseline is ever guessed. The wire does carry the flag: `cee-response-b82c89dd-trimmed.json` → `analysis_ready.options[0].is_baseline` (boolean). Without a flagged baseline the honest rendering is the absolute expected value (which is what the shipped hero does — readout at `buildHeroModel.ts:341-344`), **not** a fabricated "+X% vs current".
- Note: fixture outcome values are normalised model scores (0–1); `isNormalised` (`types.ts:315-319`) forces "Relative score" labelling — v6's "%" framing must respect this flag.

## 3. Goal-fit % per option + gating on success measure

**Verdict: AVAILABLE (probabilities) + DERIVABLE gate (shipped). Rich success-measure structure = ask #14.**

- **Wire:** per option `win_probability` (0.4375), `probability_of_joint_goal` (0.028), `constraint_probabilities` keyed by constraint id (`auto_goal_threshold: 0.028`) — golden fixture `option_comparison[0]`. Goal threshold rides the graph node: `NodeV3Schema.goal_threshold` (vendored `dist/graph.js:36`); CEE echoes `goal_threshold`, `goal_threshold_raw`, `goal_threshold_unit`, `goal_threshold_cap` on `analysis_ready` (`src/adapters/cee/types.ts:346-352`).
- **Selection:** `goalProbability` = `probability_of_joint_goal` when the option carries constraints, else `goal_probability` (`useResultsSectionData.ts:1258-1268`, via `selectGoalProbability`).
- **Gate (exactly v6's "Goal fit needs a measurable success definition"):** `hasUserTarget = goalThreshold != null` (`buildHeroModel.ts:254`); every row's goal value is nulled without it (`:283`) and the lens is withheld (`goalAvailable = hasUserTarget && …`, `:356`) — UI-SEM-071. The sub-1% floor withholds the crown when no option is meaningfully on track (`:517-…`, UI-SEM-057).
- **Success-measure structure (metric/direction/threshold/unit/timeframe/baseline):** shipped as the Define-success modal + `successMeasureStore`, whose honesty contract (`src/components/results/modals/successMeasureStore.ts:4-14`) states: **only the numeric `threshold` flows into the analysis** (via `setGoalThreshold → executeCanonicalRun`); the richer fields are display/record only, sessionStorage-persisted per scenario. That is ask #14 (wire extension vs brief-persisted rich fields) — needs the orchestrator/Paul ruling before the Goal-fit lens build hardens.

## 4. Flip risks (relationship label + switch % + "if under-delivers, option 2 leads")

**Verdict: AVAILABLE.**

- **Wire:** `FragileEdgeSchema` (vendored `dist/responses.js:29-36`) is passthrough with `edge_id, from_id, to_id, current_strength, threshold, impact_on_outcome`; the live wire adds (golden fixture `robustness.fragile_edges[0]`): `switch_probability: 0.484`, `marginal_switch_probability: 0.35`, `from_label`, `to_label`, `alternative_winner_id`, `alternative_winner_label` ("Build Dedicated Mid-Market Product Tier"). `robust_edges[]` also present (absence-vs-empty semantics = ask #6; mapper keeps whatever arrives, `mapRobustness.ts:229-231`).
- **Relationship label "X → Y":** `from_label` + `to_label` — direct.
- **Switch %:** `switch_probability` / `marginal_switch_probability` — the shipped Strengthen flip trigger reads `marginal_switch_probability ?? switch_probability` (`StrengthenContainer.tsx:100-107`) and formats "NN% chance the result flips to {alt}" (`buildRecommendations.ts:139-143`). The hero's flip rows show "48% switch" meta via a node-id join to the same values (`buildHeroModel.ts:806-816, 855-866`).
- **"If the top relationship under-delivers, option 2 becomes the likely leader":** DERIVABLE composition of `alternative_winner_label`/`alternative_winner_id` on the top-ranked fragile edge + the stable option number map (element 14). No fabrication needed. (Ask #7 — flip-risk single-sourcing — still applies: keep one formatter.)
- The hero also renders threshold-style flip rows from `recommendation.flipThresholds` (`flip_value`/`current_value`/`unit`/`alternative_winner_label`, UI-SEM-074 direction rules, `buildHeroModel.ts:817-870`) — a second, also-available producer source; v6's relationship-styled rows map more naturally to `fragile_edges`.

## 5. Drivers (signed direction, ranked magnitude, per-factor evidence quality)

**Verdict: direction + magnitude AVAILABLE; per-factor evidence quality PRODUCER-GAP (ask #10).**

- **Signed direction:** `FactorSensitivitySchema.direction` ∈ `['positive','negative']` (vendored `dist/responses.js:5,15`); fixture `factor_sensitivity[0].direction = "positive"`. Hero passes it through, omitting the glyph when absent (`buildHeroModel.ts:794-796`) — never guessed.
- **Ranked magnitude:** `importance_score`, `sensitivity_score`, `elasticity`, `importance_rank` in the schema (`dist/responses.js:12-16`); the live wire adds `influence_score`, `influence_rank`, `value_of_information`, `evpi_percentage_points` (golden fixture `factor_sensitivity[0]`). Display uses the complete-metric-set-resolved `displayInfluence` (`types.ts:512-…`, Codex R3-B1; hero at `buildHeroModel.ts:786-788`).
- **Per-factor evidence quality ("Low evidence" column):** the wire DOES carry raw ingredients — schema-optional `confidence` (0–1) + `confidence_components {structural_certainty, sampling_stability}` (`dist/responses.js:17-21`; fixture `confidence: 0.25`, `confidence_source: "isl"`; plus `m1_coaching.evidence_gaps[].confidence_display`). But the UI has **ruled these not display-safe as an "evidence" claim**: "Evidence-quality wording is deliberately ABSENT live: an evidence claim derived from raw confidence fields is forbidden (same class as the hidden DriversSection quality hint / trust line, issues 219/221)" — `buildHeroModel.ts:773-776`; same in `HeroEvidenceDisclosure.tsx:13-18`. So the v6 meta column is **PRODUCER-GAP per ask #10** ("check what 0.15 already carries before adding" — answer: `confidence` exists; what's missing is a display-safe evidence-quality contract or a doctrine ruling that `confidence` may be banded into "Low/Med/High evidence"). Interim: omit the column (matches ask #10). Note the raw `confidence` IS already consumed non-verbally: the LEHI Strengthen trigger gates on `confidence < 0.4 && influence > 0.5`, producer-confidence-only (`buildRecommendations.ts:29-31,160-176`).

## 6. Trade-offs content (You gain / You give up / Depends on / Watch)

**Verdict: PRODUCER-GAP (ask #11).**

- The shipped evidence model hard-nulls the slot: "Trade-offs require a grounded producer or reviewed narrative — the live adapter has none (producer gap) … The UI must not invent trade-offs from labels" (`buildHeroModel.ts:906-910`, `evidence: { …, tradeOffs: null }`). `HeroEvidenceDisclosure.tsx:23-27`: the tab "renders ONLY when the model carries a producer/reviewed narrative … fixture-gallery-only today".
- Nothing on the 0.15.0 wire carries this. (The legacy `Tradeoff` interface at `src/canvas/components/RecommendationCard/types.ts:83-92` belongs to an older CEE recommendation contract, not the current analysis envelope; `robustness.pareto.tradeoff_narrative` in `islRobustnessAdapter.ts:88` is a different, multi-goal surface.) Ships as hidden/honest-unavailable tab until CEE emits a typed block (additive schema ask).

## 7. Adaptive priority (clarify | broaden | challenge | evaluate | commit)

**Verdict: DERIVABLE interim (shipped) + PRODUCER-GAP for the canonical signal (ask #8).**

- **What exists on the wire:** the CEE envelope's `stage_indicator` — golden fixture `cee_response.stage_indicator = "evaluate"`; b82c89dd fixture `"analyse"`; parsed at `useConversation.ts:243-245` / `turnService.ts:264`.
- **Shipped bridge (UI-SEM-076):** `adaptivePriorityFromStage` maps `frame→clarify, ideate→broaden, evaluate→evaluate, decide→commit`, `optimise→null` (`StrengthenContainer.tsx:63-71`); it is **ordering only, never a gate** — matching recs float via `ADAPTIVE_MATCH_BOOST` (`buildRecommendations.ts:45-47, 303-310`), and null leaves the deterministic ladder untouched. Note: no stage maps to `challenge`, and the **commit recommendation is NOT gated on the producer priority** — it fires only on `robustness.status === 'computed' && level === 'high'` (`buildRecommendations.ts:276-280`), which diverges from v6's "commit shows only when the producer says so".
- **Gap:** ask #8 stands — a canonical strengthen-priority/phase signal (the code's own comment: "Remove when CEE ships a canonical strengthen-priority signal on the wire", `StrengthenContainer.tsx:60-62`).
- **Wire-vocabulary drift caveat:** `ScenarioStage = 'frame'|'ideate'|'evaluate'|'decide'|'optimise'` (`src/types/scenario.ts:55-60`), yet staging fixtures emit `stage_indicator: 'analyse'` (b82c89dd; also both 2026-05-10 debug bundles) — a value outside the union. It maps to `null` in the bridge (fail-closed, ladder untouched), which means adaptive priority silently never fires on those turns. Worth a CEE vocabulary confirmation alongside ask #8.

## 8. Option-similarity ("diversity") signal

**Verdict: PRODUCER-GAP (ask #9).**

- `DecisionOverviewCard.tsx:263-264`: "No diversity/quality claims — the producer option-similarity signal does not exist yet."
- The only honest producer channel today is the draft-coaching **bias signal**: vendored `CoachingSchema.bias_signals` with `BiasType ∈ ['anchoring','narrow_framing','status_quo_bias','overconfidence']` (`dist/coaching.js:2-11,31-36`); adapter `src/adapters/cee/types.ts:459` / `client.ts:136-141`; fixture proof `tests/fixtures/cee-responses/draft-graph.success.partial…/with-coaching-and-provenance.json` → `coaching.bias_signals[0].type = "confirmation_bias"`. The shipped broaden rec fires **only** from a producer `narrow_framing`-class finding — "never local option counting" (`buildRecommendations.ts:251-256`, NARROW_TYPES). **Drift note:** the fixture's `'confirmation_bias'` sits OUTSIDE the 0.15.0 `BiasType` enum (and its `widening_log` is a list where the schema declares a strict object) — so CEE is already emitting beyond the strict contract, and no `narrow_framing` emission is fixture-evidenced. The broaden gate has a wired channel but zero evidence of a live trigger.
- v6's "Three of four options use the same mechanism" chip note and the gated "Find a route that is not hiring" rec therefore ship absent until CEE/ISL emit the signal. Interim = recommendation absent (matches ask #9).

## 9. Brief quality (ready/thin/conflict) + per-chip states + framing question

**Verdict: DERIVABLE (partial, shipped); conflict/unverified and the explicit framing question are PRODUCER-GAPs (ask #1).**

- **Quality states (UI-SEM-079, `DecisionOverviewCard.tsx:195-215`):** `ready`/`needs_input` come from the wire (`analysis_ready.status` ∈ `ready | needs_encoding | needs_user_mapping | needs_user_input`, `adapters/cee/types.ts:330`; vendored `AnalysisReadyV3Schema.status`, `dist/analysis.js`); `blocked` derives from a blocker-severity engine critique; `thin` derives from `goalThreshold == null`; no assessment → quiet `unassessed`. v6's **"Contradictory/conflict"** state (and `unverified`) render **only via fixture `stateOverride`** (`DecisionOverviewCard.tsx:17-19,146`) — no producer framing-quality/conflict signal exists ("Remove when CEE/PLoT provide a producer framing_quality signal", `:203-204`).
- **Per-chip states (`DecisionOverviewCard.tsx:259-291`):** Goal = saved success measure (scenario-keyed store) → committed `goalThreshold` → "Success measure missing"; Context = brief text presence (`currentBriefText`); Constraints = structured `goalConstraints` count; Options = canvas option count. All store-derived, fail-closed — DERIVABLE.
- **Framing question (UI-SEM-078, `DecisionOverviewCard.tsx:124-140`):** derived from the top `'discuss'`-actionable guidance item (`primary_action.type === 'discuss'`, priority max — `:188-193`), preferring interrogative title/detail, else mechanically composing "What would it take to …?". This is exactly ask #1's hardened interim (T3); the explicit `framing_question` field remains a CEE ask (additive, 0.16.x). Guidance items themselves are AVAILABLE with `item_id, signal_code, category, source, title, detail, primary_action, target_object, priority, valid_while{analysis_hash}` (`guidanceStore.ts:30-53`; golden fixture `cee_response.guidance_items[0]`, `signal_code: "CTA_LITE"`).
- `analysis_ready.user_questions` (`adapters/cee/types.ts:334`) additionally feeds the needs-input questions list (`DecisionOverviewCard.tsx:222,375-383`).

## 10. Decision classification pills (stakes / reversibility / horizon / risk)

**Verdict: PRODUCER-GAP for stakes, reversibility, risk; horizon DERIVABLE. No post-#309 wire home exists.**

- **Where they live today: nowhere on the analysis wire.** UI-SEM-077 (`DecisionOverviewCard.tsx:231-247`): "No producer classification contract exists; the only honest client-side input today is the decision node's brief timeframe (→ horizon). Stakes, reversibility and risk appetite have NO live signal, so those pills fail closed to an explicit 'not set' state — values are NEVER fabricated. Remove when CEE provides decision_classification."
- **Horizon:** derived verbatim from the decision node's brief block `timeframe` field (`DecisionOverviewCard.tsx:160-174`) — the same field DecisionPanel displays.
- **Risk:** a risk-tolerance *input* exists UI-side (`useRiskProfile` presets driving re-weight, `AdvancedSection.tsx:74-…`; suggestion heuristics in `useRiskToleranceSuggestion.ts:173-178` keyed on a local `context.stakes`), but nothing producer-owned classifies the decision. The CEE→ISL preference flow (incl. `risk_tolerance`) is an explicitly NOT-IMPLEMENTED stub (`src/canvas/adapters/preferenceAdapter.ts:1-10,59`).
- **Legacy note:** the pre-canvas app captured `importance`/`reversibility` in route state and Supabase decision metadata (`src/components/Analysis.tsx:19,105,419`; `ReversibilitySelector.tsx`), but that flow is not connected to the canvas/analysis-tab wire. If #309's decision-context/brief work is to carry these, it needs a new contract — this is a **new producer ask beyond items 8–16** (adjacent to ask #14's brief-persistence question).
- **"Post-#309" disambiguation:** #309's "decision context" (`fix(goal-threshold): Lane 5 — representation tagging + decision-context isolation`, commit `7856b80d`) is the goal-target trio `goalThreshold / ceeAnalysisReady / outcomeNodeId` cleared atomically on scenario replacement (`DECISION_CONTEXT_CLEAR`) — it is NOT a classification store. Separately, the vendored orchestrator contract's `DecisionContextSchema` (`dist/orchestrator/decision-context.js:12-24`) is a **domain-anchors placeholder** (`monetary_figures / timeline / named_entities / goal_translation`, `status: 'not_populated'` in all current tranches, reserved for E-series coaching) — it carries no stakes/reversibility/risk fields either. Conclusion stands: no wire home exists for the classification pills.

## 11. Freshness verdict + reason string

**Verdict: AVAILABLE (both fields); rendering the reason as a receipt requires the ask #16 ruling.**

- **Wire:** `analysis_ready.freshness ∈ 'fresh'|'stale'|'unknown'|'none'` + `freshness_reason` (`adapters/cee/types.ts:410-412`); fixture proof: b82c89dd `analysis_ready.freshness = "fresh"`, `freshness_reason = "graph_hash_match"`, plus `graph_hash_at_run` / `current_graph_hash` / `computed_at`.
- **Verdict rendering (shipped):** `analysisFreshness.ts` store holds CEE's verdict verbatim with retain / never-absence→fresh / order-by-computed_at rules (`src/canvas/store/analysisFreshness.ts:7-17,62-80`); copy `FRESHNESS_COPY` — "Analysis reflects the current model." / "Model changed since this analysis. Re-run to update." (`AnalysisFreshnessNotice.tsx:28-31`).
- **Reason string:** carried but doctrine-marked "Technical reason code from CEE (e.g. 'graph_hash_match') — debug only, never user copy" (`analysisFreshness.ts:23`). v6's receipt row "Freshness: Graph hash match" **promotes** it to user copy — that is exactly ask #16 (A1/Paul ruling needed). Data-wise: AVAILABLE; doctrinally: blocked until ruled. Fail-closed interim: omit the receipt row, keep the verdict strip.

## 12. Receipts (simulations count, result stability verdict, result hash)

**Verdict: AVAILABLE (all three v6 rows) — with two receipt-integrity caveats.**

- **Simulations:** `meta.n_samples` (golden fixture `1000`; read at `useResultsSectionData.ts:975`; rendered "N simulations" `AdvancedSection.tsx:334-338`; sourced `OutputsDock.tsx:2243` `report.summary.n_samples_used ?? report.meta.n_samples`). Per-option `outcome.n_samples`/`n_valid_samples` also exist (those DO survive the V5 keep-list inside `option_comparison`). **Caveat:** the root `meta` count is **V2-path-only** (keep-list strips `meta`) — on a pure V5 turn the receipt must render honest-absent, not a stale or per-option-promoted number.
- **Result stability ("Tentative"):** the robustness verdict is on the wire — `robustness.level` (`'very_low'` in fixture), `is_robust`, plus the ADDITIVE display-safe pair `display_verdict` (`'robust'|'moderate'|'fragile'|'not_assessed'`) and `display_verdict_reason` ("a producer-owned claim-safe phrase the UI renders verbatim") — vendored `dist/boundary/enrichment.js:244-276` (PLoT lane W5, PR #202). The calibrated verbal tier already exists: `calibrateUncertaintyCopy` maps level/label → `'confident'|'moderate'|'tentative'` with "This result is tentative…" for low/very_low (`utils/uncertaintyCalibration.ts:31,41,86-88`), honest-render (no signal → null, never invented). v6's one-word "Tentative" receipt is a re-labelling of this AVAILABLE tier. **Caveat — do NOT source this receipt from `recommendation_stability`:** the vendored 0.15.0 contract marks it "**DEPRECATED and no longer emitted** (PLoT lane H item B, 2026-07-07): it was byte-identical to the leader's win_probability. Kept optional for inbound tolerance of old payloads only — consumers must use the absence path" (`enrichment.js:250-262`; the golden fixture's 0.4375 is an old-build value and equals the leader's win probability exactly). `ResultsBody.tsx:548` still passes `recommendationStability` into `AdvancedSection` — the v6 receipts build should key on `level`/`display_verdict` instead.
- **Result hash:** `response_hash` — `ResponseMetaSchema.response_hash` (optional; vendored `dist/analysis` — `response_hash` at the meta level) and top-level `plot_response.response_hash = "ee93f3a42afc11e1"` in the golden fixture; rendered truncated-with-copy at `AdvancedSection.tsx:376-398`. On the V5 path `mapV5AnalysisToReport` derives a deterministic **local** hash when the producer sent none (`mapV5AnalysisToReport.ts:296-303,841`) — if surfaced as a receipt it must be labelled local, not producer.
- **Seed (v6 drops the row — correct):** `meta.seed_used` + `seed_source` exist on the V2/PLoT path (`ResponseMetaSchema`, `dist/analysis.d.ts:132-133`; fixture `"485977"`/`client_generated`; consumed at `analysisSnapshotFactory.ts:250-251`), but the V5 conversational contract carries **no seed** (ask #5) — so dropping the receipt row aligns with T2 fail-closed. **Status at this commit:** the T2 fix has NOT landed on origin/staging — `mapV5AnalysisToReport.ts:319` still fabricates `const seed = options.seed ?? 0` ("Defaults to 0 when caller has none", `:294`). The v6 build must not re-surface a seed receipt until that lane lands.
- Freshness receipt row: see element 11 / ask #16.

## 13. Strengthen recommendation fields (title / signal / why / tip / source-provenance line)

**Verdict: AVAILABLE/DERIVABLE per named trigger (shipped engine); producer one-line `signal` = ask #12.**

Every shipped recommendation has a named deterministic or producer-backed trigger (`buildRecommendations.ts:1-24`), with all five v6 fields populated:

| Trigger | Signal source | Citation |
|---|---|---|
| Define success (clarify) | deterministic: `goalThreshold == null` | `buildRecommendations.ts:71-95` |
| Phase-3 promotion | verbatim producer coaching/review blocks (title/body/`action_intent`/`action_label`/`priority_rank`/`target_refs` — b82c89dd blocks[5]) capped to producer top-4, deduped (UI-SEM-075) | `:97-129` |
| Flip risk (evaluate) | `fragile_edges` switch prob + `alternative_winner_label` | `:131-158` |
| LEHI range (clarify) | producer per-factor `confidence` < 0.4 ∧ influence > 0.5 — producer-confidence ONLY, never the beliefExists fallback | `:160-186` |
| VOI (evaluate) | producer `worth_investigating` flag, else honestly-labelled UI EVPI floor ("engine flag not available") | `:188-225` |
| Challenge leader | `robustness.level ∈ low/very_low` | `:227-249` |
| Broaden | producer bias finding only (§19) | `:251-273` |
| Commit | `robustness.status computed ∧ level high` | `:275-300` |

- **Source-provenance line:** each rec carries an explicit `sourceLine` naming its basis (e.g. "Source: robustness analysis (fragile relationships)." `:144`; the VOI line distinguishes producer-backed vs UI-threshold `:211-214`) — v6's "Triggered because…" line is this field.
- **Signal one-liner:** live signals are UI-composed from producer numbers ("48% chance the result flips to X…"); phase-3 promoted rows get a generic "Olumi flagged this while reviewing your model." (`:112`) because guidance blocks have no short `signal` field — that is **ask #12** (interim: T3 derives from body). The 0.15.0 block contracts confirm the field set: `ReviewCardBlockSchema`/`CoachingBlockSchema` carry `title` (≤80) / `body` (≤300) / `severity` / required `priority_rank` / structured `target_refs[]` / optional `action_intent` + `action_label` (≤40) / `coaching_kind` — but no `signal` (`dist/boundary/blocks.js:197-255`).
- **Known container defects at this commit (already on the A2 ledger queue):** `StrengthenContainer.tsx:139` drops the producer `action_label` (`actionLabel: undefined` for every phase-3 item) and `:143` inverts priority as `100 − priority`, clamping producer ranks >100 (b82c89dd ranks 71–74 survive, but fixture ranks 101–104/201–202 collapse to one band). Fold into the Wave-3 Strengthen build.
- Lifecycle (addressed/dismissed/in-progress, "0 addressed · 5 worth checking") is UI-local (`strengthenStore`, reconcile-by-id — `StrengthenContainer.tsx:12-15`): DERIVABLE.

## 14. Option stable numbers

**Verdict: DERIVABLE (shipped, UI-local).**

- `selectDisplayOptions` emits `displayIndex` (re-ranks each run) and `stableNumber` — "identity-anchored ordinal: assigned once per option id in first-appearance order, stable across rerun rank flips, never reused" (`src/components/results/selectors/analysisDisplaySelector.ts:7-11,36-46`), backed by the store's `optionNumbering` map (`assignStableOptionNumbers`, `canvas/store/stableOptionNumbers`). Unregistered ids get `null`, never a colliding fallback (`:29-31`). Rendered in the hero (`HeroOptionRow.tsx:220` — `row.stableNumber ?? row.index`) and OptionCards (`OptionCards.tsx:381-386`); captured into decision records (`decisionRecordStore.ts:26-27`). No producer field needed; option identity (`option_id`/`id`, `label`) is AVAILABLE (vendored `OptionForAnalysisSchema`, `dist/analysis.d.ts:7-13`).

## 15. "Answer directly" — direct brief-edit write path

**Verdict: PRODUCER-GAP — no brief-edit write path exists today.**

- The shipped card is explicit: "No direct brief editor exists yet — Answer directly primes the drawer draft for a straight answer instead (honest interim; see the lane report)" — `DecisionOverviewCard.tsx:408-410`; the button opens the Ask-Olumi drawer with draft prefix "My answer: " (`:411-419`, `OVERVIEW_COPY.answerDraftPrefix` `:65`).
- What writable state exists: the brief is `currentBriefText` in the canvas store (read-only presence check at `DecisionOverviewCard.tsx:155`); the only analysis-affecting direct write is `setGoalThreshold → executeCanonicalRun` (success-measure path, `successMeasureStore.ts:5-8`); the rich measure and the decision record persist to **sessionStorage only** (`successMeasureStore.ts:16-19`, `decisionRecordStore.ts:5-9` — "NO backend persistence exists — durable saving is blocked on identity + Model Management"). v6's `data-direct-edit` ("Update this part of the persisted decision brief directly") presumes a **persisted, field-addressable brief** — that is the asks #14/#15 cluster plus the CEE brief-persistence question; no ledger item yet covers a brief-section write API, so this is an addition for the orchestrator.
- **Decision-record wire contract already exists but is unwired (ask #15 status):** vendored 0.15.0 ships `DecisionRecordSchema` (`dist/boundary/decision-record.js` — `record_id / scenario_id / decision{chosen_option_id, chosen_option_label, graph_hash, analysis_summary} / prediction{statement, confidence} / review_date / outcome{result: better|as_expected|worse|abandoned, brier_component}`), with the explicit pin "**NOT wired into OlumiResponse (or any other producer schema) yet** ... Persistence lives in Supabase ... a Supabase migration is being authored in parallel (this sprint's Account 3 lane); FIELD NAMES MUST MATCH THIS SCHEMA EXACTLY." The v6 modal's fields should be shaped to this schema now so the sessionStorage interim migrates without translation.

## Stability lens / What-changed lens (v6 ships honest-unavailable — confirming ask #13)

- `buildHeroModel.ts:888-892`: "Stability / What-changed carry no live data (producer gaps 211/212) — no leader can exist on a lens with nothing to lead"; leaders hard-null. `factor_stability[]` + `stability_thresholds` exist on the wire for *factors* (golden fixture: `elasticity_std`, `attribution_stability`, `rank_flip_rate`, `stability_method: bootstrap_20`), but **per-option** stability and versioned run comparison do not — v6's honest-unavailable copy is the correct shipped state (ask #13).

---

## Producer-gap roll-up (maps to asks 8–16)

| Ask | v6 element(s) | Fail-closed interim shipping now |
|---|---|---|
| #8 adaptive priority | Strengthen ordering, commit gating | stage_indicator bridge (ordering only); commit gated on robustness `high`, not producer phase |
| #9 option-similarity | broaden rec, Options chip note | rec absent unless producer bias finding; chip note counts only |
| #10 per-factor evidence quality | Drivers meta column | column omitted (raw `confidence` exists on wire but ruled not display-safe — needs contract or ruling) |
| #11 trade-offs | Trade-offs tab | `tradeOffs: null`; tab fixture-gallery-only |
| #12 guidance `signal` line | Strengthen phase-3 rows | generic signal / body-derived (T3) |
| #13 per-option stability + run comparison | Stability & What-changed lenses | honest-unavailable copy, null leaders (gaps 211/212) |
| #14 success-measure structure | Define-success modal, Goal chip | threshold-only on wire; rich fields sessionStorage display/record; ruling pending |
| #15 decision-record persistence | Record-the-decision modal | sessionStorage-only record with analysisHash snapshot |
| #16 freshness_reason promotion | "Freshness: Graph hash match" receipt | field AVAILABLE but debug-only per doctrine; receipt row withheld pending ruling |
| *(new)* decision classification | stakes/reversibility/risk pills | "not set" pills (UI-SEM-077); horizon from brief timeframe |
| *(new)* framing_quality conflict signal | "Contradictory" brief state + pause-read | fixture-override only; live derives ready/needs_input/thin/blocked |
| *(new)* brief-section write path | "Answer directly" direct edit | drawer draft prefill ("My answer: ") |
