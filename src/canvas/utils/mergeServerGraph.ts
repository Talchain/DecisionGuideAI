/**
 * mergeServerGraphOnHydrate — VALUES FROM THE SERVER, LAYOUT FROM LOCAL.
 *
 * ROADMAP 2.312 piece 3. On boot, the canvas restores from the localStorage
 * autosave (`ReactFlowGraph`'s init effect → `hydrateGraphSlice`) and nothing
 * ever asked the server what it holds for this scenario. The measured
 * consequence: a persisted edit is forgotten on refresh, and a later edit
 * REBASES against a value the user was never shown (the server recorded "from
 * £3,500 to £4,200" where the screen said £4,000).
 *
 * This closes that by merging CEE's copy over the restored canvas. The two
 * sides are authoritative for different things and neither is authoritative
 * for both:
 *
 *   · CEE owns the ANALYTICAL state. `scenarios.graph` is what every turn and
 *     every analysis is computed from.
 *   · The CANVAS owns the LAYOUT. `scenarios.graph` carries no geometry at all
 *     — no `position`, no `x`/`y`, no `layout` — and CEE measures that on the
 *     bytes it returns (`layout_present`, false for every real graph today).
 *     The autosave is the only place a position has ever existed.
 *
 * ⚠ NEVER go through `hydrateGraphSlice` for this. That path REPLACES the
 * node array, so the server's layout-free nodes would land at {0,0} and the
 * user's canvas would scramble on every refresh. The position-preserving
 * overlay is the only correct write, and it is the SAME `overlayNode` /
 * `overlayEdge` the applied-edit receipt path uses — imported, not copied.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE BOUNDARY — SERVER-WINS-ON-VALUES, AT BOOT, ONCE
 * ─────────────────────────────────────────────────────────────────────────────
 * Hydration re-opens last-writer-wins between the server row and the
 * localStorage autosave, and this merge resolves it ONE way and only at boot:
 * on a field both sides carry, the server's value wins. That is deliberate —
 * the server's copy is what the next turn and the next analysis will be
 * computed against, so showing anything else is the rebase defect again.
 *
 * What is NOT in scope, and is NOT silently half-done here:
 *   · no continuous sync — this runs at boot, not on every change;
 *   · no compare-and-swap — the UI does not write back through this path;
 *   · no DELETION. An element the canvas has and the server does not SURVIVES.
 *     The autosave can legitimately be ahead of the server (guest inspector
 *     edits never reach CEE at all — ROADMAP 2.304), so reconciling absence to
 *     deletion would trade a stale value for lost work. Absence is only ever
 *     authoritative on the applied-edit receipt path, which has a receipt to
 *     justify it; a boot read has none.
 *
 * The residual is therefore named rather than hidden: a local-only edit made
 * before this boot keeps its node on the canvas, but a field the server also
 * carries is overwritten by the server's value. That is the ruled behaviour
 * for this rung; a CAS/merge-policy rung is a separate row if wanted.
 *
 * ⚠ AND BECAUSE THAT OVERWRITE IS REAL, IT IS NOT SILENT. Whenever this merge
 * moves at least one EXISTING value it (1) pushes a pre-merge history snapshot,
 * so the revert is undoable rather than unrecoverable — the autosave would
 * otherwise persist the reverted state ~1.5s later and destroy the last copy —
 * and (2) pulses the changed elements on the existing applied-edit surface, so
 * a number cannot move under the user unannounced. Neither fires on a pure
 * addition or a no-op. See the commit block below.
 */

import { useCanvasStore } from '../store'
import { logger } from '../../lib/logger'
import { canvasEdgePairKey, wireEdgePairKey } from './graphIdentity'
import { pulseAppliedTargets } from './appliedEditPulse'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from './applyDraftResult'
import {
  ADDED_COLUMN_X_GAP,
  ADDED_COLUMN_Y_STEP,
  overlayEdge,
  overlayNode,
} from './mergeAppliedGraph'
import {
  captureUserProvenance,
  clearEdgeUserReviewOnValueChange,
  clearUserProvenance,
  observedValueUnchanged,
  restoreUserProvenance,
} from './hydrateProvenance'

/** Structural equality, matching the overlay's own no-op test. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Why a merge REFUSED the server's graph. Each value corresponds to one guard
 * below; `null` on the accepted path.
 */
