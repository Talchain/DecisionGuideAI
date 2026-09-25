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
 *     and placed at the end of their kind's own row, clear of every existing
 *     card (`newNodePlacement.placeAddedNodes`; a kind with no row yet falls
 *     back to a column right of the bounding box) — never a full re-layout of
 *     the user's graph.
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
 *     store write, no autosave, no freshness dirtying. The single exception is
 *     metadata, not a change: a receipt whose values all match may still record
 *     a missing or superseded validated `serverStrength` tuple — one edges
 *     write, and nothing else (see "TUPLE-ONLY ACQUISITION" below).
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
 * Freshness: a committing reconcile marks the model changed (all three flags,
 * `markGraphStructurallyEdited`) — #344, because a confirmed chat edit's own
 * verdict is often silent or stale and the overlay is what the banners read.
 * (This paragraph used to say the overlay was "deliberately NOT" marked here;
 * #344 reversed that and the sentence was never updated.) The ONE exception is
 * a receipt the same response attests is the graph its analysis was computed
 * against — see `receiptIsTheAttestedAnalysedGraph` at the commit below.
 * applyV5State runs BEFORE this reconcile, so that verdict has already cleared
 * the overlay by the time the commit would re-dirty it.
 */

import { CanonicalCommittedGraphReceiptSchema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../store'
import { validateNodesBatch } from '../domain/nodes'
import { logger } from '../../lib/logger'
import { saveAutosave } from '../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../store/autosaveProjection'
import { pulseAppliedTargets } from './appliedEditPulse'
import { canvasEdgePairKey, wireEdgePairKey } from './graphIdentity'
import { placeAddedNodes } from './newNodePlacement'
import { EDGE_PROVENANCED_FIELDS, edgeSourceKey } from '../domain/edgeValueProvenance'

/** Derived from EDGE_PROVENANCED_FIELDS — never a hand-listed set. */
const EDGE_SOURCE_KEYS: ReadonlySet<string> = new Set(EDGE_PROVENANCED_FIELDS.map(edgeSourceKey))

/**
 * Keys that are METADATA ABOUT a value rather than a value — so they ride
 * along with a real change but may never TRIGGER a write on their own.
 *
 * The `*Source` stamps are here for the reason given at the no-op test below:
 * a receipt that genuinely matches the canvas must stay a strict no-op, or it
 * churns every user's history on their first turn after a deploy for an
 * outcome identical either way.
 *
 * ⚠ `serverStrength` JOINS THEM, AND THE COST IS STATED RATHER THAN GLOSSED.
 * It is the wire-provenance record `edge_strength_edit.expected` is built from
 * (domain/edges.ts `readServerStatedStrength`), and unlike the display stamps
 * its absence has a FUNCTIONAL cost: the strength control cannot assert
 * anything about the server on an edge that carries none, so the edit is
 * refused (visibly) rather than sent. It is excluded anyway, because the
 * alternative is worse and is not this lane's to decide: leaving it in would
 * make every default-equal receipt write, silently reversing the reviewed
 * decision above for every edge on every turn.
 *
 * ⛔ SUPERSEDED 23 Sep (Codex 5798417040, #1913) — the paragraph that stood
 * here called the resulting divergence "narrow and fail-safe": a receipt whose
 * every value already matched, on an edge with no tuple, left the edge refusing
 * to assert "until the next receipt that moves something". That was the wrong
 * boundary. The receipt is the server's proof of the saved value, and the
 * refusal it left behind is FUNCTIONAL — the person could not make their next
 * strength edit until a reload, where boot readback recorded the very same
 * tuple. So both callers now ACQUIRE a validated tuple on an otherwise-no-op
 * overlay (`acquireServerStrengthOnNoop`). What this set still guarantees is
 * unchanged: none of these keys decides whether VALUES changed, so an
 * acquisition is never an edit — no history entry, no counted update, no
 * freshness dirtying, no pulse (`reconcileAppliedGraph`, "TUPLE-ONLY
 * ACQUISITION"), and no stamp is rewritten on an unchanged value.
 */
const EDGE_METADATA_ONLY_KEYS: ReadonlySet<string> = new Set([
  ...EDGE_SOURCE_KEYS,
  'serverStrength',
])
import {
  backfillInterventionsOntoOptionNodes,
  mapDraftEdgeToCanvas,
  mapDraftNodeToCanvas,
} from './applyDraftResult'
import type { CEEDraftResponse, CEEGoalConstraint, CEEv2Response, CEEv3Response } from '../../adapters/cee/types'

/**
 * The fallback column's constants, re-exported from where the placement rule
 * now lives (`newNodePlacement.placeAddedNodes`) so existing importers keep one
 * definition rather than gaining a second.
 */
export { ADDED_COLUMN_X_GAP, ADDED_COLUMN_Y_STEP } from './newNodePlacement'

export interface ReconcileAppliedGraphResult {
  addedNodeCount: number
  addedEdgeCount: number
  updatedNodeCount: number
  updatedEdgeCount: number
  removedNodeCount: number
  removedEdgeCount: number
}

/**
 * Recognise a complete 0.43 committed receipt after the conversation seam has
 * attached its two UI-only helpers.
 *
 * The raw response was already strict-validated before those helpers were
 * attached. Removing only these two known local decorations reconstructs that
 * strict receipt surface; every producer field is still checked by the shared
 * schema, including required own keys and exact node/edge counts. Do not turn
 * this into a permissive pick-list: an unrelated extra key must keep failing
 * closed rather than gaining canonical deletion authority.
 */
function canonicalReceiptFromAugmentedDraft(
  draftData: unknown,
): ReturnType<typeof CanonicalCommittedGraphReceiptSchema.safeParse> {
  if (draftData == null || typeof draftData !== 'object' || Array.isArray(draftData)) {
    return CanonicalCommittedGraphReceiptSchema.safeParse(draftData)
  }

  const candidate = { ...(draftData as Record<string, unknown>) }
  delete candidate.analysis_ready
  delete candidate.draftCoaching
  return CanonicalCommittedGraphReceiptSchema.safeParse(candidate)
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
 * when overlaying onto an EXISTING edge — but ONLY for keys whose baseline is
 * `undefined` (there "differs from the baseline" IS "the mapper emitted it") or
 * a constant the wire cannot set. The keys that CAN collide with a real default
 * (`weight`, `direction`) are decided by PRESENCE in `overlayEdge`, never by
 * this baseline — see "PRESENCE ON BOTH PATHS" there.
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
/**
 * ⭐ KEY ORDER IS NOT A CHANGE (manual-edit proof D1 root cause, 24 Sep).
 *
 * Serialise with object keys SORTED, recursively, so two objects holding the
 * same values compare equal whatever order their keys arrived in. Measured on
 * the served build: the agent lane's readback returns `observedState` / `prior`
 * keys shortest-first (the order Postgres `jsonb` stores), the canvas holds the
 * order it was built in, and a plain `JSON.stringify` counted every such node as
 * UPDATED — re-marking the model edited just after a run cleared it. Arrays keep
 * their order: an ordered list is not a set.
 */
function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_key, value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k]
    }
    return sorted
  })
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Exactly one side is `undefined` (both-undefined was caught above), so they
  // cannot be equal and there is nothing to serialise.
  if (a === undefined || b === undefined) return false
  try {
    return canonicalJson(a) === canonicalJson(b)
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
   * On an otherwise-no-op overlay, still record the server's validated strength
   * tuple (`serverStrength`) when the canvas lacks it or holds a different one —
   * that key and nothing else; every existing field and stamp is preserved.
   *
   * BOTH production callers pass it: boot hydration, and — since 23 Sep (Codex
   * 5798417040, #1913) — the applied-edit receipt. The receipt used to stay a
   * strict metadata no-op, which discarded the server's proof of a saved value
   * whenever the canvas already DISPLAYED it and left the next strength edit
   * refused until reload. Omitting it keeps the strict primitive, which only
   * tests now exercise. What counts as "supplied" is NOT an option — both
   * callers share one presence rule.
   *
   * (Renamed 23 Sep from `presenceFromProvenanceStamps`, which also switched
   * presence on. Presence is now unconditional, so that name would describe
   * something the option no longer controls.)
   */
  acquireServerStrengthOnNoop?: boolean
}

/**
 * The analytical keys of a mapped wire edge that the WIRE ACTUALLY SUPPLIED.
 *
 * ONE rule for both callers of `overlayEdge` (the applied-edit receipt and boot
 * hydration), so the two cannot drift apart again.
 *
 *   · PROVENANCED fields (`EDGE_PROVENANCED_FIELDS`) — supplied ⟺ the mapper
 *     stamped them. `mapDraftEdgeToCanvas` derives each stamp from the SAME raw
 *     wire probes its value chain uses (`weightSource` ⟺ `strength.mean` /
 *     `strength_mean` / `weight` present; `directionSource` ⟺ an explicit
 *     `effect_direction`; …), and `edgeValueSourcePatch` omits any stamp it
 *     cannot justify. So this is presence on the raw wire object, derived once.
 *   · Every OTHER key — supplied ⟺ it differs from the mapper's synthetic
 *     baseline. For those keys that is presence too: the baseline is `undefined`
 *     for everything the wire can set, and the keys with a real default are
 *     constants the mapper never reads off the wire (enumerated and reviewed in
 *     `mergeServerGraph.edgePresence.spec.ts` §4, which goes RED if that set
 *     grows).
 */
function wireSuppliedEdgeData(mappedData: Record<string, unknown>): Record<string, unknown> {
  const defaults = edgeMapperDefaults()
  const supplied: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(mappedData)) {
    if (!sameValue(v, defaults[k])) supplied[k] = v
  }
  for (const field of EDGE_PROVENANCED_FIELDS) {
    if (edgeSourceKey(field) in mappedData && field in mappedData) {
      supplied[field] = mappedData[field]
    }
  }
  return supplied
}

