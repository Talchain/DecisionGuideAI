/**
 * structuralDelete — the UI half of the DURABLE removal (schemas 0.48.0).
 *
 * THE DEFECT THIS CLOSES, in the founder's words: *"Every time I try to re-run
 * the analysis, it fails because it keeps adding the option that I deleted
 * back."* Root cause was transport, not logic. Until 0.48.0 no UI→CEE
 * vocabulary had a removal verb, so a canvas delete reached the server only as
 * the debounced `direct_graph_edit` NOTIFICATION — which CEE classifies
 * `'ack_and_commit'`: a turn row and NO graph write. The server's model never
 * lost the node, and the next `loadPersistedGraphStrict` handed it back.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY NOT THE DEBOUNCED HOOK — derived, and the reason is the hash.
 *
 * `useGraphEditEvents` coalesces 1.5s of mutations into one notification and
 * flushes AFTER the window. `base_graph_hash` is an optimistic-concurrency
 * assertion about *the graph the user was looking at when they deleted*, so a
 * hash read at flush time describes a graph that may already have moved — the
 * gate would then refuse a delete the user made correctly, or (worse) pass one
 * made against a graph they never saw. The intent is therefore captured
 * SYNCHRONOUSLY inside the store's delete actions, against the PRE-delete
 * graph, and drained immediately.
 *
 * ⚠ THE BRIEF NAMED `commitValidatedMutation` AS THE CALL SITE. That premise
 * does not hold at this tip and the corrected one is here: that function is the
 * CONTEXT-MENU path only (`canvas/contextMenu/actions.ts` is its sole caller),
 * it holds no base graph hash, and it is bypassed entirely by the two other
 * live delete gestures — the keyboard shortcut
 * (`useKeyboardShortcuts.ts:197` → `deleteSelected`) and the edge inspector
 * (`ui/EdgeInspector.tsx:167` → `deleteEdge`). Emitting from it would have left
 * the primary gesture silent. The one chokepoint every gesture crosses is the
 * store's four delete actions, so the capture lives there and this module holds
 * the logic.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHICH HASH — the estate has TWO same-named graph hashes and picking wrong
 * makes every delete refuse.
 *
 *   · `canvas/utils/graphHash.ts::generateGraphHash` — the UI's OWN algorithm.
 *     `V5CoachingBlock.tsx:263` already records that it is "a DIFFERENT
 *     algorithm" from CEE's. Never comparable server-side.
 *   · `adapters/cee/scenarioGraph.ts::graph_identity_hash` — CEE's 64-hex
 *     `identity.v1` envelope. CEE's own writer states the identity hash "has no
 *     wire emitter at all, so a client cannot hold one; comparing against it
 *     would be a gate that can never match".
 *   · **`OlumiResponse.graph_hash` — CEE's ANALYSIS-AFFECTING hash (`aag_v1`,
 *     16 hex).** This is the one `applyStructuralDelete` compares against
 *     (`computeAnalysisAffectingGraphHash`), and CEE stamps the same value on
 *     `analysis_ready.current_graph_hash` (measured byte-identical across six
 *     live turn captures in `src/v5/__tests__/fixtures/`).
 *
 * So the client ECHOES the last hash CEE stamped; it never computes one. That
 * is the same idiom `edge_strength_edit.expected` uses — "an optimistic-
 * concurrency assertion, not the requested value".
 *
 * ⚠ KNOWN GAP, stated rather than papered over: when no CEE hash has been
 * received in this session (e.g. a page reload that hydrates the canvas from
 * Supabase and deletes before any turn), there is no base to assert and the
 * contract forbids absent/null/empty. This module then records NO intent and
 * the delete keeps exactly today's behaviour — local plus the `direct_graph_edit`
 * notification. It does not fabricate a hash, and it does not claim a durability
 * it cannot deliver. `captureStructuralDelete` reports the reason so the gap is
 * observable rather than silent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EDGES BY ENDPOINT PAIR, AND THE CASCADE IS THE SERVER'S.
 *
 * `EdgeV3Schema` declares no `id`, so an edge's only canonical identity is
 * `(from, to)` — the contract refuses an id-keyed shape outright, and React
 * Flow's ids (`reactflow__edge-…`, `e-0`) are client-local. Endpoints are read
 * off the canvas edge's `source`/`target`, through the estate's single identity
 * definition (`canvas/utils/graphIdentity.ts`).
 *
 * Edges incident to a removed NODE are ELIDED from the payload: CEE's
 * `applyRemoveNode` owns the incident-edge cascade and
 * `elideCascadeRedundantRemoveEdges` drops exactly those ops, so enumerating
 * them adds nothing and adds a way to be wrong. Only edges the user removed
 * INDEPENDENTLY of a node removal are named. Note what this is not: it is not a
 * `cascade: true` flag (the contract forbids one) — the server derives what
 * actually left from base-vs-committed graphs and reports that.
 *
 * ONE PAYLOAD PER GESTURE. Removing a node necessarily removes its incident
 * edges; a partial apply leaves dangling edges. The contract's arrays are plural
 * and the event is one transaction, so a multi-select delete is ONE intent, never
 * N single-element turns.
 */

