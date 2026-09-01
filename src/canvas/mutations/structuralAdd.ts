/**
 * structuralAdd — the UI half of the DURABLE NODE writer (schemas 0.50.0).
 *
 * THE DEFECT THIS CLOSES. A node the user creates on the canvas reached CEE only
 * as the debounced `direct_graph_edit` NOTIFICATION, which CEE classifies
 * `'ack_and_commit'`: a turn row and NO graph write. CEE's own dispatch table
 * names the harm in the exact terms of this case — "the user's new factor
 * survives exactly until the next reload and then silently vanishes — a lie told
 * by omission". `structural_add` is the typed carrier that writes it.
 *
 * ⚠ DO NOT ROUTE THIS THROUGH `direct_graph_edit`. It appears in 18 UI files and
 * is the obvious-looking path; it commits a turn and writes no graph. The
 * carrier is `structural_add` or nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE HONESTY RULE, AND THE ONE THING THIS MODULE MUST NOT DO: A NEW NODE
 * CARRIES NO VALUE. The wire member is exactly `NodeV3Schema`'s three required
 * fields — `id`, `kind`, `label` — plus the concurrency assertion, and the
 * contract states that every optional `NodeV3` field is DELIBERATELY absent.
 * CEE's writer (`system-events/structural-add.ts`) stamps a factor with
 * `prior: uniform(0,1)` marked `prior_is_unquantified` and NO `observed_state`,
 * and refuses its own write if any numeric level reaches the persisted bytes.
 *
 * So there is nothing here to seed and nothing to default. This module builds a
 * payload of three user-stated strings. It writes no value, no category and no
 * position, because the wire has nowhere to put them and inventing one would
 * make the new node lie about its own provenance — the canvas now marks
 * "Olumi suggested this" vs "AI estimate" on exactly whether a value exists.
 *
 * ⚠ POSITION IS NOT ON THE WIRE AT ALL. `structural_add` carries no x/y, so the
 * live overlap defect (saved scenarios restoring frozen mid-convergence
 * geometry) is untouched by this event in both directions: this writer cannot
 * persist a position computed during layout convergence, because it cannot
 * persist a position. The new node's canvas position stays a purely local
 * presentation concern owned by `store.addNode` and the layout pass.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ HOW DIVERGENCE ACTUALLY BEHAVES — DERIVED AT CEE'S COMMITTED BYTES, NOT
 * ASSUMED FROM THE STATUS CODE. The rename lane's hardest-won finding was that
 * an `expected_label` mismatch returns a COMMITTED 200; the same discipline
 * applied here finds the SAME SHAPE for a different and larger set of refusals.
 *
 * `applyStructuralAdd` returns `{kind:'refused'}` for ELEVEN distinct reasons.
 * Exactly ONE of them (`BASE_HASH_DIVERGED`) carries a `baseHashConflict`, and
 * `dispatch.ts` turns only that one into a `graphConflict`, which `route-v2.ts`
 * renders as **HTTP 409 `GRAPH_DIVERGED`**. Every other refusal —
 * `no_persisted_graph`, `node_id_collision`, `unpersistable_node_kind`,
 * `apply_failed`, `ingress_projection_failed`, `projected_graph_invalid`,
 * `add_did_not_land`, `fabricated_level`, `option_roster_disagrees`,
 * `unhashable_result`, `fact_invalid` — is COMMITTED as an honest direct answer
 * (`commitPerformed: true`, no graph written) and falls through to
 * `sendFinalised200`. **HTTP 200, turn committed, node not in the model.**
 *
 * So a UI keyed on `conflict_category`, or on the status code, would read a
 * COLLIDING ID and an UNPERSISTABLE KIND as SUCCESS and leave a node on the
 * canvas that the saved model does not hold — the precise defect this event
 * exists to close, re-created one layer up. The verdict below is therefore taken
 * from the COMMITTED BYTES: CEE's refusal path passes the persisted graph
 * through `commitDirectAnswer(..., { contentGraph })`, so that arm carries a
 * readable graph that positively lacks our node.
 *
 * ⚠ AND THE ABSENCE ASYMMETRY WITH THE RENAME TWIN IS DERIVED, NOT AN
 * INCONSISTENCY. `readStructuralRenameReceipt` treats a MISSING node as
 * `unproven`, because for a rename the node's absence is a different event
 * entirely (a concurrent delete) and says nothing about the label. For an ADD it
 * is the opposite: the whole claim IS presence, so a readable committed graph
 * that does not contain this id is a POSITIVE REFUTATION of the only thing we
 * asserted. Same rule — read the bytes for the claim you actually made — giving
 * opposite answers because the claims are opposite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE ID SPACE IS NARROWER HERE THAN ON ITS SIBLINGS, and the contract says
 * why in terms: `structural_add` MINTS a new id and validates it against
 * `NodeV3Schema.shape.id` (which carries `NODE_ID_PATTERN`), "because an id that
 * fails that pattern is one CEE cannot persist into GraphV3". `structural_rename`
 * and `structural_add_edge` address EXISTING nodes and use the open
 * `CanonicalEdgeEndpointIdSchema`, because narrowing those "would refuse live
 * nodes". Both directions are wrong to copy. The predicate below is therefore
 * NOT `isWireUsableNodeId` from `structuralRename.ts` — it is the stricter one,
 * and the two are named apart so they cannot be swapped by symmetry.
 *
 * ⚠ AND THE KIND VOCABULARY IS NARROWER THAN THE WIRE'S. `NodeKind` has EIGHT
 * members; CEE's persisted `NodeKindV3` has SEVEN — it has no `constraint` — so
 * `{node_kind:'constraint'}` is a VALID payload CEE answers with a committed-200
 * refusal (`unpersistable_node_kind`). The set below is DERIVED from the
 * contract's own enum minus that one documented divergence, rather than
 * hand-listed: if the contract gains a kind, this gains it too.
 */

