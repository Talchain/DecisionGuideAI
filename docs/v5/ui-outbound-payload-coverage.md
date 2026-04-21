# UI → CEE V5 outbound payload coverage

**Brief:** `v5-ui-exclusive-path` — Phase 0 deliverable
**Schema version:** `@talchain/schemas@0.7.0` (vendored at `vendor/talchain-schemas-0.7.0.tgz`)
**Author:** UI CC
**Date:** 2026-04-21
**Paired doc:** `olumi-assistants-service/Docs/v5/v5-turn-shape-matrix.md` (CEE-side handler coverage)

---

## Purpose

Canonical mapping from every UI-initiated action to its V5 wire payload. This is the contract the UI will emit once the V5 exclusive path lands. CEE CC must (a) consume `@talchain/schemas@0.7.0` and (b) implement handlers for every row marked **NEEDS_FIX** before the UI can resume the v5-exclusive-ui brief past Phase 0.

The schema is a discriminated union on `kind`:

- `kind: 'message'` — user-originated turn with free text. `source` tells CEE how the text got here.
- `kind: 'system_event'` — UI-initiated event with no free text. Never renders a user bubble.

Base fields on both: `turn_id` (UUID), `scenario_id` (UUID), `stage` (`frame` | `analyse` | `decide` | `review`).

---

## Hard rules

1. **System events never add a user bubble.** Enforced in `useConversation` via an explicit `if (payload.kind === 'system_event') skipUserBubble = true` check, NOT via the incidental `hidden` flag.
2. **`chip` field only when `source` is `chip` or `chip_click`.** Schema-level refinement (`superRefine`) rejects otherwise.
3. **`retry_of` only when `source` is `retry`.** Schema-level refinement rejects otherwise.
4. **Clean cutover — no legacy payload shape.** v0.6.0 flat payloads (no `kind`) are rejected by v0.7.0 schema. UI and CEE must migrate together.

---

## Coverage table

| UI action | `kind` | `source` / `event.kind` | Payload fields (besides base) | User bubble? | Expected response | CEE status |
|---|---|---|---|---|---|---|
| Submit brief (free text) | `message` | `source: 'composer'` | `message`, `turn_class: 'frame'`, `stage: 'frame'` | Yes | `text_only` or `blocks` (graph_patch for draft_graph) | **NEEDS_FIX** — CEE draft_graph handler missing in V5 |
| Free-text follow-up | `message` | `source: 'composer'` | `message`, `turn_class: 'frame' \| 'clarify'`, `stage` | Yes | `text_only` | **WORKING** |
| Run analysis (composer typed "run analysis") | `message` | `source: 'composer'` | `message`, `turn_class: 'frame'`, `stage: 'analyse'` | Yes | `blocks` (analysis_result) | **WORKING** |
| Run analysis (chip click) | `message` | `source: 'chip_click'` | `message`, `turn_class: 'frame'`, `stage: 'analyse'`, `chip: { action_type: 'run_analysis', parameters? }` | Yes (chip label) | `blocks` (analysis_result) | **WORKING** (via intent classifier) |
| Click suggestion chip (plain message, no action_type) | `message` | `source: 'chip'` | `message`, `turn_class`, `stage`, `chip: { parameters? }` (no `action_type`) | Yes | `text_only` | **WORKING** |
| Click chip with bound action (non-analysis) | `message` | `source: 'chip_click'` | `message`, `chip: { action_type, parameters? }` | Yes | `blocks` (graph_patch / explanation / comparison / flip_analysis) | **NEEDS_FIX** for `set_factor_value`, `add_constraint`, `adjust_edge_strength`, `explain_result`, `compare_options`, `what_would_flip` handlers |
| Retry failed turn | `message` | `source: 'retry'` | `message` (original text), `retry_of: <priorTurnId>`, `turn_class`, `stage` | No (existing bubble re-used) | depends on original turn | **WORKING** (no special CEE logic needed; just a resend) |
| Accept suggested patch | `system_event` | `event.kind: 'patch_accepted'` | `event: { kind, patch_id }` | **No** (hard rule) | `text_only` ack or empty | **NEEDS_FIX** in CEE |
| Dismiss suggested patch | `system_event` | `event.kind: 'patch_dismissed'` | `event: { kind, patch_id }` | **No** (hard rule) | `text_only` ack or empty | **NEEDS_FIX** in CEE |
| Natural-language factor edit (confirm) | `system_event` | `event.kind: 'direct_graph_edit'` | `event: { kind, target_id, operation }` | **No** (hard rule) | `text_only` ack | **NEEDS_FIX** in CEE |
| Chip click as event (if UI needs to log without message) | `system_event` | `event.kind: 'chip_click'` | `event: { kind, chip_id }` | **No** (hard rule) | ack | **NEEDS_FIX** in CEE |
| Undo (keyboard / button) | `system_event` | `event.kind: 'undo'` | `event: { kind }` | **No** (hard rule) | ack | **NEEDS_FIX** in CEE |
| Redo (keyboard / button) | `system_event` | `event.kind: 'redo'` | `event: { kind }` | **No** (hard rule) | ack | **NEEDS_FIX** in CEE |

---

## Stage and turn_class values by action

`stage` is the current UI stage when the turn is dispatched. Derived from [`useStagePill`](../../src/canvas/hooks/useStagePill.ts) or an equivalent predicate:

