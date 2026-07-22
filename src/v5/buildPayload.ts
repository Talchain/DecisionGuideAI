/**
 * V5 outbound payload builder.
 *
 * Single source of truth for converting a `sendTurn` invocation into an
 * `OrchestratorTurnPayload` v0.7.0 discriminated union.
 *
 * Hard rules (see docs/v5/ui-outbound-payload-coverage.md):
 *   1. `kind: 'system_event'` payloads MUST NOT render a user bubble. The
 *      dispatcher in useConversation enforces this at the bubble-render site;
 *      this module's only job is to shape the wire payload.
 *   2. `chip` sub-object is present ONLY when `source` is 'chip' | 'chip_click'.
 *   3. `retry_of` is present ONLY when `source === 'retry'`.
 *   4. `direct_analysis_run` SystemEvent from the UI (not in V5 SystemEventKind)
 *      is mapped to a `kind: 'message'` payload with `chip.action_type: 'run_analysis'`.
 *      UI system events with no wire member still return null so callers can
 *      pre-filter (unsupported_system_event).
 *
 * CEE contract: @talchain/schemas. The authoritative UI pin is the
 * `@talchain/schemas` dependency in package.json; CEE pins its own copy and
 * the two can drift. Deliberately not naming a version here — version-naming
 * comments rot (this one already had, twice).
 */

import type {
  OrchestratorTurnPayload,
  MessageTurnPayload,
  SystemEventTurnPayload,
  StageType,
  TurnClassType,
  TurnSourceLiteral,
  ActionTypeLiteral,
} from '@talchain/schemas/boundary'
import { ActionType } from '@talchain/schemas/boundary'

import type { SystemEvent } from '../canvas/conversation/types'

export interface BuildV5PayloadInput {
  turnId: string
  scenarioId: string
  stage: StageType
  turnClass: TurnClassType
  /** 'user' for chat text / chip clicks / retries; 'system' for UI-initiated events */
  mode: 'user' | 'system'
  /** Required when mode === 'user'. Ignored for system events. */
  message?: string
  /** sendTurn source string. Maps to TurnSource. */
  source?: string | undefined
  /** Chip metadata forwarded by chip click handlers. */
  chipMeta?: { action_type?: string; parameters?: Record<string, unknown> } | undefined
  /**
   * Prior client_turn_id being retried. Today's UI reuses the prior
   * client_turn_id as the new turn's `turn_id` for idempotent replay
   * (see useConversation.retryLast → sendTurn({retryClientTurnId})).
   * That path does NOT populate `retryOf` because `retry_of` would
   * equal `turn_id` and be redundant. The field is kept here for
   * future use if the retry flow ever switches to allocating a new
   * turn_id while referencing the prior one.
   */
  retryOf?: string | undefined
  /** Required when mode === 'system'. Internal SystemEvent shape. */
  systemEvent?: SystemEvent | undefined
}

export type BuildV5PayloadResult =
  | { ok: true; payload: OrchestratorTurnPayload }
  | {
      ok: false
      /**
       * `unencodable_graph_edit` (F6): a batch `direct_graph_edit` event whose
       * ids yield no encodable representative target. Distinct from
       * `unsupported_system_event` because it is RETRYABLE — the caller should
       * route it through the failed-event path, never drop it silently.
       */
      reason: 'missing_message' | 'unsupported_system_event' | 'unencodable_graph_edit'
      /** True when re-issuing the same action could succeed (F6 retryable path). */
      retryable?: boolean
      detail?: string
    }

/**
 * Convert a sendTurn invocation into the v0.7.0 wire payload.
 *
 * Returns `{ ok: false }` when the input cannot be safely serialised (e.g.
 * an unsupported system event that CEE would 422). Callers should surface
 * a typed error to the user rather than send a malformed request.
 */
