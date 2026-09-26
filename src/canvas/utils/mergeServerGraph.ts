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
 *   · no compare-and-swap — the UI does not write back through this path.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ RELOAD SHOWS THE SAVED MODEL — ABSENCE IS REMOVAL, UNDER A LICENCE
 * ─────────────────────────────────────────────────────────────────────────────
 * Decision, 23 Sep 2026 (lead, on Paul's standing authority): on an ACCEPTED
 * read the canvas ends up holding exactly CEE's elements. A canvas node CEE
 * lacks, and a canvas edge whose endpoint pair CEE lacks (or whose endpoint was
 * removed), is TAKEN OFF; the layout of every surviving element is kept exactly.
 * The removal is named to the user in one lasting chat line
 * (`stores/reloadDifferenceStore.ts`, recorded by the hydration caller from
 * `removedLabels`) and counts as a model change (see the commit block below).
 *
 * THIS REPLACES THE OLD "no DELETION" CLAUSE, which kept such elements because
 * "the autosave can legitimately be ahead of the server (guest inspector edits
 * never reach CEE at all — ROADMAP 2.304)". That premise is gone: 2.304 is
 * recorded CLOSED / ALREADY FIXED, and canvas edits now reach CEE as canonical
 * turns (value edits as `factor_value_edit`, adds/deletes/renames as
 * `structural_*`). What the rule actually produced, witnessed on served
 * `fa84d226` (23 Sep, two tabs on one scenario): tab A deleted a factor, stale
 * tab B reloaded, and B's screen kept a factor the analysis ignores and the user
 * could not delete. The saved model is what every turn and every analysis is
 * computed from, so the screen must show it; and the multi-user design's
 * stale-copy rule (`docs/designs/collab-multiuser-design-recommendations-v1.md`
 * §5 item 6) is the same: a stale write is rejected and the client REFETCHES —
 * the saved copy wins over a stale local one.
 *
 * ⚠ THE LICENCE — removal happens only when ALL of these hold:
 *   · the merge was ACCEPTED. Every refusal returns before this point and
 *     removes nothing: `importUnregistered` (a deliberate import still waiting
 *     for its first registration — 2.467/2.503 — must never be trimmed),
 *     `zeroOverlap`, `emptyServerGraph`, `unusableShape`;
 *   · NO EDIT IS BETWEEN THE USER AND CEE: `editDeliveryHold` is null at merge
 *     time. A node the user added seconds after load, whose add turn is still in
 *     flight or queued, is not yet in the saved model and must not be taken off
 *     under them. While held, this boot keeps today's behaviour (nothing
 *     removed) and logs why;
 *   · the element is not a UI-only render node (`ghost-*`, and edges touching
 *     one) — composed at render, never saved, never removable by a read.
 *
 * The residual is named rather than hidden: a canvas element that never
 * finished saving IS taken off at reload. The UI cannot tell that case from
 * "removed in another tab" (nothing records which saved graph the autosave came
 * from), so the line says both are possible and asks the user to add back what
 * they still want.
 *
 * ⛔ A REMOVAL IS NOT UNDOABLE (decision, 23 Sep). Undo restores the canvas
 *   only: an undone element would sit on screen while CEE does not hold it, and
 *   the reload gate (`hydrate/bootGraphRead.ts`) refuses to register a canvas
 *   carrying an element CEE lacks — a silent divergence. So a removal pushes no
 *   snapshot, and NO history entry may carry a removed element afterwards
 *   (`withoutRemovedElements` below). "Add it back" is the ordinary add path.
 *
 * ⚠ AND BECAUSE THAT OVERWRITE IS REAL, IT IS NOT SILENT. Whenever this merge
 * moves at least one EXISTING value it (1) pushes a pre-merge history snapshot,
 * so the revert is undoable rather than unrecoverable — the autosave would
 * otherwise persist the reverted state ~1.5s later and destroy the last copy —
 * and (2) pulses the changed elements on the existing applied-edit surface, so
 * a number cannot move under the user unannounced. Neither fires on a pure
 * addition, a pure removal (named in the chat line instead) or a no-op. See the
 * commit block below.
 *
 * ⚠ AND (3), ON A WIDER PREDICATE THAN (1)/(2) — A3: whenever this merge changes
 * the graph AT ALL, it marks the analysis STALE. Without it the canvas showed
 * the merged graph while the Analysis panel showed the pre-merge result labelled
 * CURRENT, with the 2s pulse as the only signal. (1) and (2) answer "was the
 * user's work destroyed / did a number move under their eyes", which only an
 * OVERWRITE does; this answers "does the current
 * freshness verdict still describe what is on the canvas", which an ADDITION
 * breaks just as completely.
 * Three questions, two predicates — deliberately. See the commit block below.
 */

