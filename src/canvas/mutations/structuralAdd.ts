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
 * ⚠ DO NOT ROUTE THIS THROUGH `direct_graph_edit`. It is the obvious-looking
 * path and it is the wrong one twice over: it commits a turn and writes no
 * graph, and its member is `additionalProperties: false`, so it could not carry
 * a value even if we wanted it to. The carrier is `structural_add` or nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐⭐ THE HONESTY RULE, AND THE ONE THING THIS MODULE MUST NOT DO:
 *
 *              A NEW NODE ARRIVES AS AN EXPLICIT UNKNOWN.
 *
 * Not `0`. Not `50%`. Not a placeholder that reads as a measurement. This
 * module writes NO value, NO prior, NO `observedState` and NO category, and the
 * wire has nowhere to put one if it did.
 *
 * ⚠ AND THE REASON IS NOT TIDINESS — THIS ESTATE HAS ALREADY SHIPPED THE
 * OPPOSITE AND MEASURED THE HARM. `observedStateHelpers.hasObservedData`
 * records it: CEE defaulted a factor with no stated value to a neutral number
 * and stamped `observed_state.source = 'cee_inference'`; the predicate that
 * decides whether to say "no observed data" asked only `typeof value ===
 * 'number'`, so it was SATISFIED BY THE PLACEHOLDER THAT MEANS THERE IS NO
 * OBSERVED DATA, and `EvidenceGapBadge` was suppressed on precisely the factors
 * that have none. A seeded value here would re-create that defect at its
 * source — and it would be worse, because the number would carry the USER's
 * provenance rather than a stamp saying it was invented.
 *
 * So: `store.addNode` creates `data: { label }` and nothing else, this module
 * asserts that it stays that way, and `structuralAdd.explicitUnknown.spec.ts`
 * pins BOTH directions — a node added with no value renders the gap and never a
 * number, and a node carrying a GENUINE `0` still shows its `0`. The second
 * direction is not decoration: `0` is a real observed value for a binary factor
 * ("None"), and every falsiness-gated read (`value || 0`, `value ? … : …`)
 * silently destroys it. The gate is the STATUS — `typeof value === 'number'`
 * plus the provenance stamp — never the truthiness of the number.
 *
 * ⚠⚠ THIS MODULE'S GUARANTEE IS SCOPED TO THE `addNode` PATH — SAY IT THAT
 * WAY, BECAUSE THE UNSCOPED VERSION IS FALSE. `addNodeWithEdge`,
 * `duplicateSelected` and `pasteClipboard` capture no durable intent, and the
 * reason each one is uncovered is derived rather than assumed. **The full
 * measured scope is the block on `pendingStructuralAdds` in
 * `canvas/store.ts`, and it is the only place that states it.** Do not restate
 * it here; a restatement is how the caveat gets lost — this paragraph used to
 * carry its own copy, and that copy went stale the day the `category:
 * 'external'` seed it described was removed.
 *
 * The RENDER half of the guarantee now holds on the connected-add path too
 * (the seed is gone — see `store.addNodeWithEdge`), pinned by
 * `__tests__/structuralAdd.connectedAddExplicitUnknown.spec.tsx`. Rendering an
 * explicit unknown and being DURABLY SAVED are different claims; that file
 * makes the first, and only the first.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ POSITION IS NOT ON THE WIRE AT ALL, so the live overlap defect (saved
 * scenarios restoring frozen mid-convergence geometry) is untouched by this
 * event IN BOTH DIRECTIONS: this writer cannot persist a position computed
 * during layout convergence, because it cannot persist a position. The new
 * node's canvas position stays a purely local presentation concern owned by
 * `store.addNode` and the layout pass.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE DEFERRAL, AND WHY IT IS NOT A REFUSAL — inherited from the rename
 * lane (#1108) deliberately, because that lane's FIRST cut refused and was
 * beaten by the version that defers.
 *
 * On a restored graph `lastServerGraphHash` is null: a reload builds a fresh
 * store, and a scenario switch nulls it through `DECISION_CONTEXT_CLEAR`.
 * Neither hydration nor the UI can supply a real one — the only genuine
 * `base_graph_hash` in existence arrives on a turn response via `applyV5State`.
 * Standing down there would mean the FIRST node a user adds after opening a
 * saved decision is never written: on the canvas, gone on reload. That is the
 * exact P0 this event exists to close, re-created one layer down.
 *
 * So the intent is HELD with a null base, {@link resolveStructuralAddBase}
 * stamps the real hash the moment a turn supplies one, and
 * {@link buildStructuralAddWirePayload} accepts ONLY a resolved intent — so a
 * null base is unrepresentable rather than merely forbidden. The user is told
 * meanwhile, because the queue is memory-only and a reload before that turn
 * genuinely does lose the node. See {@link STRUCTURAL_ADD_DEFERRED_NOTICE}.
 *
 * ⚠ THE MEMORY-ONLY QUEUE IS A DISCLOSED LIMITATION, NOT AN OVERSIGHT, AND
 * PERSISTING IT WOULD BE WORSE. A queue that survived a reload would replay an
 * intent asserting a `base_graph_hash` read in a previous session against a
 * graph that has since moved — which is why the drain DISCARDS rather than
 * holds when the transport is off, in its own words: "leaving intents queued
 * would send them the moment the flag flipped, asserting labels and hashes read
 * in a previous session". Durability here would buy one saved gesture at the
 * cost of a class of silent stale writes. Disclosed, in the copy, instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ ABSENCE IS A REFUTATION HERE, AND ITS TWIN SAYS THE OPPOSITE — the same
 * rule giving opposite answers because the CLAIMS are opposite.
 *
 * `readStructuralRenameReceipt` treats a MISSING node as `unproven`: for a
 * rename, the node's absence is a different event entirely (a concurrent
 * delete) and says nothing about the label. For an ADD the whole claim IS
 * PRESENCE, so a readable committed graph that does not contain this id
 * positively contradicts the only thing we asserted. Read the bytes for the
 * claim you actually made — see {@link readStructuralAddReceipt}.
 */

