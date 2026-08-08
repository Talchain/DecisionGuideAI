/**
 * reconcileAppliedGraph — ingest an applied-edit receipt's authoritative graph
 * into a NON-EMPTY canvas (POC Lane C, edit-journey display closure,
 * 2026-07-11; made ATOMIC for defect B2, Codex deep review 2026-07-18).
 *
 * Wire contract: CEE #414/#424 attach the FULL committed post-mutation graph
 * to applied-edit receipts via the EXISTING top-level `draft_graph` field
 * (OlumiResponseSchema 0.8.0+, unchanged at the pinned 0.15.0), post-commit
 * only — see olumi-assistants-service
 * src/orchestrator-v5/compose/applied-graph-emit.ts. The UI's only inline
 * ingestion path (applyDraftResult via useConversation) was gated on
 * canvasIsEmpty, so a confirmed structural edit (add factor / add edge) never
 * reached a populated canvas until a full reload.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE RECEIPT ACTUALLY IS (verified against CEE staging `10633948`,
 * 2026-07-18 — this replaces an incorrect claim that used to live here)
 * ---------------------------------------------------------------------------
 *
 * A successful edit's receipt is the COMPLETE post-mutation graph, and it is
 * the ONLY transport for the result of that edit:
 *
 *   - `blocks` is EMPTY on success. `buildBoundaryBlocks`
 *     (edit-graph-dispatch.ts:832-833) opens with `if (!result.wasRejected)
 *     return []`. The previous version of this comment asserted that "value
 *     updates on existing elements arrive separately as graph_patch blocks
 *     (applyV5State)". That was FALSE for the edit_graph path and it is why
 *     this merge was additive-only. `graph_patch` reaches the wire only from
 *     compose.ts:338-345, gated on the three D1 typed-handler facts
 *     (set_factor_value / add_constraint / adjust_edge_strength) — and those
 *     turns carry a full `draft_graph` as well. On the LLM-driven edit_graph
 *     path, a rejected edit is converted to an `error` block
 *     (edit-graph-dispatch.ts:859-866); a successful one carries nothing but
 *     the graph. CEE's own docstring (edit-graph-dispatch.ts:809-818) had
 *     already corrected this myth on the server side.
 *   - `draft_graph` is the whole graph, not a delta —
 *     `buildAppliedGraphWireField` (applied-graph-emit.ts:41-48) emits
 *     `graph.nodes` / `graph.edges` wholesale from a structuredClone that
 *     `patch-applier.ts` mutated in place.
 *   - ABSENCE THEREFORE MEANS DELETION. `patch-applier.ts:105-117` splices the
 *     node out and filters its edges; CEE itself infers option deletion purely
 *     from absence (edit-graph-dispatch.ts:1148-1153).
 *   - It carries NO LAYOUT. `NodeV3` (schemas/cee-v3.ts:89-144) is closed and
 *     declares analytical fields only — no `position`, `width`, `measured`.
 *     Layout is UI-owned state that CEE never sees and can never return.
 *
 * Hence the semantics below: a full three-way reconcile that treats the
 * receipt as authoritative for ANALYTICAL state while the canvas stays
 * authoritative for LAYOUT.
 *
 * Why "draft_graph + non-empty canvas" is treated as an applied-edit receipt:
 * the V5 payload carries NO graph_state (buildPayload.ts — MessageTurnPayload
 * is turn ids/stage/message/source/chip only), so CEE's
 * `extensions.graphState` is null on EVERY V5 turn and does not discriminate.
 * The actual server-side suppression of the fresh-draft dispatch is the
 * continuation guard: route-v2 `isDraftGraphShape` requires
 * `!isContinuationScenario` (loadHasPriorTurns on the scenario), and a
 * non-empty canvas normally belongs to a scenario with prior committed turns.
 * The reachable misfire — a FRESH scenario_id with a populated canvas whose
 * first message is a >=30-char brief-shaped text — slips past that guard and
 * returns a misdrafted fresh graph; the zero-overlap guard below drops it
 * client-side (an applied receipt always overlaps the committed graph, so
 * zero node-id overlap with the canvas is diagnostic).
 *
 * ---------------------------------------------------------------------------
 * SEMANTICS — ATOMIC RECONCILE (adds + updates + deletions, one history entry)
 * ---------------------------------------------------------------------------
 *   - ADD: wire elements missing from the canvas are converted with the SAME
 *     mappers as the draft path (mapDraftNodeToCanvas / mapDraftEdgeToCanvas)
 *     and placed in a column right of the current bounding box — never a full
 *     re-layout of the user's graph.
 *   - UPDATE: wire elements already on the canvas have their ANALYTICAL fields
 *     overlaid onto the existing element. Layout-only state (position, size,
 *     measurement, selection, drag state) is preserved by construction: the
 *     existing element is spread first and the mapper's `position` is
 *     discarded. This is the hunk that fixes B2 — before it, a confirmed
 *     "set Spend to 250" left the canvas showing 100, and the 1500ms autosave
 *     then wrote that stale 100 back over CEE's committed 250.
 *   - REMOVE: elements absent from the receipt are removed — but ONLY if CEE
 *     had previously acknowledged them (`lastAuthoritativeGraph`). CEE builds
 *     the post-state from the PERSISTED graph, and the UI's save is debounced,
 *     so a node the user added moments ago is legitimately absent from the
 *     receipt without having been deleted. Removing it would trade B2's
 *     value-loss for a worse node-loss. Unacknowledged local work survives.
 *   - A receipt that changes nothing is a strict no-op — no history entry, no
 *     store write, no autosave, no freshness dirtying.
 *   - Zero node-id overlap with a non-empty canvas => DROP + structured warn.
 *
 * ---------------------------------------------------------------------------
 * WHY THE FOLLOW-UP AUTOSAVE IS LEFT IN PLACE (B2, argued)
 * ---------------------------------------------------------------------------
 * The review offered "suppress the receipt-echo autosave OR advance the saved
 * snapshot". Both were rejected on evidence, because the echo save is NOT the
 * defect once this reconcile is correct, and it is load-bearing:
 *
 *   1. The echo can no longer write stale state. useScenario's debounced save
 *      re-reads the store AT FIRE TIME (useScenario.ts:153), it does not
 *      persist a snapshot captured when the timer was scheduled, and
 *      clearTimeout collapses overlapping edits into one write. So once the
 *      STORE holds CEE's values, the write carries CEE's values. The staleness
 *      was never in the save path — it was in this merge refusing to update.
 *   2. Suppressing it would cause layout loss. CEE's own persistence
 *      (`mergeAppliedGraphForPersistence`, edit-graph-dispatch.ts:1131-1135)
 *      overwrites the whole `nodes` array of `scenarios.graph` with the
 *      GraphV3-parsed applied graph, which has no position fields. So at the
 *      moment a receipt arrives the DB has already LOST the user's layout, and
 *      the UI's save is the only thing that restores it. Suppressing the save
 *      would make every AI edit silently scramble the user's canvas on reload.
 *
 * The residual — that this save and a concurrent CEE write can race in the
 * 1500ms window — is the shared-writer/CAS problem (review C1/A3), not B2, and
 * is deliberately not addressed here.
 *
 * Freshness: deliberately NOT marking the local dirty overlay by hand here.
 * The same response carries CEE's post-apply analysis_ready.freshness verdict
 * (routed through applyV5State step 4 setAnalysisFreshness before this
 * reconcile runs); that verdict is authoritative for exactly this graph.
 * graphEditedSinceLastRun / analysisStateReady are set EXPLICITLY in the
 * commit below: pushToHistory early-returns without flipping either flag when
 * the pre-merge state equals the last history snapshot.
 */