import { NODE_ID_PATTERN, NodeKind } from '@talchain/schemas/boundary'
import type { SystemEventTurnPayload } from '@talchain/schemas/boundary'
import type { Edge, Node } from '@xyflow/react'

// SINGLE OWNER, imported rather than re-derived: the label bound is identical on
// both members (`NodeV3Schema.shape.label`), so a second copy here would be the
// hand-maintained mirror this estate pays for most often.
import { isWireUsableLabel } from './structuralRename'

/**
 * The wire event — DERIVED from the union member, never hand-rolled.
 *
 * Every member of this union is `.strict()` inside a `discriminatedUnion`, so
 * one wrong field does not lose the field: it loses the WHOLE TURN at CEE's
 * ingress (422).
 */
export type StructuralAddWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'structural_add' }
>

/** The `node_kind` values on the wire. Derived from the contract's own enum. */
export type WireNodeKind = StructuralAddWireEvent['node_kind']

/**
 * The wire kind CEE cannot persist. Named as a constant so the divergence is one
 * greppable fact rather than a magic string inside a filter.
 *
 * DERIVED FROM CEE'S BYTES: `NodeKindV3` (`src/schemas/cee-v3.ts`) has seven
 * members and no `constraint`; `structural-add.ts`'s kind gate is built from
 * `NodeKindV3.options`. The UI's own `domain/nodes.ts` records the same fact
 * independently — "CEE/PLoT never emits canvas nodes with type 'constraint'" and
 * there is no `constraint` renderer — so this is two-source, not an inference.
 */
export const CEE_UNPERSISTABLE_NODE_KIND = 'constraint'

/**
 * The kinds this writer may put on the wire.
 *
 * DERIVED from `NodeKind.options` minus the one documented divergence, so a
 * contract that gains a kind gains it here with no edit. A hand-listed set would
 * be a mirror of a vocabulary that ALREADY disagrees with its twin, which is the
 * worst place for one.
 */
