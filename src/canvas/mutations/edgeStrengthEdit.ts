/**
 * edgeStrengthEdit — the UI half of the DURABLE link-strength write
 * (schemas 0.42.0, `edge_strength_edit`).
 *
 * THE DEFECT THIS CLOSES. `EdgePanel` ships three strength affordances — the
 * signed slider, the band presets and "confirm current strength" — and all
 * three land in `useEdgeMutations.setStrength`, which did ONE local
 * `updateEdge` and emitted nothing. There is no back door: client autosave is
 * `localStorage`, and the client's `scenarios` writes touch `framing`,
 * `analysis_status`, `title`, `is_pinned` and `is_archived` — never `graph`.
 * So the user moved a slider, watched it move, and the model never heard. A lie
 * told by omission, and the same class CEE named for the add path.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THIS EVENT HAS NO `base_graph_hash`, AND THAT IS THE CONTRACT'S DECISION
 * RATHER THAN AN OMISSION TO CORRECT BY SYMMETRY WITH THE STRUCTURAL MEMBERS.
 *
 * `structural_add` / `structural_rename` / `structural_delete` each carry a
 * non-optional `base_graph_hash`. `edge_strength_edit` carries NONE — its
 * stale gate is `expected`, which the contract calls "an optimistic-concurrency
 * assertion, not the requested value". Every member of this union is
 * `.strict()`, so attaching a `base_graph_hash` here would not be belt-and-
 * braces: it would fail ingress and lose the WHOLE TURN (422).
 *
 * ⭐ The consequence is a MATERIALLY SMALLER MODULE than `structuralRename.ts`,
 * and the reason is worth stating so nobody "restores" the missing machinery.
 * That module needs a deferral queue, a drain host and a `resolve…Base` step
 * ONLY because `lastServerGraphHash` is null after a restore and a hash cannot
 * be invented. `expected` has no such hole: it is read from the edge the user
 * is looking at, so it is ALWAYS available and a gesture is never held.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ WHY A WRONG `expected` IS SAFE — the property the whole design rests on.
 *
 * `expected` is a GUARD, not a value. CEE resolves the canonical `(from, to)`
 * in its own persisted GraphV3 and compares the tuple EXACTLY
 * (`system-events/edge-strength-edit.ts:366-396`); on any mismatch it refuses
 * BEFORE the write, appends nothing, and answers 409 `GRAPH_DIVERGED` with
 * `conflict_category: 'edge_expected_tuple_mismatch'` — carrying BOTH
 * `details.edge.expected` and `details.edge.current`.
 *
 * So there is NO path on which a wrong `expected` produces a wrong write. The
 * worst outcome is a refusal that names the server's real value. That is what
 * licenses deriving `expected` from the client's best local evidence rather
 * than standing down whenever certainty is unavailable — a stand-down would
 * make the feature silently inert, which is the defect we are closing.
 *
 * ⚠ It does NOT license fabricating the fields. `expected.mean` must be a
 * number actually read off the edge; an unreadable weight is a stand-down
 * (`expected_unreadable`), never a zero.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ MAGNITUDE AND DIRECTION ARE SEPARATE, and this module inherits that split
 * from the contract rather than re-deriving it. `magnitude` is `[0, 1]` and
 * `direction_intent` is carried alongside "so a strength change cannot reverse
 * an edge accidentally". The store mirrors the same split: `data.weight` is an
 * ABSOLUTE magnitude and `data.direction` is the sign. The signed mean the
 * panel's slider works in is a DERIVED view of the pair, never a stored field.
 *
 * ⚠ AT ZERO THE SIGN IS UNREPRESENTABLE, NOT AMBIGUOUS — the trap
 * `useInspectorMutations.setStrength` already documents, reached here through a
 * different door. `-0 >= 0` is `true`, so a signed round-trip through zero
 * silently reports NEGATIVE as POSITIVE. This module therefore never recovers a
 * direction from the sign of a magnitude: `direction_intent` is stated by the
 * CALLER (the affordance knows whether the user chose a sign), and the
 * contract's own refinement is re-applied here so a contradiction is refused
 * locally rather than at ingress.
 */

import type { SystemEventTurnPayload } from '@talchain/schemas/boundary'
import type { Edge } from '@xyflow/react'