/**
 * Overlay a wire edge's analytical fields onto an existing canvas edge.
 * Returns the SAME reference when nothing changed.
 *
 * Only keys the wire SUPPLIED are applied (`wireSuppliedEdgeData`). Without
 * that filter every receipt would splat DEFAULT_EDGE_DATA over locally-tuned
 * edges and churn history on every turn. A supplied key applies when its value
 * differs from the CANVAS's current value — never "from the mapper default".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ PRESENCE ON BOTH PATHS — EQUALITY-WITH-DEFAULT IS NOT PRESENCE (L61, 23 Sep)
 * ─────────────────────────────────────────────────────────────────────────────
 * `DEFAULT_EDGE_DATA.weight` is `0.5`. Deciding "supplied" by comparing against
 * the synthetic default edge meant a wire `strength.mean: 0.5` mapped to
 * `weight: 0.5`, compared EQUAL to the baseline, and was discarded as "not
 * supplied". The baseline's `direction` is `'positive'` for the same reason, so
 * an EXPLICIT `effect_direction: 'positive'` was dropped and a local
 * `'negative'` survived — a SIGN, not a rounding difference. Those are the only
 * two reachable collisions: `beliefExists` resolves to `undefined` in the
 * baseline and `strengthStd` is omitted, so both already differ from anything
 * the wire sends.
 *
 * L61 (4 Aug) moved BOOT onto presence and left the RECEIPT path on equality,
 * on the premise that "a receipt echoes an edit the user just made". ⛔ THAT
 * PREMISE IS FALSE for a conversational edit, and this module's own header says
 * why: the receipt is the ONLY transport of the edit's result. Witnessed 23 Sep
 * (scenario 58af9704): the user confirmed a strength of 0.5, CEE stored
 * `strength.mean 0.5`, the receipt carried it — and the canvas kept showing 1.
 * The UI claim no longer matched the wire receipt, CEE's reread or a reload.
 * So presence is now UNCONDITIONAL; the receipt path is no longer a special case.
 *
 * WHAT DID NOT CHANGE, and is pinned in
 * `mergeAppliedGraph.receiptDefaultEqual.spec.ts`:
 *   · a key the wire does NOT supply never overwrites the canvas;
 *   · a receipt whose supplied values all equal the canvas is a no-op for
 *     VALUES — no history entry, no counted update — and a stamp never triggers
 *     a write on its own (EDGE_METADATA_ONLY_KEYS). The one metadata write an
 *     unchanged value may carry is ACQUIRING the validated `serverStrength`
 *     tuple (Codex 5798417040, pinned in
 *     `mergeAppliedGraph.receiptServerStrength.spec.ts`); once the tuple also
 *     matches, the same reference comes back.
 *
 * ⚠ WHAT THIS DOES NOT FIX, NAMED RATHER THAN GLOSSED. `direction` counts as
 * supplied only when `effect_direction` is explicit (the ROADMAP 2.263 stamp
 * rule). A NON-NEGATIVE mean with no `effect_direction` derives `'positive'`,
 * which still equals the baseline and so still leaves a canvas `'negative'` in
 * place — on both paths, exactly as before. Whether CEE ever emits that shape
 * was not measured here.
 */