import { useCanvasStore } from '../store'
import { interventionNumericValue } from '../../utils/interventionValue'
import { logger } from '../../lib/logger'
import { canonicalJson } from '../../lib/canonical-hash'
import { normaliseInterventionKeys } from './normaliseInterventionKeys'
import { canvasEdgePairKey, wireEdgePairKey } from './graphIdentity'
import { editDeliveryHold, type EditDeliveryState } from '../registration/editDeliveryHold'
import { pulseAppliedTargets } from './appliedEditPulse'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from './applyDraftResult'
import { overlayEdge, overlayNode } from './mergeAppliedGraph'
import { placeAddedNodes } from './newNodePlacement'
import {
  captureUserProvenance,
  clearEdgeUserReviewOnValueChange,
  clearUserProvenance,
  observedValueUnchanged,
  restoreUserProvenance,
} from './hydrateProvenance'

/** JSON object property order can change at persistence without an edit. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return canonicalJson(a) === canonicalJson(b)
  } catch {
    return false
  }
}

/**
 * Hydration may replace a scalar intervention with its equally valued record.
 * Keep that reasoning/provenance without treating acquisition as a model edit.
 * Only that acquisition is exempt: a canonical rich→scalar replacement or a
 * change between rich records keeps the existing overwrite treatment.
 */
function isOptionRecordAcquisition(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  const { interventions: previous, ...previousRest } = before
  const { interventions: incoming, ...incomingRest } = after
  if (!deepEqual(previousRest, incomingRest)) return false
  if (!previous || typeof previous !== 'object' || Array.isArray(previous) ||
      !incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return false

  const oldMap = previous as Record<string, unknown>
  const newMap = incoming as Record<string, unknown>
  const keys = Object.keys(oldMap)
  if (keys.length === 0 || keys.length !== Object.keys(newMap).length) return false
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(newMap, key)) return false
    const oldValue = interventionNumericValue(oldMap[key])
    const newValue = interventionNumericValue(newMap[key])
    // No coercion, dropped targets or null→zero equivalence, even when some
    // other entries in this option are valid. Preserve full numeric precision.
    if (oldValue === null || newValue === null || !Object.is(oldValue, newValue)) return false
    if (deepEqual(oldMap[key], newMap[key])) continue
    if (typeof oldMap[key] !== 'number' || typeof newMap[key] === 'number') return false
  }
  return true
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
   * Elements TAKEN OFF because the saved model lacks them ("RELOAD SHOWS THE
   * SAVED MODEL" in the header). Always 0 on a refusal and while an edit is
   * between the user and CEE (the licence). An edge removed because its
   * endpoint went counts here too.
   */
  removedNodeCount: number
  removedEdgeCount: number
  /**
   * What the user is told was taken off, in canvas order: each removed node's
   * `data.label` (its id when it has none), then each edge removed on its OWN
   * pair — both endpoints survive — as "the link from A to B". An edge that
   * went with its endpoint is not listed separately; the node names it.
   * Empty exactly when nothing was removed.
   */
  removedLabels: string[]
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
  return { ...NO_CHANGE, removedLabels: [], accepted: false, refusedReason: reason, changed: false }
}

/**
 * A UI-only render node: composed at render (`ReactFlowGraph` ghost options,
 * `ghostTiers`), never saved, so its absence from the saved model means nothing.
 * Defensive — they should not be in the store at all.
 */
function isUiOnlyNode(n: { type?: unknown } | null | undefined): boolean {
  return typeof n?.type === 'string' && n.type.startsWith('ghost-')
}

/**
 * A history entry with every element this read took off stripped out, by
 * identity: a removed node, an edge touching one (never a dangling edge), and
 * an edge on a pair the saved model lacks. Edges go by PAIR, never by id — the
 * same identity the removal used, so an id a removed edge once carried cannot
 * strip an edge the saved model holds. Returns the entry itself when it carried
 * none of them.
 */