import { useCanvasStore } from '../store'
import { validateNodesBatch } from '../domain/nodes'
import { logger } from '../../lib/logger'
import { saveAutosave } from '../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../store/autosaveProjection'
import { pulseAppliedTargets } from './appliedEditPulse'
import { canvasEdgePairKey, wireEdgePairKey } from './graphIdentity'
import { EDGE_PROVENANCED_FIELDS, edgeSourceKey } from '../domain/edgeValueProvenance'

/** Derived from EDGE_PROVENANCED_FIELDS — never a hand-listed set. */
const EDGE_SOURCE_KEYS: ReadonlySet<string> = new Set(EDGE_PROVENANCED_FIELDS.map(edgeSourceKey))
import {
  backfillInterventionsOntoOptionNodes,
  mapDraftEdgeToCanvas,
  mapDraftNodeToCanvas,
} from './applyDraftResult'
import type { CEEDraftResponse, CEEGoalConstraint, CEEv2Response, CEEv3Response } from '../../adapters/cee/types'

/**
 * Horizontal gap between the current bounding box and the added column.
 * Exported so the boot-hydration merge places added nodes identically —
 * two placement constants that must agree is a mirror, and mirrors drift.
 */
export const ADDED_COLUMN_X_GAP = 260
/** Vertical spacing between stacked added nodes. */
export const ADDED_COLUMN_Y_STEP = 140