/**
 * The wire event — DERIVED from the union member, never hand-rolled, for the
 * reason `structuralDelete.ts` and `structuralRename.ts` both give: a contract
 * change to the shape changes this type with it, and one wrong field on a
 * `.strict()` member of a discriminated union loses the WHOLE TURN at ingress.
 */
export type EdgeStrengthEditWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'edge_strength_edit' }
>

/** The contract's `direction_intent` vocabulary, re-exported for callers. */
export type EdgeStrengthDirectionIntent = 'preserve' | 'positive' | 'negative'

/** The contract's `intent` vocabulary. */
export type EdgeStrengthEditIntent = 'set' | 'confirm_current'

/** The contract's `expected.effect_direction` vocabulary. */
export type EdgeEffectDirection = 'positive' | 'negative'

/**
 * The optimistic-concurrency assertion: what the client believes CEE has
 * PERSISTED for this edge. Named as its own type because it is held as a
 * baseline across a gesture (see `useEdgeMutations`), not just built inline.
 */
export interface EdgeStrengthExpected {
  readonly mean: number
  readonly effect_direction: EdgeEffectDirection
}

/**
 * The contract's own numeric bounds, re-applied locally so an out-of-range
 * value becomes a visible stand-down rather than a 422 that costs the turn.
 * `EdgeStrengthEditEvent.magnitude` is `min(0).max(1)`; `expected.mean` is
 * `min(-1).max(1)`.
 *
 * ⚠ THESE ARE NOT DECORATIVE. `RelationshipsSection.handleWeightSave` accepts a
 * typed weight up to 2 — outside this contract — so a value the Model tab
 * considers legal is one ingress refuses. That surface does not emit today; if
 * it is wired later, this is the check that stops it losing a turn.
 */
export const WIRE_MAGNITUDE_MIN = 0
export const WIRE_MAGNITUDE_MAX = 1

/** Why a strength gesture produced no wire intent. Never a silent drop. */
export type EdgeStrengthEditStandDownReason =
  /** The mutation came from a producer (patch-apply, hydration), not a user. */
  | 'external_mutation'
  /** The edge is not on the canvas, so there is nothing to address on the wire. */
  | 'edge_not_found'
  /**
   * The edge carries no readable magnitude, so we cannot state what the server
   * holds. Fabricating a zero here would assert a value we never read.
   */
  | 'expected_unreadable'
  /** An endpoint id or a numeric field fails a bound the contract enforces. */
  | 'unusable_for_wire'
  /**
   * `refineEdgeStrengthEdit`'s own rules, applied before dispatch:
   * `confirm_current` must preserve direction and its magnitude must equal
   * `abs(expected.mean)` exactly.
   */
  | 'contradictory_confirmation'

/** One user strength gesture, captured against the PRE-edit edge. */
export interface EdgeStrengthEditIntentRecord {
  /** Correlates the send with its capture. */
  readonly id: string
  /** The canvas edge id — the LOCAL address, never sent on the wire. */
  readonly edgeId: string
  /** Canonical source node id (edge identity, half 1). */
  readonly from: string
  /** Canonical target node id (edge identity, half 2). */
  readonly to: string
  /** Requested absolute strength in [0, 1]. */
  readonly magnitude: number
  readonly directionIntent: EdgeStrengthDirectionIntent
  /** The optimistic-concurrency assertion, read off the pre-edit edge. */
  readonly expected: EdgeStrengthExpected
  readonly intent: EdgeStrengthEditIntent
  /**
   * Exactly what to put back if the server declines.
   *
   * ⚠ PRESENCE IS RECORDED SEPARATELY FROM VALUE, for each key, because
   * "absent" and "present with value `undefined`" are different bytes and the
   * store merges `{...e.data, ...updates.data}` — writing an explicit
   * `undefined` would overwrite a real value with nothing. This is the same
   * distinction `structuralRename`'s `provenanceWasPresent` exists to make.
   */
  readonly restore: {
    readonly weight: unknown
    readonly weightWasPresent: boolean
    readonly direction: unknown
    readonly directionWasPresent: boolean
    readonly weightSource: unknown
    readonly weightSourceWasPresent: boolean
    readonly directionSource: unknown
    readonly directionSourceWasPresent: boolean
  }
}