export const WIRE_ADDABLE_NODE_KINDS: ReadonlySet<string> = new Set<string>(
  NodeKind.options.filter((k) => k !== CEE_UNPERSISTABLE_NODE_KIND),
)

/** Why an add gesture produced no wire intent. Never a silent drop. */
export type StructuralAddStandDownReason =
  /** No CEE-stamped `graph_hash` has been seen this session — nothing to assert against. */
  | 'no_server_graph_hash'
  /** The creation came from a producer (patch-apply, coaching, hydration), not a user. */
  | 'external_mutation'
  /** The minted id fails `NODE_ID_PATTERN`, so CEE could not persist it. */
  | 'unusable_node_id'
  /** The label fails the contract's own `min(1).max(200)` bound. */
  | 'unusable_label'
  /** CEE's persisted vocabulary has no such kind — see `CEE_UNPERSISTABLE_NODE_KIND`. */
  | 'unpersistable_node_kind'

/** One user node-creation gesture, captured at the store chokepoint. */
export interface StructuralAddIntent {
  /** Correlates the send with its capture; also the dedupe key for the queue. */
  readonly id: string
  /** The id minted client-side, exactly as it will be sent and committed. */
  readonly nodeId: string
  /** The contract's `node_kind`. */
  readonly nodeKind: WireNodeKind
  /** The label the node was created with. */
  readonly label: string
  /** The CEE-stamped `aag_v1` hash of the graph the user was looking at. */
  readonly baseGraphHash: string
}

export type CaptureStructuralAddResult =
  | { readonly ok: true; readonly intent: StructuralAddIntent }
  | { readonly ok: false; readonly reason: StructuralAddStandDownReason }

export interface CaptureStructuralAddInput {
  /** The id `store.createNodeId()` minted for this node. */
  readonly nodeId: string
  /** The canvas node type, already resolved to the domain vocabulary. */
  readonly nodeKind: string
  /** The label the node is being created with. */
  readonly label: string
  /** The last CEE-stamped `graph_hash`, or null when none has been seen. */
  readonly baseGraphHash: string | null
  /** `_externalMutationActive > 0` — a producer write, not a user gesture. */
  readonly externalMutationActive: boolean
  /** Injected so the capture is deterministic under test. */
  readonly makeId: () => string
}

/**
 * Does this MINTED id clear the bound CEE must be able to persist?
 *
 * ⚠ DELIBERATELY STRICTER THAN `isWireUsableNodeId` in `structuralRename.ts`,
 * and the two must not be interchanged — see the header. `NODE_ID_PATTERN` is
 * imported from the contract rather than restated so a pattern change cannot
 * leave this behind.
 */
export function isWireUsableNewNodeId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 100 &&
    NODE_ID_PATTERN.test(id)
  )
}

/** Is this a kind CEE can actually persist? */
export function isWireAddableNodeKind(kind: unknown): kind is WireNodeKind {
  return typeof kind === 'string' && WIRE_ADDABLE_NODE_KINDS.has(kind)
}

/**
 * Capture one gesture. Returns a stand-down reason rather than a partial intent:
 * an add we cannot express correctly must not be expressed approximately.
 *
 * ⚠ THE ORDER OF THE GATES IS NOT ARBITRARY. `external_mutation` is checked
 * first because a producer write is not a gesture at all — reporting a
 * hash-related stand-down for CEE's own graph landing would attribute a user
 * outcome to machinery the user never touched.
 */
export function captureStructuralAdd(
  input: CaptureStructuralAddInput,
): CaptureStructuralAddResult {
  if (input.externalMutationActive) return { ok: false, reason: 'external_mutation' }

  const baseGraphHash = input.baseGraphHash
  if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) {
    return { ok: false, reason: 'no_server_graph_hash' }
  }

  if (!isWireUsableNewNodeId(input.nodeId)) {
    return { ok: false, reason: 'unusable_node_id' }
  }
  if (!isWireUsableLabel(input.label)) {
    return { ok: false, reason: 'unusable_label' }
  }
  if (!isWireAddableNodeKind(input.nodeKind)) {
    return { ok: false, reason: 'unpersistable_node_kind' }
  }

  return {
    ok: true,
    intent: {
      id: input.makeId(),
      nodeId: input.nodeId,
      nodeKind: input.nodeKind,
      label: input.label,
      baseGraphHash,
    },
  }
}