import type { SystemEventTurnPayload } from '@talchain/schemas/boundary'
import type { Edge, Node } from '@xyflow/react'

import type { EdgeData } from '../domain/edges'
import { canvasEdgePairKey, edgePairKey } from '../utils/graphIdentity'

/**
 * A canonical GraphV3 edge reference — the endpoint pair IS the edge's identity.
 *
 * ⚠ DERIVED FROM THE UNION MEMBER, not imported by name and not hand-rolled.
 * 0.48.0 declares `CanonicalEdgeRef` in `boundary/turn-payload.ts` but its
 * `boundary/index` re-exports neither that type nor `refineStructuralDelete`
 * (measured in the vendored `dist/boundary/index.d.ts`), so importing it by name
 * does not compile. Extracting it from `SystemEventTurnPayload` is the pattern
 * `buildPayload.ts` already uses for every other wire event and it cannot drift:
 * if the contract changes the shape, this type changes with it.
 */
export type CanonicalEdgeRef = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'structural_delete' }
>['removed_edges'][number]

/** Why a delete gesture produced no wire intent. Never a silent drop. */
export type StructuralDeleteStandDownReason =
  /** No CEE-stamped `graph_hash` has been seen this session — see the KNOWN GAP above. */
  | 'no_server_graph_hash'
  /** The gesture removed nothing resolvable (the contract refuses an empty delete). */
  | 'nothing_removed'
  /** The mutation was applied by a producer (patch-apply, hydration), not a user. */
  | 'external_mutation'

/**
 * One user delete gesture, captured against the PRE-delete graph.
 *
 * `restore` holds the removed elements VERBATIM so a refusal can put the canvas
 * back. It is UI state (positions, measured sizes, selection) that CEE has never
 * seen and can never return — reconstructing it from a receipt is impossible,
 * which is why it is captured here rather than re-derived later.
 */
export interface StructuralDeleteIntent {
  /** Correlates the send with its capture; also the dedupe key for the queue. */
  readonly id: string
  /** Canonical node ids removed, sorted and deduped. */
  readonly removedNodeIds: readonly string[]
  /** Canonical edge refs removed INDEPENDENTLY of any removed node. */
  readonly removedEdges: readonly CanonicalEdgeRef[]
  /** The CEE-stamped `aag_v1` hash of the graph the user was looking at. */
  readonly baseGraphHash: string
  /** Canvas ids claimed by this intent, so the notification hook does not double-report. */
  readonly claimedNodeIds: readonly string[]
  readonly claimedEdgeIds: readonly string[]
  /** Verbatim removed elements, for an evidence-grounded revert. */
  readonly restore: {
    readonly nodes: readonly Node[]
    readonly edges: readonly Edge<EdgeData>[]
  }
}

export type CaptureStructuralDeleteResult =
  | { readonly ok: true; readonly intent: StructuralDeleteIntent }
  | { readonly ok: false; readonly reason: StructuralDeleteStandDownReason }

export interface CaptureStructuralDeleteInput {
  /** Nodes as they were BEFORE the deletion was applied. */
  readonly nodesBefore: readonly Node[]
  /** Edges as they were BEFORE the deletion was applied. */
  readonly edgesBefore: readonly Edge<EdgeData>[]
  /** Canvas node ids the gesture removes. */
  readonly removedNodeIds: Iterable<string>
  /** Canvas edge ids the gesture removes EXPLICITLY (incident ones are derived). */
  readonly removedEdgeIds: Iterable<string>
  /** The last CEE-stamped `graph_hash`, or null when none has been seen. */
  readonly baseGraphHash: string | null
  /** `_externalMutationActive > 0` — a producer write, not a user gesture. */
  readonly externalMutationActive: boolean
  /** Injected so the capture is deterministic under test. */
  readonly makeId: () => string
}

