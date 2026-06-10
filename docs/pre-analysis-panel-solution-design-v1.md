# Pre-analysis panel v3, solution design v1

**Date:** 2026-06-10
**Status:** Implementation companion for Paul's review. Built against `origin/staging` (4c68f97f).
**Change class:** Tier B, DGAI UI only. No CEE, PLoT, ISL, schema, prompt, PMS or intent changes.
**Spec of record:** `olumi-pre-analysis-panel-grounded-spec-v2.md`. Visual reference: `pre-analysis-panel-prototype-v3 (2).html`. Data gating: `olumi-assistants-service/Docs/v5/pre-analysis-snapshot-data-availability-audit.md` (binding).

---

## 1. Summary

A new outcome-centred pre-analysis panel (`PreAnalysisPanelV3`) replaces the readiness-first panel in the Analysis tab, behind the flag `preAnalysisV3` (default **off**, recommendation below). The legacy panel and its tests are untouched; reinstatement is a flag flip. The panel ships only the audit-proven safe subset: deterministic hero lines, four honest health bars, a deterministic best-next-step ladder, count-and-presence coaching signals, an influence-ranked estimates view, a collapsed Advanced section, and a quiet readiness footer. CEE coaching enriches reserved slots only when live in session, rendered verbatim and attributed.

## 2. Evidence base (liveness, verified 2026-06-10)

Two sources: the data-availability audit (same day, binding) and a fresh verification performed for this build.