export function overlayEdge(
  existing: any,
  wireEdge: any,
  opts?: OverlayEdgeOptions,
): any {
  const mapped = mapDraftEdgeToCanvas(wireEdge, 0)
  const mappedData = (mapped.data ?? {}) as Record<string, unknown>

  const supplied = wireSuppliedEdgeData(mappedData)

  // A provenance stamp must never outlive or precede the value it describes.
  //
  // Belt, not the mechanism. Under the presence rule a stamp is supplied only
  // when its field is (the mapper emits the stamp exactly when the wire carried
  // the value), so this loop removes nothing today. It stays because the stamp
  // and the value are two keys that a future mapper change could decouple, and
  // the failure it guards is the one this marker exists to close: a claim about
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
    if (!EDGE_METADATA_ONLY_KEYS.has(k)) nextDataWithoutStamps[k] = v
  }
  if (sameValue(existing.data, nextDataWithoutStamps)) {
    // A validated readback (boot) or receipt enables the next edit, but does
    // not restate who supplied an unchanged value. Preserve every existing
    // field/stamp and acquire only the tuple — which the mapper emits only
    // when `readServerStatedStrength` validated it, so no tuple is invented.
    if (opts?.acquireServerStrengthOnNoop
      && supplied.serverStrength !== undefined
      && !sameValue(existing.data?.serverStrength, supplied.serverStrength)) {
      return { ...existing, data: { ...(existing.data ?? {}), serverStrength: supplied.serverStrength } }
    }
    return existing
  }

  const nextData = { ...(existing.data ?? {}), ...supplied }
  if (sameValue(existing.data, nextData)) return existing
  return { ...existing, data: nextData }
}

