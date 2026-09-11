/**
 * `structural_add_edge` (schemas 0.50.0) — the wire shape for a NEW causal edge.
 *
 * ⭐⭐ ONE CARRIER, FOUR CANVAS GESTURES. Draw-a-link is the obvious one. The
 * other three are gestures users ALREADY perform and already believe work: the
 * five "Add connected …" affordances, duplicate, and paste. `structural_add`
 * covers the NODES those gestures create and nothing covers the EDGES, so a
 * duplicated subgraph reaches the server as disconnected nodes and returns on
 * the next reload having quietly lost its causal structure.
 *
 * ⚠ THIS MODULE DECIDES WHICH FIELDS GO ON THE WIRE AND NOTHING ELSE. The wire
 * TYPE comes from `@talchain/schemas`; the SEND happens at a store chokepoint,
 * exactly as `planStructuralAddIntent` is called only from `addNode`.
 *
 * ── ADDRESSED BY `(from, to)`, NEVER BY AN ID ─────────────────────────────
 * `EdgeV3Schema` declares NO `id` field, so an edge's only identity in the
 * canonical graph is its endpoint pair, and a client-local id
 * (`reactflow__edge-…`) is explicitly forbidden as a lookup key. Both endpoints
 * therefore use the OPEN endpoint predicate (`isCanonicalEndpointId`), the same
 * one `structural_delete` and `structural_rename` use for EXISTING nodes — NOT
 * `isWireUsableNewNodeId`, which validates a freshly minted id against the
 * narrow `NodeV3Schema.shape.id` pattern. Two predicates, named apart on
 * purpose.
 *
 * ── MAGNITUDE AND DIRECTION ARE SEPARATE, AND THAT IS THE POINT ───────────
 * Inherited from `edge_strength_edit`'s ruling that they must be, "so a strength
 * change cannot reverse an edge accidentally". `magnitude` is UNSIGNED and
 * `effect_direction` excludes `unknown` — a stated magnitude with an unknown
 * direction is an edge whose sign cannot be recovered.
 *
 * ⛔ SO THIS BUILDER NEVER INFERS A DIRECTION FROM THE SIGN OF A NUMBER. An
 * edge whose direction is genuinely unknown is a DIFFERENT product gesture and
 * does not ride this member; a caller that has no direction must not reach here
 * with a guessed one.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────
 * `std` and `exists_probability` are absent BY CONTRACT — "the server owns
 * them". CEE writes the canonical defaults and stamps no provenance claiming a
 * person supplied them, so the canvas's own provenance gates keep reading them
 * as defaults rather than measurements. A client that sent them would be
 * asserting a confidence nobody expressed.
 */
import type { SystemEventTurnPayload } from '@talchain/schemas/boundary'
import { isCanonicalEndpointId } from './structuralDelete'

export type StructuralAddEdgeWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'structural_add_edge' }
>

/** The `effect_direction` values this member admits. `unknown` is excluded. */
export type WireEdgeDirection = StructuralAddEdgeWireEvent['effect_direction']

export function isWireEdgeDirection(value: unknown): value is WireEdgeDirection {
  return value === 'positive' || value === 'negative'
}

/**
 * ⚠ REFUSE, NEVER CLAMP. `magnitude: z.number().finite().min(0).max(1)`. The
 * canvas does NOT share that bound — `EDGE_VALUE_DOMAINS.weight` is declared
 * open and the Model tab's weight chip accepts 0–2 — so a caller can genuinely
 * hold 1.5. Clamping it to 1 would send a number the user never stated and CEE
 * would persist it as theirs, which is the exact reasoning
 * `buildEdgeStrengthEditEvent` records for refusing rather than clamping.
 */
export function isWireUsableMagnitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export interface BuildStructuralAddEdgeArgs {
  from: unknown
  to: unknown
  /** UNSIGNED. The sign is carried by `direction` and applied server-side. */
  magnitude: unknown
  direction: unknown
  /** The canonical hash the client last read. The stale gate is non-optional. */
  baseGraphHash: unknown
}

/**
 * ⭐ THE BUILDER, AND IT FAILS CLOSED IN EVERY ARM.
 *
 * `null` means "this gesture has no truthful wire form", never "send something
 * approximate". Every caller must treat `null` as a stand-down and say so to the
 * user rather than writing locally and hoping — a local edge with no wire event
 * is precisely the silent loss this carrier exists to end.
 */