export function buildV5Payload(input: BuildV5PayloadInput): BuildV5PayloadResult {
  const { turnId, scenarioId, stage, turnClass, mode } = input

  if (mode === 'system') {
    return buildSystemEventPayload(input)
  }

  const message = input.message ?? ''
  if (message.trim().length === 0) {
    return { ok: false, reason: 'missing_message' }
  }

  // Send gate (two independent signals, applied BEFORE source derivation):
  // CEE ingress validates action_type FAIL-CLOSED, so a value CEE does not
  // accept would 422 the whole turn. sanitiseActionType requires BOTH that the
  // value is published in OUR vendored enum (KNOWN_ACTION_TYPES) AND that CEE's
  // deployed service accepts it (CEE_ACCEPTED_ACTION_TYPES) — never our own
  // publication alone, which says nothing about whether CEE accepts it. A value
  // failing either signal is withheld entirely — no action_type key AND no
  // chip_click promotion — so the turn behaves exactly like today's
  // identity-only chip until the value is BOTH re-vendored and accepted.
  const wireActionType = sanitiseActionType(input.chipMeta?.action_type)

  // Derive source: chipMeta presence with a PUBLISHED action_type signals a
  // bound chip click regardless of what the caller labelled it. Keeps
  // downstream CEE routing accurate when the UI's sendChip path currently
  // passes source='chip' uniformly (see useConversation.dispatchAction).
  // Retry is always honoured over chip-derivation so retryLast() still hits
  // the retry branch on the CEE side.
  const rawSource = input.source
  const hasBoundAction = Boolean(wireActionType) || rawSource === 'chip_click'
  const effectiveSource =
    rawSource === 'retry'
      ? 'retry'
      : hasBoundAction
        ? 'chip_click'
        : input.chipMeta
          ? 'chip'
          : rawSource
  const source = normaliseMessageSource(effectiveSource)

  const base: MessageTurnPayload = {
    kind: 'message',
    turn_id: turnId,
    scenario_id: scenarioId,
    stage,
    turn_class: turnClass,
    message,
    source,
  }

  // Chip sub-object — only on chip / chip_click sources. Carries only the
  // gate-passed (published AND CEE-accepted) action_type; identity parameters
  // always travel.
  if ((source === 'chip' || source === 'chip_click') && input.chipMeta) {
    const parameters = input.chipMeta.parameters
    base.chip = {
      ...(wireActionType ? { action_type: wireActionType } : {}),
      ...(parameters ? { parameters } : {}),
    }
  }

  // retry_of — only on retry source and only when an explicit prior id is
  // provided. Current UI retry reuses the same client_turn_id and relies on
  // CEE idempotency, so retry_of is typically unset; wired defensively here
  // for future use without changing today's retry semantics.
  if (source === 'retry' && input.retryOf) {
    base.retry_of = input.retryOf
  }

  return { ok: true, payload: base }
}

function buildSystemEventPayload(input: BuildV5PayloadInput): BuildV5PayloadResult {
  const { turnId, scenarioId, stage, systemEvent } = input
  if (!systemEvent) {
    return { ok: false, reason: 'unsupported_system_event', detail: 'no systemEvent provided' }
  }

  const payload: SystemEventTurnPayload | null = systemEventToPayload({
    turnId,
    scenarioId,
    stage,
    systemEvent,
  })

  if (payload === null) {
    // Some UI SystemEvent types map to kind='message' (direct_analysis_run)
    // rather than a system_event, or have no wire member at all. Handle the
    // analysis case here; return unsupported for anything else.
    if (systemEvent.type === 'direct_analysis_run') {
      return buildDirectAnalysisRunMessage(input)
    }
    if (systemEvent.type === 'direct_graph_edit') {
      // F6: the direct_graph_edit adapter (systemEventToPayload, below) returns
      // null ONLY when a batch has no encodable representative target (e.g. all
      // changed-id lists empty). That is NOT "unsupported" — it is a RETRYABLE
      // failure. Surface it so the send leg routes it through the failed-event
      // path rather than dropping it silently or fabricating a target.
      return {
        ok: false,
        reason: 'unencodable_graph_edit',
        retryable: true,
        detail: 'direct_graph_edit batch had no encodable representative target (empty changed ids)',
      }
    }
    return {
      ok: false,
      reason: 'unsupported_system_event',
      detail: `type=${String(systemEvent.type)}`,
    }
  }

  return { ok: true, payload }
}