/**
 * The endpoint-id constraints `CanonicalEdgeEndpointIdSchema` enforces, applied
 * BEFORE the wire so a malformed local id becomes a stand-down rather than a
 * 422 that rejects the whole turn.
 *
 * DERIVED FROM THE PRODUCER'S SCHEMA, not from what our ids happen to look
 * like: non-empty, no surrounding whitespace, and never a delimiter-bearing
 * composite (`→` / `->`), which the contract reserves for composite adapters.
 */
export function isCanonicalEndpointId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id === id.trim() &&
    !id.includes('→') &&
    !id.includes('->')
  )
}

/**
 * Capture one gesture. Returns a stand-down reason rather than a partial intent:
 * a delete we cannot express correctly must not be expressed approximately.
 */
export function captureStructuralDelete(
  input: CaptureStructuralDeleteInput,
): CaptureStructuralDeleteResult {
  if (input.externalMutationActive) return { ok: false, reason: 'external_mutation' }

  const baseGraphHash = input.baseGraphHash
  if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) {
    return { ok: false, reason: 'no_server_graph_hash' }
  }

  const requestedNodeIds = new Set(input.removedNodeIds)
  const requestedEdgeIds = new Set(input.removedEdgeIds)

  const nodesById = new Map(input.nodesBefore.map((n) => [n.id, n]))
  const nodeIdsPresent = new Set(input.nodesBefore.map((n) => n.id))

  // Nodes: resolve against the PRE-delete graph and against the contract's id
  // rules. An id the canvas does not hold cannot be described to the server.
  const removedNodeIds: string[] = []
  const restoreNodes: Node[] = []
  for (const id of [...requestedNodeIds].sort()) {
    const node = nodesById.get(id)
    if (!node || !isCanonicalEndpointId(id)) continue
    removedNodeIds.push(id)
    restoreNodes.push(node)
  }
  const removedNodeIdSet = new Set(removedNodeIds)

  // Edges: every edge the gesture removes — the explicitly-selected ones AND the
  // ones the canvas drops because an endpoint went. `restore` needs ALL of them
  // (a revert must put the whole gesture back); the WIRE gets only the ones the
  // server's cascade will not already take.
  const restoreEdges: Edge<EdgeData>[] = []
  const claimedEdgeIds: string[] = []
  const wireEdgesByPair = new Map<string, CanonicalEdgeRef>()
  for (const edge of input.edgesBefore) {
    const incident =
      removedNodeIdSet.has(String(edge.source)) || removedNodeIdSet.has(String(edge.target))
    const selected = requestedEdgeIds.has(edge.id)
    if (!incident && !selected) continue

    restoreEdges.push(edge)
    claimedEdgeIds.push(edge.id)

    // Elided: the server's `applyRemoveNode` cascade owns this one.
    if (incident) continue
    // ⚠ AN EDGE WHOSE ENDPOINT THE GRAPH NO LONGER HOLDS IS NOT NAMEABLE.
    // CEE resolves every named edge against its persisted graph and refuses the
    // WHOLE removal on `edge_target_unresolvable`, so naming one costs the user
    // the entire delete. This also does the eliding in the split-callback case:
    // React Flow reports node removals and edge removals through two SEPARATE
    // store callbacks, so when the nodes go first the incident edges arrive with
    // their endpoint already gone — `incident` above cannot see that, and this
    // can.
    if (!nodeIdsPresent.has(String(edge.source)) || !nodeIdsPresent.has(String(edge.target))) {
      continue
    }
    if (!isCanonicalEndpointId(edge.source) || !isCanonicalEndpointId(edge.target)) continue
    const key = canvasEdgePairKey(edge)
    if (key === null || wireEdgesByPair.has(key)) continue
    wireEdgesByPair.set(key, { from: edge.source, to: edge.target })
  }

  const removedEdges = [...wireEdgesByPair.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, ref]) => ref)

  // `refineStructuralDelete` refuses both-arrays-empty. Stand down here rather
  // than spend a turn, a commit and a hash comparison to change nothing.
  if (removedNodeIds.length === 0 && removedEdges.length === 0) {
    return { ok: false, reason: 'nothing_removed' }
  }

  return {
    ok: true,
    intent: {
      id: input.makeId(),
      removedNodeIds,
      removedEdges,
      baseGraphHash,
      claimedNodeIds: removedNodeIds,
      claimedEdgeIds,
      restore: { nodes: restoreNodes, edges: restoreEdges },
    },
  }
}