export interface ReconcileAppliedGraphResult {
  addedNodeCount: number
  addedEdgeCount: number
  updatedNodeCount: number
  updatedEdgeCount: number
  removedNodeCount: number
  removedEdgeCount: number
}

const NO_CHANGE: ReconcileAppliedGraphResult = {
  addedNodeCount: 0,
  addedEdgeCount: 0,
  updatedNodeCount: 0,
  updatedEdgeCount: 0,
  removedNodeCount: 0,
  removedEdgeCount: 0,
}

/**
 * The edge `data` the mapper produces for a wire edge carrying NO analytical
 * fields — i.e. pure mapper defaults (DEFAULT_EDGE_DATA plus derived
 * fallbacks). DERIVED from the mapper, never hand-listed: a hand-maintained
 * list of "which fields are defaults" would silently drift the moment
 * mapDraftEdgeToCanvas gains a field, and would then start overwriting local
 * edge state with defaults the wire never sent.
 *
 * Used to tell "the wire supplied this value" from "the mapper filled this in"
 * when overlaying onto an EXISTING edge. Accepted, fail-safe under-application:
 * a wire value that happens to equal the mapper default is treated as
 * unsupplied and does not overwrite local state.
 */
let edgeMapperDefaultsCache: Record<string, unknown> | null = null
function edgeMapperDefaults(): Record<string, unknown> {
  // Computed lazily, not at module load: a throw at import time would take
  // down every consumer of this module rather than one reconcile.
  if (edgeMapperDefaultsCache === null) {
    try {
      edgeMapperDefaultsCache = (mapDraftEdgeToCanvas(
        { from: '__baseline_src__', to: '__baseline_tgt__' },
        0,
      ).data ?? {}) as Record<string, unknown>
    } catch {
      // Fail-safe: an empty baseline means "every mapped key counts as
      // wire-supplied", which over-applies rather than silently dropping the
      // update. Loud enough to find, safe enough to ship.
      edgeMapperDefaultsCache = {}
    }
  }
  return edgeMapperDefaultsCache
}