/**
 * The wire payload for one captured intent.
 *
 * Field names are the CONTRACT's, not the intent's — `node_kind` rather than
 * `nodeKind` — and the mapping lives in exactly one place so a rename of the
 * internal shape cannot silently change what goes on the wire.
 */
export function buildStructuralAddWirePayload(
  intent: StructuralAddIntent,
): Record<string, unknown> {
  return {
    node_id: intent.nodeId,
    node_kind: intent.nodeKind,
    label: intent.label,
    base_graph_hash: intent.baseGraphHash,
  }
}

/** What the SERVER's committed bytes say about this add. Three states, never two. */
export type StructuralAddReceipt =
  /** The committed graph carries THIS id at THIS kind and label. The add is a fact. */
  | 'proven'
  /** The committed graph is readable and does NOT hold this add. CEE refused. */
  | 'refuted'
  /** No readable committed graph arrived. We know nothing; do not invent a verdict. */
  | 'unproven'

/**
 * Did the server's own committed bytes take this add?
 *
 * ⭐⭐ THIS IS WHY THE STATUS CODE IS NOT ENOUGH. Ten of CEE's eleven refusal
 * reasons — including a COLLIDING NODE ID and an UNPERSISTABLE KIND — arrive as
 * a COMMITTED 200 with no `conflict_category` at all (see the header). A UI
 * keyed on the status code would read every one of them as a success.
 *
 * BOUND BY IDENTITY: this intent's exact node id. Another node having taken this
 * label, or a same-kinded sibling existing, is not evidence about ours — a value
 * predicate is precisely the shape a sibling satisfies.
 *
 * ⚠ ABSENCE IS A REFUTATION HERE, unlike its rename twin. The claim we made is
 * PRESENCE, so a readable committed graph without this id positively contradicts
 * it. (For a rename, absence is a concurrent delete and says nothing about the
 * label, which is why that twin answers `unproven`.)
 *
 * ⚠ KIND AND LABEL ARE BOTH CHECKED, and the kind half is not decoration: the
 * `node_id_collision` refusal is exactly the case where our id IS present in the
 * committed graph — carrying somebody else's node. Matching on presence alone
 * would score the one refusal the base hash provably cannot catch as a success.
 */
export function readStructuralAddReceipt(
  intent: StructuralAddIntent,
  response: unknown,
): StructuralAddReceipt {
  const draftGraph = (response as { draft_graph?: unknown } | null | undefined)?.draft_graph
  if (!draftGraph || typeof draftGraph !== 'object') return 'unproven'

  const rawNodes = (draftGraph as { nodes?: unknown }).nodes
  if (!Array.isArray(rawNodes)) return 'unproven'

  const match = rawNodes.find(
    (n) => (n as { id?: unknown } | null)?.id === intent.nodeId,
  ) as { label?: unknown; kind?: unknown } | undefined
  if (match === undefined) return 'refuted'

  return match.label === intent.label && match.kind === intent.nodeKind ? 'proven' : 'refuted'
}

/**
 * What the user is told when an add does not land.
 *
 * ⚠ THERE IS NO PER-REASON NOTICE HERE, AND THAT ABSENCE IS A DECISION, taken
 * from the rename lane rather than re-argued. Ten of the eleven refusals arrive
 * as a COMMITTED 200 whose own assistant text already names what happened and
 * what to do — "Something with that identity is already in your model, and I
 * won't overwrite it", "There's no saved model to add that to yet". Adding a
 * notice beside those would put TWO VOICES on one outcome and ours would be the
 * vaguer of the two. The canvas is still corrected; the SENTENCE is CEE's,
 * because CEE is the one that knows which gate fired.
 *
 * The keys below are exactly the outcomes where CEE says nothing at all.
 */