export type CaptureEdgeStrengthEditResult =
  | { readonly ok: true; readonly intent: EdgeStrengthEditIntentRecord }
  | { readonly ok: false; readonly reason: EdgeStrengthEditStandDownReason }

/**
 * The endpoint-id constraints `CanonicalEdgeEndpointIdSchema` enforces, applied
 * BEFORE the wire so a malformed local id becomes a stand-down rather than a
 * 422 that rejects the whole turn.
 *
 * DERIVED FROM THE PRODUCER'S SCHEMA, and deliberately the SAME predicate
 * `structuralDelete.ts` and `structuralRename.ts` export — the contract reuses
 * one schema for node ids and edge endpoints because "an endpoint IS a node
 * id". A third copy would be the hand-maintained mirror those two avoided.
 */
export function isWireUsableEndpointId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id === id.trim() &&
    !id.includes('→') &&
    !id.includes('->')
  )
}

/** Read a finite number off unknown edge data, or `undefined`. */
function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * What the SERVER is believed to hold for this edge, read off the pre-edit
 * canvas edge.
 *
 * ⚠ THE STORE SPLITS WHAT THE WIRE SIGNS. `data.weight` is an ABSOLUTE
 * magnitude (`setStrength` writes `Math.abs(mean)`) and `data.direction` is the
 * sign, so the signed mean CEE compares against is reconstructed here — it is
 * not a field that exists anywhere in the store.
 *
 * ⚠ AN ABSENT `direction` IS READ AS `'positive'`, and that is a deliberate
 * choice with a stated safety argument rather than the fabrication this
 * codebase warns about elsewhere. `setStrength`'s header is right that a
 * sign-derived WRITE fabricates a direction claim on the canvas — that write is
 * a claim about the user's intent. This is not a write: it is an ASSERTION
 * ABOUT THE SERVER, checked by the server, whose only failure mode is a refusal
 * naming the true value. Reading absence as the positive default matches
 * `safeDirection`, which is what every display path already shows the user, so
 * the assertion states what the user was actually looking at.
 */
export function readEdgeStrengthExpected(edge: Edge): EdgeStrengthExpected | null {
  const data = (edge.data ?? {}) as Record<string, unknown>
  const magnitude = finiteNumber(data.weight)
  if (magnitude === undefined) return null

  const effect_direction: EdgeEffectDirection =
    data.direction === 'negative' ? 'negative' : 'positive'

  // Reconstruct the SIGNED mean the wire asserts. `Math.abs` first so a store
  // that ever holds a signed weight cannot double-apply the sign.
  const abs = Math.abs(magnitude)
  return {
    mean: effect_direction === 'negative' ? -abs : abs,
    effect_direction,
  }
}

export interface CaptureEdgeStrengthEditInput {
  /** Edges as they were BEFORE the local write was applied. */
  readonly edgesBefore: readonly Edge[]
  readonly edgeId: string
  /** The requested ABSOLUTE strength. Never a signed mean. */
  readonly magnitude: number
  readonly directionIntent: EdgeStrengthDirectionIntent
  readonly intent: EdgeStrengthEditIntent
  /**
   * The pre-gesture baseline, when the caller captured one before its own local
   * write. Omitted means "read it off `edgesBefore`", which is correct only
   * when those edges genuinely predate the write.
   */
  readonly expected?: EdgeStrengthExpected | null
  /** `_externalMutationActive > 0` — a producer write, not a user gesture. */
  readonly externalMutationActive: boolean
  /** Injected so the capture is deterministic under test. */
  readonly makeId: () => string
}

/**
 * Capture one gesture. Returns a stand-down reason rather than a partial
 * intent: a strength edit we cannot express correctly must not be expressed
 * approximately.
 *
 * FAIL-CLOSED ON THE CONTRACT'S OWN RULES, checked here rather than trusted
 * from the caller, because one malformed field on a `.strict()` member of a
 * discriminated union does not lose the field — it loses the WHOLE TURN (422).
 */