| Signal | Path | Status | Evidence |
|---|---|---|---|
| V5 draft turn end-to-end | `POST cee-staging.onrender.com/proxy/v5/turn` | Live, HTTP 200, 50s | Smoke draft, brief prefixed `pre_analysis_panel_v3_smoke_20260610` (one artefact created, left in place per instruction) |
| Node provenance on V5 | `draft_graph.nodes[].provenance`, `observed_state.source` | Live (`ai_inferred`, `cee_inference` on all 15 nodes) | Same capture |
| `analysis_ready.coaching_summary` on V5 | top-level `analysis_ready` | **Live** ("One assumption worth checking: ...") | Same capture |
| `analysis_ready.bias_findings` on V5 | top-level `analysis_ready` | **Live** (structural `AUTHORITY_BIAS` finding with CEE-authored explanation) | Same capture |
| `coaching` object (summary, bias_signals, strengthen_items) on V5 | turn response | **Dark** (matches audit) | Same capture |
| `pre_analysis_sensitivity` embedded in CEE responses | draft or turn `analysis_ready` | **Dark on both paths** (audit capture 01 and fresh V5 capture both lack it; the UI's existing `DraftChat.tsx:756` consumer is fed by nothing on the wire today) | Audit capture 01 + smoke capture |
| PLoT `/v1/pre-analysis-sensitivity` direct | `plot-lite-service-staging.onrender.com` | **Live and passthrough-safe**: a `/v2/run`-shaped graph (the existing UI payload builder output, audit capture 07) returned HTTP 200, `method: linear`, values identical to audit capture 06 | Fresh verification call (stateless compute, no artefacts) |
| Graph readiness | CEE `/graph-readiness` via readinessStore | Live, deterministic | Audit capture 02 |
| `readiness_level` drift | live value `'ready'` outside UI union | Confirmed | Audit §7; we never branch on it |
| `analysis_ready.options[]` key drift | `option_id` on V5 vs `id` on direct path | Confirmed live | Smoke capture |

**Consequence for the Estimates feature:** CEE does not embed sensitivity anywhere today, so the panel adds a **direct, debounced UI call** to PLoT `/v1/pre-analysis-sensitivity` through the existing same-origin proxy (`/bff/engine/*` redirect in `netlify.toml` and `public/_redirects`; dev proxy already configured in `vite.config.ts:141`). The graph payload is built by the existing V2 request builder, which the staging verification proved compatible. No service code changes. Degree-based fallback covers failure, absence, and staleness.

## 3. Architecture: extended versus added

**Extended (small, behaviour-preserving):**
- `src/flags.ts`: one new entry `preAnalysisV3` (`VITE_FEATURE_PRE_ANALYSIS_V3` / `feature.preAnalysisV3`).
- `src/canvas/components/OutputsDock.tsx`: ternary at the existing pre-run mount; lazy-loaded v3 branch; legacy branch byte-identical. The inline influence-coverage block (`~line 677`) is extracted to a shared pure function (characterisation-tested before extraction).
- `src/canvas/utils/applyDraftResult.ts`: commits `pre_analysis_sensitivity` (present → store, absent → null) beside the existing `commitDraftCoachingToStore` call, mirroring `DraftChat.tsx:753-758`. This prevents stale influence surviving a graph-replacing draft on the V5 path, which matters more now the UI itself populates the field.

**Added (all new files under `src/canvas/components/pre-analysis-v3/`):** see §4 to §12. Nothing in `src/canvas/components/pre-analysis/` is modified.

**Reused as-is:** `typography` tokens and `typo()`, `Pill` primitive, `Tooltip` (floating-ui, hover and focus), `NodeShapeIndicator`, results `Accordion`, `isAiSource` / `isReviewedByUser` predicates, `withObservedStateUpdate`, `setGoalThresholdAndUpdateNode`, `updateNodeLabel`, `addNode`, `useGraphReadiness` (ref-counted readiness listener), `useGuidanceStore` conversation callbacks, glossary checker (`containsBannedTerm`).

```
pre-analysis-v3/
  index.ts                      PreAnalysisPanelV3 export only
  PreAnalysisPanelV3.tsx        composition shell + section error boundaries
  types.ts                      Attribution, PanelSignalId, SignalDef, BarModel, LadderStep,
                                EstimateRowModel, EntityGroupModel, PreAnalysisModel
  constants.ts                  BAR_LABELS (single constants object), all copy, ACTIONS_MENU
  header/   PanelHeader, HealthBars, ActionsMenu
  hero/     HeroSection, InlineField, CoachingSlot, BestNextStep
  sharpen/  SharpenSection, SignalRow
  model/    YourDecisionSection, EntityGroup, EstimateRow, CalibrateDrillIn
  advanced/ AdvancedSection
  footer/   PanelFooter
  selectors/  computeBars, computeLadder, computeEstimateRanking, computeInfluenceCoverage,
              computeModelGroups, computeProvenanceCounts        (pure, no React)
  signals/    registry, signalSessionStore, deriveSignalViews
  hooks/      usePreAnalysisModel, useSensitivityRanking, useConversationActions
```

## 4. Signal model

Every panel item is a typed signal. Registry entries (`signals/registry.ts`):

| signal_id | Detection (pure, presence/count only) | Source fields | Owner | Live evidence | Copy (constants.ts) | Action path | Resolution |
|---|---|---|---|---|---|---|---|
| `sig_goal_missing` | no node with kind goal/outcome | `nodes[]` | UI | audit §3 | "No goal set yet." | focus goal flow (ladder primary) | auto: goal appears → quiet check |
| `sig_success_missing` | goal present and threshold unset (store `goalThreshold` null and goal node `success_threshold` absent) | store + goal node | UI | audit §3, editor shipped | "What would count as success?" | focus hero success field | auto: threshold set → quiet check |
| `sig_option_breadth` | option count < 3 | `nodes[]` count | UI | audit §3 | "You are comparing N options. A materially different route widens the comparison." (count copy) | spark: widen-the-options prompt | auto: count ≥ 3 |
| `sig_risk_count` | risk count ≤ 2 | `nodes[]` count + provenance attribution | UI | audit §3 | "N risks captured, all Olumi's so far." / pre-mortem method line | spark: pre-mortem prompt (prompt-routed, no intent) | auto: count grows or user-authored risk appears |
| `sig_estimates` | ≥1 AI-estimated factor uncalibrated | provenance counts + ranking head | UI counts, CEE-supplied flags | audit §3 + smoke capture | "Olumi estimated N values from your brief. X may matter most, check it first." | scroll to estimates group / calibrate | auto: top estimate reviewed |
| `sig_cee_narrow` | `draftCoaching.biasSignals` contains `narrow_framing` | store, session-local | CEE | audit capture 01 (direct path); dark on V5 | CEE `detail` verbatim, attributed "Olumi noticed" — swaps `sig_option_breadth` copy in place | spark: widen-the-options | follows `sig_option_breadth` |
| `sig_cee_bias` | `ceeAnalysisReady.bias_findings[]` non-empty | store | CEE | **live on V5** (smoke capture) | CEE `explanation` verbatim, attributed; max 1 row | spark: reflective prompt | dismiss only (no deterministic resolution) |
| `sig_cee_strengthen` | `draftCoaching.strengthenItems` non-empty | store, session-local | CEE | audit capture 01; dark on V5 | CEE `detail` verbatim, attributed | per-item action type → conversation prompt | session |
| Hero slot `sig_cee_tradeoff` | `draftCoaching.summary` or `ceeAnalysisReady.coaching_summary` | store | CEE | coaching_summary **live on V5** (smoke capture) | verbatim, attributed "Olumi:" | none (context line) | n/a |

Banned signals (`baseline-missing`, `constraints-missing`, `assumptions-review`, `evidence-weak`, `right-question` as a claim) do not exist in the registry; a static test asserts the registry id set exactly. Dead-end intents (`confirm_factor`, `edit_factor`, `gather_evidence`, `run_pre_mortem`) never appear in any dispatch payload; a static test greps the v3 directory.

**Lifecycle:** `signalSessionStore` (zustand, session-local, never persisted) records `seen` and `resolvedAt` per signal_id, reset on scenario reset. A signal whose detection clears after being seen renders as a greyed row with a success check and hidden actions (quiet confirmation, not removal). Never-seen signals that do not detect are simply absent. Cap of three rows in Sharpen, priority-ordered (foundational, options, risks, estimates); CEE swaps happen in place so row count never jumps when coaching arrives (no layout shift).

**De-duplication:** one canonical home per signal. The ladder references the same signal ids; when a signal is the current ladder step, the Sharpen row still renders (the ladder is a pointer, not a duplicate claim) but uses identical copy from the same constant, and the hero fields carry the editing affordance.

## 5. The four bars (honest fill)

Single constants object: `BAR_LABELS = { frame: 'Frame', options: 'Options', risks: 'Risks', estimates: 'Estimates' }`. Alternative set ("The question / Options / Risks / Your input") noted as a pending product decision; one-line change. "Scenarios" rejected on glossary grounds (reserved for simulation language).

| Bar | Fill rule (live signals only) | Tooltip |
|---|---|---|
| Frame | (decision line present) + (goal set) + (success set), each 1/3 | states which component is missing |
| Options | `min(optionCount / 3, 1)` | "N options included" |
| Risks | `min(riskCount / 3, 1)` | "N risks captured" |
| Estimates | influence-weighted coverage: `Σ influence(reviewed AI-estimated factors) / Σ influence(all AI-estimated factors)`; when no usable sensitivity, same formula with degree weights | "X of N checked" |

Affordances (criteria, stakes, continue-as-is, upside) contribute nothing in either direction; no invented denominators beyond the documented count caps. Bar state colour is semantic only: warning below 0.40, neutral building, success at or above 0.75. **UI-SEM-051** (bar state thresholds) and **UI-SEM-052** (count denominators: options/3, risks/3, frame thirds) are registered in CLAUDE.md and tagged at the constants.

## 6. Best-next-step ladder (deterministic)

1. Goal missing → "Set the goal this decision serves." (goal flow)
2. Goal present, success unset → "Define what success means here, so the analysis can judge the options." (focus success field)
3. Highest-influence uncalibrated estimate → "Check [factor], it may matter most to the analysis." (open calibrate row)
4. `can_run_analysis === false` → mirror `confidence_explanation` verbatim (CEE-authored, no UI judgement)
5. Otherwise → "Run your first analysis, then stress-test what it depends on." (Analyse)

Note: the spec lists success before goal; detections are scoped (success requires a goal) so both orderings produce identical outcomes; rung 1/2 ordering here is the dependency-correct expression of the same ladder. Right-question remains an affordance (Actions menu and hero spark), never a rung.

## 7. Sensitivity strategy (ranking and Estimates bar)

- **Primary:** `useSensitivityRanking` (mounted only inside the v3 panel): builds the graph with the existing V2 request machinery (`buildV2Request` graph + `normaliseGraphIds`), POSTs `/bff/engine/v1/pre-analysis-sensitivity` with `goal_node_id`, debounced 500ms on a graph fingerprint (readinessStore pattern), aborts in-flight on change, writes result via `setPreAnalysisSensitivity` (the existing store field), maps normalised ids back via the existing reverse id map. Failure or non-200 → store null. Flag off → hook never mounts → zero behaviour change.
- **Stale guard (approved correction):** before any use for ranking or bar weighting, validate `factor_influence` ids against current factor node ids. Any mismatch (removed or added factors) → degree fallback with hedged copy. Influence ranking is never displayed from a payload that no longer matches the graph. Covered by a selector test with a stale-payload fixture.
- **Fallback:** degree weighting (in-degree + out-degree per factor, `KeyRelationships` pattern), deterministic, stable alphabetical tie-break. Copy stays humble in both modes ("may matter most", "likely influence"); positional labels only ("top priority", "next to check", "lower priority").
- **Hygiene:** `applyDraftResult` clears or replaces the store value atomically on every draft, so influence keyed to dead node ids cannot survive a graph replacement between debounce ticks.

## 8. Progressive rendering

Deterministic content renders immediately. Reserved slots:
- Hero coaching line: `draftCoaching.summary` (direct path) else `ceeAnalysisReady.coaching_summary` (live on V5). Slot reserves no height when empty; appears with opacity transition only, below the fields, so no layout shift of fields or ladder.
- Sharpen: CEE items swap copy in place (`sig_cee_narrow` over `sig_option_breadth`) or fill the third row only when fewer than three deterministic signals are live.
- All CEE text rendered as text nodes, verbatim, attributed ("Olumi noticed", "Olumi:").

## 9. State synchronisation

All sections derive from one memoised `PreAnalysisModel` (hook `usePreAnalysisModel`), fed by narrow store selectors (`nodes`, `edges`, `goalThreshold`, `draftCoaching`, `ceeAnalysisReady`, `preAnalysisSensitivity`) plus `useGraphReadiness()`. The only local state is uncommitted input text. Committing the success field calls `setGoalThresholdAndUpdateNode` once; bars, ladder, pills, footer and the success signal all change in that single pass. Typing performs zero store writes (commit on blur or Enter, Esc reverts).

## 10. Actions and dispatch (no dead ends, no forked conventions)

- **Sparks and Actions menu:** send immediately via `useConversationActions` → `_sendChip(label, fullPrompt)` (existing guidance-store convention, the surface PR #173 pins); fallback `_prefillChat`; both unregistered → switch to the Olumi tab and prefill. Eight menu items, all prompt-routed: pressure-test the frame, widen the options, take the outside view, run a pre-mortem, find risks and upside, calibrate estimates, compare my view with Olumi, prepare first analysis. No `action_type` is attached to prompt chips (CEE's classifier routes from text), so no contract intents are emitted.
- **Run analysis:** the footer button calls the `onAnalyse` prop (OutputsDock `handleRunAnalysis`), preserving the single gate authority (`canRunAnalysis`) and the V5 canonical dispatch path. Readiness fields drive only the quiet dot and sublines (coaching, never gates).
- **Add option / add risk:** deterministic local `addNode` flow (canvas store), focusing the new node; no intent emission.

## 11. Calibrate drill-in (value-scale guard, approved correction)

- Displayed value and unit are sourced exactly as the existing inspector does, from raw display-scale fields (node `display_value`, `observed_state.raw_value`, unit helpers; `resolveEditorRawValue` is the reference for the ambiguity cases), never the normalised model-scale `value`.
- If the display scale for a factor is ambiguous (the `resolveEditorRawValue` null cases, or no raw display fields present), the row degrades to **confirm-only**: no numeric display, a single "confirm as is" action. Occurrences are listed in the report.
- Save writes via `withObservedStateUpdate`: numeric edit → `source: 'user_edited'`; confirm-as-is → `source: 'user_confirmed'`. Both flip `isReviewedByUser`, move the Estimates bar by the factor's influence weight, and resolve `sig_estimates` when the top estimate is covered.
- Range and confidence capture: follow-on enhancement (recorded in the report), not in v1.

## 12. Attribution (collaboration-ready)

```ts
type Attribution = { kind: 'olumi' } | { kind: 'person'; personId?: string; displayName: string }
```
Provenance pills, coaching lines and review states render from this type. Single-user today: `person` defaults to the current user. No you-versus-AI binary in component props; review state is attributable per author.

## 13. DS v5 compliance and prototype deviations

Tokens only (`panelHeader/Body/Meta`, semantic colours, `bg-panel`, borders via `/30` opacity), Lucide icons, outlined pills with `text-text-body`, shared Tooltip on hover and focus, sentence case, British English, no em dashes in copy. The DS guard (`ci:guard:ds`) must show zero net-new signatures.

Deliberate deviations from the prototype HTML (it forks the system; we do not):
1. Prototype's darkened primary (`#2F7FA6`) is a token fork → we use `bg-primary`. The known primary contrast failure (brand.css `#52A3C8`, spec `#63ADCF`, both fail WCAG with white text) is flagged in the report; no fork.
2. Prototype's decision **diamond** violates the shape system (diamond = goal) → `NodeShapeIndicator` decision hexagon.
3. Prototype's invented `--track`/`--building` neutrals → mapped to existing neutral tokens.
4. Hover-only revealed icons → always visible at reduced emphasis, strengthened on hover/focus.
5. Tooltips on non-focusable pills → provenance detail behind focusable affordances.
6. Prototype rows with no live source (stakes, criteria list) → omitted.
7. Prototype risk-bar headroom for upside → replaced by the honest count rule.
8. Icon buttons below 44px → documented panel exception, consistent with existing inspector affordances; keyboard and focus-visible support throughout.

## 14. Rollout and reinstatement

- Flag `preAnalysisV3`; env `VITE_FEATURE_PRE_ANALYSIS_V3`; localStorage override `feature.preAnalysisV3` ('1'/'0').
- **Default OFF (recommendation, endorsed):** the new panel ships dark; Paul reviews in-browser before any flip.
- **Reinstatement procedure:** set `feature.preAnalysisV3` to '0' (or leave env unset). Files involved: `src/flags.ts` (flag definition), `OutputsDock.tsx` (single ternary). The legacy `pre-analysis/` tree is untouched and its tests run unchanged. No migrations, no shared mutable state: the only store field both panels read is `preAnalysisSensitivity`, which the legacy panel already treats as optional; with the flag off the v3 fetch hook never mounts, so legacy behaviour is byte-identical.
- The readiness-first card (legacy "gauge") is demoted by the flag, not deleted.

## 15. Deferred (with reasons)

| Item | Reason |
|---|---|
| Baseline / continue-as-is signal | Audit verdict: sparse `is_baseline`, `id`/`option_id` drift, UI regex fallback; needs contract amendment |
| Right-question as a system claim | No service emits a framing-quality signal; prompt affordance only |
| Constraints / criteria missing claim | CEE emission unreliable (cap landed as `observed_state.cap`) |
| Assumptions review, evidence/provenance rows | Post-analysis only; Track S half-deployed |
| Effect-strength values on connections | Value-scale fix pending (CEE/PLoT #246 lane) |
| Coaching persistence across reload | CEE lifecycle decision (session-local today) |
| Coaching-intensity lever | Spec hook, not built |
| Range + confidence capture in calibrate | Follow-on enhancement (approved) |
| Per-person attribution UI | Hooks only; single user today |

## 16. Risks

1. **Sensitivity rarely live in deployed sessions until the direct call ships with the panel** — mitigated: the call is part of this build and staging-verified; degree fallback plus stale guard otherwise; hedged copy in both modes.
2. **Render cost during canvas edits** — panel mounts pre-run only; selectors are O(n) pure passes; sections memoised; typing never derives.
3. **Layout shift on coaching arrival** — slots reserve structure; swap-in-place; row-count assertions in tests.
4. **Gate divergence** (readiness vs run authority) — button uses OutputsDock authority only; readiness is coaching copy.
5. **Legacy regression via shared edits** — only the coverage extraction touches legacy behaviour; characterisation test pins it; legacy suite must pass unchanged.

## 17. Manual staging replay (for Paul)

1. `localStorage.setItem('feature.preAnalysisV3', '1')` on the deployed canvas (`/#/canvas`), reload.
2. Draft a decision from the composer. Expect: hero shows decision and goal lines; bars reflect goal/success presence and counts; ladder points at success measure; estimates group ranks factors (sensitivity call visible in the network tab as `POST /bff/engine/v1/pre-analysis-sensitivity`, or degree fallback with hedged copy if it fails).
3. Set the success measure inline. Expect single-pass update: Frame bar, success pill, ladder, footer subline.
4. Calibrate the top estimate (edit or confirm as is). Expect Estimates bar moves by influence weight; signal resolves to a quiet check.
5. Click a spark. Expect the prompt sent to Olumi immediately with the panel's label in the bubble.
6. `localStorage.setItem('feature.preAnalysisV3', '0')`, reload. Expect the current panel exactly as today.

## 17a. Build verification results (2026-06-10, local dev server)

Live browser smoke on the worktree dev server (PLoT proxied to staging, CEE dummied):
- Flag on: v3 panel renders (bars, hero, signals with correct entity shapes, footer).
- `POST /bff/engine/v1/pre-analysis-sensitivity` fired through the existing proxy and returned live influence (f1 1, f2 1, f3 0.5); ranking consumed it (tie broken by label: "Check Ramp-up time").
- Success commit: typing wrote nothing; Enter committed once; field re-rendered "25%", the Olumi-estimate pill flipped to user attribution, Frame bar, ladder and footer updated in the same pass.
- Calibrate: drill-in saved 45 → row "checked by you", Estimates bar moved to exactly 40% (the factor's influence share), the estimates signal re-pointed at the next factor.
- Flag off + reload: legacy panel restored, v3 absent (reinstatement lever proven).
- Production build green; the v3 panel is a separate lazy chunk (flag-off users do not load it).
- A temporary gitignored `.env.local` remains in the worktree for Paul's in-browser review (delete after; see memory note on worktree dev env).

## 18. Test matrix

See plan §Test plan; in brief: pure selector suites (bars honest-fill, ladder rungs and precedence, ranking with sensitivity/fallback/stale fixtures, coverage characterisation), signal registry matrix (including banned-id and dead-end-intent static assertions, glossary scan of all copy), session ledger, component suites (three states, one-pass resolution, coaching present/absent/partial fixtures from `tests/fixtures/cee-responses/` plus a staging-derived V5 smoke fixture, no-layout-shift row counts, footer `readiness_level` absence assertion, flag-gate spec), `applyDraftResult` ingestion cases, DS guard, lint, typecheck (ci + full app tsconfig), legacy pre-analysis suite unchanged.