import { NodeKind } from '@talchain/schemas/boundary'
import type { SystemEventTurnPayload } from '@talchain/schemas/boundary'
import type { Node } from '@xyflow/react'

import { isWireUsableLabel } from './structuralRename'

/**
 * The wire event — DERIVED from the union member, never hand-rolled.
 *
 * Every member of this union is `.strict()` inside a `discriminatedUnion`, so
 * one wrong field does not lose the field: it loses the WHOLE TURN at CEE's
 * ingress (422). A hand-written interface would go stale silently.
 */
export type StructuralAddWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'structural_add' }
>

/** The `node_kind` values the contract admits. Derived from the wire member. */
export type WireNodeKind = StructuralAddWireEvent['node_kind']

/** Why an add gesture produced no wire intent. Never a silent drop. */
export type StructuralAddStandDownReason =
  /** The mutation came from a producer (patch-apply, hydration), not a user. */
  | 'external_mutation'
  /** The node is not on the canvas, so there is nothing to add on the wire. */
  | 'node_not_found'
  /** The node id or label fails a bound the contract enforces at ingress. */
  | 'unusable_for_wire'
  /** The kind is one CEE cannot persist — refused before the wire, not after. */
  | 'unpersistable_node_kind'

/**
 * One user add gesture, captured against the node as created.
 *
 * ⚠ THERE IS NO `restore` FIELD, AND ITS ABSENCE IS THE POINT. A rename's
 * revert must put back a previous label; an add's revert has nothing to put
 * back — it removes the node it created. Everything needed for that is the id,
 * plus the label and kind we asserted, which the stand-down discipline in
 * {@link revertStructuralAdd} compares against before touching anything.
 */
export interface StructuralAddIntent {
  /** Correlates the send with its capture; also the dedupe key for the queue. */
  readonly id: string
  /** The canonical node id, minted client-side, exactly as it will be sent. */
  readonly nodeId: string
  /** The kind, resolved through the domain's ONE fallback chain. */
  readonly nodeKind: string
  /** The label the user typed. */
  readonly label: string
  /**
   * The CEE-stamped `aag_v1` hash of the graph the user was looking at, or
   * `null` when NO turn had stamped one yet — the restored-graph case.
   *
   * ⚠⚠ NULL IS "NOT YET", NOT "NEVER". See the header's deferral section: this
   * nullability is what stops the first add after a restore being dropped.
   */
  readonly baseGraphHash: string | null
}