export function captureEdgeStrengthEdit(
  input: CaptureEdgeStrengthEditInput,
): CaptureEdgeStrengthEditResult {
  if (input.externalMutationActive) return { ok: false, reason: 'external_mutation' }

  // BOUND BY IDENTITY — this edge's own id, never a value predicate a sibling
  // edge between other endpoints could satisfy.
  const edge = input.edgesBefore.find((e) => e.id === input.edgeId)
  if (!edge) return { ok: false, reason: 'edge_not_found' }

  // The baseline is SUPPLIED when the caller holds one captured before its own
  // local write (the slider case — see `useEdgeMutations`), and read from the
  // edge otherwise. Never silently re-read over a supplied one: that is exactly
  // the tautology this parameter exists to prevent.
  const expected = input.expected ?? readEdgeStrengthExpected(edge)
  if (expected === null) return { ok: false, reason: 'expected_unreadable' }

  const from = edge.source
  const to = edge.target
  const magnitude = finiteNumber(input.magnitude)
  if (
    !isWireUsableEndpointId(from) ||
    !isWireUsableEndpointId(to) ||
    magnitude === undefined ||
    magnitude < WIRE_MAGNITUDE_MIN ||
    magnitude > WIRE_MAGNITUDE_MAX ||
    expected.mean < -WIRE_MAGNITUDE_MAX ||
    expected.mean > WIRE_MAGNITUDE_MAX
  ) {
    return { ok: false, reason: 'unusable_for_wire' }
  }

  // `refineEdgeStrengthEdit`, re-applied before dispatch. `confirm_current` is
  // a PROVENANCE-ONLY act: it must preserve the persisted direction and restate
  // the exact current magnitude. A caller that gets either wrong is refused
  // here rather than at ingress.
  if (input.intent === 'confirm_current') {
    if (input.directionIntent !== 'preserve' || magnitude !== Math.abs(expected.mean)) {
      return { ok: false, reason: 'contradictory_confirmation' }
    }
  }

  const data = (edge.data ?? {}) as Record<string, unknown>
  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k)

  return {
    ok: true,
    intent: {
      id: input.makeId(),
      edgeId: input.edgeId,
      from,
      to,
      magnitude,
      directionIntent: input.directionIntent,
      expected,
      intent: input.intent,
      restore: {
        weight: data.weight,
        weightWasPresent: has('weight'),
        direction: data.direction,
        directionWasPresent: has('direction'),
        weightSource: data.weightSource,
        weightSourceWasPresent: has('weightSource'),
        directionSource: data.directionSource,
        directionSourceWasPresent: has('directionSource'),
      },
    },
  }
}

/**
 * The wire payload for one captured intent.
 *
 * Field names are the CONTRACT's, not the intent's — `direction_intent` rather
 * than `directionIntent` — and the mapping lives in exactly one place so a
 * rename of the internal shape cannot silently change what goes on the wire.
 *
 * ⚠ `edgeId` IS DELIBERATELY ABSENT. The contract addresses edges by canonical
 * `(from, to)` because `EdgeV3Schema` declares no `id` field at all, and
 * `edge_adjudication`'s own note says client-side ids ("reactflow__edge-…")
 * "are NOT stable across repos … never the lookup key". Sending one would be
 * unresolvable against the persisted graph, and the member is `.strict()`.
 */
export function buildEdgeStrengthEditWirePayload(
  intent: EdgeStrengthEditIntentRecord,
): Record<string, unknown> {
  return {
    from: intent.from,
    to: intent.to,
    magnitude: intent.magnitude,
    direction_intent: intent.directionIntent,
    expected: {
      mean: intent.expected.mean,
      effect_direction: intent.expected.effect_direction,
    },
    intent: intent.intent,
  }
}

/**
 * The server's own account of what this edge currently holds, read off a
 * refused 409's `details.edge.current`.
 *
 * ⭐ THIS IS THE FIELD THAT MAKES THE REFUSAL AN EXIT RATHER THAN A DEAD END.
 * A user whose edit is refused on a diverged tuple needs to know what the model
 * actually holds; without it the honest copy could only say "something changed"
 * and the next attempt would assert the same stale `expected` and refuse
 * identically forever — an affordance terminating in refusal.
 *
 * Fail-closed: any shape we cannot read returns `null`, and the caller falls
 * back to copy that claims nothing about the current value.
 */
export function readRefusedCurrentStrength(details: unknown): EdgeStrengthExpected | null {
  const edge = (details as { edge?: unknown } | null | undefined)?.edge
  const current = (edge as { current?: unknown } | null | undefined)?.current
  if (!current || typeof current !== 'object') return null

  const mean = finiteNumber((current as { mean?: unknown }).mean)
  if (mean === undefined) return null

  const raw = (current as { effect_direction?: unknown }).effect_direction
  if (raw !== 'positive' && raw !== 'negative') return null

  return { mean, effect_direction: raw }
}

