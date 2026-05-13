# V5 — Current State

Canonical tracker for the V5 completion programme. **Update this file in
place; do not start a new tracker.** Per-phase implementation briefs are
cross-referenced under "Implementation briefs" below.

Last updated: 2026-05-13 (post-reconciliation corrections — decision_review
Option A recorded; UX §9 acceptance source recorded; data contract
constraint added; Phase 3 split into 3A minimum coaching contract + 3B
full coaching layer; testing-gate principle clarified as baseline-diff;
useConversation.ts ownership recorded for Phases 2–3; Phase 2b round-2
reviewer findings addressed in olumi-assistants-service#170 + companion
DGAI#140 UI chip whitelist PR).

## Programme shape

Four sequenced phases, two parallel upstream-contract surfaces, two
distinct exit gates.

```
parallel:    [ISL B3 ✓ awaiting verify]   [PLoT EVPI clamp — pending]
phased:      Phase 1 → Phase 2 → Phase 3 → Phase 4
gate:        G1        G2        G3        G4
                       ↓
                       Olumi experience smoke (3-5 scripted scenarios,
                       binary pass/fail) — separate gate between
                       Phase 2 and Phase 3.

V5 product-experience gate    : Phase 1 G1 + Phase 2 G2 + clean replay
                                 + Olumi experience smoke
Scientific-audit gate          : ISL B3, PLoT B3, EVPI clamp, flip-threshold
                                 monitoring decision recorded
```

| Phase | Scope | Outcome |
|---|---|---|
| **1** | Debug exporter V5 awareness + visible Results rendering proof | Bundles + tests stop lying about V5 turns; visible-render is automated |
| **2** | Restore core journey reliability and speed (4 sub-PRs: 2a labels, 2b chip-click bypass, 2c raw-value suppression *diagnosis-first*, 2d no-op honesty *after 2a/2b*) | "What changed?" names real entities; chip clicks fast; assistant copy doesn't leak raw IDs; no-op edits honest + fast |
| **3A** | Minimum coaching contract — emit ReviewCard / Coaching / Evidence / Exercise blocks conforming to `v5-analysis-tab-data-contract-v1.md`; auto-invoke decision_review with guardrails | Coaching meets UX §9.1 + §9.2 |
| **3B** | Full coaching layer — draft_graph coaching outputs, coaching_state persistence, evidence-ranked coaching, formatting/layout, chip↔coaching coherence | Coaching meets UX §9.3 + §9.4 |
| **4** | V4 retirement, scientific cleanup, methodology / audit | Single-codepath V5; scientific gate also passed; no V4 dead code |

Manual testing is **not recommended** until the V5 product-experience
gate passes (see "Gates" section).

## Implementation briefs (per phase, current)

- **Phase 1 — debug exporter:** `~/.claude/plans/exportbundle-v5-aware-fix-brief.md`
- **Phase 1 — visible-render verification (diagnosis):** `~/.claude/plans/area-1-staging-verification-2026-05-13.md`
  + DevTools-only fallback if automated path fails: `~/.claude/plans/area-1-devtools-verification-script.md`
- **Phase 2a — Step 3 label resolution:** `~/.claude/plans/area-3-step3-label-resolution-brief.md`
- **Phase 2b — safe-chip dispatch:** `~/.claude/plans/v5-chip-click-router-bypass-workstream.md`
- **Phase 2c — raw / internal value suppression:** brief TBD (see Phase 2c §below for scope sketch)
- **Phase 2d — edit_graph no-op honesty + negative-intent fast path:** brief consolidated into Phase 2d §below; backend-primary
- **Phase 3 — full coaching layer:** brief TBD (gated on Phase 2 G2 + Phase 2 homework decision)
- **Phase 4 — V4 retirement + scientific cleanup:** brief TBD (gated on Phase 3 G3)
- **Area 1 shipped (closed at hydration layer):** `~/.claude/plans/area-1-v5-analysis-hydration-brief.md` (PR #137, merged at `21c6d1e2`)

---

## Phase status

### Phase 1 — Debug exporter V5 awareness + visible-render verification
- **Status**: 🔄 **PR #138 OPEN** (https://github.com/Talchain/DecisionGuideAI/pull/138)
  at branch `claude/v5-phase1-debug-exporter`, head `3d84df0e`. Awaiting
  Codex review.
- **Blockers**: none
- **Upstream context**: PR #137 (V5 Results-panel hydration) **MERGED**
  at `21c6d1e22f34d0ea8c03e219ccb31ba4baa3afd4` on 2026-05-12. Code path
  `applyV5State step 5 → store.resultsComplete → state.results.report.option_probabilities`
  is live on staging (`https://staging--olumi.netlify.app/`). The
  hydration layer is done. **What's left for the V5 Results experience
  closure is the *consumer* side — V5-aware debug exporter AND a
  visible-render verification that does not depend on Paul running
  DevTools snippets.**
- **What lands (two coordinated changes in one PR)**:
  1. **Exporter V5 awareness.** `resolveOption()` and the
     factor-sensitivity resolver in `exportBundle.ts` add
     `state.results.report.option_probabilities[node.id].win_probability`
     (and the equivalent `factor_sensitivity` source) as the **first**
     entry in their resolution chains, with new `WinProbabilitySource` /
     `FactorMetricSource` enum members. V4 `apiResponse.*` fallbacks
     retained unchanged so Comparison-mode users are not regressed.
  2. **Automated visible-render verification.** Component-level
     test that mounts the actual Results panel (or its top-level
     selector hook) against a real-staging-shape V5 envelope and asserts
     the rendered DOM (or selector output) shows numeric per-option
     win-probability values keyed by the canvas option-node IDs. **This
     is the gate that closes the Area-1 visible-render question — not a
     DevTools snippet, not a manual click-through.**
- **G1 acceptance** (per the baseline-diff testing principle, §Hard
  constraints):
  - [x] `pnpm typecheck` clean (verified locally on `3d84df0e`).
  - [x] **Targeted tests pass** — 4 visible-render + 5 V5-aware
        exporter tests, all green.
  - [x] **Relevant full suites pass**: exportBundle (132/132, +5 new),
        Results (908/908, +4 new), V5 (403/403, unchanged).
  - [x] **Baseline-diff against `origin/staging @ 21c6d1e2`**: zero
        NEW deterministic failures.
  - [x] Rich exporter test fixture round-trip: V5 source resolves
        first; V4 fallbacks unchanged; staging-fixture exercise shows
        all 4 options carry numeric `win_probability_displayed` and
        `win_probability_source ===
        'state.results.report.option_probabilities.win_probability'`.
  - [x] **Visible-render assertion: component test mounts production
        `OptionCards` with V5-shape `OptionResult` data and asserts
        exact rendered DOM percentages via `data-testid="win-pct-<id>"`.**
  - [x] **No manual DevTools dependency for closure.** The DevTools
        script in `~/.claude/plans/area-1-devtools-verification-script.md`
        is the documented fallback only — primary closure is automated.
  - [ ] Codex review approval.
- **Files**:
  - `src/components/debug/utils/exportBundle.ts` (lines 683-698 enum
    extension; ~1822-1869 `resolveOption()`; ~1759 factor-sensitivity
    resolver)
  - `src/components/debug/__tests__/exportBundle.fixtureReplay.spec.ts`
    (mock at lines 355-359)
  - `src/components/debug/__tests__/exportBundle.v1_5.spec.ts` (3 new
    cases — V5 happy path, V5+V4 simultaneous, V4-only regression guard)
  - **NEW** Results-panel render test under
    `src/components/results/__tests__/` (e.g.
    `Results.v5-render.spec.tsx`) using the staging fixture
- **Evidence today**:
  - UI hook reads `report.option_probabilities` at
    `src/components/results/useResultsSectionData.ts:1042` — user-facing
    Results panel is unaffected by the export bug.
  - Canvas store `ResultsState` carries `report` and `enrichment` only;
    no `apiResponse` field exists (`src/canvas/store.ts:170-191`). The
    export bug reads `apiResponse.*` which V5 turns never populate.
  - V5 mapper writes the fields the exporter needs at
    `src/v5/mapV5AnalysisToReport.ts:534, 557, 619`.
  - Bundle-string verification confirms `analysis_result:results_hydrated`,
    `currentResultsHash`, and `VITE_V5_ENDPOINT` all inlined in the
    deployed `ReactFlowGraph-CEZXhZWB.js` chunk — PR #137 IS deployed.

---

### Phase 2 — Restore core journey reliability and speed
- **Status**: ☐ Not started
- **Blockers**: Phase 1 G1 (need automated evidence before changing
  the chip surface AND/OR the assistant-copy surface). Backend
  sub-PRs 2a / 2b / 2d may begin in parallel with Phase 1 because they
  do not modify UI consumer code.
- **Composite G2 gate**: ALL FOUR sub-PRs (2a, 2b, 2c, 2d) merged AND
  the Olumi experience smoke (separate gate, §below) passes.
- **Sub-structure**:

#### Phase 2a — Step 3 label resolution (preGraph through both layers)
- **What lands**:
  - `resolveElementLabel(id, currentNodes, currentEdges, preGraph)` —
    new `preGraph` parameter, used so deleted/changed entities still
    resolve to their real label rather than the raw ID.
  - **MANDATORY (not optional):** `sanitiseAffectedEntityLabel` (or
    the final-sanitisation step at the fact-builder boundary) is
    widened to accept and consult `preGraph` too. Threading `preGraph`
    through `resolveElementLabel` only is **insufficient** — the
    downstream sanitiser ([backend `src/orchestrator-v5/handlers/edit-graph-fact-builder.ts:329-351`](https://github.com/Talchain/olumi-assistants-service/blob/staging/src/orchestrator-v5/handlers/edit-graph-fact-builder.ts))
    re-strips a recovered label back to "the relevant factor" /
    "the relevant element" if it can't validate against the post-edit
    graph. **Both layers must accept `preGraph`.**
- **Acceptance (sub-gate)**:
  - [ ] Unit tests cover preGraph fallback (single `remove_node`
        AND multi-op compound case).
  - [ ] Unit tests cover the sanitiser path: a recovered pre-edit
        label survives the full sanitisation chain (does NOT collapse
        to "the relevant factor" / "the relevant element").
  - [ ] Replay fixture: deleted-entity `direct_edit` events carry the
        real label, not "unknown" / "the relevant factor".
- **Files (UI side)**:
  - `src/canvas/conversation/utils/resolveElementLabel.ts`
  - `src/canvas/conversation/useGraphEditEvents.ts` (callers at lines 300, 313)
  - `src/canvas/conversation/utils/__tests__/resolveElementLabel.spec.ts`
- **Files (backend side, primary)**:
  - `src/orchestrator/tools/edit-graph.ts` — `resolveElementLabel`
    signature, `buildOperationDescription`, `buildAppliedChanges`
    (~8 call-sites, ~6 lines new body).
  - `src/orchestrator-v5/handlers/edit-graph-fact-builder.ts:329-351`
    — `sanitiseAffectedEntityLabel` widened to accept `preGraph`.

#### Phase 2b — Deterministic chip-click dispatch for safe chip actions
- **What lands**:
  - Generalise `dispatchChipClickRunAnalysis` →
    `dispatchDeterministicChipClick(actionType)` whitelist-based dispatcher
    so chip-clicks with `chip.action_type` in the safe set
    (`run_analysis`, `explain_result`, `what_would_flip`, candidate
    `compare_options`) bypass full LLM routing / ORIENT.
  - Saves ~12s per chip click that currently pays the ORIENT-Sonnet
    tax even though the chip already declared the handler. Confirmed
    against [chip-click-dispatch.ts:9-15 header comment](https://github.com/Talchain/olumi-assistants-service/blob/staging/src/orchestrator-v5/handlers/chip-click-dispatch.ts).
- **Acceptance (sub-gate)**:
  - [ ] Unit tests cover safe-chip deterministic dispatch (each
        whitelisted action_type).
  - [ ] Telemetry: `explain_result` / `what_would_flip` chips no
        longer hit CEE Anthropic routing — `llm_calls_used: 0` AND
        end-to-end latency drops to <2s (was ~13s).
  - [ ] No regression for `edit_graph` / `draft_graph` routing.
- **Files (backend, primary)**:
  - `src/orchestrator-v5/handlers/chip-click-dispatch.ts` —
    generalisation.
  - `src/orchestrator/route-v2.ts:564, 583, 595, 630` — extend
    detection scope.
- **Files (UI, secondary)**:
  - `src/canvas/conversation/zones/SuggestedChips.tsx`
    (`V5_ENABLED_ACTIONS` at line 26).
  - `src/canvas/conversation/useConversation.ts` (dispatch site).
- **UI companion PR**: **DGAI #140**
  (`https://github.com/Talchain/DecisionGuideAI/pull/140`,
  branch `claude/v5-phase2b-ui-chip-whitelist`). Extends
  `V5_ENABLED_ACTIONS` with `explain_results` + `what_would_flip` and
  adds plural alias `explain_results: 'explain'` to `ACTION_TO_TURN_TYPE`.
  Without this companion PR the backend bypass is inert because the V5
  UI filter would hide every new executable chip emitted by olumi-
  assistants-service#170's `chip-generator` change. Required co-merge.

#### Phase 2c — Raw / internal value suppression in user-facing copy
- **Status**: **diagnosis-only first**, then brief, then implementation.
  Do **not** start a fix PR until the diagnosis identifies actual
  leakage paths on real V5 turns.
- **Phase 2c.0 — Diagnosis (must precede brief):**
  - Survey real V5 staging turns (`analysis_result`, `explain_result`,
    `what_would_flip`, `edit_graph` apply / reject / no-op) for
    user-visible emissions that contain raw IDs (`opt_*`, `fac_*`,
    `goal_*`, `e_*`), operator-glyphs (`<=`, `>=`, `≤`, `≥`), or
    schema-internal field names (`constraint_id`, `node_id`,
    `provenance`, `raw_value`, `mean`, `std`).
  - For each leakage path, record: source file:line that emitted the
    leak, surface that rendered it (assistant text / chip /
    review-card / inspector), the wire-shape that carried it, and
    whether existing safety (e.g.
    `compose/forbidden-user-facing-phrases.ts`) could have caught it.
  - Output: written diagnosis doc filed at
    `~/.claude/plans/phase-2c-raw-value-suppression-diagnosis.md`.
- **What lands** (initial scope hypothesis — to be refined by diagnosis):
  - Audit assistant-text composer + chip-text composer for emissions
    that include raw IDs (`opt_*`, `fac_*`, `goal_*`, `e_*`),
    operator-glyphs (`<=`, `>=`), or schema-internal field names
    (`constraint_id`, `node_id`, `provenance`, `raw_value`, `mean`,
    `std`).
  - Centralise the suppression list (currently scattered across
    `forbidden-user-facing-phrases.ts`, the wire-to-DOM safety regex,
    and per-renderer hand-rolled checks).
  - Component-level / fact-builder tests assert absence of these terms
    in normal (happy-path) user-facing surfaces.
- **Acceptance (sub-gate)**:
  - [ ] Documented allowlist + denylist of terms; centralised.
  - [ ] Replay fixture: assistant-text and chip text contain zero
        raw-ID / operator-glyph / schema-internal-term emissions on
        the Olumi-smoke scenarios.
  - [ ] Existing `expectNoLeakInDOM()`-style tests extend to the
        Phase-2c scope.
- **Files (TBD)**:
  - Likely: `src/orchestrator-v5/compose/output-safety.ts` (backend),
    `src/orchestrator-v5/compose/forbidden-user-facing-phrases.ts`
    (backend), various UI renderers.
- **Investigation needed before implementation**: where does the leakage
  actually happen on real V5 turns? Phase 2c brief must start with
  a survey, not a rewrite.

#### Phase 2d — edit_graph no-op telemetry honesty + strict negative-intent fast path
- **Sequencing**: starts **after Phase 2a and Phase 2b are underway**
  (not blocking on their merge, but their PRs should be in flight so
  reviewer context is fresh). Reasoning: 2a and 2b touch separate files
  and ship the bigger user-visible wins; 2d benefits from running with
  2a's preGraph plumbing already understood by reviewers.
- **Sub-order within Phase 2d**: telemetry honesty lands FIRST as its own
  PR (or first commit on the same branch); the strict negative-intent
  fast path lands SECOND. Reasoning: honest telemetry on the no-op path
  is the prerequisite for measuring the fast-path's actual win.
- **Backend-primary** (was framed as UI router work in earlier tracker;
  reconciliation moves it to backend CEE / edit_graph dispatch where the
  actual no-op classification, latency, and telemetry emit live).
- **What lands**:
  - **Telemetry honesty first.** Distinct counters for
    `edit_graph.applied`, `.rejected`, `.no_op_zero_operations`,
    `.no_op_negative_intent`. Log line at
    [`edit-graph-dispatch.ts:991`](https://github.com/Talchain/olumi-assistants-service/blob/staging/src/orchestrator-v5/handlers/edit-graph-dispatch.ts)
    augmented with `mutation_applied` + `operations_count` so
    operators can read the true outcome alongside `was_rejected`.
  - **Strict negative-intent fast path** — extends the existing
    deterministic block at
    [`edit-graph-dispatch.ts:503-610`](https://github.com/Talchain/olumi-assistants-service/blob/staging/src/orchestrator-v5/handlers/edit-graph-dispatch.ts)
    (currently scoped to `add_risk` only) with explicit literal matches
    for "no change", "no changes", "keep it as is", "keep as is",
    "leave it", "leave it as is", "don't change", "do not change".
    Disqualified by any presence of edit verbs (`add`, `update`,
    `remove`, `change`, `set`).
- **Acceptance (sub-gate)**:
  - [ ] `npm run typecheck` clean (backend).
  - [ ] Four telemetry counters land; verified by fixture replay.
  - [ ] Matcher covers the explicit list, rejects looser variants
        ("actually no", "nope", "I changed my mind").
  - [ ] No-op acceptance test: explicit no-change message returns in
        <2s with `operations_count: 0`, `mutation_applied: false`,
        `analysis_freshness` unchanged. Confirmed honest in the log.
  - [ ] No CEE prompt change.
- **Files (backend, primary)**:
  - `src/orchestrator-v5/handlers/edit-graph-dispatch.ts` (lines
    503-519 for preflight extension; line 991 for log enrichment).
  - **NEW** `src/orchestrator/intent-gate.ts` extension OR a sibling
    `negative-intent.ts` for the matcher (final location TBD by
    Phase 2d brief).
- **Files (UI)**: none. Reconciliation note — earlier tracker draft
  put `src/v5/responseRouter.ts` here; that was wrong unless the brief
  surfaces a UI-side detection requirement.

#### Phase 2 homework decision — RESOLVED

**Decision (2026-05-13): Option A — auto-invoke `decision_review` after
every successful `run_analysis`, with guardrails.**

Guardrails (mandatory for Phase 3A):
- **Run once per fresh graph hash.** Compute `coaching_state_key` from
  the analysis-affecting graph hash + leading_option_id (or the same
  hash basis as the V5 results-hash dedupe contract). Skip the
  `decision_review` invocation when the key matches a persisted entry.
- **Persist the result.** Coaching output lives on the canvas store
  (shape TBD by Phase 3A brief — likely `coachingStore` slice mirroring
  `resultsStore`). Survives multi-turn dialogue without re-derivation.
- **Invalidate after graph edits.** Any `edit_graph` / direct-edit that
  changes the analysis-affecting graph hash invalidates the coaching
  entry. Next `run_analysis` re-derives via the auto-invoke path.
- **Feature-flagged.** Gate behind `VITE_ENABLE_AUTO_DECISION_REVIEW`
  (or equivalent) so the auto-invoke can be disabled per-deploy without
  reverting code.
- **Track latency and cost.** Telemetry per invocation:
  `decision_review.latency_ms`, `decision_review.input_tokens`,
  `decision_review.output_tokens`. Establish baseline + budget in the
  Phase 3A brief.
- **Stop and report if materially too slow.** If 95th-percentile
  end-to-end latency for `run_analysis` + `decision_review` exceeds the
  budget set by Phase 3A, automatically degrade to Option B (lazy on
  panel-open) and surface a tracker entry. Defines the rollback path.

This decision unblocks Phase 3 brief drafting. **Removed from Phase 3
blockers.**

---

### Phase 3 — Full coaching layer (split into 3A + 3B)

- **Status**: ☐ Not started; briefs to be drafted post-Phase-2 G2.
- **Blockers**: Phase 2 G2 (composite — all sub-PRs merged + Olumi
  smoke passed). Phase 2 homework decision and UX §9 source are
  **resolved** (see below); they are now *constraints*, not blockers.

#### Phase 3A — Minimum coaching contract (data-contract-conformant)

The smallest viable coaching surface that conforms to the v1
data contract and lets the Analysis tab render coaching without
guessing at shapes.

- **Hard constraint:** Phase 3A output shapes must conform to the
  v5 Analysis-tab data contract
  (`olumi-coaching-ux-requirements-v1.md`'s companion doc
  `v5-analysis-tab-data-contract-v1.md`), especially:
  - `ReviewCardBlock`
  - `CoachingBlock`
  - `EvidenceBlock`
  - `ExerciseBlock`
  - interaction intents
  - freshness / staleness semantics
  - suppression rules
  - **Contract status: DRAFT, pending V5 + Analysis-tab confirmation.
    Treat as authoritative for Phase 3A but allow targeted revisions
    when V5 and Analysis-tab implementations surface gaps. Each
    revision is recorded in the change log.**
- **Six adopted corrections to the contract (carry through Phase 3A):**
  1. **Separate display text from machine references.** All
     coaching blocks expose `target_refs` (machine-readable IDs)
     alongside human-readable `label` / `text` fields. Renderers
     never re-derive a label from a raw ID.
  2. **Standard block metadata.** Every coaching block carries
     `block_id`, `block_type`, `priority`, `priority_band`,
     `freshness`, `freshness_reason`, `created_at`,
     `coaching_state_key`. Metadata is rendered conditionally; never
     leaked into prose.
  3. **Visual rendering decisions owned by the Analysis tab.** CEE
     emits semantic content (what the block *means*); the Analysis
     tab decides *how* it renders (icon, colour, layout, density).
     Phase 3A backend must not bake visual hints into the contract.
  4. **CEE emits freshness/status/reason; Analysis tab renders
     canonical copy.** Backend signals `freshness ∈ {fresh, stale,
     unknown, none}` and `freshness_reason ∈ {graph_hash_match,
     graph_hash_diverged, missing_inputs, …}`; UI maps to the
     canonical user-facing copy. No prose freshness strings in the
     backend.
  5. **Verify all interaction intents against the live handler /
     action registry.** Every interaction intent emitted in a
     coaching block (e.g. "validate this assumption", "edit this
     factor") must round-trip through the registered handler /
     action surface — no orphan intents that the UI can't dispatch.
  6. **Copy-length / formatting constraints + fallback behaviour for
     missing or invalid fields.** Each block type declares max line
     count, max char counts, allowed inline-formatting (bold /
     italic / code per the design system), and fallback text when
     a field is missing or invalid (e.g. "Coaching unavailable for
     this run" rather than crashing or rendering an empty block).
- **Decision_review invocation contract (per the Phase 2 homework
  decision):**
  - Auto-invoke after every successful `run_analysis` succeeds.
  - Guarded by `coaching_state_key` (graph-hash-based) — runs once
    per fresh graph.
  - Persists to the canvas store.
  - Invalidates on any `edit_graph` / direct-edit that changes the
    analysis-affecting graph hash.
  - Feature-flagged (`VITE_ENABLE_AUTO_DECISION_REVIEW` or equivalent).
  - Telemetry: `decision_review.latency_ms`, `.input_tokens`,
    `.output_tokens`.
  - Auto-degrade to lazy (Option B) if 95th-percentile end-to-end
    latency for `run_analysis + decision_review` exceeds the budget
    set by the Phase 3A brief.
- **G3A acceptance** (acceptance standard:
  `olumi-coaching-ux-requirements-v1.md` §9.1 + §9.2):
  - [ ] Backend emits the four contract blocks
        (`ReviewCardBlock`, `CoachingBlock`, `EvidenceBlock`,
        `ExerciseBlock`) on the V5 envelope, conforming to the
        adopted contract corrections above.
  - [ ] `decision_review` auto-invoke wired with all guardrails.
  - [ ] UI Analysis tab consumes the contract blocks and renders
        canonical copy from `freshness` / `freshness_reason`.
  - [ ] Every emitted interaction intent dispatches successfully via
        the live handler / action registry (no orphans).
  - [ ] Fallback rendering for missing / invalid fields tested.
  - [ ] Latency budget recorded; degrade-to-lazy threshold tested.

#### Phase 3B — Full coaching layer (post-3A)

Once the minimum coaching contract is shipping cleanly, expand to the
full coaching layer. Acceptance source: §9.3 + §9.4 of
`olumi-coaching-ux-requirements-v1.md`.

- **What lands** (scope per V5 Completion Plan):
  1. **`draft_graph` structured-output threading.** Surface
     `strengthen_items`, `widening_log`, `bias_signals`, and
     `provenance` — these currently exist in the draft_graph stage
     but are not fully consumed by the UI.
  2. **`coaching_state` persistence across turns.** Extends 3A's
     coaching-state persistence to all coaching outputs (not just
     `decision_review`). Define the persistence shape on the canvas
     store and the cache / dedupe rules.
  3. **Evidence-ranked coaching / chips.** A unified ranker emits
     ordered evidence-priority items; chips, brief, review-cards, and
     assistant text consume the SAME ranker output. Replaces the
     current "single generic 'Add evidence' chip" failure mode.
  4. **Structured response blocks vs prose blobs.** All coaching
     content emitted as typed blocks per the contract (no free-form
     prose that the UI has to parse heuristically).
  5. **Raw / internal value suppression in coaching surfaces** —
     extends Phase 2c's centralised suppression to coaching output
     paths.
  6. **Formatting / layout quality.** Coaching panel respects design
     system spacing, hierarchy, and typography; copy reads as natural
     advice rather than serialised debug output.
  7. **Chip ↔ coaching coherence.** Chips reflect the SAME ranked
     evidence priority that the coaching panel surfaces; clicking a
     chip lands on the relevant coaching item, not a re-derived
     surface.
- **G3B acceptance**: meets `olumi-coaching-ux-requirements-v1.md`
  §9.3 + §9.4 in full.
- **Files**: TBD — scope is large, specific files surface during the
  Phase 3B brief.

---

### Phase 4 — V4 retirement, scientific cleanup, methodology / audit
- **Status**: ☐ Not started; brief NOT written
- **Blockers**: Phase 3 G3.
- **What lands** (scope per V5 Completion Plan):
  1. **V4 codepath removal.** With V5 exclusive on every turn, the
     V4 fall-through paths (`src/canvas/conversation/turnService.ts`,
     V4 mapper bypass, V4-only Comparison-mode plumbing if not still
     needed) become dead weight. Audit + remove. Includes the
     `OutcomePanel.OptionComparisonSection` V4-pre-existing gap
     (which auto-resolves once V4 is gone, since V5 hydration covers it).
  2. **Scientific cleanup.** ISL B3 verification finalised, PLoT EVPI
     clamp landed (or explicitly deferred with rationale), flip-threshold
     `no_effect_within_bounds` decision recorded (currently monitored).
  3. **Methodology / audit.** Replay batch baseline maintenance,
     fixture refresh cadence, conversation-flow URL-parse test setup
     repair (currently 12-test baseline noise), `.gitignore` rules for
     macOS Finder / iCloud duplicate-file artefacts (` 2.ts`, ` 3.ts`),
     Codex review-gate cadence documented.
  4. **Schema-level tightening if surfaced.** `win_probabilities` key
     contract (label vs ID) — if the boundary contract firms up,
     mapper path B (label fallback) can be simplified; if it doesn't,
     monitor.
- **G4 acceptance**:
  - [ ] V4 surface absent from `src/` (or explicit retain-with-rationale
        list documented here).
  - [ ] Scientific-audit gate (§Gates) all green.
  - [ ] Methodology improvements landed.

---

## Parallel upstream-contract surfaces

### ISL B3 — `auto_noise_applied` propagation on V2 envelope
- **Status**: ✅ Implementation complete on `staging` branch, **awaiting
  push approval**.
- **What landed** (local, unpushed): 6 files, +178 lines.
  - `src/models/response_v2.py` — `Optional[bool]` field on
    `ISLResponseV2`, schema example updated.
  - `src/utils/response_builder.py` — builder tracks and emits the flag
    in both `build()` and `build_error_response()`.
  - `src/api/robustness.py` — `builder.set_auto_noise_applied(
    v1_response.metadata.auto_noise_applied)` wired into the V2
    enhanced route.
  - `tests/unit/test_response_v2.py` — 4 new unit tests
    (True/False/None/error-response).
  - `tests/integration/test_p2_verification.py` — 2 new route tests
    asserting the field at the JSON top level for both `true` and
    `false`.
  - `openapi.json` — regenerated.
- **Gate**: full pre-push gate green
  (`scripts/pre-push-validate.sh` → 1782 passed / 654 skipped / 0
  failed / 5 checks green / safe to push).
- **Next**: push approval → deploy → run
  `plot-lite-service/scripts/B3-staging-smoke.sh` and confirm
  21/21 with no `auto_noise_flag_missing_from_isl` warnings.
- **Blocks**: scientific-audit gate (§Gates).

### PLoT EVPI clamp
- **Status**: ☐ Not started.
- **What lands**: `Math.max(0, ...)` clamp at
  `plot-lite-service/src/routes/v2/run.ts:4013` plus a tightened
  OpenAPI description. New test asserts non-negative
  `evpi_percentage_points` end-to-end.
- **Blockers**: ISL B3 push must land first (per the agreed
  ISL → PLoT → DGAI sequencing); local PLoT `staging` carries
  unpushed A1 commits — drift inspection required before push
  (run `git log origin/staging..staging` and compare
  `/health` build with `origin/staging`).
- **Acceptance**:
  - [ ] Drift inspection complete and reviewed.
  - [ ] Clamp commit isolated from unrelated work or explicitly
        approved as a bundled scientific rollout.
  - [ ] `npx tsc --noEmit` clean.
  - [ ] Targeted vitest case green.
  - [ ] Post-deploy: live `/v2/run` responses show no negative
        `evpi_percentage_points`.

### Flip-threshold `no_effect_within_bounds`
- **Status**: monitored, not addressed. Legitimate signal that a
  factor's [0,1] range does not flip the argmax option. Decision to
  resolve (no-action vs explicit messaging) recorded in Phase 4
  scientific-cleanup acceptance.

---

## Gates

The programme has **two distinct exit gates** that must both pass before
V5 is considered complete:

### V5 product-experience gate (Phase 1 + Phase 2 + smoke)
- [ ] Phase 1 G1 passed.
- [ ] Phase 2 G2 passed (composite — all 4 sub-PRs merged).
- [ ] Clean replay batch run end-to-end against the post-Phase-2 build
      with zero new errors and zero new warnings.
- [ ] **Olumi experience smoke** (§below) returns binary PASS on every
      scripted scenario.

When this gate passes, broad manual testing is recommended. Phase 3
work may begin in parallel.

### Scientific-audit gate (parallel + Phase 4)
- [ ] ISL B3 deployed; PLoT B3 staging smoke 21/21 with no
      `auto_noise_flag_missing_from_isl` warnings.
- [ ] PLoT EVPI status known (clamp deployed, or explicitly deferred
      with rationale recorded here).
- [ ] Flip-threshold `no_effect_within_bounds` decision recorded
      (monitored vs addressed).
- [ ] Phase 4 G4 passed.

When this gate passes, the scientific surface is publicly defensible.

---

## Olumi experience smoke (Phase 2 → Phase 3 gate)

After Phase 2 G2 passes, run **3-5 scripted scenarios** with binary
pass/fail. Each scenario tests whether the experience now feels
coherent, fast, readable, and useful enough to continue broader manual
testing.

Suggested scenario shape (Paul refines before running):

| # | Scenario | Pass criteria |
|---|---|---|
| 1 | Fresh draft → analyse → expect ranked options | Results panel shows numeric win probabilities per option; leading option visibly correct; <30s end-to-end |
| 2 | After analysis → click "what would flip?" chip | Returns in <2s (chip-click bypass); narrative is coherent; no "the relevant factor" placeholder |
| 3 | Edit a factor → re-analyse → confirm "what changed?" | Recent-changes summary names the actual changed factor by label; analysis re-runs cleanly |
| 4 | Tell the assistant "no change, keep it as is" → confirm fast no-op | Returns in <2s; honest telemetry; no spurious mutation; no misleading "applied" copy |
| 5 | Multi-turn dialogue (analyse → explain → edit → re-analyse) | State persists; chips remain coherent; no debug-bundle false-negatives |

Pass = every scenario meets its criteria with NO regressions on prior
green scenarios. Any single fail blocks Phase 3 entry until the
relevant Phase 2 sub-PR is patched + re-smoked.

This gate is **separate from the manual-testing recommendation** — Olumi
smoke is the smallest scripted check that proves the journey is
coherent enough to invite broader manual testing.

---

## File-overlap sequencing summary

| File | Phase 1 | Phase 2a | Phase 2b | Phase 2c | Phase 2d | Phase 3 | Phase 4 |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **UI repo (DecisionGuideAI)** | | | | | | | |
| `src/components/debug/utils/exportBundle.ts` | ● | | | | | | |
| `src/canvas/conversation/utils/resolveElementLabel.ts` | | ● | | | | | |
| `src/canvas/conversation/useGraphEditEvents.ts` | | ● | | | | | |
| `src/canvas/conversation/zones/SuggestedChips.tsx` | | | ● | | | ● | |
| `src/canvas/conversation/useConversation.ts` | | ● | ● | possibly | | ● | ● |
| `src/canvas/components/CoachingCard.tsx` | | | | | | ● | |
| `src/canvas/stores/guidanceStore.ts` | | | | | | ● | |
| **Backend repo (olumi-assistants-service)** | | | | | | | |
| `src/orchestrator/tools/edit-graph.ts` | | ● | | | | | |
| `src/orchestrator-v5/handlers/edit-graph-fact-builder.ts` | | ● | | | | | |
| `src/orchestrator-v5/handlers/chip-click-dispatch.ts` | | | ● | | | | |
| `src/orchestrator/route-v2.ts` | | | ● | | | | |
| `src/orchestrator-v5/handlers/edit-graph-dispatch.ts` | | | | | ● | | |
| `src/orchestrator-v5/compose/output-safety.ts` | | | | likely | | possibly | |
| `src/orchestrator-v5/compose/forbidden-user-facing-phrases.ts` | | | | likely | | possibly | |
| **Removed in Phase 4** | | | | | | | |
| `src/canvas/conversation/turnService.ts` (V4) | | | | | | | ● |
| V4 mapper bypass paths | | | | | | | ● |

`useConversation.ts` is the shared UI spine — keep each phase's edits
narrow and well-commented so rebases stay clean.

`edit-graph-dispatch.ts` is the shared backend dispatcher — Phase 2a
adds a parameter to one call-site; Phase 2d extends preflight + log;
keep diffs orthogonal so the two sub-PRs can land independently.

### `useConversation.ts` ownership during Phases 2–3

**Working assumption (recorded 2026-05-13):** V5 phases own
`useConversation.ts` during Phases 2 and 3. The Analysis-tab workstream
consumes V5 contract artifacts (envelope shapes, `decision_review`
output, structured coaching blocks per
`v5-analysis-tab-data-contract-v1.md`) but does **not** modify
`useConversation.ts`. Analysis tab rendering reads from `useCanvasStore`
slices (`results.report`, the future `coachingStore`) and from
selector hooks (`useResultsSectionData`, the future
`useCoachingSectionData`), not from the V5 dispatcher.

**If this assumption is wrong**, surface immediately to define merge
order between V5 phases and Analysis-tab work. The risk is real because
both workstreams share `useConversation.ts` as a potential touch point
when the Analysis tab needs to participate in the conversation lifecycle
(e.g. a "this coaching item suggests an action — let me dispatch it"
flow). Phase 3A interaction-intent correction (correction #5: verify
intents against the live handler/action registry) is the boundary; if
intents flow back through `useConversation.ts`, Analysis-tab work and
V5 Phase 3 must coordinate the touch points.

**Until contradicted, V5 phases 2 and 3 proceed under this assumption.**

---

## Hard constraints (carried from the brief)

- No prompt edits.
- No CEE routing changes outside documented Phase 2/3/4 scope.
- No broad refactors.
- No package/lockfile churn.
- No `--no-verify`.
- No production pushes.
- Each phase (or sub-phase) lands as its own PR with its own gate.
- Tests must be additive — no weakening of existing assertions.
- Backend phases require a **fresh worktree** off
  `origin/staging` of `olumi-assistants-service`. The main checkout is
  currently dirty (modified `data/prompts.json`, untracked `.claude/`,
  `tools/edit-evaluator/`, `tools/graph-evaluator/fixtures/*`).

### Testing-gate principle (baseline-diff)

Do **not** rely on `--changed` tests alone. For every sub-PR:

1. Run **targeted tests** (the focused files the PR touches).
2. Run **`pnpm typecheck`** (or repo-specific equivalent).
3. Run **relevant full suites** (V5 suite in UI repo; CEE suite in
   backend; not just `--changed`).
4. Where possible, capture **full-vitest baseline-diff evidence**:
   record pre-PR failure count + names, record post-PR count + names,
   require zero NEW deterministic failures.
5. **The gate is "no new deterministic failures versus baseline"**,
   not "full suite green". The full suite has known baseline failures
   + OOM (see Open blockers) that pre-date this programme; those are
   tracked separately under Phase 4 methodology cleanup.

Every PR comment must state: "Targeted: <result>. Typecheck: <result>.
Relevant full suite: <result>. Baseline-diff: <new failures vs prior
HEAD>." A PR that cannot run the full suite locally must say so and
defer to CI for the baseline-diff comparison.

---

## Open blockers + recent decisions (2026-05-13)

### Recently shipped
- **PR #137 (V5 Results-panel hydration) — MERGED** at squash commit
  `21c6d1e22f34d0ea8c03e219ccb31ba4baa3afd4` on staging. Three review
  rounds + one self-review round addressed (round-3 fix:
  `report.results.{conservative,likely,optimistic}` no longer fabricate
  zeroes). 403 V5 tests pass + typecheck clean locally. Remote PR
  branch cleaned up after the post-merge `--delete-branch` skip.

### Open PRs (Phase 1 + Phase 2)
- **DGAI #138 — Phase 1 (debug exporter V5 awareness + visible-render proof).**
  Awaiting Codex review. Branch `claude/v5-phase1-debug-exporter`,
  base `origin/staging @ 21c6d1e2`. 132/132 exporter tests pass;
  908/908 Results tests pass; 403/403 V5 tests unchanged; typecheck
  clean; zero baseline-diff failures.
- **olumi-assistants-service #169 — Phase 2a (Step 3 label resolution).**
  PR open; **GitHub CI `Lint, TypeCheck, Unit Tests` job currently RED.**
  Local agent verification: targeted (12/12 + 60/60), integration
  (189/189), wider (825/825), zero regressions in baseline-diff;
  `tsc -p tsconfig.build.json --noEmit` clean. CI failures are
  pre-existing test-file typecheck noise per CLAUDE.md note —
  **explicit baseline-diff evidence must be added to PR description**
  before reviewer can call CI red as a merge blocker. Branch
  `claude/v5-step2a-step3-label-resolution`, base
  `origin/staging @ d60b90a2`. Reviewer findings to address before
  merge: (a) fix misleading pre/post comment at `edit-graph.ts:2701`
  (`buildAppliedChanges` is post-primary, pre-fallback; comment
  currently suggests pre-primary); (b) reconcile CI red with
  baseline-diff evidence; (c) the edge-label gap reclassified as
  Phase 2a.1 follow-up (see above).
- **olumi-assistants-service #170 — Phase 2b (chip-click router bypass).**
  PR open; **GitHub CI `Lint, TypeCheck, Unit Tests` job is baseline-red**
  (`tsc --noEmit` test-file noise per CLAUDE.md note). Round-2 reviewer
  findings ADDRESSED: (a) chip-generator post-analysis "Explain the
  result" + decide-fragile "What would make this flip?" chips converted
  to executable `action_type` chips at `chip-generator.ts:218-235` +
  `502-518`; (b) 2 new happy-path tests added in
  `chip-click-dispatch.test.ts` exercising `buildAnalysisFromPriorFacts`
  reconstruction and asserting handler receives hydrated
  `{analysisProjection, analysisFreshness:'fresh', analysisReady:'ready'}`;
  (c) baseline-diff evidence to be moved from comments into PR
  description (this tracker entry tracks the PR body update task);
  (d) stale `route-v2.ts:656` comment about no-new-dispatcher for
  `what_would_flip` corrected. Local verification: 13/13 unit
  (chip-click-dispatch) + 9/9 chip-click-dispatch-analysis-ready +
  3/3 new integration; full `tsc --noEmit`: 450 errors / 453 baseline
  (−3 net, ZERO new attributable); no package/lockfile churn. Branch
  `claude/v5-step2b-chip-click-bypass`.
- **DGAI #140 — Phase 2b UI chip whitelist + plural dispatch.**
  Companion to olumi-assistants-service#170. Branch
  `claude/v5-phase2b-ui-chip-whitelist`, base
  `origin/staging @ 21c6d1e2`. Extends `V5_ENABLED_ACTIONS` with
  `explain_results` + `what_would_flip` so the new executable chips
  emitted by the backend chip-generator are not silently filtered out
  by the V5 UI gate. Adds plural `explain_results: 'explain'` to
  `ACTION_TO_TURN_TYPE` so chip clicks resolve to a turn type even when
  the chip carries the backend-canonical plural action_type. 446/446
  V5 tests pass; build typecheck clean; zero baseline-diff failures;
  no package/lockfile churn. **Without this co-merge, the latency win
  is inert: the backend bypass exists but the chip-generator's new
  executable chips would be filtered out by the V5 UI's
  `V5_ENABLED_ACTIONS` check before they reach the dispatcher.**

### Phase 2b reviewer findings (2026-05-13) — round-2 status

Round-2 reviewer of PR #170 surfaced **two P1 gaps + one P2 stale-comment**
plus a follow-on P1 UI-side blocker; all four are now addressed (the
backend three on PR #170, the UI one on the new DGAI #140 companion):

1. ✅ **P1 ADDRESSED: "Explain the result" chip now emits executable
   `action_type`.** `src/orchestrator-v5/compose/chip-generator.ts:218-235`
   post-analysis "Explain the result" chip converted to executable
   `action_type: 'explain_results'` chip. Same conversion applied at
   `502-518` for the decide-fragile "What would make this flip?"
   prompt → `action_type: 'what_would_flip'`. The deterministic
   bypass is now reachable from the chip-click paths reviewers flagged.
2. ✅ **P1 ADDRESSED: Happy-path test coverage added.**
   `src/orchestrator-v5/handlers/__tests__/chip-click-dispatch.test.ts`
   adds 2 tests exercising prior-fact reconstruction via
   `buildAnalysisFromPriorFacts`; both assert handler receives hydrated
   `{analysisProjection, analysisFreshness:'fresh', analysisReady:'ready'}`
   from the chip-click path (one for `explain_results`, one for
   `what_would_flip`). `buildTurnContext` mock refactored to be
   hoisted so per-test overrides drive the reconstruction inputs.
3. ✅ **P2 ADDRESSED: Stale comment.**
   `src/orchestrator/route-v2.ts:656` "no new dispatcher" comment
   corrected to reflect the new dispatcher.
4. ✅ **P1 ADDRESSED (UI side, DGAI #140): UI chip whitelist gap.**
   Without a parallel UI change the backend's chip-emission fix is
   inert because the V5 UI's `V5_ENABLED_ACTIONS` filter in
   `src/canvas/conversation/zones/SuggestedChips.tsx` would drop the
   newly executable chips before they reach the dispatcher. DGAI #140
   extends `V5_ENABLED_ACTIONS` with `explain_results` and
   `what_would_flip` and adds plural `explain_results: 'explain'` to
   `ACTION_TO_TURN_TYPE` in `useConversation.ts` (the singular legacy
   alias was already mapped). 446/446 UI tests pass; build typecheck
   clean; zero baseline-diff failures.

### Phase 2b trade-off — DECISION NEEDED before merge

The brief's premise "ORIENT produces context the handlers don't use"
turned out to be **incorrect** for v0.9+. Both `explain_results` and
`what_would_flip` handlers DO consume ORIENT-populated fields
(`analysisProjection`, `analysisFreshness`, `analysisReady`,
`explanation.answer_text`).

**Agent's mitigation (currently in PR #170):**
- New `dispatchChipClickNoopExplanation` path pre-populates the
  ORIENT-consumed fields from local state — `prior_facts` (via
  `buildAnalysisFromPriorFacts`) and persisted-graph hash (via
  `deriveAnalysisFreshness` + `computeStructuralReadiness`).
- Handler falls back to **deterministic** `composeExplainResultsFallback`
  prose composer instead of Sonnet's per-turn `answer_text`.
- Latency win: ~12s saved per chip-click (the ORIENT Sonnet call is
  bypassed).
- **Quality trade-off:** the per-turn explanation is composed by the
  deterministic fallback (template-shaped), not by Sonnet on each
  chip click. Less context-sensitive, more predictable.

**Decision to make:**
- **(i) Ship as-is** (deterministic prose, fast). Phase 3 coaching
  layer would later reintroduce Sonnet-quality explanation via the
  structured coaching contract (which would also need to live on a
  cached `decision_review` invocation, not in the chip-click hot path).
- **(ii) Defer Phase 2b** until ORIENT-context handling is
  architecturally separated from chip-click latency (likely Phase 3
  scope expansion).
- **(iii) Ship Phase 2b but exclude `explain_results` /
  `what_would_flip` from the whitelist** (keeping only `run_analysis`),
  which negates the user-facing latency win.

Recommendation surfaced from this agent run: **(i) ship as-is**, with
the trade-off documented in the PR description and the deterministic
prose path treated as an interim until Phase 3 coaching ships with
proper per-chip-click context routing.

Trade-off transparency: documented in PR #170 dispatcher source JSDoc
and "Per-handler validation" section so future reviewers see it
explicitly.

### Operational corrections to my prior status claims
- ⚠️ **Full Test Suite is NOT clean.** Post-merge run on `21c6d1e2`
  showed `9 Test Files failed | 845 passed | 3 skipped` and `20 Tests
  failed | 12848 passed | 66 skipped` plus `ERR_WORKER_OUT_OF_MEMORY`.
  Compared to pre-merge `b5802b78`: `8 failed / 843 passed` files —
  i.e. ~+1 file delta consistent with flake / runner OOM, not a
  deterministic PR #137 regression. **Do not describe Full Test Suite
  as green** in any communication; baseline-failure state pre-dates
  Area 1, tracked separately under Phase 4 methodology cleanup.
- ⚠️ **Visible UI smoke for Area 1 is NOT independently verified.**
  Staging is live and serving the merged commit, but no automated
  visible-render assertion exists yet — that is **Phase 1 G1** of this
  tracker.

### Pending decisions — RESOLVED 2026-05-13
- ✅ **Phase 2 homework — decision_review invocation model**: **Option
  A (auto-invoke after every successful run_analysis) with guardrails**.
  Detailed in Phase 2 §"Phase 2 homework decision — RESOLVED" above.
  Removed from Phase 3 blocker list; now a Phase 3A constraint.
- ✅ **Coaching UX requirements §9 source**:
  `olumi-coaching-ux-requirements-v1.md`, §9.1–9.4. §9.1 + §9.2 are the
  Phase 3A acceptance standard; §9.3 + §9.4 are the Phase 3B acceptance
  standard. Removed from Phase 3 blocker list.
- ✅ **v5 Analysis-tab data contract source**:
  `v5-analysis-tab-data-contract-v1.md`. Treated as DRAFT-but-authoritative
  for Phase 3A; six adopted contract corrections recorded in Phase 3A
  scope above. Each future revision recorded in change log.
- ✅ **`useConversation.ts` ownership during Phases 2–3**: V5 owns it
  under the working assumption that Analysis-tab work consumes V5
  contract artifacts but does not modify the dispatcher. Surface
  immediately if assumption proves wrong.

### Cross-repo hygiene
- **Backend `olumi-assistants-service` main checkout is dirty**. Use a
  fresh worktree from `origin/staging` of `olumi-assistants-service`
  (current `staging` HEAD: `d60b90a2`).
- **Local malformed git ref `claude/v5-analysis-hydration 2`**: cleaned
  in round-3 review. No remaining space-suffixed refs.
- **macOS Finder duplicate-file artefacts** (` 2.ts`, ` 3.ts`, etc.):
  iCloud sync was actively duplicating files during PR #137 work.
  `.gitignore` rule pattern for `* [0-9].{ts,tsx,json}` to be added in
  Phase 4 methodology cleanup. Until then, scan for + delete duplicates
  before each commit.

### Phase 2a follow-up — edge-label sanitisation gap (Phase 2a.1, **manual-testing blocker**)

Reviewer-corrected classification (2026-05-13): this is **Phase 2a
follow-up**, NOT Phase 4 scientific cleanup. Edge edits are normal
graph edits in the core user journey; "the relevant factor" appearing
on edge updates is a Step 3 trust issue, not polish. **Broad manual
testing must exclude edge-edit Step 3 assertions until this is fixed.**

The Phase 2a backend agent surfaced this limitation while implementing
node-label preGraph threading (PR #169):

- `buildAppliedChanges` in `src/orchestrator/tools/edit-graph.ts` sets
  `change.label = op.path` for **edge operations** (e.g. `update_edge`,
  `remove_edge`). For an edge op the path is a slug like
  `fac_b::goal_y`. The V5 sanitiser tries to look this up as an entity
  ID, fails, and falls back to the `PREFIX_GENERIC` generic
  ("the relevant factor"). User copy for edge edits then reads "the
  relevant factor was updated" instead of "the link from B to Y was
  updated".
- Phase 2a correctly fixed the node-removal case (the user-visible
  primary symptom). Edge labels are a separate semantic-change problem:
  either `AppliedChangeItem.label` must carry a friendly representation
  (`"<fromLabel> → <toLabel>"`), or the sanitiser must learn to parse
  `from::to` patterns and look up both endpoints in `preGraph`.
- **Owner:** Phase 2a.1 follow-up PR, backend repo. Should land before
  the Olumi experience smoke gate is run (otherwise smoke scenarios
  that include edge edits will fail or have to be excluded).
- Test workaround on PR #169: the multi-op compound fixture uses
  `update_node` instead of `update_edge` to stay within Phase 2a
  scope. The exclusion is documented inline in the test comment.

### Live debug-bundle blindness (until Phase 1 G1)
Until Phase 1 lands, every V5 debug bundle reports
`win_probability_displayed: null` /
`win_probability_source: "unmatched"` regardless of actual UI render
state — because the exporter reads only `state.results.apiResponse.*`
(V4 / Comparison-mode only), never `state.results.report.*`. **Debug
bundles are NOT admissible evidence of UI failure for V5 turns until
Phase 1 ships.**

---

## Change log

- 2026-05-13 (late evening): **Post-reconciliation corrections.**
  decision_review invocation = Option A (auto-invoke with guardrails)
  recorded; UX §9 source = `olumi-coaching-ux-requirements-v1.md` §9.1–9.4
  recorded; **`v5-analysis-tab-data-contract-v1.md` adopted as Phase 3A
  hard constraint** (DRAFT, pending V5+Analysis-tab confirmation) with
  six corrections (target_refs, standard block metadata, Analysis-tab
  owns visual rendering, CEE emits freshness/status/reason, verify
  intents against handler/action registry, copy-length+fallback rules).
  Phase 3 split into **3A (minimum coaching contract)** and
  **3B (full coaching layer)**. Testing-gate principle clarified:
  baseline-diff (no NEW deterministic failures vs prior HEAD), not
  `--changed`-only or full-suite-green. **`useConversation.ts`
  ownership recorded** for Phases 2–3 (V5 owns under working
  assumption). Phase 2c reframed as **diagnosis-first** (no fix PR
  until leakage paths are mapped). Phase 2d sequencing recorded
  (after 2a/2b in flight; telemetry honesty before fast path).
- 2026-05-13 (evening): **V5 Completion Plan reconciliation pass.**
  Phases renumbered + reframed. Phase 2 expanded to four sub-PRs
  (2a labels, 2b chip-click bypass, 2c raw-value suppression, 2d
  no-op honesty); old Phase 3 (no-op handling) folded into Phase 2d
  as backend-primary, not UI-router. Phase 3 (was Phase 4) expanded
  from "chip/coaching coherence" to the full coaching layer
  (decision_review, draft_graph coaching outputs, coaching_state
  persistence, evidence-ranked coaching, structured response blocks,
  formatting, UX §9 acceptance). Phase 4 introduced as V4 retirement
  + scientific cleanup + methodology/audit. **Two distinct exit
  gates** — V5 product-experience gate (Phase 1 + 2 + replay + Olumi
  smoke) vs scientific-audit gate (ISL B3, PLoT B3, EVPI, flip-threshold,
  Phase 4). **Olumi experience smoke** added as the Phase 2 → Phase 3
  gate (3-5 scripted scenarios, binary pass/fail). **Phase 2 homework
  decision** added: decision_review invocation model (auto / lazy /
  progressive) — must be settled before Phase 3 brief is drafted.
  File-overlap matrix expanded to cover the 4 Phase-2 sub-PRs. Strong
  existing material (Phase 1 detail, Phase 2a/2b detail, parallel
  upstream surfaces, hard constraints, open blockers, manual-testing
  gate) preserved.
- 2026-05-13 (afternoon): PR #137 / V5 Results hydration MERGED at
  `21c6d1e2`; staging deployed; remote branch cleaned. Tracker reframed
  to position Phase 1 as the closure follow-up (debug exporter +
  visible-render verification). Phase 2 mandate strengthened:
  `sanitiseAffectedEntityLabel` MUST accept `preGraph` (mandatory).
  Operational corrections recorded: Full Test Suite baseline-failure
  state, visible-render verification still pending, backend repo
  hygiene for fresh-worktree requirement.
- 2026-05-13 (morning): Initial tracker created. Replaces the earlier
  "scientific fixes close-out" framing. ISL B3 fix implementation
  complete, awaiting push approval.