/**
 * An intent whose base hash is in hand. The ONLY shape the wire builder accepts,
 * so a deferred intent cannot be sent by forgetting to check a boolean.
 */
export type ResolvedStructuralAddIntent = StructuralAddIntent & {
  readonly baseGraphHash: string
}

export type CaptureStructuralAddResult =
  | {
      readonly ok: true
      readonly intent: StructuralAddIntent
      /**
       * True when the intent is queued WITHOUT a base hash and is waiting for a
       * turn to stamp one. The caller owes the user a disclosure in this state:
       * the node is on the canvas, the model does not hold it yet, and a reload
       * before the next turn loses it.
       */
      readonly deferred: boolean
    }
  | { readonly ok: false; readonly reason: StructuralAddStandDownReason }

export interface CaptureStructuralAddInput {
  /** Nodes as they are AFTER the add — the new node must be among them. */
  readonly nodesAfter: readonly Node[]
  readonly nodeId: string
  /** The last CEE-stamped `graph_hash`, or null when none has been seen. */
  readonly baseGraphHash: string | null
  /** `_externalMutationActive > 0` — a producer write, not a user gesture. */
  readonly externalMutationActive: boolean
  /**
   * The kinds CEE can actually PERSIST, injected rather than imported so this
   * module states the policy and its owner supplies the vocabulary. See
   * {@link WIRE_ADDABLE_NODE_KINDS}.
   */
  readonly persistableKinds: ReadonlySet<string>
  /** Resolve a node's kind through the domain's ONE fallback chain. */
  readonly resolveKind: (node: Node) => string | null
  /** Injected so the capture is deterministic under test. */
  readonly makeId: () => string
}

/**
 * The id constraints `structural_add` enforces at ingress, applied BEFORE the
 * wire so a malformed local id becomes a stand-down rather than a 422 that
 * rejects the whole turn.
 *
 * ⚠⚠ DELIBERATELY NOT `isWireUsableNodeId` FROM `structuralRename.ts`, AND THE
 * TWO ARE NAMED APART SO THEY CANNOT BE SWAPPED BY SYMMETRY. `structural_add`
 * MINTS a new id and validates it against the narrow `NodeV3Schema.shape.id`
 * pattern, because an id failing that pattern is one CEE cannot persist into
 * GraphV3. `structural_rename` and `structural_add_edge` address EXISTING nodes
 * and use the OPEN `CanonicalEdgeEndpointIdSchema`, because narrowing those
 * "would refuse live nodes" — CEE's persisted GraphV3 is the authority and its
 * deployed node ids are open strings. Copying either predicate onto the other's
 * event is wrong, in opposite directions: narrow the rename and you refuse live
 * nodes; widen the add and you mint an id CEE cannot store.
 */
export function isWireUsableNewNodeId(id: unknown): id is string {
  return typeof id === 'string' && WIRE_NEW_NODE_ID_PATTERN.test(id)
}

/**
 * The mint-time id pattern, kept as one greppable constant.
 *
 * Bounds are `NodeV3Schema.shape.id`'s: `min(1).max(100)` plus the lowercase
 * `NODE_ID_PATTERN`. The UI's `createNodeId()` returns `String(nextNodeId)`,
 * which satisfies it.
 */
export const WIRE_NEW_NODE_ID_PATTERN = /^[a-z0-9_:-]{1,100}$/

/**
 * Capture one gesture. Returns a stand-down reason rather than a partial intent:
 * an add we cannot express correctly must not be expressed approximately.
 *
 * ⚠ READ AGAINST THE POST-ADD GRAPH, unlike the rename twin. A rename asserts
 * `expected_label`, a fact about the graph BEFORE the gesture, so it must
 * capture first. An add asserts the existence of something that did not exist
 * before, so its subject only exists AFTER. Same discipline — read the graph the
 * assertion is about — reaching opposite sides of the same `set()`.
 */