/**
 * The `data` patch that puts back exactly what the server still holds.
 *
 * Keys that were ABSENT before the write are OMITTED rather than set to
 * `undefined` — the store merges `{...e.data, ...patch}`, so an explicit
 * `undefined` would overwrite a real value with nothing. That is the same rule
 * `setStrength` states for its own `direction` key, applied to the undo.
 */
export function buildEdgeStrengthRevertPatch(
  intent: EdgeStrengthEditIntentRecord,
): Record<string, unknown> {
  const { restore } = intent
  return {
    ...(restore.weightWasPresent ? { weight: restore.weight } : {}),
    ...(restore.directionWasPresent ? { direction: restore.direction } : {}),
    ...(restore.weightSourceWasPresent ? { weightSource: restore.weightSource } : {}),
    ...(restore.directionSourceWasPresent ? { directionSource: restore.directionSource } : {}),
  }
}

/**
 * What the user is told when a strength edit does not land.
 *
 * ⚠ EVERY LINE NAMES AN ACTION THAT ACTUALLY WORKS. "Try again" would re-send
 * the SAME `expected` and refuse identically forever; "reload, then edit again"
 * is right ONLY where the server's value is genuinely unknown to us. Where CEE
 * handed back `details.edge.current` we say the number instead, because that is
 * the one datum that makes the user's next move bounded.
 */
export const EDGE_STRENGTH_NOTICE = {
  /**
   * 409, `edge_expected_tuple_mismatch`, WITHOUT a readable current value.
   * CEE refused before writing, so the old strength is back on the canvas.
   */
  diverged_unknown_current:
    "The saved model's strength for that link had already changed, so your edit wasn't saved — I've put the saved value back rather than show you a number the model doesn't hold. Ask me anything about this decision and I'll re-sync, then set it again.",
  /**
   * 409 on the CAS path (`BASE_HASH_DIVERGED` / `rpc_cas_conflict`). The graph
   * moved under the write; CEE guarantees it appended nothing.
   */
  base_hash_diverged:
    "The saved model changed while you were setting that strength, so it wasn't saved — I've put the saved value back. Ask me anything about this decision and I'll re-sync with the saved model, then set it again.",
  /**
   * The edge itself could not be resolved server-side — it is not in CEE's
   * persisted graph, or the endpoint pair matches more than one edge. Reverting
   * is right (nothing was written) and a re-send cannot help.
   */
  target_unresolvable:
    "I couldn't find that link in the saved model, so the new strength wasn't saved and I've put the previous value back. Reload this decision to see the links the model actually holds.",
  /**
   * The turn failed, or came back with nothing readable. We hold no committed
   * bytes, so we know NEITHER that it landed nor that it did not — and the
   * value is LEFT ALONE, because reverting on a guess discards the user's work
   * on no evidence.
   */
  unconfirmed_server:
    "I couldn't confirm that strength reached the saved model. It's on the canvas, but it may revert when you reload — reload this decision to see what the model actually holds.",
  /** Nothing reached the server. Same epistemic position, different cause. */
  unconfirmed_transport:
    "That strength change didn't reach the server, so the saved model may still hold the previous value. Reload this decision to see what the model actually holds.",
} as const

export type EdgeStrengthNoticeKey = keyof typeof EDGE_STRENGTH_NOTICE

/**
 * The honest sentence for a refusal that DID name the server's current value.
 *
 * Built rather than looked up, because the number is the whole point: a fixed
 * string could not carry it, and a user told "it changed" without being told
 * what to has no bounded next move.
 */
export function edgeStrengthDivergedNotice(current: EdgeStrengthExpected | null): string {
  if (current === null) return EDGE_STRENGTH_NOTICE.diverged_unknown_current
  const shown = Math.abs(current.mean)
  const sense = current.effect_direction === 'negative' ? 'decreasing' : 'increasing'
  return (
    `The saved model already holds ${shown} (${sense}) for that link, not the value you started from, ` +
    `so your edit wasn't saved and I've put the saved value back. ` +
    `Set it again from here and it will stick.`
  )
}