function systemEventToPayload(args: {
  turnId: string
  scenarioId: string
  stage: StageType
  systemEvent: SystemEvent
}): SystemEventTurnPayload | null {
  const { turnId, scenarioId, stage, systemEvent } = args
  const { type, payload: eventPayload } = systemEvent
  const base = { kind: 'system_event' as const, turn_id: turnId, scenario_id: scenarioId, stage }

  switch (type) {
    case 'patch_accepted': {
      const patch_id = stringField(eventPayload, 'patch_id')
      if (!patch_id) return null
      return { ...base, event: { kind: 'patch_accepted', patch_id } }
    }
    case 'patch_dismissed': {
      const patch_id = stringField(eventPayload, 'patch_id')
      if (!patch_id) return null
      return { ...base, event: { kind: 'patch_dismissed', patch_id } }
    }
    case 'direct_graph_edit': {
      const event = adaptDirectGraphEdit(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'feedback_submitted': {
      // F7 (feedback thumbs = wire): map the UI's optimistic thumbs event onto
      // the typed 0.22 `feedback` system event. The emitter
      // (ConversationPanel.handleFeedback) sends { turn_id, rating } for a
      // whole-turn rating, so target.kind is 'turn' and target.id is the turn
      // id. rating is fail-closed to the schema enum: anything but 'up'/'down',
      // or a missing turn id, returns null -> unsupported, never a wire 422.
      const rating = stringField(eventPayload, 'rating')
      const target_id = stringField(eventPayload, 'turn_id')
      if ((rating !== 'up' && rating !== 'down') || !target_id) return null
      return {
        ...base,
        event: { kind: 'feedback', rating, target: { id: target_id, kind: 'turn' } },
      }
    }
    // V5 schema includes chip_click, undo, redo — not currently emitted by
    // the UI as SystemEvent.type (no WireSystemEventType entries). Kept
    // here for forward compatibility: when the UI adds those event types,
    // their payload shape will slot in.
    default:
      return null
  }
}

function buildDirectAnalysisRunMessage(input: BuildV5PayloadInput): BuildV5PayloadResult {
  // UI's `direct_analysis_run` system event corresponds to V5's
  // `run_analysis` handler, which ingests a kind='message' turn with
  // chip.action_type='run_analysis'. See docs/v5/ui-outbound-payload-coverage.md
  // row "Explicit run-analysis button".
  const payload: MessageTurnPayload = {
    kind: 'message',
    turn_id: input.turnId,
    scenario_id: input.scenarioId,
    stage: input.stage,
    turn_class: input.turnClass,
    message: input.message && input.message.trim().length > 0 ? input.message : 'Run analysis',
    source: 'chip_click',
    chip: { action_type: 'run_analysis' },
  }
  return { ok: true, payload }
}

function normaliseMessageSource(source: string | undefined): TurnSourceLiteral {
  switch (source) {
    case 'chip':
      return 'chip'
    case 'chip_click':
      return 'chip_click'
    case 'retry':
      return 'retry'
    default:
      return 'composer'
  }
}

// Narrow an optional unknown field to a string, returning '' if absent/empty.
// Keep the branch explicit so nullish vs empty-string errors surface clearly.
function stringField(src: Record<string, unknown> | undefined, key: string): string {
  if (!src) return ''
  const val = src[key]
  return typeof val === 'string' && val.length > 0 ? val : ''
}

// Narrow an optional unknown field to an array of non-empty strings.
function stringArrayField(src: Record<string, unknown> | undefined, key: string): string[] {
  if (!src) return []
  const val = src[key]
  if (!Array.isArray(val)) return []
  return val.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

// The wire `direct_graph_edit` event (0.22), derived from the vendored schema
// so the shape here can never drift from what `OrchestratorTurnPayloadSchema`
// will accept.
type DirectGraphEditWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'direct_graph_edit' }
>

// `fields_changed` arrives from the real emitter (useGraphEditEvents.ts) as a
// MAP (element id → touched field names). The 0.22 wire types `fields_changed`
// as a flat string[] that "names the touched fields" — no id association.
// Flatten DETERMINISTICALLY: the sorted, de-duplicated UNION of every element's
// field names. Non-map / malformed input yields [].
function flattenFieldsChangedToNames(src: Record<string, unknown> | undefined): string[] {
  if (!src) return []
  const raw = src['fields_changed']
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return []
  const names = new Set<string>()
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    for (const field of value) {
      if (typeof field === 'string' && field.length > 0) names.add(field)
    }
  }
  return [...names].sort()
}

/**
 * F6 — batch `direct_graph_edit` → 0.22 wire adapter.
 *
 * The UI's REAL debounced emitter (src/canvas/conversation/useGraphEditEvents.ts,
 * the `sendSystemEvent({ type: 'direct_graph_edit', payload })` call) emits a
 * BATCH payload — `{ changed_node_ids, changed_edge_ids, operations,
 * fields_changed (a MAP), summary }` — and NO singular `target_id` / `operation`.
 * The vendored 0.22 `DirectGraphEditEvent` STILL REQUIRES the singular
 * `{ target_id, operation }` pair (back-compat for consumers on an older pin)
 * and accepts the batch fields ADDITIVELY, typing `fields_changed` as string[]
 * (not a map). Before this adapter the singular-only read returned null, the
 * turn was never built, and real batch edits were silently discarded.
 *
 * This adapter (a) derives a DETERMINISTIC representative singular pair and
 * (b) carries the additive batch fields, converting `fields_changed` map →
 * string[]. It returns null ONLY when no representative target is encodable
 * (empty ids); the caller turns that into a RETRYABLE failure. It NEVER
 * fabricates a target.
 *
 * Representative-choice rule (documented here because it cannot be read off the
 * wire shape alone, and MUST be deterministic):
 *   • target_id = an explicit `target_id` if the caller supplied one (a direct
 *     singular caller / back-compat), else the FIRST changed id in stable
 *     order — `changed_node_ids` (sorted ascending) take precedence over
 *     `changed_edge_ids` (sorted ascending). In words: "first changed node,
 *     else first changed edge".
 *   • operation = an explicit `operation` if supplied, else `operations[0]`
 *     (sorted ascending) — the batch's first operation verb. The wire batch
 *     carries only the SET of operations (no per-id map), so this describes the
 *     batch, not necessarily `target_id`'s own op. It is a stable representative.
 *
 * Ids and the `operations` array are sorted defensively so the wire output is a
 * pure function of the input SET, independent of the caller's array order.
 */
function adaptDirectGraphEdit(
  eventPayload: Record<string, unknown> | undefined,
): DirectGraphEditWireEvent | null {
  const changedNodeIds = [...stringArrayField(eventPayload, 'changed_node_ids')].sort()
  const changedEdgeIds = [...stringArrayField(eventPayload, 'changed_edge_ids')].sort()
  const operations = [...stringArrayField(eventPayload, 'operations')].sort()
  const fieldsChanged = flattenFieldsChangedToNames(eventPayload)
  const summary = stringField(eventPayload, 'summary')

  const explicitTarget = stringField(eventPayload, 'target_id')
  const explicitOperation = stringField(eventPayload, 'operation')

  const target_id = explicitTarget || changedNodeIds[0] || changedEdgeIds[0] || ''
  const operation = explicitOperation || operations[0] || ''

  // Unencodable: no representative target/operation (e.g. empty ids). Signal
  // null so the caller raises a RETRYABLE failure. NEVER fabricate a target.
  if (!target_id || !operation) return null

  const event: DirectGraphEditWireEvent = { kind: 'direct_graph_edit', target_id, operation }
  if (changedNodeIds.length > 0) event.changed_node_ids = changedNodeIds
  if (changedEdgeIds.length > 0) event.changed_edge_ids = changedEdgeIds
  if (operations.length > 0) event.operations = operations
  if (fieldsChanged.length > 0) event.fields_changed = fieldsChanged
  if (summary) event.summary = summary
  return event
}

// ActionType is a strict enum on the wire. If the UI passes an unknown
// action_type, we'd fail ingress; drop it to let CEE's classifier dispatch
// from message text alone.
//
// V-P0-2 fold, completed 2026-07-20: DERIVED from the vendored
// @talchain/schemas ActionType enum — the hand-copied list this replaced
// went 2 generations stale (7 members vs the enum's 9, silently stripping
// explain_results + explain_from_structure at the wire). The parity spec in
// explainChips.vocabulary.spec.ts stays as the guard against anyone
// reverting to a hand list.
//
// KNOWN_ACTION_TYPES answers ONE question: "is this value published in the
// enum WE vendored?" That is necessary but NOT sufficient to send — the send
// gate also requires CEE_ACCEPTED_ACTION_TYPES (below).
export const KNOWN_ACTION_TYPES: ReadonlySet<ActionTypeLiteral> = new Set<ActionTypeLiteral>(
  ActionType.options,
)

/**
 * CEE-acceptance registry — the SECOND, independent signal the send gate
 * requires. It answers a DIFFERENT question from KNOWN_ACTION_TYPES: not "did
 * WE publish this value?" but "does CEE's DEPLOYED service accept it at
 * ingress?"
 *
 * Why it exists (the whole point of the send gate): CEE ingress validates
 * action_type FAIL-CLOSED, so a value CEE does not accept 422s the whole turn.
 * The gate used to key on publication ALONE — but OUR publishing a value says
 * nothing about whether CEE accepts it, so a publication-only gate can only
 * ever be right by luck. The two facts are now DECOUPLED: a value is sent only
 * when BOTH hold (see isSendableActionType). A newly re-vendored value is
 * WITHHELD until it is added here with provenance — publication can never again
 * open the gate on its own.
 *
 * This is a DELIBERATE hand-maintained allowlist that CANNOT be derived from
 * our vendored enum (deriving it would re-couple the two facts and re-create
 * the defect). It is safe as a hand list because it fails CLOSED: a value
 * absent here is withheld (behaves like today's identity-only chip — never a
 * 422), never sent. Drift therefore over-blocks (a chip visibly fails to light
 * up), it can never leak a CEE-rejected value onto the wire. The element type
 * is ActionTypeLiteral, so an entry that is not (or no longer) in the vendored
 * enum is a COMPILE error — you cannot list an accepted value you have not
 * vendored (it would be inert), which keeps the registry honest.
 *
 * Provenance per value:
 * - run_analysis, set_factor_value, add_constraint, adjust_edge_strength,
 *   explain_result, explain_results, explain_from_structure, compare_options,
 *   what_would_flip: present in the vendored enum since <= 0.19.0 and permitted
 *   by the publication-only gate that preceded this registry. They have been
 *   live on the wire without an ingress 422 (explain_results + the singular
 *   legacy alias are the V-P0-2 chip vocabulary) — i.e. empirically
 *   CEE-accepted. Grandfathered here on that OBSERVED behaviour; they are the
 *   only values whose acceptance predates the registry.
 * - analysis_readiness: CEE #578 (their 0.20.0 re-vendor) MERGED and in the
 *   serving build lineage + A1 deploy confirmation 2026-07-20 ("CEE accepts
 *   analysis_readiness on the deployed service"). Accepted at INGRESS; sparks
 *   are currently claimed by CEE's process-meta branch (deterministic, safe),
 *   with a dedicated typed routing arm queued as a separate CEE build.
 *   Ingress-acceptance is exactly what the send gate needs — the typed arm is
 *   not required for the turn to be accepted rather than 422'd.
 * - what_changed: F2 CHANGE B (2026-07-22). The typed door for the "What
 *   changed?" pill (WhatChangedChip). Published half comes from the re-vendored
 *   @talchain/schemas 0.21.0 enum (KNOWN_ACTION_TYPES, derived); this accepted
 *   half is the hand-listed mirror. Accepting counterpart is CEE PR #620
 *   (feat/f2b-accept-what-changed) — DO NOT MERGE this UI change before #620 is
 *   merged + deploy-verified, or the send 422s the whole turn (CEE is
 *   fail-closed on the enum). See parallel-briefs/F2B-BYTE-CONFIRM §6 landing
 *   order.
 *
 * ⚠ DRIFT HAZARD (the dominant Olumi defect class): this list is a
 * HAND-MAINTAINED mirror of what CEE's deployed service accepts. It is
 * DELIBERATELY not derived from our vendored enum — there is no shared contract
 * artefact to derive CEE's *deployed acceptance* from today, and deriving it
 * from our own enum would re-couple the two facts and re-create the bug the send
 * gate exists to prevent (publication says nothing about CEE acceptance). It
 * fails CLOSED (a missing entry over-blocks: the chip visibly no-ops, never a
 * 422), so the risk is silent under-send, not a leak. Every new enum value MUST
 * be added here by hand with provenance, in lockstep with CEE deploy.
 */
export const CEE_ACCEPTED_ACTION_TYPES: ReadonlySet<ActionTypeLiteral> =
  new Set<ActionTypeLiteral>([
    'run_analysis',
    'set_factor_value',
    'add_constraint',
    'adjust_edge_strength',
    'explain_result',
    'explain_results',
    'explain_from_structure',
    'compare_options',
    'what_would_flip',
    'analysis_readiness',
    'what_changed',
  ])

/**
 * The send gate, factored out as a PURE predicate so a test can drive it with
 * SYNTHETIC registries and prove the AND actually bites — that publication
 * alone (or acceptance alone) can never open it. A value is sendable IFF it is
 * BOTH published in the vendored enum AND present in the CEE-acceptance
 * registry.
 */
export function isSendableActionType(
  raw: string,
  published: ReadonlySet<string>,
  accepted: ReadonlySet<string>,
): boolean {
  return published.has(raw) && accepted.has(raw)
}

function sanitiseActionType(raw: string | undefined): ActionTypeLiteral | undefined {
  if (!raw) return undefined
  return isSendableActionType(raw, KNOWN_ACTION_TYPES, CEE_ACCEPTED_ACTION_TYPES)
    ? (raw as ActionTypeLiteral)
    : undefined
}
