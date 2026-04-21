# Brief v5-exclusive-ui — Staging Walkthrough

Branch: `claude/v5-exclusive-ui`
Commits:
- `fffe7863` Phase 0 — schema v0.7.0 + outbound coverage table
- `a0a7ff6c` Phases 2–6 — eligibility collapse + V4 fallback removal + V5 rendering
- `f9d294cd` Phase 3.5 — reviewer P0/P1 gaps (stage derivation, empty routing, cancel-on-new-send, unified guidance, V5 state application)
- [this commit] Phase 7–8 — grep gates + CI typecheck widening + walkthrough + Playwright smoke

Pre-conditions:
- `VITE_ENABLE_V5_ORCHESTRATOR=true` in the staging frontend env.
- Staging CEE running `@talchain/schemas@0.7.0` with `v5-handler-surface` commit (system-event dispatcher + draft_graph + edit_graph + run_analysis chip click all WORKING per `olumi-assistants-service/Docs/v5/v5-turn-shape-matrix.md` as of 2026-04-21).
- Dev build: `VITE_ENABLE_V5_ORCHESTRATOR=true npm run dev`.

---

## Phase 7 Grep Gate Summary

| Gate | Description | Result |
|------|-------------|--------|
| 1 | `fall_through_v4` code references | ✅ Zero code hits; only docstring references to the removal |
| 2 | `v1/turn/stream` reachable from V5-on path | ✅ Three hits (turnService.ts, types.ts, flags.ts) all in V4-only code |
| 3 | `isV5Eligible` / `V5EligibilityReason` usage | ✅ One call site in useConversation; flag-only semantics |
| 4 | `VITE_ENABLE_V5_ORCHESTRATOR` code references | ✅ Three live sites (preempt check, V5 block, eligibility gate) |
| 5 | `talchain-schemas-0.5.1` refs in package/scripts | ✅ Zero — only unrelated third-party deps at that version |

## Phase 7 CI typecheck widening

`tsconfig.ci.json` now includes `src/v5/**/*.ts` and `src/v5/**/*.tsx`. Future V5 payload drift (e.g. constructing a `kind: 'message'` payload without `source`) fails `npm run typecheck` instead of slipping through to deploy.

Two pre-existing errors surfaced from transitive imports and were fixed in-place:
- `src/types/cee.ts:191` — unused `review` parameter in `getBlocksForIntent` renamed to `_review`.
- `src/types/scenario.ts:140` — removed `override` modifier on `cause` that didn't match the target's `Error` base class declaration.

---

## Acceptance Checklist

### Task 1 — Eligibility filter removed

- [ ] With `VITE_ENABLE_V5_ORCHESTRATOR=true`:
  - [ ] Submit a brief (free text) → Network tab shows `POST /bff/orchestrate/v2/turn` with `kind: 'message'`, `source: 'composer'`.
  - [ ] Send a chip click (e.g. "Run analysis" or a suggestion) → same endpoint, `source: 'chip_click'` or `'chip'`.
  - [ ] Accept a patch (system event) → same endpoint, `kind: 'system_event'`, `event.kind: 'patch_accepted'`.
  - [ ] Click Try again on a failed turn → same endpoint, `source: 'retry'`.
  - [ ] After analysis completes, send a follow-up question → same endpoint, NOT blocked by eligibility gate.
  - [ ] Accept a second patch after analysis → same endpoint.
- [ ] Grep verification: `grep -rn "chip_metadata\|turn_type_hint\|analysis_ran\|prior_tool_calls" src/v5/eligibility.ts` returns zero.

### Task 2 — V4 fallback removed

- [ ] `grep -rn "fall_through_v4\|fallthrough.*v4" src/` returns only the three commentary references (documentation of removal).
- [ ] Force an error from CEE (e.g. simulate 500): UI renders the typed-error bubble directly; no silent fallback to V4.
- [ ] `v5Adapter.ts` no longer exports `V5FallThroughToV4`; `V5CallResult = V5ParseResult`.

### Task 3 — Non-streaming UX handling

**Loading state:**
- [ ] Hit Send → `ThinkingIndicator` shape-wave animation appears IMMEDIATELY (no delay).
- [ ] During a slow response (>15s), the long-running hint appends elapsed seconds every 5s.

**Timeout:**
- [ ] Throttle network to simulate CEE taking >60s: after timeout, an assistant bubble appears with "This is taking longer than expected. Try again or rephrase your message." and a primary **Try again** chip.
- [ ] No blank chat bubble — the timeout bubble replaces the pending state cleanly.

**Completion:**
- [ ] On response arrival, the `ThinkingIndicator` disappears and the message renders in the same frame — no flicker.

