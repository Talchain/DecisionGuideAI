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