- No graph yet → `stage: 'frame'`.
- Graph but analysis not run → `stage: 'frame'` (pre-analysis) or `'analyse'` when the user explicitly triggers analysis.
- Analysis complete → `stage: 'decide'` or `'review'` based on downstream UI state.

`turn_class` on `message` payloads: UI defaults to `'frame'` for `composer` source. CEE's Sonnet classifier then makes the real dispatch decision via intent_class (`converse` / `execute` / `clarify` / `coach`) — the payload's `turn_class` is advisory only in A2. See `olumi-assistants-service/src/orchestrator-v5/turn-executor.ts:979-1003`.

UI **should not** emit `turn_class: 'propose' | 'decide' | 'review'` today; per `olumi-assistants-service/src/orchestrator-v5/types.ts:44-46` these are placeholders that yield `UnhandledTurnClassError` → UNHANDLED → P0 alert.

---

## Expected response shapes

All responses are validated against `OlumiResponseSchema` (v0.7.0 — unchanged from v0.6.0 on response side).

- **`text_only`**: non-empty `assistant_text`, no non-error blocks.
- **`blocks`**: non-empty `blocks` array with kinds from `{ text | analysis_result | graph_patch | explanation | comparison | flip_analysis }`.
- **Error block at position 0**: typed error — see [BoundaryError](../../node_modules/@talchain/schemas/dist/boundary/errors.d.ts).
- **Typed error response (non-2xx body)**: parsed as `BoundaryError`, which carries top-level `retryable: boolean`. UI classifies retryability client-side via `src/v5/failureTypeRetryability.ts` (to be added in Phase 4) and issues a dev-only `console.warn` if the server `retryable` flag disagrees with the client classification.

CEE-emitted blocks today: `text`, `error`, `analysis_result`, `graph_patch`. The UI will implement full renderers for `analysis_result` and `graph_patch` in Phase 5; `explanation`, `comparison`, `flip_analysis` get an unsupported-block placeholder until CEE starts emitting them.

---

## Enrichment fields inside `analysis_result.enrichment`

The UI reads these keys (if present) from `blocks[].enrichment`:

- `decision_review` — object consumed by [`DecisionReviewPanel`](../../src/canvas/components/DecisionReviewPanel.tsx) via a light adapter in `src/v5/decisionReviewAdapter.ts` (Phase 5). Shape mirrors `CeeDecisionReviewPayloadV1`; validation via zod; falls back to summary-only card on malformed enrichment.
- `coaching_signal_id` — read but not acted on in this brief. Logged at DEV `console.info`. Client-side coaching via `useCEECoaching()` remains authoritative until a future slice hoists this to the response root.

---

## What changed vs v0.6.0

**Breaking:**

- Added required `kind: 'message' | 'system_event'` discriminator on turn payloads. v0.6.0 flat payloads are rejected.
- `MessageTurnPayload` now requires `source`. v0.6.0 callers that sent `{turn_id, scenario_id, message, turn_class, stage}` must add `kind: 'message'` and `source: 'composer' | 'chip' | 'chip_click' | 'retry'`.

**Additive:**

- `SystemEventTurnPayload` variant — new code path for system events.
- `SystemEventKind` enum: `patch_accepted | patch_dismissed | direct_graph_edit | chip_click | undo | redo`.
- `TurnSource` enum: `composer | chip | chip_click | retry`.
- Optional `chip.parameters: Record<string, unknown>` and `chip.action_type: ActionType`.
- Optional `retry_of: Uuid` on message payloads.
- Cross-field refinements: `chip` requires chip source, `retry_of` requires retry source.

**Response-side:** no changes. `OlumiResponseSchema`, `BoundaryErrorSchema`, all block schemas unchanged from v0.6.0. `BoundaryError.retryable` stays top-level.

---

## UI implementation map (Phases 2–7, deferred)

| UI file | Phase | Consumes |
|---|---|---|
| `src/v5/buildPayload.ts` (NEW) | 3 | `MessageTurnPayloadSchema`, `SystemEventTurnPayloadSchema`, `TurnSource`, `SystemEventKind` |
| `src/v5/v5Adapter.ts` | 3 | `OrchestratorTurnPayload` discriminated type |
| `src/canvas/conversation/useConversation.ts` | 3 | calls `buildPayload` + `callV5Turn` with new shapes |
| `src/v5/failureTypeRetryability.ts` (NEW) | 4 | `FailureTypeLiteral`, `BoundaryError.retryable` |
| `src/v5/decisionReviewAdapter.ts` (NEW) | 5 | `OlumiResponse.blocks[].enrichment.decision_review` |
| `src/v5/blocks/mapV5Blocks.ts` (NEW) | 5 | `OlumiResponse.blocks[]` block union |

---

## Halt point

This coverage table is the Phase 0 deliverable. Before the UI proceeds to Phase 2+:

1. CEE CC must bump `olumi-assistants-service` to `@talchain/schemas@0.7.0` and update the V2 ingress validator.
2. CEE CC must implement handlers for every **NEEDS_FIX** row — at minimum `patch_accepted`, `patch_dismissed`, `direct_graph_edit`, and the draft_graph / edit_graph flows the UI needs for the golden path (brief §4).
3. CEE CC updates `Docs/v5/v5-turn-shape-matrix.md` with WORKING status.

Once those three are confirmed, UI resumes Phase 2.