export function captureStructuralAdd(
  input: CaptureStructuralAddInput,
): CaptureStructuralAddResult {
  if (input.externalMutationActive) return { ok: false, reason: 'external_mutation' }

  // A missing base hash is a DEFERRAL, not a stand-down — see the header. Every
  // OTHER refusal still applies to a deferred gesture: a vanished node or an
  // unpersistable kind is just as wrong held in a queue as it is on the wire.
  const rawBase = input.baseGraphHash
  const baseGraphHash = typeof rawBase === 'string' && rawBase.length > 0 ? rawBase : null

  // BOUND BY IDENTITY — the node id, never a kind or label predicate another
  // node could satisfy. This is the defect `addNamedNode`'s `.at(-1)` scan
  // carried: it found the last node OF A KIND, which is a different node the
  // moment anything else adds one.
  const node = input.nodesAfter.find((n) => n.id === input.nodeId)
  if (!node) return { ok: false, reason: 'node_not_found' }

  const data = (node.data ?? {}) as Record<string, unknown>
  const rawLabel = data.label
  const label = typeof rawLabel === 'string' ? rawLabel : ''

  if (!isWireUsableNewNodeId(input.nodeId) || !isWireUsableLabel(label)) {
    return { ok: false, reason: 'unusable_for_wire' }
  }

  const nodeKind = input.resolveKind(node)
  // Refused HERE rather than at CEE, because CEE's answer is a COMMITTED 200: a
  // turn spent, a commit performed, and no node written. Standing down costs
  // nothing and says something true.
  if (nodeKind === null || !input.persistableKinds.has(nodeKind)) {
    return { ok: false, reason: 'unpersistable_node_kind' }
  }

  return {
    ok: true,
    deferred: baseGraphHash === null,
    intent: {
      id: input.makeId(),
      nodeId: input.nodeId,
      nodeKind,
      label,
      baseGraphHash,
    },
  }
}

/**
 * Stamp the CURRENT base hash onto an intent, or refuse.
 *
 * ⭐ WHY DRAIN-TIME IS SOUND FOR THE DEFERRED CASE. At capture there was no hash
 * to read, so the choice is between the freshest real one and none at all.
 * `base_graph_hash` is a STALENESS gate — it asserts "the graph has not moved
 * since I looked" — and an add makes no claim about any pre-existing node, so
 * stamping a fresher base asserts nothing the user did not see. The one thing
 * `base_graph_hash` provably CANNOT catch for an add is a colliding id, because
 * a colliding id is already present in the very graph the user was looking at;
 * that is caught by CEE reading its own persisted graph, and surfaces here as a
 * refuted receipt.
 *
 * Returns `null` rather than a partial intent.
 */