export function buildStructuralAddEdgeEvent({
  from,
  to,
  magnitude,
  direction,
  baseGraphHash,
}: BuildStructuralAddEdgeArgs): StructuralAddEdgeWireEvent | null {
  if (!isCanonicalEndpointId(from)) return null
  if (!isCanonicalEndpointId(to)) return null
  if (!isWireUsableMagnitude(magnitude)) return null
  if (!isWireEdgeDirection(direction)) return null
  if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) return null

  return {
    kind: 'structural_add_edge',
    from,
    to,
    magnitude,
    effect_direction: direction,
    base_graph_hash: baseGraphHash,
  } as StructuralAddEdgeWireEvent
}

/* ════════════════════════════════════════════════════════════════════════
 * CAPTURE — turning a canvas gesture into a durable intent
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * ⭐⭐⭐ THE RULE THAT DECIDES WHICH GESTURES CAN RIDE THIS CARRIER, AND IT IS
 * NOT THE ONE I EXPECTED WHEN I STARTED.
 *
 * `structural_add_edge` REQUIRES a `magnitude` and an `effect_direction`. A
 * freshly drawn link has neither: `onConnect` creates it from
 * `USER_EDGE_DEFAULTS`, which is `weight: 0.3, direction: 'positive'` and
 * carries **no `weightSource` and no `directionSource`** — so the canvas's own
 * provenance gates already read both as NOT SET, and every surface says so.
 *
 * ⛔ SO A BARE DRAW-A-LINK MUST NOT BE SENT. Putting `0.3` on the wire would
 * assert a strength the user never stated, CEE would persist it as theirs, and
 * PLoT would analyse it — a fabricated number reaching the model through the one
 * door this estate guards hardest. `USER_EDGE_DEFAULTS.weight` is the exact
 * constant `formatNumericLabel`'s header records the canvas once printing as a
 * measurement (ROADMAP 2.950). Sending it would be that defect, server-side.
 *
 * ⭐ WHAT THIS DOES COVER, and it is most of the value: every gesture whose edge
 * arrives WITH a stated strength and direction — duplicate, paste, and the
 * "Add connected …" affordances that choose a direction. Those carry real
 * provenance from the edge they were copied from or the choice the user made.
 *
 * ⚠⚠ AND THE GAP THIS LEAVES, STATED RATHER THAN PAPERED OVER: a link drawn
 * with no strength CANNOT become durable under the current contract. It cannot
 * ride this member (no magnitude to state), and it cannot be repaired later by
 * `edge_strength_edit` either, because that member EDITS an edge the server
 * already holds — and the server never received this one. The product gesture
 * "these two things are connected, I don't yet know how strongly" has no wire
 * form. That is a CONTRACT gap, not a UI one, and it is reported rather than
 * worked around here.
 */
export interface StructuralAddEdgeIntent {
  /** Correlates the send with its capture; also the dedupe key for the queue. */
  readonly id: string
  /** The canvas edge id — LOCAL only, never sent. Used to bind the intent. */
  readonly edgeId: string
  readonly from: string
  readonly to: string
  /** UNSIGNED, and provenance-gated: only a strength somebody SET reaches here. */
  readonly magnitude: number
  readonly direction: WireEdgeDirection
  /** `null` means "no turn has stamped one yet" — a DEFERRAL, never a drop. */
  readonly baseGraphHash: string | null
}

export type ResolvedStructuralAddEdgeIntent = StructuralAddEdgeIntent & {
  readonly baseGraphHash: string
}

/** Why an add-edge gesture produced no wire intent. Never a silent drop. */
export type StructuralAddEdgeStandDownReason =
  /** The mutation came from a producer (patch-apply, hydration), not a user. */
  | 'external_mutation'
  /** The edge is not on the canvas, so there is nothing to add on the wire. */
  | 'edge_absent'
  /** An endpoint is not a canonical id — a dangling edge is what CEE refuses. */
  | 'endpoint_unusable'
  /**
   * ⭐ THE COMMON ONE, AND IT IS NOT A FAILURE. Nobody has stated a strength or
   * a direction, so there is no truthful `magnitude` to send. See the header.
   */
  | 'strength_not_stated'

export type CaptureStructuralAddEdgeResult =
  | { ok: true; intent: StructuralAddEdgeIntent; deferred: boolean }
  | { ok: false; reason: StructuralAddEdgeStandDownReason }

export interface CaptureStructuralAddEdgeInput {
  /** The edges AFTER the add — the gesture's own result, never the prior state. */
  readonly edgesAfter: ReadonlyArray<{ id: string; source: string; target: string; data?: unknown }>
  readonly edgeId: string
  readonly baseGraphHash: unknown
  readonly externalMutationActive: boolean
  /**
   * The provenance-gated strength for an edge's data, injected rather than
   * imported so this module holds no second copy of the gate. Callers pass
   * `resolveEdgeSignedStrengthDisplay`; it returns `show: false` for anything
   * nobody set, INCLUDING `USER_EDGE_DEFAULTS`.
   */
  readonly resolveSignedStrength: (data: unknown) => { show: boolean; value?: number }
  /** Same discipline for the direction claim. */
  readonly resolveDirection: (data: unknown) => { show: boolean; direction?: string }
  readonly makeId: () => string
}