/**
 * Stable deep-equality for plain JSON-ish canvas data.
 *
 * E-2 — THE `undefined` SHORT-CIRCUIT IS A REAL COST, NOT A MICRO-OPTIMISATION.
 * The dominant call pattern is `sameValue(mappedValue, baseline[key])` where the
 * baseline (`edgeMapperDefaults`) has NO entry for the key — the deliberate case
 * for `validation`, which carries no `DEFAULT_EDGE_DATA` default by design. So
 * `b` is `undefined` while `a` is the whole validation bag: two `pass` objects,
 * `contested_reasons`, the evoi legs. `JSON.stringify(a)` then serialises that
 * entire bag, per edge, only to compare it against the literal `undefined` —
 * which `JSON.stringify` renders as `undefined` (not a string), so the comparison
 * was already decided before the work began.
 *
 * On an applied-edit receipt over a contested graph that is ~150-250KB of string
 * allocation and immediate garbage per receipt.
 *
 * BEHAVIOUR-IDENTICAL ON EVERY REACHABLE INPUT, and the one unreachable exception
 * is named rather than glossed. When exactly one side is `undefined` the two
 * `JSON.stringify` results cannot match — `undefined` against any string — and
 * `a === b` above already answered the both-`undefined` case. The exception is a
 * value `JSON.stringify` ALSO renders as `undefined`: a function or a symbol,
 * which the old code therefore reported as EQUAL to `undefined`. Both sides of
 * every call site are mapper output over parsed wire JSON
 * (`mapDraftNodeToCanvas` / `mapDraftEdgeToCanvas`, and `edgeMapperDefaults`
 * which is itself one of those calls), so neither can be a function or a symbol.
 * Were one to arrive, the new answer ("different") sends the key down the
 * wire-supplied path — the OVER-applying direction this module already declares
 * fail-safe two comments up, rather than silently dropping an update.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Exactly one side is `undefined` (both-undefined was caught above), so they
  // cannot be equal and there is nothing to serialise.
  if (a === undefined || b === undefined) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Overlay a wire node's analytical fields onto an existing canvas node.
 *
 * Returns the SAME object reference when nothing changed, so callers can use
 * identity to detect a no-op.
 *
 * Layout preservation is structural: `existing` is spread first and only
 * `type` / `data` are replaced. `mapped.position` (always `{x:0,y:0}`) is
 * discarded, and every other root-level React Flow field the canvas owns —
 * position, width, height, measured, selected, dragging, style, zIndex,
 * parentId — is carried through untouched.
 *
 * Field-level rule: the wire WINS on keys it carries, the canvas KEEPS keys
 * the wire omits. Absence of a key is not treated as "clear it" — CEE's node
 * schema is closed and omits optional fields it has no value for, and UI-side
 * backfills (interventions, is_baseline, goal_threshold_*) live in the same
 * `data` bag. The residual is documented and accepted: a value CEE genuinely
 * cleared stays on the canvas until the next full draft.
 *
 * ⚠ EXPORTED for `mergeServerGraph.ts` (ROADMAP 2.312 piece 3). Boot hydration
 * needs exactly this rule — server values win, local layout survives — and a
 * second implementation of "spread existing first" would be the hand-maintained
 * mirror this repo keeps getting bitten by. There is ONE definition of the
 * overlay; its two callers differ only in the semantics around it.
 */
export function overlayNode(existing: any, wireNode: any): any {
  const mapped = mapDraftNodeToCanvas(wireNode)
  const nextData = { ...(existing.data ?? {}), ...(mapped.data ?? {}) }
  const nextType = mapped.type ?? existing.type

  if (nextType === existing.type && sameValue(existing.data, nextData)) {
    return existing
  }
  return { ...existing, type: nextType, data: nextData }
}

export interface OverlayEdgeOptions {
  /**
   * Determine "the wire supplied this field" from the mapper's PROVENANCE
   * STAMPS rather than from "the mapped value differs from the mapper default".
   *
   * OFF by default, so the RECEIPT path is byte-unchanged. Boot hydration turns
   * it ON — see the block below for why the two paths differ.
   */
  presenceFromProvenanceStamps?: boolean
}

/**
 * Overlay a wire edge's analytical fields onto an existing canvas edge.
 * Returns the SAME reference when nothing changed.
 *
 * Only keys whose mapped value DIFFERS from the mapper's default baseline are
 * applied — see EDGE_MAPPER_DEFAULTS. Without that filter every receipt would
 * splat DEFAULT_EDGE_DATA over locally-tuned edges and churn history on every
 * turn.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ EQUALITY-WITH-DEFAULT IS NOT PRESENCE, AND AT BOOT THAT COSTS A NUMBER (L61)
 * ─────────────────────────────────────────────────────────────────────────────
 * `DEFAULT_EDGE_DATA.weight` is `0.5`. So a server edge carrying
 * `strength.mean: 0.5` maps to `weight: 0.5`, compares EQUAL to the synthetic
 * baseline, and is discarded as "not supplied" — leaving a local `0.7` on screen
 * while the next analysis is computed from the server's `0.5`. The synthetic
 * baseline's `direction` is `'positive'` for the same reason (default weight
 * `0.5 >= 0`), so an EXPLICIT server `effect_direction: 'positive'` is dropped
 * and a local `'negative'` survives — a SIGN, not a rounding difference.
 *
 * Those are the only two reachable collisions: `beliefExists` resolves to
 * `undefined` in the baseline (the explicit assignment overrides the
 * `DEFAULT_EDGE_DATA` spread) and `strengthStd` is omitted, so both already
 * differ from anything the wire sends.
 *
 * On the RECEIPT path the under-application is defensible and stays: a receipt
 * echoes an edit the user just made, and over-applying defaults across every
 * turn is the worse failure. At BOOT it is not defensible — the server row IS
 * what the next turn rebases from, so a dropped value is screen-vs-compute
 * divergence.
 *
 * THE FIX IS DERIVED, NOT A SECOND LIST. `mapDraftEdgeToCanvas` already proves
 * which fields the wire carried: it computes `wireSuppliedStrength` from the
 * same three probes its priority chain uses and passes it to
 * `edgeValueSourcePatch`, which OMITS any stamp it cannot justify. Hence
 * `weightSource` present on the mapped edge ⟺ the wire carried a strength. The
 * field set is `EDGE_PROVENANCED_FIELDS`; the stamp key is `edgeSourceKey`.
 *
 * ⚠ WHAT THIS DOES NOT FIX, NAMED RATHER THAN GLOSSED. Presence is only
 * recoverable for the PROVENANCED fields. Any other key the mapper always emits
 * with a non-undefined default is still equality-detected, and would still be
 * dropped if the wire ever started supplying it at exactly the default. That set
 * is enumerated and reviewed in a corpus assertion in
 * `mergeServerGraph.edgePresence.spec.ts` §4, which goes RED when it grows —
 * because a guard derived from a registry can prove its consumers agree with the
 * registry and can never prove the registry is complete.
 */