**Cancellation (cancel-on-new-send, Phase 3.5 P1 #1):**
- [ ] During an in-flight V5 turn, type and submit a second message. Confirm in Network tab that the first request is **aborted** (shows "canceled" status); the second dispatches.
- [ ] Retry and system-event callers still queue as before — they do not preempt an active user turn.

### Task 4 — V5 response rendering

**Conversation turns (text_only):**
- [ ] Free-text follow-up returns `assistant_text` only → message bubble renders the text; no blocks.
- [ ] Typography: Inter font, standard chat-bubble styling per DS v5.

**Analysis results (`analysis_result` block):**
- [ ] Run analysis → response has `blocks: [{type: 'analysis_result', summary, leading_option_id, win_probabilities, enrichment}]`.
- [ ] Inline card renders with the canonical summary, leader-option highlighted pill, and win-probability pills for each option.
- [ ] When `enrichment.decision_review` is well-formed, the `DecisionReviewPanel` in the side panel reflects the payload (NOTE: Phase 5 wired the `decisionReviewAdapter`; the panel read-path is a separate integration. If the panel doesn't reflect the enrichment, mark as NEEDS_FIX for a follow-up brief — it's a known deferred item).

**Action turns with confirmation (`graph_patch` block):**
- [ ] Accept a factor value edit via chip or natural-language command → response has `graph_patch` with `status: 'applied'`, `operation: 'set_factor_value'`, `target_id`, `before`, `after`.
- [ ] Inline card renders as "Applied · Set factor value" with target + diff.
- [ ] Canvas graph also updates — the node's observed value reflects `after` (Phase 3.5 P0 #2 `applyV5State` wiring).

**Typed errors:**
- [ ] Retryable error (e.g. `UPSTREAM_TIMEOUT`): bubble shows canonical text + **Try again** chip. No generic guidance line.
- [ ] Non-retryable error (e.g. `TURN_BUDGET_EXCEEDED`): bubble shows canonical text + guidance line ("This session has reached its turn limit..."). **No Try again chip.**
- [ ] If `BoundaryError.details.reason` is present: reason text appears layered beneath canonical text (does not replace it).
- [ ] Never a generic "Something went wrong" when a structured reason is available.

**System events:**
- [ ] Accept / dismiss patch → hit `/bff/orchestrate/v2/turn` with `kind: 'system_event'`; **no user bubble appears** (hard rule — Phase 3 outbound coverage table).
- [ ] Natural-language factor edit (`direct_graph_edit`) → same; hard rule no-bubble.

**Coaching signals:**
- [ ] After FIRST_ANALYSIS_COMPLETE, coaching text renders via existing client-side `useCEECoaching()` (Q2 locked scope — server coaching_signal_id is DEV-logged only for this brief).

**Chips / suggested actions:**
- [ ] Response with `suggested_actions` → chips render under the message (max 2 per DS v5 §21.4).
- [ ] Clicking a chip with `action_type='run_analysis'` re-dispatches as `source: 'chip_click'` with `chip.action_type: 'run_analysis'` on the wire.

### Task 5 — Dead V4 code removed from V5-enabled path

- [ ] V5 block in `useConversation.ts` does NOT reference `callOrchestratorTurn`, `streamOrchestratorTurn`, or `buildRequest` (V4 builders).
- [ ] V5 block does NOT contain a fall-through branch to V4.
- [ ] V4 block in same file is gated behind flag-off; when flag is on it is unreachable dead code (kept for rollback).

### Task 6 — Design system alignment

Code-level audit (automated):
- [ ] `grep -nE "bg-[a-z]+-(light|50|100|200)" src/v5/blocks/ src/v5/TypedErrorRenderer.tsx` → zero hits.
- [ ] `grep -nE "text-[a-z]+-(500|600|700)" src/v5/blocks/ src/v5/TypedErrorRenderer.tsx` → zero hits.
- [ ] All V5 cards use `rounded-xl border border-panel-border bg-panel`.
- [ ] All pills use `bg-transparent border border-{semantic}/30 text-text-body rounded-full px-2.5 py-0.5`.
- [ ] All typography uses `typography.panelHeader/panelBody/panelMeta` tokens.

Visual audit:
- [ ] V5 analysis-result card alignment matches existing `SuggestionCard` / `CoachingCard` pattern.
- [ ] V5 graph-patch card status pill uses semantic colour (success/text-light).
- [ ] Error bubble uses DS v5 error surface — no forbidden bg-danger-light.
- [ ] Try again chip: primary button style (`bg-primary text-text-on-color`).
- [ ] Inter font throughout. Lucide icons only. No emoji.

---

## Hard rules from brief §5

- [ ] No blank chat bubbles (empty `assistant_text` + no blocks renders "No response received" with Try again chip — Phase 3 empty-response guard in `responseRouter.ts`).
- [ ] No silent fallback to V4 (V5 block has no fall_through; error states render typed errors in place).
- [ ] No generic error messages when structured reason is available (canonical FAILURE_USER_TEXT + optional server reason + optional guidance, never a generic catch-all).
- [ ] Retryable errors show Try again chip; non-retryable show code-specific guidance.
- [ ] Timeout shows clear message with retry (not a frozen UI).

---

## Golden path journey (brief §4)

Run the full journey with flag on and staging CEE:

1. [ ] Submit a brief in frame stage → `draft_graph` fires → graph appears on canvas.
2. [ ] Accept a suggested patch → system event handled → canvas updates (applyV5State forwards set_factor_value / adjust_edge_strength mutations).
3. [ ] Ask a follow-up question → conversational response renders.
4. [ ] Run analysis (chip click) → `analysis_result` block renders inline + (if enrichment contains decision_review) side panel reflects review.
5. [ ] Decision review enrichment present OR typed error (not silent absence).
6. [ ] Coaching text renders after FIRST_ANALYSIS_COMPLETE signal (via client-side useCEECoaching).
7. [ ] Chips render and are clickable; clicks dispatch with correct source/action_type.
8. [ ] Edit a factor via natural language → `direct_graph_edit` system event → confirmation bubble + canvas update.
9. [ ] No turn in the journey hits `/orchestrate/v1/turn/stream` or `/orchestrate/v1/turn`. Verified by Playwright smoke at `e2e/smoke/v5-exclusive-routing.spec.ts`.

---

## Test evidence summary

| Layer | Test file | Count | Status |
|-------|-----------|-------|--------|
| Eligibility (flag-only) | `src/v5/__tests__/eligibility.test.ts` | 8 | ✅ |
| Adapter | `src/v5/__tests__/v5Adapter.test.ts` | 7 | ✅ |
| Response parser baseline | `src/v5/__tests__/responseParser.test.ts` | 5 | ✅ |
| Response parser fixtures (realistic CEE shapes) | `src/v5/__tests__/responseParser.fixtures.test.ts` | 13 | ✅ |
| Router | `src/v5/__tests__/responseRouter.test.ts` | 8 | ✅ |
| End-to-end adapter→router | `src/v5/__tests__/end-to-end.test.ts` | 7 | ✅ |
| Payload builder (outbound coverage) | `src/v5/__tests__/buildPayload.test.ts` | 19 | ✅ |
| Stage mapping | `src/v5/__tests__/stageMapper.test.ts` | 18 | ✅ |
| Retryability + guidance + reason | `src/v5/__tests__/failureTypeRetryability.test.ts` | 23 | ✅ |
| TypedErrorRenderer | `src/v5/__tests__/TypedErrorRenderer.test.tsx` | 24 | ✅ |
| Block mapper | `src/v5/__tests__/mapV5Blocks.test.ts` | 11 | ✅ |
| Decision-review adapter | `src/v5/__tests__/decisionReviewAdapter.test.ts` | 10 | ✅ |
| State applicator | `src/v5/__tests__/applyV5State.test.ts` | 12 | ✅ |
| **Total V5 unit coverage** | | **165** | **✅** |
| Schema (olumi-schemas boundary) | `tests/boundary/` (v0.7.0 branch) | 47 | ✅ |
| Network contract smoke (Playwright) | `e2e/smoke/v5-exclusive-routing.spec.ts` | 1 | see §Playwright |

---

## Playwright smoke — Network contract gate

`e2e/smoke/v5-exclusive-routing.spec.ts` runs with `VITE_ENABLE_V5_ORCHESTRATOR=true` and captures every request URL during a scripted journey. Final assertion: **zero hits to `/orchestrate/v1/turn` or `/orchestrate/v1/turn/stream`**; every orchestrator hit goes to `/orchestrate/v2/turn`.

Run: `npm run e2e:smoke`.

The smoke is the canonical "no V4 leakage" gate — green smoke means no code path in the V5-on journey reaches V4, independent of grep gates.

---

## Known deferred items (tracked for a follow-up brief)

1. **`analysis_result` → `useResultsStore` population** — `applyV5State` surfaces `analysis_result_results_store_not_wired` in its deferred list. V5AnalysisResultBlock renders inline card; results store integration requires translator from V5 shape to V2RunResponse. Fixtures needed.
2. **`add_constraint` graph_patch operation** — `applyV5State` surfaces `add_constraint_not_wired`. Constraints live on goal node prior fields in the canvas store; canonical constraint → `prior.range_min/range_max/threshold` mapping deferred.
3. **Scenario auto-allocation on missing scenario** — V5 block short-circuits with a user-friendly message. V4 has implicit scenario allocation; matching V5 to that behaviour is out of this brief's scope.
4. **Decision review side panel** — `decisionReviewAdapter` is in place; the DecisionReviewPanel read-path from V5 responses is a separate integration. If the panel doesn't reflect enrichment during §Task 4 analysis-result verification, this is a known gap.

---

## Rollback procedure

Set `VITE_ENABLE_V5_ORCHESTRATOR=false` (or remove the env var) in the staging frontend config and redeploy. Every turn routes to V4 (`/orchestrate/v1/turn/stream` or `/orchestrate/v1/turn`) unchanged. The CEE `CEE_PIPELINE_V4_ENABLED` flag also needs to be toggled to `true` if V4 routes have been gated off server-side.

Verification after rollback: Network tab should show every turn hitting `/v1/turn` (or `/v1/turn/stream`) and zero hits to `/v2/turn`.
