# Brief v5-exclusive-ui — Close-out and Staging Walkthrough

Branch: `claude/v5-exclusive-ui`

Commits:
- `fffe7863` Phase 0 — schema v0.7.0 + outbound coverage table + vendored tarball
- `a0a7ff6c` Phases 2–6 — eligibility collapse + V4 fallback removal + V5 rendering
- `f9d294cd` Phase 3.5 — reviewer P0/P1 gaps (stage derivation, empty routing, cancel-on-new-send, unified guidance, V5 state application)
- `fbf13bb0` Phases 7–8 — grep gates + CI typecheck widening (V5 scope) + walkthrough + Playwright smoke + reviewer pass
- [this commit] Phase 8.5 — second reviewer pass (coverage claims corrected, parity contract test, smoke simplification, walkthrough with code-verified results)

Pre-conditions for staging walkthrough:
- `VITE_ENABLE_V5_ORCHESTRATOR=true` in the staging frontend env.
- Staging CEE running `@talchain/schemas@0.7.0` with `v5-handler-surface` commit. Verified independently: `olumi-assistants-service` package.json pins `file:./vendor/talchain-schemas-0.7.0.tgz` with SHA `3ce084fac7eaa5fdcdf02a35173253aec6a493744cf7e7e01eeb0364ffb45c16` (matches UI's vendored tarball bytes). `Docs/v5/v5-turn-shape-matrix.md` (2026-04-21) reports zero NEEDS_FIX rows.

---

## Scope and completion boundary

This brief delivers the **exclusive-path wire contract** and the **response rendering + state application scope** its plan defined. Three inline-render items remain explicitly deferred to follow-up work (see §"Deferred items"). Honest close-out:

- ✅ **Wire contract complete.** Every dispatched turn routes to `/orchestrate/v2/turn` with a v0.7.0 discriminated payload; V4 is dead code when the flag is on.
- ✅ **Response rendering complete.** `text_only`, `blocks`, `empty`, and `typed_error` all covered; graph_patch + analysis_result inline cards wired; explanation/comparison/flip_analysis + unsupported placeholder in place.
- ✅ **State application complete for the operations CEE emits today** (stage tracking, graph_patch set_factor_value, graph_patch adjust_edge_strength).
- ◐ **Decision review panel reads inline card, not the side panel.** `decisionReviewAdapter` validates the enrichment but the side-panel `DecisionReviewPanel` read-path from V5 responses is not wired. Side panel will show thin content or legacy state until a follow-up brief plumbs the enrichment through the panel hook.
- ◐ **`analysis_result` does not populate `useResultsStore`.** V5 analysis_result → V2RunResponse translator deferred (realistic CEE fixtures needed).
- ◐ **`graph_patch: add_constraint` not wired.** `applyV5State` surfaces `add_constraint_not_wired` in its deferred list.

## Coverage claim corrections (reviewer P0 items)

The reviewer flagged three overstatements in the prior close-out. Corrections:

- **"Every turn routes to V2"** → reality: every DISPATCHABLE turn routes to V2. Two local short-circuits preserve sensible UX without dispatching: (a) no scenario loaded (renders "please create or load a decision first" + no user bubble), (b) unsupported system event like `feedback_submitted` (CEE has no handler, would 422 — builder refuses and renders "this action isn't supported yet"). Both paths are deliberate. V4 had the same scenario requirement.
- **"All six system events working"** → reality: **3 of 6 V5 `SystemEventKind` values are emitted by the UI today** (`patch_accepted`, `patch_dismissed`, `direct_graph_edit`). The remaining three (`chip_click`, `undo`, `redo`) are in the v0.7.0 schema for CEE compatibility but have no UI emission site yet — they require new product flows (e.g. deciding whether UI undo should fire a system event to CEE or stay client-only). A follow-up UI product brief would wire them.
- **Schema ↔ UI parity locked by test.** `src/v5/__tests__/systemEventParity.test.ts` asserts that every UI `WireSystemEventType` reaches V5 exactly as the outbound coverage table documents, and that every V5 `SystemEventKind` is either UI-emitted or in a `knownDeferred` set with a product rationale. Drift on either side fails the test.

---

## Phase 7 grep gate results (code-verified ✅)

| Gate | Command | Result |
|------|---------|--------|
| 1 | `grep -rnE "fall_through_v4\|fallthrough.*v4\|v4.*fallback" src/` | ✅ 3 hits, all docstring references to the removal — no code |
| 2 | `grep -rnE "v1/turn/stream" src/` | ✅ 3 hits, all in V4-only files (turnService.ts, types.ts, flags.ts) |
| 3 | `grep -rnE "isV5Eligible\|V5EligibilityReason" src/` | ✅ Single live call site in useConversation.ts + definition + tests |
| 4 | `grep -rn "VITE_ENABLE_V5_ORCHESTRATOR" src/` | ✅ 3 live code sites (preempt check, V5 block, eligibility gate) |
| 5 | `grep -rn "talchain-schemas-0.5.1" package.json package-lock.json scripts/` | ✅ Zero |

## Phase 7 CI typecheck widening (partial ✅)

- `tsconfig.ci.json` now includes `src/v5/**/*.ts` and `src/v5/**/*.tsx`. Future V5 payload drift (missing `kind` discriminator, mismatched source, shape-level regressions) fails `npm run typecheck` at CI.
- Two pre-existing errors in `src/types` surfaced from V5's transitive imports and were fixed in-place (unused `review` parameter → `_review` in `getBlocksForIntent`; removed `override` modifier on `cause` in `ScenarioPersistenceError`).
- **useConversation.ts is NOT in the CI gate.** Adding it pulled in ~20 unrelated pre-existing V4 errors (TurnRequestPayload field access without narrowing, OrchestratorResponseEnvelopeV2 cast warnings, V4 SystemEventWire/WireSystemEvent mismatch) plus transitive errors in `src/lib/mappers/**`, `src/types/database.ts`, `src/utils/nodeIdNormalisation.ts`. Fixing these is a separate V4 type-debt effort outside this brief's scope. The V5 payload path is still protected by (a) `buildV5Payload` being in the CI gate, (b) `callV5Turn` accepting only `OrchestratorTurnPayload`, (c) the single V5 call site passing `build.payload` — no hand-constructed literals. The theoretical gap would open only if a future dev bypasses `buildV5Payload` at the call site; a code-review convention or grep-based lint would close it without widening the CI gate.
- Surgical V4 dead-code removal while in the vicinity: unused imports (`OrchestratorStreamEvent`, `logger`) and unused parameter (`nodeCount` → `_nodeCount`) cleaned up. Net improvement; reversible.

## Phase 8b — Test evidence (code-verified ✅)

| Layer | Test file | Count | Status |
|-------|-----------|-------|--------|
| Eligibility (flag-only) | `src/v5/__tests__/eligibility.test.ts` | 8 | ✅ |
| Adapter | `src/v5/__tests__/v5Adapter.test.ts` | 7 | ✅ |
| Response parser baseline | `src/v5/__tests__/responseParser.test.ts` | 5 | ✅ |
| Response parser fixtures | `src/v5/__tests__/responseParser.fixtures.test.ts` | 13 | ✅ |
| Router | `src/v5/__tests__/responseRouter.test.ts` | 8 | ✅ |
| End-to-end adapter→router | `src/v5/__tests__/end-to-end.test.ts` | 7 | ✅ |
| Payload builder (outbound coverage) | `src/v5/__tests__/buildPayload.test.ts` | 19 | ✅ |
| Stage mapping | `src/v5/__tests__/stageMapper.test.ts` | 18 | ✅ |
| Retryability + guidance + reason | `src/v5/__tests__/failureTypeRetryability.test.ts` | 23 | ✅ |
| TypedErrorRenderer | `src/v5/__tests__/TypedErrorRenderer.test.tsx` | 24 | ✅ |
| Block mapper | `src/v5/__tests__/mapV5Blocks.test.ts` | 11 | ✅ |
| Decision-review adapter | `src/v5/__tests__/decisionReviewAdapter.test.ts` | 10 | ✅ |
| State applicator | `src/v5/__tests__/applyV5State.test.ts` | 12 | ✅ |
| UI ↔ V5 parity contract (NEW) | `src/v5/__tests__/systemEventParity.test.ts` | 8 | ✅ |
| **Total V5 unit coverage** | | **173** | **✅** |
| Schema boundary (olumi-schemas v0.7.0) | `tests/boundary/` | 47 | ✅ |
| Network contract smoke (Playwright) | `e2e/smoke/v5-exclusive-routing.spec.ts` | 1 | see §Playwright |
| Wider conversation regression sample | `src/canvas/conversation/__tests__/` | 1293 pass, 1 skipped | ✅ |

## Phase 8c — Playwright smoke (code-verified ✅)

**File:** `e2e/smoke/v5-exclusive-routing.spec.ts` — 1 test, asserts ZERO V1 orchestrator hits during canvas bootstrap with V5 flag on. The absence assertion is deterministic regardless of whether bootstrap triggers V2 traffic.

**Known gap (reviewer improvement #1, deferred):** the smoke does not drive a scripted user journey (send message, chip click, retry, patch accept) so it cannot positively verify that V2 request bodies carry valid discriminated shapes under real traffic. A journey smoke requires either staging CEE access or a mocked CEE contract fixture — both larger efforts than this brief. Positive-path coverage is instead carried by the 173 unit tests (`buildPayload.test.ts`, `systemEventParity.test.ts`) which cover every documented outbound shape.

---

## Staging walkthrough — for the person running the flag-on verification

The following boxes are for a human running the canvas in a browser with `VITE_ENABLE_V5_ORCHESTRATOR=true` and staging CEE. Fill in observations or screenshots as evidence.

### Task 1 — Eligibility filter removed

- [ ] Submit a brief (free text) → Network tab shows `POST /bff/orchestrate/v2/turn` with `kind: 'message'`, `source: 'composer'`.
- [ ] Send a chip click → `source: 'chip_click'` or `'chip'`.
- [ ] Accept a patch → `kind: 'system_event'`, `event.kind: 'patch_accepted'`.
- [ ] Click Try again on a failed turn → `source: 'retry'`.
- [ ] After analysis completes, send a follow-up question → not blocked.
- [ ] Accept a second patch after analysis → not blocked.

### Task 3 — Non-streaming UX handling

- [ ] Hit Send → `ThinkingIndicator` appears immediately (no delay).
- [ ] During a slow response (>15s) → long-running hint appends elapsed seconds every 5s.
- [ ] Throttle network to trigger the 60s timeout → "This is taking longer than expected. Try again or rephrase your message." bubble + Try again chip.
- [ ] On normal response → `ThinkingIndicator` disappears and message renders with no flicker.
- [ ] Cancel-on-new-send: during an in-flight turn, submit a second message. Network tab shows the first request **aborted** (canceled status); second dispatches.

### Task 4 — V5 response rendering

- [ ] Free-text follow-up → message bubble with canonical text only.
- [ ] Run analysis → inline analysis card with summary, leading-option highlighted pill, win-probability pills.
- [ ] If `enrichment.decision_review` well-formed → NOTE: side panel may NOT reflect (deferred item). Inline card still renders.
- [ ] Patch edit → "Applied · Set factor value" card + canvas node observed value updates to match `after`.
- [ ] Retryable error (force UPSTREAM_TIMEOUT) → canonical text + Try again chip, no guidance line.
- [ ] Non-retryable error (force TURN_BUDGET_EXCEEDED) → canonical text + guidance line, no Try again chip.
- [ ] If `details.reason` present → reason layered beneath canonical text (not replacing it).
- [ ] System events → no user bubble appears.
- [ ] Chips render under message (max 2 per DS v5 §21.4).

### Task 6 — Design system alignment (code-verified ✅, visual audit below)

Code-verified:
- ✅ `grep -nE "bg-[a-z]+-(light|50|100|200)" src/v5/blocks/ src/v5/TypedErrorRenderer.tsx` → zero hits.
- ✅ `grep -nE "text-[a-z]+-(500|600|700)" src/v5/blocks/ src/v5/TypedErrorRenderer.tsx` → zero hits.
- ✅ All V5 cards use `rounded-xl border border-panel-border bg-panel`.
- ✅ All pills use `bg-transparent border border-{semantic}/30 text-text-body rounded-full px-2.5 py-0.5`.
- ✅ All typography uses `typography.panelHeader/panelBody/panelMeta`.

Visual audit (needs staging walkthrough):
- [ ] V5 analysis-result card alignment matches existing `SuggestionCard` / `CoachingCard` pattern.
- [ ] Error bubble uses DS v5 error surface.
- [ ] Try again chip: primary button style.
- [ ] Inter font + Lucide icons only, no emoji.

---

## Hard rules from brief §5 (code-verified ✅)

- ✅ No blank chat bubbles — empty `assistant_text` + no blocks routes to `kind: 'empty'` in `responseRouter.ts`; useConversation renders fallback + Try again chip. Chips-only responses also route to empty (fixed per P0 #5).
- ✅ No silent fallback to V4 — `V5FallThroughToV4` sentinel removed; `fall_through_v4` grep returns only docstring hits.
- ✅ No generic errors when structured reason is available — `FAILURE_USER_TEXT[code]` + layered `details.reason` + code-specific guidance for non-retryable, never a generic catch-all.
- ✅ Retryable vs non-retryable split — `isRetryable` classifier in `failureTypeRetryability.ts`, server disagreement surfaces via `checkRetryableAgreement` in DEV.
- ✅ Timeout bubble with retry — lifecycle helper in V5 block renders synthetic bubble + retry chip.

---

## Golden path journey (needs staging walkthrough)

### Hard blocker — graph does not appear from brief submission (CEE-side gap)

Submitting a brief through V5 currently produces a **text-only or conversational response**. The graph does not appear on the canvas after the turn. This is a hard gate for the golden path.

**Root cause analysis (UI-side verified):**

1. **No `add_node` / `add_edge` operations exist in v0.7.0 schema.** `GraphPatchBlock.operation` is an enum: `set_factor_value | add_constraint | adjust_edge_strength`. The schema cannot represent "create a new node" or "create a new edge" — only mutations to existing graph elements.
2. **CEE's draft_graph handler is missing from V5.** The "Submit brief" row in `ui-outbound-payload-coverage.md` is marked **NEEDS_FIX — CEE draft_graph handler missing in V5**.
3. **UI handling is correct for what the schema supports.** `applyV5State` applies all `graph_patch` operations correctly. `mapV5Blocks` maps every defined block type. Unknown blocks degrade to `v5_unsupported` with a DEV console.warn (not a crash).

**What must change on the CEE side before this works:**
- CEE must ship a V5 draft_graph handler that produces `graph_patch` blocks to build the initial graph, OR the schema must be bumped to add `add_node` / `add_edge` operations so CEE can emit them.
- Once CEE emits those operations, the UI `applyV5State` must be extended to call `addNode` / `addEdge` on the canvas store for those operation types.

**UI-side gap to fix when CEE is ready** (tracked in deferred items below): `applyV5State` handles `set_factor_value` and `adjust_edge_strength` but has no `add_node` / `add_edge` case. These will need to be added when CEE ships the corresponding schema operations.

### Journey checklist (current state)

- [ ] **BLOCKED** Submit a brief → graph appears on canvas. *(CEE draft_graph handler missing; schema has no add_node/add_edge operations)*
- [ ] Accept a suggested patch → system event handled → canvas updates. *(CEE handler NEEDS_FIX)*
- [x] Ask a follow-up → conversational response renders. *(Working)*
- [ ] Run analysis → analysis_result block renders. *(UI renders inline card; results store wiring deferred)*
- [ ] Decision review enrichment present OR typed error (not silent absence). *(Inline card; panel wiring deferred)*
- [x] Coaching text renders after FIRST_ANALYSIS_COMPLETE (client-side useCEECoaching). *(Client-side; no V5 dependency)*
- [x] Chips render + clickable → dispatch with correct `source`/`action_type`. *(Working)*
- [ ] Natural-language factor edit → `direct_graph_edit` system event → confirmation + canvas update. *(CEE handler NEEDS_FIX)*
- [x] No turn hits `/orchestrate/v1/turn/stream` or `/orchestrate/v1/turn` when `VITE_ENABLE_V5_ORCHESTRATOR=true`. *(Verified: routing fix in this brief)*
- [x] Structured CEE errors render specific message + reason, never generic fallback. *(Verified: `FAILURE_USER_TEXT[code]` + layered `details.reason` + code-specific guidance)*

---

## Deferred items (follow-up briefs)

1. **`analysis_result` → `useResultsStore`** — V5AnalysisResultBlock renders inline card; results store integration requires translator from V5 shape to V2RunResponse. Realistic CEE fixtures needed.
2. **`graph_patch: add_constraint`** — canonical constraint → `prior.range_min/range_max/threshold` mapping deferred.
3. **`applyV5State` add_node / add_edge** — when CEE ships add_node/add_edge schema operations, `applyV5State` must call `addNode` / `addEdge` on the canvas store. Not implementable until the schema bump lands.
4. **DecisionReviewPanel reading V5 enrichment** — adapter in place; panel hook wiring is a separate integration. Inline card covers primary user-facing case.
5. ✅ **Scenario auto-allocation** — shipped in commit `9e3f21f3`. Lazy UUID allocation on first V5 turn if `currentScenarioId` is absent or non-UUID; persisted to canvas store so subsequent turns reuse the same ID.
6. **UI emission sites for `chip_click`, `undo`, `redo` system events** — V5 schema supports them; UI product flow decisions pending.
7. **Journey-driven Playwright smoke** — current smoke asserts V1 absence during bootstrap. Journey coverage would positively verify V2 body shapes under real traffic.
8. **useConversation.ts in CI typecheck** — blocked by ~20 pre-existing V4 type-debt errors unrelated to V5; requires a dedicated V4 type-cleanup effort.

---

## Rollback procedure

Set `VITE_ENABLE_V5_ORCHESTRATOR=false` (or remove the env var) in the staging frontend config and redeploy. Every turn routes to V4 (`/orchestrate/v1/turn/stream` or `/orchestrate/v1/turn`) unchanged. On the CEE side, `CEE_PIPELINE_V4_ENABLED` must also toggle to `true` if V4 routes have been gated off server-side.

Verification after rollback: Network tab should show every turn hitting `/v1/turn` (or `/v1/turn/stream`) and zero hits to `/v2/turn`.