export function overlayEdge(
  existing: any,
  wireEdge: any,
  opts?: OverlayEdgeOptions,
): any {
  const mapped = mapDraftEdgeToCanvas(wireEdge, 0)
  const mappedData = (mapped.data ?? {}) as Record<string, unknown>

  const defaults = edgeMapperDefaults()
  const supplied: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(mappedData)) {
    if (!sameValue(v, defaults[k])) supplied[k] = v
  }

  // Presence beats equality on the paths that ask for it. Runs BEFORE the stamp
  // coupling below, so a value promoted here keeps its own stamp rather than
  // having it stripped as orphaned.
  if (opts?.presenceFromProvenanceStamps) {
    for (const field of EDGE_PROVENANCED_FIELDS) {
      if (edgeSourceKey(field) in mappedData && field in mappedData) {
        supplied[field] = mappedData[field]
      }
    }
  }

  // A provenance stamp must never outlive or precede the value it describes.
  //
  // The filter above deliberately UNDER-applies: a wire value that happens to
  // equal the mapper default is treated as unsupplied and does not overwrite
  // local state. A `*Source` stamp, though, differs from the baseline whenever
  // the wire supplied ANYTHING — so without this coupling a receipt carrying
  // weight 0.5 (== DEFAULT_EDGE_DATA.weight, therefore not applied) would still
  // stamp `weightSource: 'cee'` onto an edge still showing the user's own 0.7.
  // That is the exact defect class this marker exists to close: a claim about
  // where a number came from, attached to a different number. Derived from
  // EDGE_PROVENANCED_FIELDS, never a hand-kept pair list.
  for (const field of EDGE_PROVENANCED_FIELDS) {
    const sourceKey = edgeSourceKey(field)
    if (sourceKey in supplied && !(field in supplied)) delete supplied[sourceKey]
  }

  if (Object.keys(supplied).length === 0) return existing

  // …and a stamp alone must not trigger a write. A receipt that genuinely
  // matches the canvas is a STRICT no-op here — no history entry, no store
  // write — and metadata about an unchanged number does not earn an exception:
  // it would churn every user's history on their first turn after this ships,
  // for a display outcome identical either way. So the no-op test is made
  // against the data WITHOUT the stamps; when a real value does change, the
  // stamps ride along with it.
  const nextDataWithoutStamps = { ...(existing.data ?? {}) }
  for (const [k, v] of Object.entries(supplied)) {
    if (!EDGE_SOURCE_KEYS.has(k)) nextDataWithoutStamps[k] = v
  }
  if (sameValue(existing.data, nextDataWithoutStamps)) return existing

  const nextData = { ...(existing.data ?? {}), ...supplied }
  if (sameValue(existing.data, nextData)) return existing
  return { ...existing, data: nextData }
}