/**
 * Fold two intents captured in the SAME synchronous tick into one.
 *
 * ⚠ THIS EXISTS BECAUSE ONE GESTURE CAN REACH THE STORE THROUGH TWO CALLBACKS.
 * React Flow's built-in delete (default `deleteKeyCode` = Backspace/Delete, and
 * no `deleteKeyCode` prop is set on this canvas) reports node removals through
 * `onNodesChange` and edge removals through `onEdgesChange` — two separate store
 * writes for ONE keypress. Recorded naively that is two turns, and the second
 * one is refused BY CONSTRUCTION: the first commit moves the persisted hash, so
 * the second carries a base the server has already left behind. The user would
 * get a spurious "the model changed since you deleted that" for a wait we chose.
 *
 * Merging is only sound within a tick, and that is exactly the window used: no
 * turn can have been sent and no hash can have moved, so both halves genuinely
 * describe the same base graph — asserted below rather than assumed.
 *
 * The re-elision at the end is load-bearing. An edge that was independent when
 * the edge half was captured becomes cascade-redundant once the node half is
 * folded in, and naming it would be the duplicate-op the server's
 * `elideCascadeRedundantRemoveEdges` exists to drop.
 */
export function mergeStructuralDeleteIntents(
  first: StructuralDeleteIntent,
  second: StructuralDeleteIntent,
): StructuralDeleteIntent {
  if (first.baseGraphHash !== second.baseGraphHash) {
    // Not reachable within a tick — but if it ever is, folding would attach one
    // half's ids to the other half's base assertion, which is the one thing this
    // event must never do.
    return second
  }

  const removedNodeIds = [...new Set([...first.removedNodeIds, ...second.removedNodeIds])].sort()
  const removedNodeIdSet = new Set(removedNodeIds)

  const edgesByPair = new Map<string, CanonicalEdgeRef>()
  for (const e of [...first.removedEdges, ...second.removedEdges]) {
    if (removedNodeIdSet.has(e.from) || removedNodeIdSet.has(e.to)) continue
    edgesByPair.set(edgePairKey(e.from, e.to), e)
  }
  const removedEdges = [...edgesByPair.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, ref]) => ref)

  const dedupeById = <T extends { id: string }>(items: readonly T[]): T[] => {
    const byId = new Map<string, T>()
    for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item)
    return [...byId.values()]
  }

  return {
    // The FIRST intent's id survives: the drainer and any telemetry already
    // correlate the gesture by it.
    id: first.id,
    removedNodeIds,
    removedEdges,
    baseGraphHash: first.baseGraphHash,
    claimedNodeIds: [...new Set([...first.claimedNodeIds, ...second.claimedNodeIds])].sort(),
    claimedEdgeIds: [...new Set([...first.claimedEdgeIds, ...second.claimedEdgeIds])].sort(),
    restore: {
      nodes: dedupeById([...first.restore.nodes, ...second.restore.nodes]),
      edges: dedupeById([...first.restore.edges, ...second.restore.edges]),
    },
  }
}

/** The `system_event` payload this intent sends. Field names are the contract's. */
export type StructuralDeleteWirePayload = {
  removed_node_ids: string[]
  removed_edges: { from: string; to: string }[]
  base_graph_hash: string
}

export function buildStructuralDeleteWirePayload(
  intent: StructuralDeleteIntent,
): StructuralDeleteWirePayload {
  return {
    removed_node_ids: [...intent.removedNodeIds],
    removed_edges: intent.removedEdges.map((e) => ({ from: e.from, to: e.to })),
    base_graph_hash: intent.baseGraphHash,
  }
}

/**
 * Does this response PROVE the server removed what we asked?
 *
 * ⚠ ABSENCE FROM THE COMMITTED GRAPH IS THE PROOF, and `draft_graph` is the
 * carrier — CEE's own words: *"the authoritative UI-facing receipt is the
 * `draft_graph` applied-graph field that `dispatch.ts` stamps from the COMMITTED
 * bytes"*, and `mergeAppliedGraph.ts` already records the same rule from the
 * other side (*"ABSENCE THEREFORE MEANS DELETION"*). CEE stamps `draft_graph`
 * ONLY after re-reading the committed bytes and verifying every removal landed;
 * every refusal and every withheld success omits it.
 *
 * So this is deliberately a THREE-WAY answer, not a boolean. `'refuted'` means
 * we hold a graph that still contains the element — positive evidence the
 * removal did not happen. `'unproven'` means we hold no graph at all and know
 * nothing, which must never be treated as either outcome (P3: an unknown may not
 * be replaced by a more convenient certainty).
 */