export type MergeServerGraphRefusal =
  /** Not an object — nothing that could be a graph arrived. */
  | 'unusableShape'
  /** An object with no nodes AND no edges. Nothing was observed. */
  | 'emptyServerGraph'
  /** Zero node-id overlap with a non-empty canvas — two unrelated graphs. */
  | 'zeroOverlap'
  /**
   * ROADMAP 2.467/2.503 — the canvas holds a graph the SERVER HAS NEVER SEEN.
   *
   * THE DEFECT THIS CLOSES, live-witnessed 5 Aug: import a file, press F5
   * WITHOUT saving, and the imported values were silently GONE. This module's
   * own rule is "VALUES FROM THE SERVER, LAYOUT FROM LOCAL" — `overlayNode`
   * does `{...existing.data, ...mapped.data}`, so CEE's `label` wins on every
   * node id it shares. That rule is CORRECT once the server has the graph, and
   * destructive before it does: nothing had registered the import, so the boot
   * merge restored the pre-import model over the user's own work, without a
   * word. Not a trust-of-numbers defect — the freshness posture stayed honestly
   * cannot-confirm throughout — but the user's EDIT being undone.
   *
   * ⚠ THIS IS DELIBERATELY NOT A STANDALONE PATCH OF THE MERGE RULE. Weakening
   *   server-wins in general would trade one silent divergence for another. The
   *   refusal is scoped to exactly the window in which the server's copy is
   *   KNOWN to be the older one, and it ENDS when registration is acknowledged:
   *   `releaseImportRegistration` drops the hold, the next hydrate finds no
   *   marker, and server-wins resumes with the server holding the user's graph.
   *   Symptom and cause are closed by the same train.
   */
  | 'importUnregistered'

export interface MergeServerGraphResult {
  addedNodeCount: number
  addedEdgeCount: number
  updatedNodeCount: number
  updatedEdgeCount: number
  /**
   * Always 0. Present so the shape matches the receipt reconciler's and so the
   * "boot never deletes" invariant is an ASSERTABLE counter rather than a
   * promise in a comment.
   */
  removedNodeCount: number
  removedEdgeCount: number
  /**
   * ⚠ WHETHER THE SERVER'S GRAPH WAS READ AT ALL — NOT WHETHER IT MOVED ANYTHING.
   *
   * Every refusal below used to return the SAME all-zero counts an ACCEPTED but
   * idempotent merge returns, so the caller could not distinguish "I read the
   * server's graph and it already matched" from "I refused to look at it". The
   * hydration caller then recorded CEE's identity token — a claim that we have
   * APPLIED that graph — on graphs it had just thrown away.
   *
   * The definition is STRUCTURAL, not a flag someone must remember to set:
   * `accepted` is true exactly when control reaches the body that records
   * `lastAuthoritativeGraph`. The two identity records therefore answer to ONE
   * rule and cannot drift apart.
   */
  accepted: boolean
  /** The guard that refused. `null` when `accepted`. */
  refusedReason: MergeServerGraphRefusal | null
  /**
   * Whether the store was actually written. Distinct from `accepted`: an
   * idempotent boot is `accepted: true, changed: false`, and that combination is
   * exactly the case a caller must NOT treat as a refusal.
   */
  changed: boolean
}

const NO_CHANGE = Object.freeze({
  addedNodeCount: 0,
  addedEdgeCount: 0,
  updatedNodeCount: 0,
  updatedEdgeCount: 0,
  removedNodeCount: 0,
  removedEdgeCount: 0,
})

function refused(reason: MergeServerGraphRefusal): MergeServerGraphResult {
  return { ...NO_CHANGE, accepted: false, refusedReason: reason, changed: false }
}

/**
 * Merge the server's graph onto the live canvas.
 *
 * @param serverGraph `scenarios.graph` VERBATIM, as returned by
 *   `scenario_graph.v1`. Null / absent / empty is a strict no-op: an empty
 *   server graph is a normal state (every scenario starts there) and must
 *   never blank a canvas that has content.
 */