function withoutRemovedElements<T extends { nodes: any[]; edges: any[] }>(
  entry: T,
  removedNodeIds: ReadonlySet<string>,
  removedPairKeys: ReadonlySet<string>,
): T {
  const nodes = entry.nodes.filter((n) => !removedNodeIds.has(n?.id))
  const edges = entry.edges.filter((e) => {
    if (e == null) return true
    if (removedNodeIds.has(e.source) || removedNodeIds.has(e.target)) return false
    const key = canvasEdgePairKey(e)
    return key === null || !removedPairKeys.has(key)
  })
  return nodes.length === entry.nodes.length && edges.length === entry.edges.length
    ? entry
    : { ...entry, nodes, edges }
}

/** What the user is told a removed node was: its label, or its id. */
function nodeDisplayName(n: { id?: unknown; data?: unknown } | undefined, fallbackId: string): string {
  const label = (n?.data as { label?: unknown } | undefined)?.label
  return typeof label === 'string' && label.trim().length > 0 ? label.trim() : fallbackId
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

  // --- Removals: on the canvas, not in the saved model ("RELOAD SHOWS THE SAVED
  // MODEL" in the header). Every refusal has already returned, so this is an
  // ACCEPTED read by construction. Same shape as the receipt path's removal
  // (`reconcileAppliedGraph`): a node goes by id, an edge goes with a removed
  // endpoint or on its own missing pair. The receipt path licenses removal by
  // `lastAuthoritativeGraph`; a boot read IS the authoritative graph, so its
  // licence is instead that no edit is between the user and CEE.
  const uiOnlyNodeIds = new Set<string>(
    store.nodes.filter((n: any) => isUiOnlyNode(n)).map((n: any) => n.id as string),
  )
  const removedNodeIds = new Set<string>()
  const removedEdgeIds = new Set<string>()
  const pairRemovedEdges: any[] = []
  for (const n of store.nodes as any[]) {
    if (uiOnlyNodeIds.has(n.id)) continue
    if (!serverNodeById.has(n.id)) removedNodeIds.add(n.id)
  }
  for (const e of store.edges as any[]) {
    if (removedNodeIds.has(e.source) || removedNodeIds.has(e.target)) {
      removedEdgeIds.add(e.id)
      continue
    }
    if (uiOnlyNodeIds.has(e.source) || uiOnlyNodeIds.has(e.target)) continue
    const key = canvasEdgePairKey(e)
    // A canvas edge with no resolvable pair cannot be compared; leave it.
    if (key !== null && !serverEdgeByPair.has(key)) {
      removedEdgeIds.add(e.id)
      pairRemovedEdges.push(e)
    }
  }
  // ⚠ THE LICENCE: nothing is removed while an edit is between the user and CEE.
  // Read at merge time, from the live store — a node added seconds after load
  // whose add turn is still on the wire (or queued, or unconfirmed) is simply
  // not in the saved model YET.
  //
  // ⚠ AND A READ WITH NO NODES IS NOT A MODEL TO CONVERGE ON. Edges with no
  // nodes are all dangling — no saved model has that shape — and taking every
  // node off would blank the canvas, which the `emptyServerGraph` refusal exists
  // to prevent. The zero-overlap guard does not catch it (it needs server nodes
  // to compare), so it is refused here: nothing removed, logged.
  const somethingToRemove = removedNodeIds.size > 0 || removedEdgeIds.size > 0
  const removalHold: string | null = !somethingToRemove
    ? null
    : serverNodeById.size === 0
      ? 'server_graph_has_no_nodes'
      : editDeliveryHold(useCanvasStore.getState() as unknown as EditDeliveryState)
  if (removalHold !== null) {
    logger.warn('merge_server_graph.removal_withheld', {
      scenarioId: store.currentScenarioId ?? null,
      reason: removalHold,
      wouldRemoveNodeCount: removedNodeIds.size,
      wouldRemoveEdgeCount: removedEdgeIds.size,
    })
    removedNodeIds.clear()
    removedEdgeIds.clear()
    pairRemovedEdges.length = 0
  }
  const survivingNodes = removedNodeIds.size > 0
    ? store.nodes.filter((n: any) => !removedNodeIds.has(n.id))
    : store.nodes
  const survivingEdges = removedEdgeIds.size > 0
    ? store.edges.filter((e: any) => !removedEdgeIds.has(e.id))
    : store.edges
  const survivingEdgeIds = new Set<string>(survivingEdges.map((e: any) => e.id))

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
  const valueChangedNodeIds: string[] = []
  const mergedNodes = survivingNodes.map((n: any) => {
    const serverNode = serverNodeById.get(n.id)
    if (!serverNode) return n

    const userStamps = captureUserProvenance(n.data)
    const overlaid = overlayNode(n, serverNode)
    if (overlaid === n) return n

    const nextData = observedValueUnchanged(n.data, overlaid.data)
      ? restoreUserProvenance(overlaid.data, userStamps)
      : clearUserProvenance(overlaid.data)
    const next = nextData === overlaid.data ? overlaid : { ...overlaid, data: nextData }
    const previousData = n.type === 'option' ? normaliseInterventionKeys(n.data ?? {}) : n.data
    const incomingData = next.type === 'option' ? normaliseInterventionKeys(next.data ?? {}) : next.data
    const recordAcquisition = n.type === 'option' && next.type === 'option' &&
      isOptionRecordAcquisition(previousData, incomingData)

    // A merge whose ONLY effect was to strip a user stamp and then put it back
    // is a no-op, and must stay one — otherwise every boot writes the store and
    // dirties history for a canvas that did not change.
    if (next.type === n.type && deepEqual(incomingData, previousData)) return n

    updatedNodeCount += 1
    if (!recordAcquisition) valueChangedNodeIds.push(n.id)
    return next
  })

  let updatedEdgeCount = 0
  const valueChangedEdgeIds: string[] = []
  const mergedEdges = survivingEdges.map((e: any) => {
    const key = canvasEdgePairKey(e)
    const serverEdge = key ? serverEdgeByPair.get(key) : undefined
    if (!serverEdge) return e

    // ⚠ PRESENCE, NOT EQUALITY-WITH-DEFAULT (L61). A server `strength.mean: 0.5`
    // (== the default weight) or an explicit default-positive `effect_direction`
    // must land: the server row is what the NEXT analysis rebases from. Presence
    // is decided inside `overlayEdge` by ONE rule shared with the receipt path
    // (unconditional since 23 Sep — the receipt path had kept equality and
    // dropped a user-confirmed 0.5). The only boot-specific behaviour left is
    // recording the server's strength tuple on an otherwise-no-op overlay.
    const overlaid = overlayEdge(e, serverEdge, { acquireServerStrengthOnNoop: true })
    if (overlaid === e) return e

    // `userReviewedStrength` is UI-only and never on the wire, so the overlay
    // can never clear it — it would outlive the weight it describes.
    const reviewCleared = clearEdgeUserReviewOnValueChange(e.data, overlaid.data)

    // ⚠ A1: a wire edge with no `edge_type` is schema-implicit 'directed' by
    // CEE's own contract (`EdgeV3Schema` `.default('directed')`), but writing
    // that literal spelling onto canvas data turns an absent field into an
    // EXPLICIT one — exactly what StyledEdge treats as an override of its
    // node-kind structural inference, drawing a structural link (option→
    // factor, decision→option) as a strong causal one. A readback must never
    // MINT the field the canvas never had. Any OTHER explicit spelling
    // ('structural', 'bidirected', …) is a real fact and is kept.
    const mintedDirected = e.data?.edge_type === undefined && reviewCleared?.edge_type === 'directed'
    const nextData = mintedDirected
      ? Object.fromEntries(Object.entries(reviewCleared).filter(([k]) => k !== 'edge_type'))
      : reviewCleared
    const next = nextData === overlaid.data ? overlaid : { ...overlaid, data: nextData }

    if (deepEqual(next.data, e.data)) return e

    updatedEdgeCount += 1
    // Acquiring server readback is a store change, not a changed model value.
    // Mask ONLY that record; every other change retains the existing edit
    // classification. The overlay preserves user stamps on tuple-only reads.
    // `origin` is acquired metadata too (R2, C46): never a changed value.
    const comparableReadback = { ...next.data, serverStrength: e.data?.serverStrength, origin: e.data?.origin }
    if (!deepEqual(comparableReadback, e.data)) {
      valueChangedEdgeIds.push(e.id)
    }
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

  // ⭐⭐ AN EMPTY CANVAS IS A HYDRATION, NOT AN ADDITION — SO IT GETS A LAYOUT.
  //
  // THE DEFECT THIS CLOSES, driven and measured: a user reloading a saved
  // scenario with no local autosave (new device, cleared storage, incognito, or
  // a scenario first opened elsewhere) got all 15 nodes in ONE VERTICAL LINE —
  // unique `x` of 260, `y` stepping by exactly 140.
  //
  // With nothing on the canvas EVERY server node is "added", so all of them fell
  // through the placement below — a constant pair whose own comment says it
  // exists to drop "a few added nodes beside an existing bounding box" and
  // "never a re-layout of nodes the user has already arranged". It was being
  // applied to the ONE case it explicitly disclaims, and with no existing nodes
  // `Math.max(...[])` has nothing to take, so `baseX` collapses to `0 + 260`.
  //
  // ⚠ AND THE PRODUCT COULD NOT SEE IT. `graphNeedsInitialLayout` asks
  // `xSpread < 40 && ySpread < 40`; a column has xSpread 0 but ySpread ~1960, so
  // it returns FALSE — no layout is triggered — and the camera then confidently
  // frames the line. Fifteen nodes in a row is not a laid-out graph, but nothing
  // in the product disagreed.
  //
  // ⚠ THE PREDICATE IS NOT THE PLACE TO FIX THIS, and loosening it was
  // considered and REJECTED: a user CAN deliberately arrange nodes in a column,
  // and a geometric test cannot tell their column from ours. That fix would
  // destroy real work to repair ours — this bug wastes a layout, that one would
  // delete an arrangement.
  //
  // ⭐ The predicate asks a GEOMETRIC question when the real one is PROVENANCE:
  // did WE place these, or did the USER arrange them? That answer is already in
  // hand HERE — `store.nodes.length === 0` means there was nothing to preserve.
  // No flag is recorded, because recording one would be a second source of truth
  // for a fact this site can already see.
  //
  // So this branch is safe BY CONSTRUCTION: it fires only when the canvas was
  // empty, so there is no arrangement it can damage. The nodes keep the origin
  // `mapDraftNodeToCanvas` gives them, and the layout is requested directly in
  // the commit below — the same request `useInitialLayoutGuard` makes, on the
  // designed path, unchanged.
  //
  // ⚠ AN EARLIER VERSION OF THIS SENTENCE SAID the origin placement "makes
  // `graphNeedsInitialLayout` return TRUE on its own terms". THAT IS FALSE AT
  // n = 1 — the predicate returns `false` for `unlocked.length <= 1`, so a
  // single-node hydration is NOT self-describing as needing layout. Corrected
  // in place rather than deleted, because the consequence is worth carrying:
  // the request below is what makes this work, and `useInitialLayoutGuard` is
  // therefore NOT a safety net for a one-node hydration — if that request were
  // ever swallowed, nothing else would ask. At n >= 2 the predicate does agree,
  // which is exactly why the false sentence read as true.
  const hydratingEmptyCanvas = store.nodes.length === 0 && addedNodes.length > 0

  // Deterministic placement: each added node joins its own row, clear of every
  // existing card — never a re-layout of nodes the user has already arranged.
  // The SAME helper as the receipt path (`placeAddedNodes`), so the two
  // placements cannot drift.
  if (addedNodes.length > 0 && !hydratingEmptyCanvas) {
    const positions = placeAddedNodes(mergedNodes, addedNodes)
    addedNodes.forEach((n: any, idx: number) => {
      n.position = positions[idx]
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
    // SURVIVING ids, not every id the canvas held: an id carried by an edge this
    // merge just removed must not block the server's own edge under that id.
    if (typeof e.id === 'string' && survivingEdgeIds.has(e.id)) return false
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
  //
  // The removed labels are named against what the user sees NOW: a removed node
  // by its own label, a pair-removed edge by its endpoints' post-merge labels.
  const displayNodeById = new Map<string, any>(mergedNodes.map((n: any) => [n.id, n]))
  const removedLabels = [
    ...(store.nodes as any[])
      .filter((n) => removedNodeIds.has(n.id))
      .map((n) => nodeDisplayName(n, n.id)),
    ...pairRemovedEdges.map(
      (e) =>
        `the link from ${nodeDisplayName(displayNodeById.get(e.source), e.source)} to ${nodeDisplayName(displayNodeById.get(e.target), e.target)}`,
    ),
  ]
  const result: MergeServerGraphResult = {
    addedNodeCount: addedNodes.length,
    addedEdgeCount: addedEdges.length,
    updatedNodeCount,
    updatedEdgeCount,
    removedNodeCount: removedNodeIds.size,
    removedEdgeCount: removedEdgeIds.size,
    removedLabels,
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

  const removedAny = result.removedNodeCount > 0 || result.removedEdgeCount > 0
  const changed =
    result.addedNodeCount > 0 ||
    result.addedEdgeCount > 0 ||
    result.updatedNodeCount > 0 ||
    result.updatedEdgeCount > 0 ||
    removedAny
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
  //
  // ⛔ A REMOVAL DOES NOT QUALIFY, AND NO SNAPSHOT MAY CARRY ONE ("A REMOVAL IS
  // NOT UNDOABLE" in the header). Undo would put the element back on the canvas
  // only — CEE does not hold it and the reload gate will not register it — so a
  // removal pushes nothing, and after this merge every history entry is
  // stripped of what it took off. That includes the snapshot an overwrite in the
  // SAME read has just pushed (undo still restores the overwritten value, never
  // the removed element) and any EARLIER entry (in-session draft recovery also
  // runs this merge). The chat line's "Add it back" is the ordinary add path.
  const overwroteExistingValues = valueChangedNodeIds.length > 0 || valueChangedEdgeIds.length > 0
  const modelChanged =
    overwroteExistingValues || addedNodes.length > 0 || addedEdges.length > 0 || removedAny
  if (overwroteExistingValues) {
    useCanvasStore.getState().pushHistory()
  }
  if (removedAny) {
    const removedPairKeys = new Set<string>(
      pairRemovedEdges.map((e: any) => canvasEdgePairKey(e)).filter((k): k is string => k !== null),
    )
    const strip = (entry: any) =>
      withoutRemovedElements(entry, removedNodeIds, removedPairKeys)
    useCanvasStore.setState((s: any) => ({
      history: { past: s.history.past.map(strip), future: s.history.future.map(strip) },
    }))
  }

  // ⚠ PRODUCER WRITE, NOT A USER GESTURE — the suppression is load-bearing.
  // `_externalMutationActive` is a COUNTER, so nesting with an outer window is
  // safe and deliberate. Without this, any consumer of "the user changed the
  // graph" — `useGuidanceInvalidationOnEdit`, and the `direct_graph_edit`
  // emitter on the flag-OFF posture — treats a write the PRODUCER made as a
  // local edit. For guidance that means wiping the coaching the very same turn
  // just delivered, and because `clearGuidanceItems()` also clears the persisted
  // blob (`guidanceStore.ts:608-613`), the loss survives a reload.
  useCanvasStore.getState().beginExternalGraphMutation?.('hydrate')
  try {
    useCanvasStore.setState({
      // Metadata acquisition still needs to be stored when it is not an edit.
      nodes: updatedNodeCount > 0 || addedNodes.length > 0 || removedNodeIds.size > 0
        ? [...mergedNodes, ...addedNodes] as any : store.nodes,
      edges: [...mergedEdges, ...addedEdges] as any,
      // Requested in the SAME write as the nodes it describes: a separate
      // `setPendingLayout` call would leave a frame in which the canvas holds an
      // origin stack that nothing has asked to lay out, and the camera's restore
      // trigger reads exactly that state.
      //
      // ⚠⚠ AND `layoutRequestId` MOVES WITH IT, WHICH THE RAW FIELD WRITE ALONE
      // DID NOT. `setPendingLayout(true)` is `set({ pendingLayout: true,
      // layoutRequestId: get().layoutRequestId + 1 })` — the bump is half of
      // what it does, and writing only the field silently dropped it. Complete
      // manifest, contrast-controlled: this was the ONLY raw `pendingLayout:
      // true` in `src/` outside the setter's own body, against 7 producers that
      // use the setter.
      //
      // The bump is what INVALIDATES A LAYOUT ALREADY IN FLIGHT. Without it,
      // `applyLayout`'s post-await commit guard (`isCurrentGen()`) still passes
      // — its generation never moved — so a layout that started BEFORE this
      // hydration commits its stale snapshot over the graph we just merged.
      // Measured: hold a layout open across the hydration and the final state
      // is `nodeCount: 0, layoutVersion: 1` — AN EMPTY CANVAS REPORTED AS A
      // SUCCESSFUL LAYOUT. That is the same defect class this whole branch
      // exists to close, one line over.
      //
      // ⚠ NOT a separate `setPendingLayout()` call: that reintroduces exactly
      // the intermediate frame the paragraph above exists to prevent. Read
      // fresh at write time rather than from the `store` snapshot captured at
      // entry, so a bump landing during the merge is not overwritten.
      ...(hydratingEmptyCanvas
        ? {
            pendingLayout: true,
            layoutRequestId: useCanvasStore.getState().layoutRequestId + 1,
          }
        : {}),
    })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }

  // ── THE ANALYSIS NO LONGER DESCRIBES THIS CANVAS (A3) ─────────────────────
  //
  // THE DEFECT THIS CLOSES: this merge changed the canvas on reload and left
  // the Analysis panel showing the PRE-MERGE result labelled CURRENT. The only
  // signal the user got was the ~2s pulse below.
  //
  // Nothing upstream catches it, and each near-miss is worth naming because
  // each one LOOKS like it would:
  //   · `analysisFreshness.ts:455-458` compares `graph_hash_at_run` to
  //     `current_graph_hash` — both fields of the SAME stored blob, so it is
  //     comparing a value against itself and cannot see a canvas that moved
  //     after the blob was restored;
  //   · `validateCeeAnalysisReady` (`ceeAnalysisReadyValidation.ts:31`) compares
  //     NODE IDS ONLY, so a VALUE-ONLY change passes and a stale result is
  //     UPGRADED to `fresh` — and that upgrade runs BEFORE this merge;
  //   · `resultsLoadHistorical` (`store.ts:4142`) sets `graphEditedSinceLastRun:
  //     false` on every hydrate, and nothing flipped it back.
  //
  // ⚠ AND `pushHistory()` ABOVE IS NOT THIS. Measured at this tip: `pushToHistory`
  // sets the LEGACY PAIR (`graphEditedSinceLastRun`/`analysisStateReady`) but
  // NEVER `analysisFreshnessDirty` — and the freshness banners read the OVERLAY,
  // not the pair. It also EARLY-RETURNS when the pre-merge state hashes equal to
  // the last snapshot (`store.ts:1266-1273`), so even the pair's flip is
  // incidental. That is the #344 shape exactly: one staleness system set, the
  // other missed, shipping a false "analysis reflects the current model". Hence
  // the EXPLICIT, ATOMIC 3-flag call — `markGraphStructurallyEdited` is the
  // store's declared API for external mutators for this reason.
  //
  // ⚠ THE PREDICATE IS `modelChanged`, NOT `overwroteExistingValues`, AND THE
  // DIVERGENCE FROM THE TWO GATES EITHER SIDE OF IT IS DELIBERATE — DO NOT
  // "TIDY" THESE INTO ONE. Three different questions share this block:
  //   · pushHistory            — "is the user's work about to be destroyed?"
  //                              Only an OVERWRITE qualifies (a removal is
  //                              deliberately NOT undoable — see the header).
  //   · pulseAppliedTargets    — "did a number move under the user's eyes?"
  //                              Only an OVERWRITE moves one.
  //   · THIS                   — "is the canvas graph now different from the
  //                              graph the current freshness verdict was
  //                              established against?" ANY change makes that
  //                              verdict unsupported, an ADDITION included.
  // Aligning the three would re-open the lie on the addition path.
  //
  // ⚠ NOT UNCONDITIONAL: marking every boot stale would be its own defect — a
  // false stale on the commonest boot of all, the idempotent one. The
  // early no-op return and modelChanged guard buy that. Tuple-only readback
  // and equivalent option-record acquisition are stored without invalidating
  // unchanged analysis; real overwrites, additions AND removals still
  // invalidate it — a removal is a model change like any other.
  if (modelChanged) useCanvasStore.getState().markGraphStructurallyEdited?.()

  // ── DISCLOSURE: never move a number the user is looking at in silence ──────
  //
  // The same coalesced highlight the applied-edit path uses, on exactly the
  // elements whose values this merge changed. It is deliberately NOT applied to
  // ADDED elements: those are new arrivals, not overwrites, and pulsing them
  // would dilute the signal that matters. Fails closed downstream against the
  // canvas.
  if (overwroteExistingValues) {
    pulseAppliedTargets({
      nodeIds: valueChangedNodeIds,
      edgeIds: valueChangedEdgeIds,
    })
  }

  // Counts only: the removed labels are the user's own words and stay out of logs.
  const { removedLabels: labelsForUser, ...counts } = result
  logger.info('merge_server_graph.applied', {
    scenarioId: store.currentScenarioId ?? null,
    ...counts,
    removedLabelCount: labelsForUser.length,
  })

  return result
}