export type StructuralDeleteReceipt = 'proven' | 'refuted' | 'unproven'

export function readStructuralDeleteReceipt(
  intent: StructuralDeleteIntent,
  response: unknown,
): StructuralDeleteReceipt {
  const draftGraph = (response as { draft_graph?: unknown } | null | undefined)?.draft_graph
  if (!draftGraph || typeof draftGraph !== 'object') return 'unproven'

  const rawNodes = (draftGraph as { nodes?: unknown }).nodes
  const rawEdges = (draftGraph as { edges?: unknown }).edges
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) return 'unproven'

  const survivingNodeIds = new Set(
    rawNodes
      .map((n) => (n as { id?: unknown } | null)?.id)
      .filter((id): id is string => typeof id === 'string'),
  )
  const survivingEdgePairs = new Set(
    rawEdges
      .map((e) => {
        const from = (e as { from?: unknown; source?: unknown } | null)?.from
          ?? (e as { source?: unknown } | null)?.source
        const to = (e as { to?: unknown; target?: unknown } | null)?.to
          ?? (e as { target?: unknown } | null)?.target
        return typeof from === 'string' && typeof to === 'string' ? edgePairKey(from, to) : null
      })
      .filter((k): k is string => k !== null),
  )

  // Bound by IDENTITY: this intent's exact ids and exact endpoint pairs. A
  // different element having gone is not evidence about ours.
  const everyNodeGone = intent.removedNodeIds.every((id) => !survivingNodeIds.has(id))
  const everyEdgeGone = intent.removedEdges.every(
    (e) => !survivingEdgePairs.has(edgePairKey(e.from, e.to)),
  )
  return everyNodeGone && everyEdgeGone ? 'proven' : 'refuted'
}

/** What a revert did — reported, never assumed. */
export type StructuralDeleteRevertOutcome =
  /** The removed elements were put back. */
  | 'restored'
  /** Nothing to do: every element is already present (the gesture was undone, or a receipt re-added it). */
  | 'already_present'
  /** The scenario moved on — restoring would write into a graph this gesture never described. */
  | 'stood_down'

export interface RevertStructuralDeleteStore {
  readonly nodes: Node[]
  readonly edges: Edge<EdgeData>[]
  readonly currentScenarioId?: string | null
  applyStructuralDeleteRevert: (restore: {
    nodes: readonly Node[]
    edges: readonly Edge<EdgeData>[]
  }) => void
}

/**
 * Put back what the server refused to remove.
 *
 * STAND-DOWN DISCIPLINE, copied from `revertOptimisticFactorEdit` for the same
 * reason: a late revert must not overwrite newer truth. It restores only the
 * elements still ABSENT, never re-adds one the user has since recreated, and
 * declines entirely once the scenario has changed under it.
 */
export function revertStructuralDelete(
  intent: StructuralDeleteIntent,
  store: RevertStructuralDeleteStore,
  capturedScenarioId: string | null,
): StructuralDeleteRevertOutcome {
  if ((store.currentScenarioId ?? null) !== capturedScenarioId) return 'stood_down'

  const presentNodeIds = new Set(store.nodes.map((n) => n.id))
  const presentEdgePairs = new Set(
    store.edges.map((e) => canvasEdgePairKey(e)).filter((k): k is string => k !== null),
  )

  const nodes = intent.restore.nodes.filter((n) => !presentNodeIds.has(n.id))
  const edges = intent.restore.edges.filter((e) => {
    const key = canvasEdgePairKey(e)
    if (key === null || presentEdgePairs.has(key)) return false
    // Never restore an edge whose endpoints are not both on the canvas — that
    // would be the dangling-edge hazard the server refuses, created locally.
    const endpointsPresent =
      (presentNodeIds.has(String(e.source)) || nodes.some((n) => n.id === e.source)) &&
      (presentNodeIds.has(String(e.target)) || nodes.some((n) => n.id === e.target))
    return endpointsPresent
  })

  if (nodes.length === 0 && edges.length === 0) return 'already_present'
  store.applyStructuralDeleteRevert({ nodes, edges })
  return 'restored'
}