export function reconcileAppliedGraph(
  draftData: CEEDraftResponse | CEEv2Response | CEEv3Response
): ReconcileAppliedGraphResult {
  const rawNodes: any[] =
    (draftData as any)?.nodes ?? (draftData as any)?.graph?.nodes ?? []
  const rawEdges: any[] =
    (draftData as any)?.edges ?? (draftData as any)?.graph?.edges ?? []

  const store = useCanvasStore.getState()
  const existingNodeIds = new Set(store.nodes.map((n) => n.id))
  const existingEdgeIds = new Set(store.edges.map((e) => e.id))

  // Structural guard (PR #266 review): an applied-edit receipt's graph is the
  // COMMITTED canvas graph plus/minus the edit, so it always shares node ids
  // with a non-empty canvas. Zero overlap means this draft_graph is a
  // misdrafted FRESH graph (fresh scenario_id + populated canvas + first
  // brief-shaped message slips past CEE's continuation guard) — grafting it
  // would union two unrelated graphs. Drop and warn instead.
  //
  // This guard is MORE load-bearing now than it was under the additive merge:
  // an unrelated graph would not merely graft, it would DELETE the real one.
  if (store.nodes.length > 0 && rawNodes.length > 0) {
    const hasOverlap = rawNodes.some(
      (n: any) => n != null && typeof n.id === 'string' && existingNodeIds.has(n.id)
    )
    if (!hasOverlap) {
      logger.warn('merge_applied_graph.zero_overlap_drop', {
        scenarioId: store.currentScenarioId ?? null,
        canvasNodeCount: store.nodes.length,
        wireNodeCount: rawNodes.length,
      })
      return { ...NO_CHANGE }
    }
  }

  // --- Wire indexes ---
  const wireNodeById = new Map<string, any>()
  for (const n of rawNodes) {
    if (n != null && typeof n.id === 'string' && n.id.length > 0) {
      if (!wireNodeById.has(n.id)) wireNodeById.set(n.id, n)
    }
  }
  const wireEdgeByPair = new Map<string, any>()
  for (const e of rawEdges) {
    if (e == null) continue
    const key = wireEdgePairKey(e)
    // First wins: parallel edges between one pair are not a canvas shape.
    if (key && !wireEdgeByPair.has(key)) wireEdgeByPair.set(key, e)
  }

  // --- Removals (authorised only for elements CEE has acknowledged) ---
  // `lastAuthoritativeGraph` is null until the UI has seen an authoritative
  // graph for this scenario (fresh draft, prior receipt, or DB hydration), in
  // which case nothing is removable — the fail-safe direction.
  const authoritative = store.lastAuthoritativeGraph
  const ackNodeIds = new Set(authoritative?.nodeIds ?? [])
  const ackEdgePairs = new Set(authoritative?.edgePairs ?? [])

  const removedNodeIds = new Set<string>()
  for (const n of store.nodes) {
    if (ackNodeIds.has(n.id) && !wireNodeById.has(n.id)) removedNodeIds.add(n.id)
  }

  const survivingNodes = store.nodes.filter((n) => !removedNodeIds.has(n.id))

  const removedEdgeIds = new Set<string>()
  for (const e of store.edges) {
    // An edge whose endpoint was removed cannot survive (matches CEE's own
    // remove_node semantics: patch-applier.ts filters connected edges).
    if (removedNodeIds.has(e.source) || removedNodeIds.has(e.target)) {
      removedEdgeIds.add(e.id)
      continue
    }
    const key = canvasEdgePairKey(e)
    if (key && ackEdgePairs.has(key) && !wireEdgeByPair.has(key)) {
      removedEdgeIds.add(e.id)
    }
  }

  // --- Updates on surviving elements ---
  let updatedNodeCount = 0
  const reconciledNodes = survivingNodes.map((n: any) => {
    const wireNode = wireNodeById.get(n.id)
    if (!wireNode) return n
    const next = overlayNode(n, wireNode)
    if (next !== n) updatedNodeCount += 1
    return next
  })

  let updatedEdgeCount = 0
  const survivingEdges = store.edges.filter((e) => !removedEdgeIds.has(e.id))
  const reconciledEdges = survivingEdges.map((e: any) => {
    const key = canvasEdgePairKey(e)
    const wireEdge = key ? wireEdgeByPair.get(key) : undefined
    if (!wireEdge) return e
    const next = overlayEdge(e, wireEdge)
    if (next !== e) updatedEdgeCount += 1
    return next
  })

  // --- Added nodes: on the wire, not on the canvas ---
  const missingRawNodes = rawNodes.filter(
    (n: any) =>
      n != null &&
      typeof n.id === 'string' &&
      n.id.length > 0 &&
      !existingNodeIds.has(n.id)
  )
  const addedNodes = missingRawNodes.map((n: any) => mapDraftNodeToCanvas(n))

  // Deterministic placement: a column to the right of the SURVIVING bounding
  // box. Never re-layouts the user's existing nodes.
  if (addedNodes.length > 0) {
    const xs = reconciledNodes.map((n: any) => n.position?.x ?? 0)
    const ys = reconciledNodes.map((n: any) => n.position?.y ?? 0)
    const baseX = (xs.length ? Math.max(...xs) : 0) + ADDED_COLUMN_X_GAP
    const baseY = ys.length ? Math.min(...ys) : 0
    addedNodes.forEach((n: any, idx: number) => {
      n.position = { x: baseX, y: baseY + idx * ADDED_COLUMN_Y_STEP }
    })
  }

  // --- Added edges: on the wire, not on the canvas, endpoints resolvable ---
  const unionNodeIds = new Set<string>([
    ...reconciledNodes.map((n: any) => n.id as string),
    ...addedNodes.map((n: any) => n.id as string),
  ])
  // Track endpoint pairs already taken — by surviving canvas edges AND by
  // earlier NEW edges in this same receipt. The commit below writes via a
  // direct setState (bypassing addEdge's duplicate guard), so two wire edges
  // sharing a pair must self-dedupe here (first wins).
  const seenEdgePairs = new Set<string>(
    reconciledEdges
      .map((e: any) => canvasEdgePairKey(e))
      .filter((k): k is string => k !== null)
  )
  const survivingEdgeIds = new Set(reconciledEdges.map((e: any) => e.id))
  const missingRawEdges = rawEdges.filter((e: any) => {
    if (e == null) return false
    const key = wireEdgePairKey(e)
    if (key === null) return false
    if (typeof e.id === 'string' && survivingEdgeIds.has(e.id)) return false
    if (seenEdgePairs.has(key)) return false
    // Fail-closed: never add a dangling edge (e.g. wire endpoint the user
    // deleted locally and the receipt re-references).
    const from = e.from ?? e.source
    const to = e.to ?? e.target
    if (!unionNodeIds.has(from) || !unionNodeIds.has(to)) return false
    seenEdgePairs.add(key)
    return true
  })
  const usedEdgeIds = new Set<string>([...existingEdgeIds, ...survivingEdgeIds])
  const addedEdges = missingRawEdges.map((e: any, i: number) => {
    const mapped = mapDraftEdgeToCanvas(e, i)
    // The mapper's fallback id (`e-${i}`) indexes the wire array — make it
    // collision-proof against edges already on the canvas.
    let id: string = mapped.id
    while (usedEdgeIds.has(id)) id = `${id}-a`
    usedEdgeIds.add(id)
    return { ...mapped, id }
  })

  const result: ReconcileAppliedGraphResult = {
    addedNodeCount: addedNodes.length,
    addedEdgeCount: addedEdges.length,
    updatedNodeCount,
    updatedEdgeCount,
    removedNodeCount: removedNodeIds.size,
    removedEdgeCount: removedEdgeIds.size,
  }

  const changed =
    result.addedNodeCount > 0 ||
    result.addedEdgeCount > 0 ||
    result.updatedNodeCount > 0 ||
    result.updatedEdgeCount > 0 ||
    result.removedNodeCount > 0 ||
    result.removedEdgeCount > 0

  // Record what CEE has acknowledged even on a no-op: the receipt is proof
  // that CEE has seen exactly these elements, which is what authorises a
  // LATER receipt to delete them. Doing this only on a change would leave the
  // set stale after an idempotent turn.
  useCanvasStore.getState().setLastAuthoritativeGraph({
    nodeIds: [...wireNodeById.keys()],
    edgePairs: [...wireEdgeByPair.keys()],
  })

  // ROADMAP 2.932 (Codex MF2) — commit the receipt's goal_constraints.
  //
  // The receipt's draft_graph carries goal_constraints the same way the
  // fresh-draft path does — nested per @talchain/schemas, or lifted from the
  // response root onto this very object by attachAnalysisReadyToInlineDraftGraph
  // (useConversation), which is the SAME object applyDraftResult reads. Before
  // this, reconcile committed ONLY nodes and edges, so a populated-canvas turn
  // that returned constraints left the store on the previous value — the
  // completed canvas showed "No limits on record" and the NEXT analysis (which
  // reads store.goalConstraints) omitted them. That is the silent-loss the row
  // is about.
  //
  // Runs BEFORE the `!changed` early-return: a terminal analysis turn typically
  // leaves the graph structurally identical while still carrying the
  // constraints, so gating this on a node/edge change would drop exactly the
  // case the defect describes.
  //
  // ABSENCE DOES NOT CLEAR. This module's whole contract is "the wire WINS on
  // keys it carries, the canvas KEEPS keys the wire omits" (see overlayNode) —
  // an applied-edit receipt is not the wholesale replacement a fresh draft is,
  // so a receipt that merely does not re-send constraints must not become a NEW
  // way to lose them (the exact failure class this row closes). Non-empty array
  // → adopt; absent / empty / non-array → leave the store as-is. fromProducerSync
  // because these are CEE's authoritative post-state and must not self-dirty the
  // freshness verdict the same response already set.
  const receiptGoalConstraints = (draftData as { goal_constraints?: unknown }).goal_constraints
  if (Array.isArray(receiptGoalConstraints) && receiptGoalConstraints.length > 0) {
    useCanvasStore
      .getState()
      .setGoalConstraints(receiptGoalConstraints as CEEGoalConstraint[], { fromProducerSync: true })
  }

  if (!changed) return result

  // --- Commit: one history entry, one atomic store write ---
  const canvas = useCanvasStore.getState()
  canvas.pushHistory()
  useCanvasStore.setState({
    nodes: [...reconciledNodes, ...addedNodes] as any,
    edges: [...reconciledEdges, ...addedEdges] as any,
  })

  // Staleness flags set EXPLICITLY (not via pushToHistory, which early-returns
  // without flipping them when the pre-merge state equals the last snapshot),
  // and ATOMICALLY: the freshness banners read the analysisFreshnessDirty
  // overlay, not the legacy pair, and every other mutation path already marks
  // all three (applyDraftResult, the edit chokepoints, commitValidatedMutation).
  useCanvasStore.getState().markGraphStructurallyEdited?.()

  // Warning-only schema validation on the added nodes (mirrors applyDraftResult).
  validateNodesBatch(addedNodes)

  // Seamlessness R2: acknowledge the AI's applied edit with the SAME
  // coalesced 2s highlight the graph_patch path uses — pulse only, no
  // selection/viewport hijack. Fail-closed downstream against the canvas.
  // Updated elements pulse too: a changed value the user cannot see change is
  // the display half of the same defect.
  pulseAppliedTargets({
    nodeIds: [
      ...addedNodes.map((n: any) => n.id as string),
      ...reconciledNodes
        .filter((n: any, i: number) => n !== survivingNodes[i])
        .map((n: any) => n.id as string),
    ],
    edgeIds: [
      ...addedEdges.map((e: any) => e.id as string),
      ...reconciledEdges
        .filter((e: any, i: number) => e !== survivingEdges[i])
        .map((e: any) => e.id as string),
    ],
  })

  // Newly added option nodes need node.data.interventions mirrored from
  // analysis_ready (OptionNode render, islRequestAdapter fallback readers).
  // applyV5State step 4 wrote ceeAnalysisReady BEFORE this reconcile ran, when
  // the option node did not yet exist — close the loop now. Idempotent.
  const analysisReady = useCanvasStore.getState().ceeAnalysisReady
  if (analysisReady) {
    backfillInterventionsOntoOptionNodes(analysisReady)
  }

  // Immediate autosave for crash resilience (mirrors applyDraftResult).
  try {
    // Shared projection — previously this literal omitted ceeAnalysisReady and
    // selectedGoalNode, and saveAutosave REPLACES, so applying a merge dropped
    // both from whatever the periodic autosave had last written.
    saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  } catch {
    // Non-critical — swallow save errors
  }

  return result
}