/**
 * True when `after` differs from `before` ONLY in `data.serverStrength` — the
 * overlay's tuple acquisition, which is metadata and never a counted update.
 * Anything else (a value, a stamp riding with a value) is a real change.
 */
function isServerStrengthAcquisitionOnly(before: any, after: any): boolean {
  if (before === after) return false
  const withoutTuple = (edge: any): Record<string, unknown> => {
    const data = { ...(edge.data ?? {}) } as Record<string, unknown>
    delete data.serverStrength
    return { ...edge, data }
  }
  return sameValue(withoutTuple(before), withoutTuple(after))
}

function nonEmptyHash(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/**
 * ⭐ IS THIS RECEIPT THE GRAPH THE ANALYSIS WAS COMPUTED AGAINST?
 *
 * WITNESSED on served UI `a4434670` (24 Sep, `MANUAL-EDIT-PROOF-20260924.md`
 * D1, 4 of 4 runs that followed an edit): the run completed, applyV5State's
 * `setAnalysisFreshness` took CEE's `fresh` verdict and cleared the overlay,
 * `resultsComplete` cleared the legacy flag — and 39 ms later THIS module's
 * commit called `markGraphStructurallyEdited` (stack: the served chunk's `Vc`
 * is `reconcileAppliedGraph`, called from the applied-receipt branch of
 * `useConversation`). Every surface then said "Model changed" over a run CEE,
 * the response and the store all called current. A run with no preceding edit
 * cleared correctly, because its receipt overlaid nothing.
 *
 * Why the run turn reaches this commit at all: on the Agent lane EVERY turn
 * carries a `draft_graph` read back from the persisted graph (CEE
 * `agent-v1-turn.ts` `readBackState`), and after an edit that readback is not
 * byte-identical to the canvas the edit left behind, so the overlay counts an
 * update. WHICH field differs on the served wire is UNVERIFIED — this
 * predicate deliberately does not depend on it. The question the mark answers
 * is "does the analysis still describe the canvas?", and when the reconcile
 * moves the canvas TO the graph the analysis was computed against, the answer
 * is yes whatever moved.
 *
 * ONLY WITH IDENTITY, NEVER FROM THE WORD `fresh` ALONE. All of:
 *   · the response's own `analysis_ready` (attached to this object by
 *     `attachAnalysisReadyToInlineDraftGraph` — the same readback that built
 *     the receipt) says `fresh` AND carries `graph_hash_at_run ===
 *     current_graph_hash`, both non-empty — the attestation CEE stamps only
 *     when the run's `computed_against_hash` equals the readback's hash
 *     (`analysis-ready-freshness.ts`), the same pair the boot restore demands;
 *   · the store HOLDS that same verdict — a payload the reducer refused (e.g.
 *     strictly older than one it already holds) is not the authority this
 *     canvas is under, and the receipt may be the older graph.
 * NOT a second copy of the store's holds. An undispatched edit or an
 * unregistered import already keeps the overlay set through this very turn
 * (`setAnalysisFreshness` / `clearAnalysisFreshnessDirty` decline to clear it),
 * so skipping the mark cannot un-dirty anything — it only stops THIS commit
 * from dirtying a clear one.
 * Anything else — a restore (no `analysis_ready` on the object), a confirmed
 * chat edit whose verdict is `stale` or silent (#344), a `fresh` without the
 * hash pair — keeps the mark. Fail closed: the cost of a false "changed" is a
 * rerun; the cost of a false "current" is a decision on the wrong model.
 */
function receiptIsTheAttestedAnalysedGraph(draftData: unknown): boolean {
  if (draftData == null || typeof draftData !== 'object') return false
  const ready = (draftData as { analysis_ready?: unknown }).analysis_ready
  if (ready == null || typeof ready !== 'object' || Array.isArray(ready)) return false
  const verdict = ready as Record<string, unknown>
  if (verdict.freshness !== 'fresh') return false
  const atRun = nonEmptyHash(verdict.graph_hash_at_run)
  const current = nonEmptyHash(verdict.current_graph_hash)
  if (atRun === null || atRun !== current) return false

  const held = useCanvasStore.getState().analysisFreshness
  return (
    held?.freshness === 'fresh' &&
    held.graphHashAtRun === atRun &&
    held.currentGraphHash === current
  )
}

export function reconcileAppliedGraph(
  draftData: CEEDraftResponse | CEEv2Response | CEEv3Response,
  opts?: {
    /**
     * The turn's committed response carries a `graph_hash` equal to the
     * `base_graph_hash` its edit was sent (and CAS-checked) against: CEE
     * states the edit moved nothing its analysis reads. See the dirty-mark
     * note below. Omitted → false.
     */
    readonly analysisHashUnmoved?: boolean
  },
): ReconcileAppliedGraphResult {
  const canonicalReceipt = canonicalReceiptFromAugmentedDraft(draftData)
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
  // Edges whose ONLY change is acquiring the receipt's validated server tuple.
  // Not counted as updates and never pulsed: no value the person sees moved.
  const tupleOnlyEdgeIds = new Set<string>()
  const survivingEdges = store.edges.filter((e) => !removedEdgeIds.has(e.id))
  const reconciledEdges = survivingEdges.map((e: any) => {
    const key = canvasEdgePairKey(e)
    const wireEdge = key ? wireEdgeByPair.get(key) : undefined
    if (!wireEdge) return e
    const next = overlayEdge(e, wireEdge, { acquireServerStrengthOnNoop: true })
    if (next === e) return e
    if (isServerStrengthAcquisitionOnly(e, next)) tupleOnlyEdgeIds.add(e.id)
    else updatedEdgeCount += 1
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

  // Deterministic placement: each added node joins ITS OWN ROW (the tier
  // `TIER_BY_KIND` gives its kind), right of that row's rightmost card and
  // clear of every card on the SURVIVING canvas — the row the canonical layout
  // would give it, so a later analysis no longer moves it to a different row.
  // A kind with no row yet keeps the column right of the bounding box. Never
  // re-layouts the user's existing nodes. ONE helper, shared with the boot
  // merge (`mergeServerGraph`), so the two placements cannot drift.
  if (addedNodes.length > 0) {
    const positions = placeAddedNodes(reconciledNodes, addedNodes)
    addedNodes.forEach((n: any, idx: number) => {
      n.position = positions[idx]
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
  // keys it carries, the canvas KEEPS keys the wire omits" (see overlayNode).
  // That remains the rule for every legacy/partial receipt: non-empty array →
  // adopt; absent / empty / non-array → retain.
  //
  // 0.43 adds one deliberately narrower case. A value that passes the shared
  // CanonicalCommittedGraphReceiptSchema owns every analysis-state key and has
  // count-consistent carrier arrays, so its own-key `goal_constraints: []` is
  // an explicit post-commit attestation of no constraints. Only that complete
  // shape may clear. This is schema authority, not an ad-hoc own-key check; an
  // almost-canonical receipt fails closed and retains the prior store value.
  // fromProducerSync because both adoption and clearing are CEE's authoritative
  // post-state and must not self-dirty the freshness verdict this response set.
  const receiptGoalConstraints = (draftData as { goal_constraints?: unknown }).goal_constraints
  const canonicalExplicitClear =
    canonicalReceipt.success && canonicalReceipt.data.goal_constraints.length === 0
  if (
    (Array.isArray(receiptGoalConstraints) && receiptGoalConstraints.length > 0) ||
    canonicalExplicitClear
  ) {
    const constraints: CEEGoalConstraint[] | null = canonicalExplicitClear
      ? null
      : (receiptGoalConstraints as CEEGoalConstraint[])
    useCanvasStore.getState().setGoalConstraints(constraints, { fromProducerSync: true })
    // R2: the staging MF2 witness traces constraints by these logs; without one
    // here the reconcile commit is invisible to it. Matches applyDraftResult's
    // and useV2Run's `[constraint-trace]` shape.
    logger.info('[constraint-trace] store-write', {
      source: 'reconcileAppliedGraph',
      count: constraints?.length ?? 0,
      constraint_ids: constraints?.map((c) => c.constraint_id) ?? [],
    })

    // F1 (adversarial review) — PERSIST HERE, AND NOT LEFT TO THE 30s TIMER OR
    // TO THE COMMIT BELOW. On this module's canonical case — a terminal analysis
    // turn that leaves the graph structurally identical — `changed` is false and
    // the early return below is taken, so the post-commit `saveAutosave` at the
    // end of this function NEVER RUNS. Nothing else covers it either:
    //   - applyV5State runs BEFORE this reconcile (useConversation.ts:4566 vs
    //     :4737), so its resultsComplete-driven write at store.ts:3365 persists
    //     the store's PRE-COMMIT constraints;
    //   - the 30s timer's dirty check is `computeGraphHash(nodes, edges)`, which
    //     is constraint-blind and skips (the identical hazard store.ts:3348's
    //     comment warns about for the analysis payload);
    //   - the complete saveAutosave writer manifest has no site that fires after
    //     a no-op commit.
    // Result before this write: the store held the constraints, the autosave did
    // not, and the guest reload hydrated `?? null` — cleared. It also keeps a
    // REVISED set from leaving the superseded one in the record.
    //
    // Deliberately unconditional rather than gated on `!changed`: a predicate
    // here would be one more thing to get wrong, and on the changed path the
    // post-commit write simply supersedes this one (saveAutosave skips an
    // identical payload, so the cost is bounded).
    try {
      saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
    } catch {
      // Non-critical — never let a persistence failure break the reconcile.
    }
  }

  // --- TUPLE-ONLY ACQUISITION (Codex 5798417040, #1913) ---
  //
  // No value moved, but the receipt proved what the server holds for at least
  // one edge whose tuple was missing or superseded. Record it, and NOTHING
  // else: no pushHistory (nothing the person could want to undo), no
  // markGraphStructurallyEdited (the analysis still describes these values),
  // no pulse, no autosave call. `serverStrength` is outside the registration
  // projection, so the acknowledgement digest is unchanged by this write; the
  // ordinary debounced graph save observes it exactly as it observes any
  // receipt write. Once value and tuple both match, the overlay returns the
  // same reference and this branch is not reached — replay stays idempotent.
  if (!changed) {
    if (tupleOnlyEdgeIds.size > 0) {
      // Same producer-write suppression as the commit below.
      useCanvasStore.getState().beginExternalGraphMutation?.('envelope_apply')
      try {
        useCanvasStore.setState({ edges: reconciledEdges as any })
      } finally {
        useCanvasStore.getState().endExternalGraphMutation?.()
      }
    }
    return result
  }

  // Asked BEFORE the commit, of the state the response itself left behind
  // (applyV5State has already applied this turn's verdict).
  const analysedGraphAttested = receiptIsTheAttestedAnalysedGraph(draftData)

  // --- Commit: one history entry, one atomic store write ---
  const canvas = useCanvasStore.getState()
  canvas.pushHistory()
  // ⚠ PRODUCER WRITE, NOT A USER GESTURE — the suppression is load-bearing.
  // `_externalMutationActive` is a COUNTER, so nesting with an outer window is
  // safe and deliberate. Without this, any consumer of "the user changed the
  // graph" — `useGuidanceInvalidationOnEdit`, and the `direct_graph_edit`
  // emitter on the flag-OFF posture — treats a write the PRODUCER made as a
  // local edit. For guidance that means wiping the coaching the very same turn
  // just delivered, and because `clearGuidanceItems()` also clears the persisted
  // blob (`guidanceStore.ts:608-613`), the loss survives a reload.
  useCanvasStore.getState().beginExternalGraphMutation?.('envelope_apply')
  try {
    useCanvasStore.setState({
      nodes: [...reconciledNodes, ...addedNodes] as any,
      edges: [...reconciledEdges, ...addedEdges] as any,
    })
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }

  // Staleness flags set EXPLICITLY (not via pushToHistory, which early-returns
  // without flipping them when the pre-merge state equals the last snapshot),
  // and ATOMICALLY: the freshness banners read the analysisFreshnessDirty
  // overlay, not the legacy pair, and every other mutation path already marks
  // all three (applyDraftResult, the edit chokepoints, commitValidatedMutation).
  //
  // ⛔ EXCEPT when this receipt IS the graph the same response's run was
  // computed against (`receiptIsTheAttestedAnalysedGraph`): the commit moved
  // the canvas TO the analysed graph, so "the analysis no longer describes the
  // canvas" would be false. Unconditional, this re-dirtied every run that
  // followed an edit ~39 ms after the run cleared it (D1, served `a4434670`).
  //
  // ⛔ AND EXCEPT when THE PRODUCER says its analysis-affecting hash did not
  // move (`opts.analysisHashUnmoved`, computed by the caller from the turn's
  // own wire: the committed response's `graph_hash` equals the
  // `base_graph_hash` the edit was CAS-checked against). Served witness 25 Sep
  // (UI `64a3b385` / CEE `e39f6e0`, scenario `51c9ce82…`): a `structural_rename`
  // sent at base `31f5adf8e5043c9c` came back at `graph_hash`
  // `31f5adf8e5043c9c`, 0 provider calls — and this commit still marked the
  // model structurally edited, so the canvas said "Model changed" until a
  // reload. `changed` above is TRUE for any byte difference the overlay picks
  // up, cosmetic keys included; it still decides the COMMIT. Only the DIRTY
  // CLAIM now defers to CEE's own hash projection — never to a UI list of
  // "analytical fields", which is narrower than that projection
  // (`category`, `factor_type`, `intercept`, `encoding_map`, `edge_type`:
  // review 5821463627) and would read a real change as "current".
  // Absent, or any other wire → the mark stands (fail closed: a false
  // "changed" costs a rerun; a false "current" costs a decision).
  if (!analysedGraphAttested && opts?.analysisHashUnmoved !== true) {
    useCanvasStore.getState().markGraphStructurallyEdited?.()
  }

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
        .filter((e: any, i: number) => e !== survivingEdges[i] && !tupleOnlyEdgeIds.has(e.id))
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