/**
 * The `details.conflict_category` values on a 409 `GRAPH_DIVERGED` for which
 * CEE ITSELF STATES the write did not land. Membership here is what entitles
 * the resolver to revert the canvas and to promise, in
 * `STRUCTURAL_DELETE_NOTICE.base_hash_diverged`, that nothing was removed.
 *
 * ⚠ NO LONGER A PRIVATE SET — IT IS THE SHARED ONE, BY REFERENCE.
 * `factor_value_edit` is the second optimistic writer to need exactly this
 * question answered, and two writers each carrying their own copy of a
 * producer-derived set is the differently-drifting-twins defect: the next
 * category CEE adds would land in one copy and not the other, and the writer
 * left behind would go on asserting a state the server declined, silently,
 * under a green suite. The single definition — with the full producer
 * derivation for each member, and the reasons the set must stay closed — lives
 * at `v5/provenNoWriteConflict.ts`. This alias is kept because the name reads
 * correctly at this call site and because the delete's own conflict spec binds
 * to it; it is an ALIAS, not a copy, so a drift is not expressible.
 */
export { PROVEN_NO_WRITE_CONFLICT_CATEGORIES as STRUCTURAL_DELETE_NO_WRITE_CONFLICT_CATEGORIES } from '../../v5/provenNoWriteConflict'

/**
 * The one honest sentence for a delete whose fate we could not confirm, keyed by
 * OUTCOME rather than composed at each site.
 *
 * ⚠ EMITTED ONLY WHERE CEE'S OWN PROSE DOES NOT RENDER. On a 200 the
 * `assistant_text` branch of `sendTurn` renders CEE's message for system turns
 * too, and CEE already says exactly what happened ("…so I haven't removed
 * anything. Reload it and try again."). Adding a second sentence there would put
 * two voices on one outcome. A typed error and a transport failure render NO
 * bubble in system mode — that silence is what these fill.
 */
export const STRUCTURAL_DELETE_NOTICE = {
  /**
   * 409 `GRAPH_DIVERGED` / `BASE_HASH_DIVERGED`. CEE guarantees it wrote nothing,
   * so the elements are back.
   *
   * ⚠ THE ACTION NAMED HERE IS DERIVED FROM WHAT ACTUALLY REFRESHES THE BASE,
   * and two more obvious instructions are wrong — both were in this string at
   * some point and both are affordances terminating in refusal (P8):
   *
   *   · "Try again" — a bare retry re-sends the SAME `base_graph_hash`, because
   *     `lastServerGraphHash` only moves when a turn response stamps a new one.
   *     It refuses identically, forever, in a loop of the product's own making.
   *   · "Reload, then delete again" — a reload builds a fresh store and hydrates
   *     from Supabase with NO CEE turn, so `lastServerGraphHash` is null and the
   *     next delete STANDS DOWN silently (the warning is DEV-gated). The user
   *     would follow the instruction straight back into the original defect.
   *     Seeding the hash at hydration is not available either: the scenario-graph
   *     READ returns `graph_identity_hash` (the 64-hex identity token) and no
   *     `graph_hash` at all — measured, with a contrast control.
   *
   * What DOES refresh it is a turn: `applyV5State` captures the top-level
   * `graph_hash` off every response, so any message re-syncs the base — and on a
   * receipt-bearing turn `reconcileAppliedGraph` re-syncs the canvas with it. So
   * the copy asks for the one thing that works, and it works in-session with no
   * reload at all.
   */
  base_hash_diverged:
    "The saved model changed since you deleted that, so nothing was removed — I've put it back on the canvas rather than show you a deletion that never happened. Ask me anything about this decision and I'll re-sync with the saved model, then delete it again.",
  /**
   * Any other server-side failure. The turn reached the server and failed; we
   * hold no committed bytes, so we know neither that it landed nor that it did
   * not. Saying "couldn't confirm" is the only claim the evidence supports.
   */
  unconfirmed_server:
    "I couldn't confirm that deletion reached the saved model. It's still gone from the canvas, but it may come back when you reload or re-run — reload this decision to see what the model actually holds.",
  /**
   * Nothing reached the server. Same epistemic position, different cause; the
   * copy avoids blaming the model for a network failure.
   */
  unconfirmed_transport:
    "That deletion didn't reach the server, so the saved model may still contain it. It's still gone from the canvas — reload this decision to see what the model actually holds.",
} as const

export type StructuralDeleteNoticeKey = keyof typeof STRUCTURAL_DELETE_NOTICE