export const STRUCTURAL_ADD_NOTICE = {
  /**
   * 409 `GRAPH_DIVERGED` / `BASE_HASH_DIVERGED`. CEE guarantees it wrote
   * nothing, so the new node is gone from the canvas too.
   *
   * ⚠ THE ACTION NAMED HERE IS THE ONE THAT ACTUALLY REFRESHES THE BASE,
   * inherited from `STRUCTURAL_RENAME_NOTICE` rather than re-reasoned: "try
   * again" re-sends the SAME `base_graph_hash` and refuses identically forever,
   * and "reload" builds a fresh store with `lastServerGraphHash` null, so the
   * next add stands down silently. What DOES refresh it is a turn —
   * `applyV5State` captures the top-level `graph_hash` off every response.
   */
  base_hash_diverged:
    "The saved model changed while you were adding that, so it wasn't saved — I've taken it back off rather than show you something the model doesn't hold. Ask me anything about this decision and I'll re-sync with the saved model, then add it again.",
  /**
   * The turn reached the server and came back with no readable committed graph.
   * We hold no bytes, so we know neither that it landed nor that it did not.
   * The node is LEFT ON THE CANVAS, because removing it on a guess would discard
   * the user's work on evidence we do not have.
   */
  unconfirmed_server:
    "I couldn't confirm that reached the saved model. It's on the canvas, but it may disappear when you reload — reload this decision to see what the model actually holds.",
  /**
   * Nothing reached the server. Same epistemic position, different cause; the
   * copy avoids blaming the model for a network failure.
   */
  unconfirmed_transport:
    "That didn't reach the server, so the saved model may not have it. It's on the canvas — reload this decision to see what the model actually holds.",
} as const

export type StructuralAddNoticeKey = keyof typeof STRUCTURAL_ADD_NOTICE

/** What a revert did — reported, never assumed. */
export type StructuralAddRevertOutcome =
  /** The node this intent created has been taken back off the canvas. */
  | 'removed'
  /** Nothing to do: the node is already gone. */
  | 'already_absent'
  /** The node has moved on since — newer truth, or the user's own edges. Do not touch it. */
  | 'stood_down'

export interface RevertStructuralAddStore {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
  readonly currentScenarioId?: string | null
  applyStructuralAddRevert: (nodeId: string) => void
}

/**
 * Take back a node the server refused to save.
 *
 * STAND-DOWN DISCIPLINE, copied from `revertStructuralRename` and
 * `revertStructuralDelete` for the same reason: a late revert must not overwrite
 * newer truth.
 *
 * ⭐ AND ONE STAND-DOWN THIS EVENT NEEDS THAT ITS SIBLINGS DO NOT: **A NODE WITH
 * INCIDENT EDGES IS NOT REMOVED.** Removing it would take the user's edges with
 * it, silently — trading the loss this whole lane exists to close for a subtler
 * one, on work the user did AFTER the gesture we are correcting. A node that
 * has been connected since is no longer just this gesture's node.
 */
export function revertStructuralAdd(
  intent: StructuralAddIntent,
  store: RevertStructuralAddStore,
  capturedScenarioId: string | null,
): StructuralAddRevertOutcome {
  if ((store.currentScenarioId ?? null) !== capturedScenarioId) return 'stood_down'

  const node = store.nodes.find((n) => n.id === intent.nodeId)
  if (!node) return 'already_absent'

  // Renamed since: the canvas is describing something this gesture never saw.
  const currentLabel = (node.data as { label?: unknown } | undefined)?.label
  if (currentLabel !== intent.label) return 'stood_down'

  // Connected since: removing would delete the user's edges as collateral.
  const hasIncidentEdge = store.edges.some(
    (e) => e.source === intent.nodeId || e.target === intent.nodeId,
  )
  if (hasIncidentEdge) return 'stood_down'

  store.applyStructuralAddRevert(intent.nodeId)
  return 'removed'
}