export function mergeServerGraphOnHydrate(
  serverGraph: unknown,
): MergeServerGraphResult {
  if (serverGraph === null || typeof serverGraph !== 'object') return refused('unusableShape')

  const g = serverGraph as Record<string, unknown>
  const rawNodes: any[] = Array.isArray(g.nodes) ? g.nodes : []
  const rawEdges: any[] = Array.isArray(g.edges) ? g.edges : []

  // Honest absence: nothing to merge, so nothing is written and no identity is
  // recorded. A server graph with no elements must not authorise later
  // deletions either.
  if (rawNodes.length === 0 && rawEdges.length === 0) return refused('emptyServerGraph')

  const store = useCanvasStore.getState()

  // ROADMAP 2.467/2.503 — refuse while the canvas holds an UNREGISTERED import.
  // Placed AFTER the shape guards (an unusable or empty server graph is still
  // that, whatever the canvas holds) and BEFORE anything reads the canvas or
  // records an identity: a refusal here must not leave `lastAuthoritativeGraph`
  // claiming we applied a graph we deliberately did not.
  //
  // Derived from the store field, which is itself DERIVED at every
  // graph-replacement site from the localStorage marker — so this covers the
  // reload, the new tab and the scenario-load paths without a release list to
  // keep in sync (trap 12).
  if (store.importPendingServerRegistration) {
    logger.warn('merge_server_graph.import_unregistered_hold', {
      scenarioId: store.currentScenarioId ?? null,
      canvasNodeCount: store.nodes.length,
      serverNodeCount: rawNodes.length,
    })
    return refused('importUnregistered')
  }
  const existingNodeIds = new Set(store.nodes.map((n: any) => n.id))
  const existingEdgeIds = new Set(store.edges.map((e: any) => e.id))

  // Structural guard, same rationale as the receipt path: a scenario's server
  // graph and its own restored canvas always share node ids. ZERO overlap with
  // a NON-EMPTY canvas means these are two unrelated graphs (a stale autosave
  // stamped with a scenario id whose server row has since been redrafted), and
  // unioning them would produce a graph neither side ever had. Drop and warn.
  // An EMPTY canvas is the opposite case and the whole point of this feature:
  // there is nothing to conflict with, so it hydrates in full.
  if (store.nodes.length > 0 && rawNodes.length > 0) {
    const hasOverlap = rawNodes.some(
      (n: any) => n != null && typeof n.id === 'string' && existingNodeIds.has(n.id),
    )
    if (!hasOverlap) {
      logger.warn('merge_server_graph.zero_overlap_drop', {
        scenarioId: store.currentScenarioId ?? null,
        canvasNodeCount: store.nodes.length,
        serverNodeCount: rawNodes.length,
      })
      return refused('zeroOverlap')
    }
  }

  // --- Server indexes. Node identity is the id; EDGE identity is the endpoint
  // pair (CEE mints composite ids, the draft mapper falls back to positional
  // ones, so the same edge routinely carries different ids on the two sides).
  const serverNodeById = new Map<string, any>()
  for (const n of rawNodes) {
    if (n != null && typeof n.id === 'string' && n.id.length > 0) {
      if (!serverNodeById.has(n.id)) serverNodeById.set(n.id, n)
    }
  }
  const serverEdgeByPair = new Map<string, any>()
  for (const e of rawEdges) {
    if (e == null) continue
    const key = wireEdgePairKey(e)
    if (key && !serverEdgeByPair.has(key)) serverEdgeByPair.set(key, e)
  }

  // --- Updates. `overlayNode` spreads the EXISTING node first and discards the
  // mapper's `position`, so every canvas-owned root field — position, width,
  // height, measured, selected, dragging, style, zIndex, parentId — survives by
  // construction, bound to the node that owned it. Matching is by id, never by
  // array index.
  //
  // ⚠ PROVENANCE IS APPLIED ON TOP OF THE OVERLAY, NOT INSIDE IT (review A1).
  // The overlay is provenance-blind: it replaces the camelCase `observedState`
  // bag wholesale while the snake_case one — which `isReviewedByUser` reads
  // FIRST — is never emitted by the mapper and therefore survives. Left alone
  // that strips honest user stamps on an unchanged value AND leaves a "checked
  // by you" badge on a number the server just changed. See `hydrateProvenance`.
  let updatedNodeCount = 0
  const mergedNodes = store.nodes.map((n: any) => {
    const serverNode = serverNodeById.get(n.id)
    if (!serverNode) return n

    const userStamps = captureUserProvenance(n.data)
    const overlaid = overlayNode(n, serverNode)
    if (overlaid === n) return n

    const nextData = observedValueUnchanged(n.data, overlaid.data)
      ? restoreUserProvenance(overlaid.data, userStamps)
      : clearUserProvenance(overlaid.data)
    const next = nextData === overlaid.data ? overlaid : { ...overlaid, data: nextData }

    // A merge whose ONLY effect was to strip a user stamp and then put it back
    // is a no-op, and must stay one — otherwise every boot writes the store and
    // dirties history for a canvas that did not change.
    if (next.type === n.type && deepEqual(next.data, n.data)) return n

    updatedNodeCount += 1
    return next
  })

  let updatedEdgeCount = 0
  const mergedEdges = store.edges.map((e: any) => {
    const key = canvasEdgePairKey(e)
    const serverEdge = key ? serverEdgeByPair.get(key) : undefined
    if (!serverEdge) return e

    // ⚠ PRESENCE, NOT EQUALITY-WITH-DEFAULT (L61). The receipt path infers "the
    // wire supplied this" from "it differs from the mapper's default edge",
    // which silently drops a server `strength.mean: 0.5` (== the default weight)
    // and an explicit default-positive `effect_direction`. That under-
    // application is fine for a receipt and wrong at boot: the server row is
    // what the NEXT analysis rebases from, so a dropped value leaves the screen
    // and the compute disagreeing. The mapper's own provenance stamps prove what
    // the wire carried — see `overlayEdge`.
    const overlaid = overlayEdge(e, serverEdge, { presenceFromProvenanceStamps: true })
    if (overlaid === e) return e

    // `userReviewedStrength` is UI-only and never on the wire, so the overlay
    // can never clear it — it would outlive the weight it describes.
    const nextData = clearEdgeUserReviewOnValueChange(e.data, overlaid.data)
    const next = nextData === overlaid.data ? overlaid : { ...overlaid, data: nextData }

    if (deepEqual(next.data, e.data)) return e

    updatedEdgeCount += 1
    return next
  })

  // --- Additions: on the server, not on the canvas.
  const missingRawNodes = rawNodes.filter(
    (n: any) =>
      n != null &&
      typeof n.id === 'string' &&
      n.id.length > 0 &&
      !existingNodeIds.has(n.id),
  )
  const addedNodes = missingRawNodes.map((n: any) => mapDraftNodeToCanvas(n))

  // Deterministic placement, right of the existing bounding box — never a
  // re-layout of nodes the user has already arranged. Same constants as the
  // receipt path, imported from it.
  if (addedNodes.length > 0) {
    const xs = mergedNodes.map((n: any) => n.position?.x ?? 0)
    const ys = mergedNodes.map((n: any) => n.position?.y ?? 0)
    const baseX = (xs.length ? Math.max(...xs) : 0) + ADDED_COLUMN_X_GAP
    const baseY = ys.length ? Math.min(...ys) : 0
    addedNodes.forEach((n: any, idx: number) => {
      n.position = { x: baseX, y: baseY + idx * ADDED_COLUMN_Y_STEP }
    })
  }

  const unionNodeIds = new Set<string>([
    ...mergedNodes.map((n: any) => n.id as string),
    ...addedNodes.map((n: any) => n.id as string),
  ])
  const seenEdgePairs = new Set<string>(
    mergedEdges
      .map((e: any) => canvasEdgePairKey(e))
      .filter((k): k is string => k !== null),
  )
  const missingRawEdges = rawEdges.filter((e: any) => {
    if (e == null) return false
    const key = wireEdgePairKey(e)
    if (key === null) return false
    if (typeof e.id === 'string' && existingEdgeIds.has(e.id)) return false
    if (seenEdgePairs.has(key)) return false
    // Fail closed: never add a dangling edge.
    const from = e.from ?? e.source
    const to = e.to ?? e.target
    if (!unionNodeIds.has(from) || !unionNodeIds.has(to)) return false
    seenEdgePairs.add(key)
    return true
  })
  const usedEdgeIds = new Set<string>(existingEdgeIds)
  const addedEdges = missingRawEdges.map((e: any, i: number) => {
    const mapped = mapDraftEdgeToCanvas(e, i)
    let id: string = mapped.id
    while (usedEdgeIds.has(id)) id = `${id}-a`
    usedEdgeIds.add(id)
    return { ...mapped, id }
  })

  // Past every guard: the server's graph WAS read. That is what `accepted`
  // means, and it is the same fact that licenses the `setLastAuthoritativeGraph`
  // record twelve lines below — one rule, asserted in
  // `mergeServerGraph.acceptance.spec.ts` §3 so the two cannot drift apart.
  const result: MergeServerGraphResult = {
    addedNodeCount: addedNodes.length,
    addedEdgeCount: addedEdges.length,
    updatedNodeCount,
    updatedEdgeCount,
    // Structural, not incidental: this path has no removal branch at all.
    removedNodeCount: 0,
    removedEdgeCount: 0,
    accepted: true,
    refusedReason: null,
    changed: false, // set below, once the counts are known
  }

  // The server graph IS CEE's view of this scenario, so everything in it is an
  // element CEE has acknowledged. Recording it is what lets the FIRST applied
  // -edit receipt after this boot reconcile a deletion; `lastAuthoritativeGraph`
  // names "DB hydration" as one of its three sources for exactly this reason,
  // and `loadScenario` already seeds it the same way on the Supabase path.
  //
  // ⚠ RECORDED EVEN WHEN THE MERGE CHANGED NOTHING, and that is deliberate: the
  // evidence is the READ, not the write. A server graph identical to the canvas
  // is still proof that CEE has seen exactly these elements, and gating the
  // record on a diff would leave the acknowledged set stale after precisely the
  // most common boot — the one where nothing has drifted. The receipt path
  // states the same rule for the same reason. It is recorded only AFTER the
  // guards above: a graph dropped for zero overlap was refused, not observed.
  useCanvasStore.getState().setLastAuthoritativeGraph({
    nodeIds: [...serverNodeById.keys()],
    edgePairs: [...serverEdgeByPair.keys()],
  })

  const changed =
    result.addedNodeCount > 0 ||
    result.addedEdgeCount > 0 ||
    result.updatedNodeCount > 0 ||
    result.updatedEdgeCount > 0
  result.changed = changed

  // ⚠ ACCEPTED, NOT CHANGED. This early return is an IDEMPOTENT boot — the
  // server's graph was read and it already matched — and it must stay
  // distinguishable from the refusals above, because it is the ONE case that
  // both looks like a refusal in the counters and legitimately licenses
  // recording an identity token.
  if (!changed) return result

  // ── A PRE-MERGE SNAPSHOT, WHENEVER AN EXISTING VALUE MOVES (review A3) ─────
  //
  // The earlier version of this file pushed no history entry, reasoning that
  // "boot is not an edit". That reasoning was wrong in the one case that
  // matters. When the local autosave is NEWER than the server row — routine,
  // because guest inspector edits never reach CEE at all (ROADMAP 2.304) — this
  // merge REVERTS the user's work to the server's older values. Silently, with
  // no undo, and the `useScenario` autosave then persists the reverted state
  // ~1.5s later, destroying the last copy that held it.
  //
  // So: whenever at least one EXISTING element's value changes, snapshot first.
  // Additions alone do not qualify — nothing is being overwritten — and a
  // no-op merge already returned above.
  const overwroteExistingValues = updatedNodeCount > 0 || updatedEdgeCount > 0
  if (overwroteExistingValues) {
    useCanvasStore.getState().pushHistory()
  }

  useCanvasStore.setState({
    nodes: [...mergedNodes, ...addedNodes] as any,
    edges: [...mergedEdges, ...addedEdges] as any,
  })

  // ── DISCLOSURE: never move a number the user is looking at in silence ──────
  //
  // The same coalesced highlight the applied-edit path uses, on exactly the
  // elements whose values this merge changed. It is deliberately NOT applied to
  // ADDED elements: those are new arrivals, not overwrites, and pulsing them
  // would dilute the signal that matters. Fails closed downstream against the
  // canvas.
  if (overwroteExistingValues) {
    pulseAppliedTargets({
      nodeIds: mergedNodes
        .filter((n: any, i: number) => n !== store.nodes[i])
        .map((n: any) => n.id as string),
      edgeIds: mergedEdges
        .filter((e: any, i: number) => e !== store.edges[i])
        .map((e: any) => e.id as string),
    })
  }

  logger.info('merge_server_graph.applied', {
    scenarioId: store.currentScenarioId ?? null,
    ...result,
  })

  return result
}