export function resolveStructuralAddBase(
  intent: StructuralAddIntent,
  currentBaseGraphHash: string | null,
): ResolvedStructuralAddIntent | null {
  if (typeof intent.baseGraphHash === 'string' && intent.baseGraphHash.length > 0) {
    return intent as ResolvedStructuralAddIntent
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
 *
 * ⚠⚠ FOUR FIELDS, AND THERE IS NO FIFTH. No value, no prior, no position, no
 * category. If a future edit adds one here it is either a contract field this
 * comment has gone stale about, or it is the fabrication the whole module
 * exists to prevent — check which before writing it.
 */
export function buildStructuralAddWirePayload(
  intent: ResolvedStructuralAddIntent,
): Record<string, unknown> {
  return {
    node_id: intent.nodeId,
    node_kind: intent.nodeKind,
    label: intent.label,
    base_graph_hash: intent.baseGraphHash,
  }
}

/**
 * The kinds CEE can actually PERSIST.
 *
 * ⚠⚠ THE WIRE VOCABULARY AND THE PERSISTED VOCABULARY DISAGREE BY EXACTLY ONE
 * MEMBER, AND THE DISAGREEMENT IS LOAD-BEARING. `NodeKind` on the wire has
 * EIGHT members; CEE's persisted `NodeKindV3` has SEVEN — it has no
 * `constraint`. So `{node_kind: 'constraint'}` is a VALID payload at the wire
 * that CEE refuses server-side, answering with a COMMITTED 200: a turn spent, a
 * commit performed, and no node written.
 *
 * ⚠ CORRECTED AFTER REVIEW — the refusal happens BEFORE the persistence writer,
 * not at it. An earlier version of this comment said the payload "dies at its
 * writer's own gate", which put the check one stage too late; the payload never
 * reaches the persistence writer at all. The consequence for this module is
 * unchanged, which is why the code is unchanged: a committed-200 refusal costs
 * the user a turn either way, and standing down here costs nothing.
 *
 * Standing down here costs nothing and says something true, so the divergence
 * is applied BEFORE the wire rather than discovered after it.
 *
 * ⭐ TWO-SOURCE, NOT AN INFERENCE. The UI's own `domain/nodes.ts` records the
 * same fact independently and from the other direction — "CEE/PLoT never emits
 * canvas nodes with type 'constraint' … there is no 'constraint' ReactFlow
 * renderer" — so this is corroborated rather than assumed by symmetry.
 *
 * ⚠ IT IS DERIVED FROM THE CONTRACT'S OWN ENUM MINUS THE ONE DOCUMENTED
 * DIVERGENCE, never hand-listed: a contract that gains a kind gains it here
 * with no edit, and the one subtraction stays greppable as a single named fact.
 */
export const CEE_UNPERSISTABLE_NODE_KIND = 'constraint'

/**
 * The kinds this writer may put on the wire: the contract's own enum MINUS the
 * one documented divergence. Derived, so a contract that gains a kind gains it
 * here with no edit, and the single subtraction stays greppable.
 */
export const WIRE_ADDABLE_NODE_KINDS: ReadonlySet<string> = new Set<string>(
  NodeKind.options.filter((k) => k !== CEE_UNPERSISTABLE_NODE_KIND),
)

/**
 * What the SERVER's committed bytes say about this add. Three states, never two.
 */
export type StructuralAddReceipt =
  /** The committed graph carries THIS id. The add is a fact. */
  | 'proven'
  /** The server did not write it — read positively, never inferred from silence. */
  | 'refuted'
  /** We hold no evidence either way. Do not invent a verdict. */
  | 'unproven'

/**
 * Did the server's own bytes take this add?
 *
 * ⚠⚠ THIS FUNCTION EXISTS IN ITS PRESENT FORM BECAUSE THE OBVIOUS DESIGN RESTS
 * ON A FALSE PREMISE, AND THE PREMISE WAS WRITTEN DOWN IN A PRIOR DRAFT OF THIS
 * LANE AS THOUGH DERIVED.
 *
 * That draft asserted: "CEE's refusal path passes the persisted graph through
 * `commitDirectAnswer(..., { contentGraph })`, so that arm carries a readable
 * graph that positively lacks our node." **It does not.** Derived at CEE
 * `d5455355`: `contentGraph` is an INTERNAL artefact — `commit.ts:200-218`
 * describes it as "the scenario graph used to resolve entity-id labels when
 * reducing `assistant_text` to its durable public form", its only consumer is
 * `parseContentGraph` feeding `durablePublicAssistantText`, and it never
 * reaches the client. The only inline-graph WIRE field is `draft_graph`, and in
 * the whole system-event family it is stamped at exactly four places, ALL OF
 * THEM SUCCESS ARMS (`dispatch.ts:1054, 1489, 2070 rename, 2367 add`).
 *
 * **So `draft_graph` is ABSENT on every refusal, and "the committed graph
 * lacks our node" is evidence we never receive.** A receipt keyed on that
 * absence alone would answer `unproven` for every real refusal — the
 * cannot-confirm line, forever, on the one outcome the user most needs told.
 *
 * ⭐ THE DISCRIMINATOR THAT DOES EXIST, and it is specific to ADD:
 * **AN ADD THAT LANDS NECESSARILY MOVES THE ANALYSIS HASH.**
 *
 * ⚠ THE LOAD-BEARING FIELD IS THE **ID**, NOT THE KIND — corrected after review,
 * because the first version of this paragraph said `projectNode` emits
 * `{id, kind}` "unconditionally" and the `kind` half is CONDITIONAL. The
 * argument never needed it: a projection that emits the node's ID at all means a
 * NEW, UNIQUE id changes the projected `nodes` array and therefore the canonical
 * string, whatever else is or is not included alongside it. (For an added OPTION
 * it moves twice over — the top-level option roster gains an entry too.) This is
 * also why the writer sets `rerun_recommended: true`, the opposite of rename's.
 *
 * ⚠ AND THE DESIGN DOES NOT REST ON THIS BEING EXHAUSTIVE. Even if some future
 * projection change made an add hash-neutral, the inference below would degrade
 * to `unproven` — the cannot-confirm line — and never to a false `proven`.
 *
 * Therefore `graph_hash === base_graph_hash` PROVES the persisted graph did not
 * move, which PROVES our node is not in it. The inference runs in exactly one
 * direction and it is the safe one: a hash that DID move proves only that
 * something changed, never that the something was ours, so that reads
 * `unproven` rather than `proven`.
 *
 * ⚠ AND THE DESIGN IS DELIBERATELY ROBUST TO A CONTESTED PREMISE. CEE's
 * `structural_add` refusal arm is derived to return `graph_hash` = the server's
 * current hash (`dispatch.ts:2185-2188`), but this repo's own note at
 * `useConversation.ts:4239` records a `factor_value_edit` refusal carrying NO
 * `graph_hash` at all. Those are different events on different paths and only
 * one of them was derived here, so this reads the hash as EVIDENCE WHEN PRESENT
 * and falls to `unproven` when absent. Under either reading it cannot answer
 * `proven` for a turn that wrote nothing — which is the only error that would
 * leave the user with a node the model does not hold and no word about it.
 *
 * BOUND BY IDENTITY throughout: this intent's exact node id. Another node
 * having appeared is not evidence about ours.
 */
export function readStructuralAddReceipt(
  intent: StructuralAddIntent,
  response: unknown,
): StructuralAddReceipt {
  const res = (response ?? {}) as { draft_graph?: unknown; graph_hash?: unknown }

  // ── 1. A readable committed graph outranks every other signal ────────────
  const draftGraph = res.draft_graph
  if (draftGraph && typeof draftGraph === 'object') {
    const rawNodes = (draftGraph as { nodes?: unknown }).nodes
    if (Array.isArray(rawNodes)) {
      const present = rawNodes.some(
        (n) => (n as { id?: unknown } | null)?.id === intent.nodeId,
      )
      // ⭐ ABSENCE IS A REFUTATION HERE, AND ITS RENAME TWIN SAYS THE OPPOSITE.
      // `readStructuralRenameReceipt` answers `unproven` for a missing node,
      // because a rename's claim is about a LABEL and the node's absence is a
      // different event (a concurrent delete). An add's whole claim IS
      // PRESENCE, so a readable graph without this id contradicts exactly what
      // we asserted. Same rule — read the bytes for the claim you made —
      // giving opposite answers because the claims are opposite.
      return present ? 'proven' : 'refuted'
    }
  }

  // ── 2. No readable graph. The hash is the only evidence left. ────────────
  const hash = res.graph_hash
  if (typeof hash !== 'string' || hash.length === 0) return 'unproven'
  if (typeof intent.baseGraphHash !== 'string' || intent.baseGraphHash.length === 0) {
    return 'unproven'
  }
  // An unmoved hash proves an unwritten graph. A moved one proves only that
  // SOMETHING changed — never that it was ours.
  return hash === intent.baseGraphHash ? 'refuted' : 'unproven'
}

/**
 * What the user is told when an add is captured but cannot be sent YET.
 *
 * ⚠⚠ THE SPECIFICITY IS THE WHOLE POINT, and it is inherited from the rename
 * lane rather than re-invented: what happened, what has NOT, when it will, and
 * what is lost if they reload first. UI #1025 REVERTED #1024 for shipping a
 * control that HID exactly this loss. The failure mode here is real and
 * reachable — the queue is memory-only — so the copy names it rather than
 * implying a durability the product has not earned, and it names the thing that
 * COMPLETES the write (any message at all, because that is what stamps a
 * `graph_hash` via `applyV5State`). No affordance terminating in refusal.
 */
export const STRUCTURAL_ADD_DEFERRED_NOTICE =
  "Added to the canvas. It isn't saved to the model yet — I'll save it with your next message. If you reload before then, it won't be there."

/**
 * ⭐⭐ WHAT A USER IS TOLD WHEN THE ADD'S TURN WAS INTERRUPTED — the trap the
 * rename lane hit, which this lane would hit identically.
 *
 * `useConversation` gates its whole optimistic resolution on `!isAbort`, and
 * its ABORT ARM handles `factor_value_edit` ONLY. Every V5 dispatch runs
 * `abortRef.current?.abort()` before installing its own controller. So adding a
 * node and then asking Olumi anything cancels the add's turn and NEITHER arm
 * runs: no removal, no confirmation, no sentence, and nothing in state to say
 * an attempt was made. The response arm is fenced again on
 * `activeV5TurnIdRef.current === turnClientId`, which discards a superseded
 * turn just as quietly.
 *
 * ⚠ IT MUST NOT REMOVE THE NODE. The cancel was CLIENT-side, CEE may well have
 * taken the add, and there are no committed bytes either way. Destroying the
 * user's node on that guess is the data-loss direction of the same harm.
 * `unconfirmed` is a legitimate TERMINAL state — "we sent it and never heard" —
 * and the honest move is to say so.
 *
 * Deliberately a TOAST rather than a chat message: the settle happens in the
 * drain, which outlives the React instance that started the send.
 */
export const STRUCTURAL_ADD_UNCONFIRMED_TOAST =
  "That went out just as you sent something else, so I can't tell you whether it saved. It's on the canvas — reload this decision to see what the model actually holds."

/**
 * Where one add gesture has got to. THREE outcomes, never two, and
 * `unconfirmed` is a terminal state rather than a polite word for success.
 *
 * ⚠ THE RECORD LIVES IN THE STORE, not in a closure owned by whichever
 * component happened to be mounted when the user typed.
 */
export type StructuralAddLifecycleStatus =
  | 'in_flight'
  | 'committed'
  | 'refused'
  | 'unconfirmed'

export interface StructuralAddLifecycleRecord {
  readonly intent: StructuralAddIntent
  /** The scenario this attempt was made against, captured at DISPATCH. */
  readonly scenarioId: string | null
  readonly status: StructuralAddLifecycleStatus
}

/** Everything except `in_flight` — the states a settle may write. */
export type StructuralAddTerminalStatus = Exclude<
  StructuralAddLifecycleStatus,
  'in_flight'
>

/**
 * How many records to keep. The drain is SERIALISED (one gesture at a time), so
 * at most one record is ever `in_flight` and a plain "keep the newest N" cannot
 * evict a live attempt.
 */
export const STRUCTURAL_ADD_LIFECYCLE_LIMIT = 20

/**
 * What the user is told when an add does not land.
 *
 * ⚠ THE WITHHELD CASE IS DELIBERATE AND IS NOT AN OMISSION. On the twelve
 * committed-200 refusal arms CEE speaks, with a better sentence than ours
 * because it names the specific reason — "Something with that identity is
 * already in your model, and I won't overwrite it", "I couldn't add that
 * without putting a number on it that you never gave me". The system-turn 200
 * branch renders that prose. Adding a notice beside it would put TWO VOICES on
 * one outcome and ours would be the vaguer.
 *
 * ⚠⚠ THE 409 IS THE EXCEPTION, AND IT IS NOT SYMMETRIC WITH THE 200s. CEE's
 * `BASE_HASH_DIVERGED` arm composes an `assistant_text` — "The model has
 * changed since you added that, so I haven't put it in" — and **the client
 * never sees it**, because a 409 returns a `BoundaryError` envelope rather than
 * the writer's response (CEE `orchestrator/route-v2.ts`; ⚠ the line range this
 * comment used to cite was WRONG and is removed rather than guessed again — the
 * BEHAVIOUR was independently confirmed, the citation was not). So the one
 * refusal where
 * CEE's own words are unreachable is precisely the one where the UI must
 * supply them. Derived, not assumed by symmetry with the 200 arms.
 */
export const STRUCTURAL_ADD_NOTICE = {
  /**
   * 409 `GRAPH_DIVERGED` / `BASE_HASH_DIVERGED`. CEE guarantees it wrote
   * nothing, so the node is taken back off the canvas.
   *
   * ⚠ THE ACTION NAMED IS THE ONE THAT ACTUALLY REFRESHES THE BASE, inherited
   * from `STRUCTURAL_DELETE_NOTICE.base_hash_diverged` rather than re-reasoned:
   * "try again" re-sends the SAME `base_graph_hash` and refuses identically
   * forever, and "reload, then add it again" builds a fresh store with
   * `lastServerGraphHash` null. What DOES refresh it is a turn — `applyV5State`
   * captures the top-level `graph_hash` off every response — so the copy asks
   * for the one thing that works, in-session, with no reload.
   */
  base_hash_diverged:
    "The saved model changed while you were adding that, so it wasn't saved — I've taken it back off rather than show you something the model doesn't hold. Ask me anything about this decision and I'll re-sync, then add it again.",
  /**
   * The server answered and the evidence says it did not write. CEE said
   * nothing we can render, so we say it.
   */
  refused_server:
    "That wasn't saved to the model, so I've taken it back off the canvas rather than show you something that isn't there.",
  /**
   * ⭐ THE STOOD-DOWN-CONNECTED CASE. The add was refused, but the node has
   * since been linked to something. Removing it would destroy an edge THIS
   * GESTURE DID NOT CREATE, which is the data-loss direction of the same harm,
   * so the node stays and the state is named exactly instead. The canvas is
   * then knowingly ahead of the model, and saying so is the whole contract of
   * this lane.
   */
  refused_left_on_canvas:
    "That wasn't saved to the model. You've since connected it, so I've left it on the canvas rather than delete your link — but it won't be there when you reload.",
  /**
   * The turn reached the server and we hold no evidence either way. The node is
   * LEFT ALONE, because removing it on a guess is data loss, which is strictly
   * worse than the uncertainty it would be trying to hide.
   */
  unconfirmed_server:
    "I couldn't confirm that reached the saved model. It's on the canvas, but it may not be there when you reload — reload this decision to see what the model actually holds.",
  /** Nothing reached the server. Same epistemic position, different cause. */
  unconfirmed_transport:
    "That didn't reach the server, so the saved model may not have it. It's on the canvas — reload this decision to see what the model actually holds.",
} as const

export type StructuralAddNoticeKey = keyof typeof STRUCTURAL_ADD_NOTICE

/** What a revert did — reported, never assumed. */
export type StructuralAddRevertOutcome =
  /** The node this gesture created is off the canvas again. */
  | 'removed'
  /** Nothing to do: the node is already gone. */
  | 'already_absent'
  /** Newer truth is on the canvas — the scenario moved, or the node changed. */
  | 'stood_down'
  /**
   * The node has acquired an edge since it was added. Removing it would destroy
   * a link this gesture never created, so it is left and the user is told.
   */
  | 'stood_down_connected'

export interface RevertStructuralAddStore {
  readonly nodes: readonly Node[]
  readonly edges: readonly { source?: unknown; target?: unknown }[]
  readonly currentScenarioId?: string | null
  applyStructuralAddRevert: (removal: { nodeId: string }) => void
}

/**
 * Take back a node the server did not save.
 *
 * STAND-DOWN DISCIPLINE, inherited from `revertStructuralRename` and
 * `revertStructuralDelete` and then EXTENDED, because this revert is the only
 * one of the three that DESTROYS rather than restores.
 *
 * A rename revert puts a string back; if it is wrong the user retypes it. An
 * add revert deletes a node, and if it is wrong the user has lost work with no
 * undo entry pointing at it. So it writes only when every one of these holds:
 *
 *   · the scenario is still the one the gesture was made against;
 *   · the node is still there (absent → nothing to do, and NOT an error);
 *   · it still holds the LABEL AND KIND this intent asserted — if the user has
 *     renamed or retyped it, the canvas is describing something this gesture
 *     never sent, and removing it would be a silent overwrite dressed as a
 *     correction;
 *   · nothing has been connected to it — see `stood_down_connected`.
 *
 * ⚠ BOUND BY IDENTITY, and the kind is checked as well as the label because a
 * node that was retyped from `factor` to `option` is a different assertion than
 * the one the server refused.
 */
export function revertStructuralAdd(
  intent: StructuralAddIntent,
  store: RevertStructuralAddStore,
  capturedScenarioId: string | null,
  resolveKind: (node: Node) => string | null,
): StructuralAddRevertOutcome {
  if ((store.currentScenarioId ?? null) !== capturedScenarioId) return 'stood_down'

  const node = store.nodes.find((n) => n.id === intent.nodeId)
  if (!node) return 'already_absent'

  const currentLabel = (node.data as { label?: unknown } | undefined)?.label
  if (currentLabel !== intent.label) return 'stood_down'
  if (resolveKind(node) !== intent.nodeKind) return 'stood_down'

  const connected = store.edges.some(
    (e) => e.source === intent.nodeId || e.target === intent.nodeId,
  )
  if (connected) return 'stood_down_connected'

  store.applyStructuralAddRevert({ nodeId: intent.nodeId })
  return 'removed'
}
