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
 *      Other UI system events that V5 rejects (feedback_submitted) return null
 *      so callers can pre-filter.
 *
 * CEE contract: @talchain/schemas — the UI pins 0.15.0 (see package.json for
 * the authoritative version; CEE pins 0.16.0, and the pins can drift).
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
  | { ok: false; reason: 'missing_message' | 'unsupported_system_event'; detail?: string }

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

  // Publication gate (schema-derived, sanitise BEFORE source derivation):
  // CEE ingress validates action_type FAIL-CLOSED against ITS vendored enum,
  // so an unpublished value on the wire would 422 the whole turn. The gate
  // is derived from OUR vendored enum (sanitiseActionType → KNOWN_ACTION_TYPES
  // → ActionType.options): a mapped-but-unpublished value is withheld
  // entirely — no action_type key AND no chip_click promotion — so the turn
  // behaves exactly like today's identity-only chip until a schema re-vendor
  // lights the value up with zero code change here.
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
  // gate-passed (published) action_type; identity parameters always travel.
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
    // or are unsupported (feedback_submitted). Handle the analysis case here;
    // return unsupported for anything else.
    if (systemEvent.type === 'direct_analysis_run') {
      return buildDirectAnalysisRunMessage(input)
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
      const target_id = stringField(eventPayload, 'target_id')
      const operation = stringField(eventPayload, 'operation')
      if (!target_id || !operation) return null
      return { ...base, event: { kind: 'direct_graph_edit', target_id, operation } }
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
export const KNOWN_ACTION_TYPES: ReadonlySet<ActionTypeLiteral> = new Set<ActionTypeLiteral>(
  ActionType.options,
)

function sanitiseActionType(raw: string | undefined): ActionTypeLiteral | undefined {
  if (!raw) return undefined
  return (KNOWN_ACTION_TYPES as ReadonlySet<string>).has(raw)
    ? (raw as ActionTypeLiteral)
    : undefined
}