export function captureStructuralAddEdge(
  input: CaptureStructuralAddEdgeInput,
): CaptureStructuralAddEdgeResult {
  if (input.externalMutationActive) return { ok: false, reason: 'external_mutation' }

  // BOUND BY IDENTITY — the edge id, never an endpoint-pair scan another edge
  // could satisfy. Two edges between the same nodes cannot coexist, but a scan
  // would still find the WRONG one mid-gesture while the canvas holds both.
  const edge = input.edgesAfter.find((e) => e.id === input.edgeId)
  if (!edge) return { ok: false, reason: 'edge_absent' }
  if (!isCanonicalEndpointId(edge.source) || !isCanonicalEndpointId(edge.target)) {
    return { ok: false, reason: 'endpoint_unusable' }
  }

  // ⛔ THE PROVENANCE GATE — the whole reason this capture exists rather than a
  // straight read of `edge.data.weight`. Both halves must be SET: a stated
  // magnitude with an unstated direction is an edge whose sign cannot be
  // recovered, which the contract excludes by construction.
  const strength = input.resolveSignedStrength(edge.data)
  const direction = input.resolveDirection(edge.data)
  if (!strength.show || typeof strength.value !== 'number') {
    return { ok: false, reason: 'strength_not_stated' }
  }
  if (!direction.show || !isWireEdgeDirection(direction.direction)) {
    return { ok: false, reason: 'strength_not_stated' }
  }

  const magnitude = Math.abs(strength.value)
  // The contract bound, applied at CAPTURE so an unsendable intent never enters
  // the queue. Refuse, never clamp — see `isWireUsableMagnitude`.
  if (!isWireUsableMagnitude(magnitude)) return { ok: false, reason: 'strength_not_stated' }

  const rawBase = input.baseGraphHash
  const baseGraphHash = typeof rawBase === 'string' && rawBase.length > 0 ? rawBase : null

  return {
    ok: true,
    deferred: baseGraphHash === null,
    intent: {
      id: input.makeId(),
      edgeId: edge.id,
      from: edge.source,
      to: edge.target,
      magnitude,
      direction: direction.direction,
      baseGraphHash,
    },
  }
}

/** Stamp a deferred intent with the hash that has since arrived, or refuse. */
export function resolveStructuralAddEdgeBase(
  intent: StructuralAddEdgeIntent,
  currentBaseGraphHash: string | null,
): ResolvedStructuralAddEdgeIntent | null {
  if (typeof intent.baseGraphHash === 'string' && intent.baseGraphHash.length > 0) {
    return intent as ResolvedStructuralAddEdgeIntent
  }
  if (typeof currentBaseGraphHash !== 'string' || currentBaseGraphHash.length === 0) return null
  return { ...intent, baseGraphHash: currentBaseGraphHash }
}

/**
 * The wire payload for one captured intent.
 *
 * Field names are the CONTRACT's, not the intent's, and the mapping lives in
 * exactly one place so a rename of the internal shape cannot silently change
 * what goes on the wire.
 */
export function buildStructuralAddEdgeWirePayload(
  intent: ResolvedStructuralAddEdgeIntent,
): Record<string, unknown> {
  return {
    from: intent.from,
    to: intent.to,
    magnitude: intent.magnitude,
    effect_direction: intent.direction,
    base_graph_hash: intent.baseGraphHash,
  }
}

export const STRUCTURAL_ADD_EDGE_DEFERRED_NOTICE =
  "Connection drawn. It isn't saved to the model yet — I'll save it with your next message. If you reload before then, it won't be there."

export const STRUCTURAL_ADD_EDGE_UNCONFIRMED_TOAST =
  "That connection went out just as you sent something else, so I can't tell you whether it saved. It's on the canvas — reload this decision to see what the model actually holds."

/**
 * ⭐ WHAT A USER IS TOLD WHEN THE LINK CANNOT BE SAVED AT ALL YET.
 *
 * Not a failure message, because nothing failed: they drew a connection and have
 * not said how strong it is, and the model has no way to hold "connected, but
 * unknown". Naming the ONE thing that makes it durable is the whole job of this
 * sentence — a generic "couldn't save" would leave them with no move.
 */
export const STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE =
  "Connection drawn. Set its strength to save it to the model — until then it stays on your canvas only."
