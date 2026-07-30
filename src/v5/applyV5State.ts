/**
 * applyV5State — translate V5 OlumiResponse side-effects into canvas store
 * mutations.
 *
 * V5 responses are slim — they carry diffs (graph_patch blocks) and
 * analysis summaries (analysis_result.enrichment) rather than full state
 * envelopes. The V4 path uses handleEnvelope() which applies richer
 * state directly from OrchestratorResponseEnvelopeV2. For the V5 exclusive
 * path this function keeps local UI state consistent with what CEE has
 * already done server-side.
 *
 * Scope:
 *   1. stage_indicator → canvas.currentStage
 *   2. graph_patch (applied) → canvas store mutation for set_factor_value,
 *      adjust_edge_strength, and add_constraint. add_constraint maps `after`
 *      into a CEEGoalConstraint and UPSERTS it (by constraint id) into the
 *      canvas `goalConstraints` slice via setGoalConstraints — the SAME slice
 *      GoalPanel's "Add constraint" flow writes. A patch that carries the
 *      constraint_id of one already stored REPLACES it in place (CEE edits a
 *      constraint's value/label/unit while retaining its id — see
 *      add-constraint.ts); only a deep-semantic no-op (all fields equal after
 *      normalisation) writes nothing. Also: ui_directive verbs
 *      (highlight / focus / open_inspector) — the AI's "point at the graph"
 *      gestures, each reusing the seam its user-driven equivalent uses.
 *   3. analysis_result.enrichment.decision_review → runMeta. TWO different
 *      payloads share that key and go to two different fields: the live 0.30
 *      shape → `runMeta.decisionReview030`, the M1 REST shape →
 *      `runMeta.ceeReviewV1` (inert on live turns — see decisionReviewAdapter).
 *      BOTH are written on every analysis turn, value or null, so neither can
 *      go stale behind the other (ROADMAP 2.154).
 *      Block enrichment is the canonical source. A secondary check on a
 *      non-schema top-level enrichment field (future CEE extension) is
 *      gated behind a runtime presence check so it safely no-ops today.
 *   4. analysis_ready (top-level, CEE v0.8.1+) → store.ceeAnalysisReady.
 *      Lenient shape validation only — status and per-option status are
 *      passed through for downstream readiness logic to interpret (see
 *      usePreRunValidation). Skipped when the inline-draft_graph path will
 *      subsequently run applyDraftResult, which owns the write on that path.
 *
 * The function is idempotent for repeated application of the same
 * response (e.g. test double-fires) because all downstream store
 * mutations are property assignments keyed by target_id.
 */
import type { OlumiResponse, StageType } from '@talchain/schemas/boundary'
import type { Edge, Node } from '@xyflow/react'

import type { ReportV1 } from '../adapters/plot/types'
import type { CEEAnalysisReady, CEEGoalConstraint } from '../adapters/cee/types'
import type { CeeDecisionReviewPayloadV1 } from '../types/cee'
import type { ScenarioStage } from '../types/scenario'
import { logV5StateStep } from './debugLog'
import { pulseAppliedTargets } from '../canvas/utils/appliedEditPulse'
import { focusNodeById, focusEdgeById } from '../canvas/utils/focusHelpers'
import {
  readDecisionReviewWireState,
  type DecisionReview030,
} from './decisionReviewAdapter'
import { mapV5AnalysisToReport } from './mapV5AnalysisToReport'
import { v5StageToScenarioStage } from './stageMapper'

/**
 * Minimal store-shape interface. useCanvasStore.getState() returns a larger
 * type; this picks only what we mutate so the applicator stays loosely
 * coupled and easily testable. The structural typing matches both the real
 * store and any test double.
 */
export interface V5ApplicatorStore {
  setCurrentStage: (stage: ScenarioStage | null) => void
  updateNode: (id: string, updates: Partial<Node>) => void
  updateEdgeData: (id: string, data: Partial<Record<string, unknown>>) => void
  nodes: Node[]
  edges: Edge[]
  /** Partial merge into runMeta — only provided fields are updated. */
  setRunMeta: (meta: {
    ceeReviewV1: CeeDecisionReviewPayloadV1 | null
    /** ROADMAP 2.154 — the 0.30 review view-model, or null to evict. */
    decisionReview030: DecisionReview030 | null
  }) => void
  /** Write (or clear) the CEE analysis_ready payload that gates the run. */
  setCeeAnalysisReady: (analysisReady: CEEAnalysisReady | null) => void
  /**
   * Optional: write goal_constraints (ROADMAP 1.22). On the V5 path this
   * applicator writes via `add_constraint` graph_patch blocks only, UPSERTING
   * by constraint id (step 2) — additive/replace, never a clear (a turn with no
   * constraint patch leaves the slice untouched; there is no V5 clear signal to
   * gate on). The other live source, CEE's `draft_graph.goal_constraints`, is
   * owned by applyDraftResult, not here.
   */
  setGoalConstraints?: (
    constraints: CEEGoalConstraint[] | null,
    opts?: { fromProducerSync?: boolean },
  ) => void
  /**
   * Current goal constraints, read to UPSERT an `add_constraint` graph_patch's
   * constraint (replace by id, or append when new) without dropping the ones
   * already present. Snapshot-frozen at apply time (the applicator receives a
   * spread of getState()), so multiple add_constraint patches in one turn are
   * coalesced into a single setGoalConstraints write after the block loop —
   * reading this field again after a mid-loop set would return the stale
   * pre-turn value.
   */
  goalConstraints?: CEEGoalConstraint[] | null
  /**
   * Optional: select a node without a history entry — the SAME seam a user
   * click uses to open/retarget inspector-v2 (store.ts). Wired for the
   * `open_inspector` ui_directive verb; selection only, no viewport move.
   */
  selectNodeWithoutHistory?: (nodeId: string) => void
  /** Optional: select an edge without a history entry (edge inspector). */
  selectEdgeWithoutHistory?: (edgeId: string) => void
  /**
   * Optional: backfill goal_threshold_raw/unit/cap onto the goal node's data
   * (ROADMAP 1.22). Wired at the real call site to the shared
   * `backfillGoalThresholdOntoGoalNode` helper (applyDraftResult.ts) — that
   * helper writes via a direct store.setState, NOT store.updateNode, because
   * `goal_threshold_raw` is in ANALYTICAL_NODE_DATA_FIELDS (analyticalChange.ts):
   * routing this backfill through updateNode would treat CEE echoing back the
   * threshold on its OWN just-received analysis_ready as a user edit and
   * invalidate the very analysis this applicator just marked fresh two lines
   * above. Injected (rather than called as a bare import) so applyV5State's
   * own unit tests stay isolated from the real canvas store.
   */
  backfillGoalThreshold?: (analysisReady: {
    goal_node_id?: string
    goal_threshold_raw?: number | null
    goal_threshold_unit?: string | null
    goal_threshold_cap?: number | null
  }) => void
  /** Optional: update the freshness slice from a raw response.analysis_ready (retain / order / never absence→fresh). */
  setAnalysisFreshness?: (rawAnalysisReady: unknown) => void
  /** Optional: clear the local dirty overlay when a genuinely new analysis run completes (new analysis_result response_hash). */
  clearAnalysisFreshnessDirty?: () => void
  /** Optional (F10): a genuinely new analysis_result landed with NO explicit
   *  freshness verdict on the response — overwrite the freshness slice to
   *  unknown/run_completed_without_verdict instead of retaining a pre-run
   *  'stale' over the run's own results. */
  noteRunCompletedWithoutVerdict?: () => void
  /**
   * Results hydration (V5-exclusive path). When the response carries an
   * analysis_result block, the applicator builds a ReportV1 via
   * mapV5AnalysisToReport and calls this setter so the main Results panel
   * renders V5 analyses without selector changes (mirrors the V4 envelope
   * path at useConversation.ts:1865+). Optional so the applicator stays
   * testable against minimal store doubles.
   *
   * The real canvas store's resultsComplete accepts a wider params shape
   * (drivers, cee*, rawV2Response); the V5 path only uses the narrow
   * subset declared here. TypeScript's structural subtyping accepts the
   * wider real implementation in this slot.
   */
  resultsComplete?: (params: {
    report: ReportV1
    hash: string
    resultsSource?: 'direct' | 'conversation'
    enrichment?: unknown
    rawV2Response?: unknown
  }) => void
  /**
   * Current results hash for dedupe. When the new analysis hash matches
   * this value, the applicator skips the resultsComplete write — same
   * pattern as the V4 path (useConversation.ts:1861). null when no
   * analysis has been hydrated yet.
   */
  currentResultsHash?: string | null
}

/**
 * Lenient normaliser for a V5 top-level analysis_ready payload.
 *
 * Shape invariants enforced (strict):
 *   - `goal_node_id` must be a non-empty string.
 *   - `options` must be an array with at least one entry that carries an id
 *     (`id` or `option_id`).
 *
 * Per-option normalisation (tolerant):
 *   - `option_id` is mapped to `id` if `id` is absent.
 *   - Entries missing both `id` and `option_id` are dropped.
 *   - Missing / non-object `interventions` becomes `{}` (baseline options
 *     legitimately have no interventions).
 *   - `status` is passed through when it is a string; otherwise `'unknown'`.
 *
 * Returns `undefined` when the payload is absent, not a plain object, or
 * fails the shape invariants above. Callers should treat `undefined` as
 * "clear the store value" (defensive — prevents a stale ceeAnalysisReady
 * from a prior turn surviving into a turn where CEE sent a malformed
 * payload).
 */
function normaliseV5AnalysisReady(raw: unknown): CEEAnalysisReady | undefined {
  if (raw == null || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>

  const goalNodeId = obj.goal_node_id
  if (typeof goalNodeId !== 'string' || goalNodeId.length === 0) return undefined
  if (!Array.isArray(obj.options) || obj.options.length === 0) return undefined

  const normalisedOptions = obj.options
    .map((optRaw) => {
      if (optRaw == null || typeof optRaw !== 'object') return null
      const opt = optRaw as Record<string, unknown>
      const id =
        typeof opt.id === 'string' && opt.id.length > 0
          ? opt.id
          : typeof opt.option_id === 'string' && opt.option_id.length > 0
            ? opt.option_id
            : undefined
      if (!id) return null

      const interventions =
        opt.interventions != null &&
        typeof opt.interventions === 'object' &&
        !Array.isArray(opt.interventions)
          ? (opt.interventions as Record<string, unknown>)
          : {}
      const status = typeof opt.status === 'string' ? opt.status : 'unknown'

      return { ...opt, id, interventions, status }
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)

  if (normalisedOptions.length === 0) return undefined

  const topStatus = typeof obj.status === 'string' ? obj.status : 'unknown'

  // Freshness normalisation — mirrors useConversation.ts:normaliseAnalysisReady
  // so the V5 top-level path (this function) and the graph_patch-block path
  // share the same boundary contract. Without this, missing/invalid freshness
  // would survive into the store despite the brief stating CEE emits it on
  // every response.
  const freshnessRaw = obj.freshness
  const freshness =
    freshnessRaw === 'fresh' || freshnessRaw === 'stale' ||
    freshnessRaw === 'unknown' || freshnessRaw === 'none'
      ? freshnessRaw
      : 'unknown'

  // Drop non-string freshness_reason at the boundary so the store never holds
  // a value that violates the declared type.
  const freshness_reason =
    typeof obj.freshness_reason === 'string' ? obj.freshness_reason : undefined

  // The V5 normaliser is intentionally lenient: it preserves whatever
  // string CEE sent for `status` (and per-option `status`) and falls back
  // to 'unknown' on absence. `CEEAnalysisReady.status` is a narrow union
  // that does not include 'unknown' or arbitrary CEE-future strings, but
  // downstream consumers narrow again before acting on it
  // (`wouldPassStrictAttachContract` below; `usePreRunValidation` checks
  // `status === 'ready'` explicitly). The single cast below acknowledges
  // the runtime widening without the prior `as unknown as` double cast,
  // which hid the divergence.
  return {
    ...obj,
    status: topStatus,
    options: normalisedOptions,
    freshness,
    freshness_reason,
  } as CEEAnalysisReady
}

/**
 * Silent mirror of the strict contract enforced inside
 * attachAnalysisReadyToInlineDraftGraph (validateAnalysisReadyContract):
 * overall status === 'ready', every option status === 'ready', every option
 * has a string id, every option's interventions is a non-null object.
 *
 * We need a dry-run predicate (does applyDraftResult's internal write path
 * accept this payload?) without the validator's `console.error` side effect,
 * which is noisy for legitimate soft statuses (needs_encoding,
 * needs_user_mapping) on every non-ready turn.
 */
function wouldPassStrictAttachContract(ar: CEEAnalysisReady): boolean {
  // ar.status may be 'unknown' at runtime (lenient normaliser widens the union)
  // even though the declared type is narrower — the cast lets TS compile.
  if ((ar.status as string) !== 'ready') return false
  if (!ar.goal_node_id || ar.goal_node_id.length === 0) return false
  if (!ar.options || ar.options.length === 0) return false
  return ar.options.every((opt) => {
    if (!opt.id || opt.id.length === 0) return false
    if ((opt.status as string) !== 'ready') return false
    // interventions is Record<string,…> on the type so it can't be null, but
    // our lenient normaliser may produce an empty {} on options that had none.
    // Array check prevents accidentally passing an array-shaped value.
    if (Array.isArray(opt.interventions)) return false
    return true
  })
}

/**
 * Decide whether the inline-draft_graph path in useConversation.sendTurn will
 * subsequently invoke applyDraftResult AND that call will itself write
 * analysis_ready to the store. When both are true, applyDraftResult owns
 * the write (plus backfill) and this applicator must not double-write.
 *
 * Gate mirrors useConversation.ts:2698 (canvas empty AND inline draft_graph
 * has at least one node) AND the strict attach-contract check inside
 * attachAnalysisReadyToInlineDraftGraph. When the strict contract rejects
 * the payload, applyDraftResult will not call setCeeAnalysisReady, so this
 * applicator must step in as the safety net.
 */
function inlinePathWillOwnAnalysisReadyWrite(
  response: OlumiResponse,
  store: V5ApplicatorStore,
  normalisedAnalysisReady: CEEAnalysisReady,
): boolean {
  if (store.nodes.length > 0) return false
  const draftGraph = response.draft_graph
  if (!draftGraph || !Array.isArray(draftGraph.nodes) || draftGraph.nodes.length === 0) {
    return false
  }
  return wouldPassStrictAttachContract(normalisedAnalysisReady)
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

/**
 * Resolve an `add_constraint` patch operator, tolerant of both wire
 * vocabularies: the schema/DraftGoalConstraint form ('>=' / '<=') and the
 * chip-parameter form ('at_least' / 'at_most', chipParameters.ts). Returns
 * null when neither maps — the caller then fail-closes the whole patch.
 */
function resolveConstraintOperator(
  operatorRaw: unknown,
  constraintTypeRaw: unknown,
): '>=' | '<=' | null {
  if (operatorRaw === '>=' || operatorRaw === '<=') return operatorRaw
  if (constraintTypeRaw === 'at_least') return '>='
  if (constraintTypeRaw === 'at_most') return '<='
  return null
}

/**
 * Map an `add_constraint` graph_patch's `after` record (untyped on the wire)
 * into a CEEGoalConstraint — the shape the canvas `goalConstraints` slice and
 * PLoT's preflight both read. UI-is-a-passthrough: never coerce a value, never
 * fabricate an operator. Returns null (→ deferred, an A1 ask if it recurs)
 * when a node id, a valid operator, OR a finite numeric value cannot be
 * resolved.
 *
 * node_id resolution order: explicit `after.node_id`, then `after.target_id`,
 * then the patch's own `target_id` (the constrained node). constraint_id
 * prefers the wire value; when absent it is derived deterministically as CEE's
 * own `constraint_<node_id>_<min|max>` scheme so a re-applied identical patch
 * dedupes by id (idempotency — no crypto/random, which would defeat it).
 */
function normaliseAddConstraintPatch(
  after: Record<string, unknown> | null,
  patchTargetId: string | undefined,
): CEEGoalConstraint | null {
  if (!after || typeof after !== 'object') return null

  const nodeId = isNonEmptyString(after.node_id)
    ? after.node_id
    : isNonEmptyString(after.target_id)
      ? after.target_id
      : isNonEmptyString(patchTargetId)
        ? patchTargetId
        : undefined
  if (!nodeId) return null

  const operator = resolveConstraintOperator(after.operator, after.constraint_type)
  if (!operator) return null

  const value = after.value
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const constraint_id = isNonEmptyString(after.constraint_id)
    ? after.constraint_id
    : isNonEmptyString(after.id)
      ? after.id
      : `constraint_${nodeId}_${operator === '>=' ? 'min' : 'max'}`

  const constraint: CEEGoalConstraint = {
    constraint_id,
    node_id: nodeId,
    operator,
    value,
  }
  if (isNonEmptyString(after.label)) constraint.label = after.label
  if (isNonEmptyString(after.unit)) constraint.unit = after.unit
  if (isNonEmptyString(after.source_quote)) constraint.source_quote = after.source_quote
  if (typeof after.confidence === 'number' && Number.isFinite(after.confidence)) {
    constraint.confidence = after.confidence
  }
  if (
    after.provenance === 'explicit' ||
    after.provenance === 'inferred' ||
    after.provenance === 'proxy'
  ) {
    constraint.provenance = after.provenance
  }
  return constraint
}

/**
 * Constraint identity for dedupe/idempotency: a shared constraint_id/id, OR the
 * same (node_id, operator, value) triple. The triple check keeps a re-applied
 * patch that carries NO constraint_id idempotent even though a fresh derived id
 * would otherwise differ across fires.
 */
function constraintsSameIdentity(a: CEEGoalConstraint, b: CEEGoalConstraint): boolean {
  const aId = a.constraint_id ?? a.id
  const bId = b.constraint_id ?? b.id
  if (aId && bId && aId === bId) return true
  return (
    a.node_id != null &&
    a.node_id === b.node_id &&
    a.operator === b.operator &&
    a.value === b.value
  )
}

/**
 * Deep-semantic equality for an UPSERT no-op check. Two constraints are equal
 * only when every content field matches after normalisation (undefined treated
 * as absent). Identity alone is NOT sufficient: CEE edits a constraint in place
 * retaining its constraint_id, so a value/label/unit change shares identity but
 * differs in content and MUST write. This gate lets an exact re-send (byte-
 * identical echo / double-fire) coalesce to zero writes while a genuine update
 * still lands.
 */
function constraintsDeepEqual(a: CEEGoalConstraint, b: CEEGoalConstraint): boolean {
  return (
    (a.constraint_id ?? a.id) === (b.constraint_id ?? b.id) &&
    a.node_id === b.node_id &&
    a.operator === b.operator &&
    a.value === b.value &&
    (a.label ?? undefined) === (b.label ?? undefined) &&
    (a.unit ?? undefined) === (b.unit ?? undefined) &&
    (a.source_quote ?? undefined) === (b.source_quote ?? undefined) &&
    (a.confidence ?? undefined) === (b.confidence ?? undefined) &&
    (a.provenance ?? undefined) === (b.provenance ?? undefined)
  )
}

type V5Block = OlumiResponse['blocks'][number]

export interface ApplyV5StateResult {
  /** Effect identifiers that ran (for DEV logging + tests) */
  applied: string[]
  /** Effects we intentionally skipped; each is a NEEDS_FIX category */
  deferred: Array<{ reason: string; block?: V5Block; detail?: string }>
}

/**
 * Out-of-order / stale-turn protection.
 *
 * Callers may optionally provide the client-turn id that was minted when the
 * outgoing request was sent plus a snapshot of the store's notion of the
 * currently-active turn. When both are supplied and disagree, this response
 * is stale and must not write. Callers who don't pass either option get the
 * historical behaviour (no staleness gating).
 */
export interface ApplyV5StateOptions {
  /** The `client_turn_id` that was stamped on the outgoing request. */
  turnClientId?: string | null
  /** The store's active turn id at apply time. When mismatched, drop writes. */
  currentClientTurnId?: string | null
}

function isStage(s: string | { stage?: string } | undefined): s is StageType {
  if (!s) return false
  const v = typeof s === 'string' ? s : s.stage
  return v === 'frame' || v === 'analyse' || v === 'decide' || v === 'review'
}

function normaliseStage(
  s: OlumiResponse['stage_indicator'] | { stage?: string } | undefined,
): StageType | null {
  if (typeof s === 'string') return isStage(s) ? s : null
  if (s && typeof s === 'object' && 'stage' in s) {
    return isStage(s.stage) ? (s.stage as StageType) : null
  }
  return null
}

/**
 * Extract and apply decision_review from an enrichment dict to runMeta.
 * Returns true when a review of EITHER recognised shape was applied; false
 * when the key is absent, degraded (`null`) or malformed.
 *
 * ROADMAP 2.154 — two shapes share this key and they go to two different
 * runMeta fields. Both are written on every call so neither can go stale behind
 * the other: a turn carrying a 0.30 review evicts a prior turn's M1 review via
 * the `: null` ternary below, and vice versa.
 *
 * ⚠ A previous version of this comment claimed the eviction was "load-bearing,
 * not hygiene" and that it justified keeping the adapter's M1 branch. The
 * second half was **backwards and is withdrawn** (A3): eviction here does not
 * depend on that branch. Returning `false` sends the caller to its `else` arm,
 * which clears BOTH fields unconditionally — so if the M1 branch did not exist,
 * an M1-shaped payload would be evicted MORE aggressively, not less. The branch
 * SUPPRESSES eviction for that case by retaining the payload. See
 * `decisionReviewAdapter.ts`'s header for the honest (weaker) rationale.
 *
 * The eviction itself is still worth having and is unaffected by any of that:
 * `runMeta.ceeReviewV1` has THREE live producers outside this path —
 * `useResultsRun.ts:159` (REAL M1 off the PLoT v1 SSE stream),
 * `useV2Run.ts:1055` and `hydrateAnalysis.ts:154` (both synthesised) — so a
 * stale review from one of them must not outlive the turn that replaced it.
 * (`useConversation.ts:3112` and `useV2Run.ts:994` also pass a `ceeReviewV1`,
 * but through `resultsComplete`, which discards it — see the manifest table in
 * `decisionReviewAdapter.ts`. Naming those as live was the earlier error.)
 */
function applyDecisionReviewToRunMeta(
  enrichment: Record<string, unknown> | undefined,
  store: V5ApplicatorStore,
  source: 'block' | 'top-level',
): boolean {
  if (!enrichment) return false
  const state = readDecisionReviewWireState(enrichment)
  if (state.kind !== 'v0_30' && state.kind !== 'm1') return false
  store.setRunMeta({
    ceeReviewV1: state.kind === 'm1' ? state.review : null,
    decisionReview030: state.kind === 'v0_30' ? state.review : null,
  })
  if (source === 'top-level' && import.meta.env.DEV) {
    console.warn('[V5] decision_review applied from top-level enrichment fallback')
  }
  return true
}

export function applyV5State(
  response: OlumiResponse,
  store: V5ApplicatorStore,
  options?: ApplyV5StateOptions,
): ApplyV5StateResult {
  const applied: string[] = []
  const deferred: ApplyV5StateResult['deferred'] = []

  // Stale-turn invariant (pre-all-writes). The response's turnClientId must
  // match the store's active client turn. When supplied and mismatched, ALL
  // V5 writes are dropped — stage, graph_patch, runMeta (decision review),
  // and analysis_ready. An older response arriving after a newer one landed
  // must not regress any slice. Callers who do not pass staleness options
  // retain the historical behaviour (no staleness gating) so unit tests of
  // pure applyV5State logic remain backwards compatible.
  if (isStaleTurn(options)) {
    deferred.push({
      reason: 'stale_turn_all_writes_skipped',
      detail: `incoming=${options?.turnClientId ?? 'null'} active=${options?.currentClientTurnId ?? 'null'}`,
    })
    logV5StateStep({
      step_number: 1,
      step_name: 'stale_turn_guard',
      input_keys: ['stage_indicator', 'blocks', 'analysis_ready'],
      output_keys: [],
      applied: false,
      skip_reason: 'stale_turn',
    })
    return { applied, deferred }
  }

  // 1. Stage tracking. V5 StageType → UI ScenarioStage. Callers may bias
  // 'frame' to 'ideate' when the graph is non-empty (preserve pre-V5
  // behaviour); the applicator writes the base mapping and the canvas
  // store's own consistency rules (see useStagePill) handle presentation.
  const stage = normaliseStage(response.stage_indicator)
  if (stage) {
    store.setCurrentStage(v5StageToScenarioStage(stage))
    applied.push(`stage:${stage}`)
    logV5StateStep({
      step_number: 1,
      step_name: 'stage_tracking',
      input_keys: ['stage_indicator'],
      output_keys: ['currentStage'],
      applied: true,
    })
  } else {
    logV5StateStep({
      step_number: 1,
      step_name: 'stage_tracking',
      input_keys: ['stage_indicator'],
      output_keys: [],
      applied: false,
      skip_reason: 'stage_not_recognised_or_missing',
    })
  }

  // 2. Per-block side effects.
  const appliedCountBeforeBlocks = applied.length
  const blockTypeCounts: Record<string, number> = {}
  for (const block of response.blocks) {
    blockTypeCounts[block.type] = (blockTypeCounts[block.type] ?? 0) + 1
  }
  // Seamlessness R2: V5 graph_patch blocks arrive already applied
  // server-side — the exact "AI edited your graph silently" moment. Collect
  // the targets that actually apply below and pulse once after the loop.
  const pulsedNodeIds: string[] = []
  const pulsedEdgeIds: string[] = []
  // add_constraint patches are collected here and flushed to
  // setGoalConstraints ONCE after the loop: the store snapshot's
  // goalConstraints is frozen at apply time, so a per-patch read-modify-write
  // would drop every constraint but the last.
  const pendingConstraints: CEEGoalConstraint[] = []
  // R4 dispatcher rate limit: the producer contract is at most ONE
  // ui_directive per turn — the UI enforces it defensively; extras defer.
  let uiDirectiveExecuted = false
  for (const block of response.blocks) {
    if (block.type === 'graph_patch') {
      if (block.status !== 'applied') continue
      const target = block.target_id
      switch (block.operation) {
        case 'set_factor_value': {
          // `after` carries the new observed value (shape mirrors PLoT
          // observedState). Merge into node.data via updateNode.
          const after = block.after as Record<string, unknown> | null
          if (!after || !target) {
            deferred.push({ reason: 'set_factor_value_missing_after_or_target', block })
            break
          }
          const node = store.nodes.find((n) => n.id === target)
          if (!node) {
            deferred.push({ reason: 'set_factor_value_target_not_found', block, detail: target })
            break
          }
          // One-level merge: `data` and `observedState` objects spread;
          // nested objects inside `after` (e.g. `range: { min, max }`)
          // replace their counterparts wholesale. This matches CEE's
          // current set_factor_value shape (flat `{ value, baseline,
          // unit, ... }`); tighten if CEE ever nests structured fields.
          store.updateNode(target, {
            data: {
              ...(node.data as Record<string, unknown>),
              observedState: {
                ...((node.data as { observedState?: Record<string, unknown> }).observedState ?? {}),
                ...after,
              },
            } as typeof node.data,
          })
          applied.push(`graph_patch:set_factor_value:${target}`)
          pulsedNodeIds.push(target)
          break
        }
        case 'adjust_edge_strength': {
          const after = block.after as Record<string, unknown> | null
          if (!after || !target) {
            deferred.push({ reason: 'adjust_edge_strength_missing_after_or_target', block })
            break
          }
          const edge = store.edges.find((e) => e.id === target)
          if (!edge) {
            deferred.push({ reason: 'adjust_edge_strength_target_not_found', block, detail: target })
            break
          }
          // CEE's adjust_edge_strength carries weight/direction in `after`.
          store.updateEdgeData(target, after as Record<string, unknown>)
          applied.push(`graph_patch:adjust_edge_strength:${target}`)
          pulsedEdgeIds.push(target)
          break
        }
        case 'add_constraint': {
          // Constraints live in the canvas `goalConstraints` slice (the same
          // one GoalPanel writes via setGoalConstraints) — NOT on goal-node
          // prior fields as the old NEEDS_FIX marker assumed. Map `after` →
          // CEEGoalConstraint and queue it; the loop flushes all queued
          // constraints in one setGoalConstraints call afterwards.
          if (typeof store.setGoalConstraints !== 'function') {
            deferred.push({
              reason: 'add_constraint_store_lacks_setter',
              block,
              detail: 'Applicator store has no setGoalConstraints; constraint not applied.',
            })
            break
          }
          const constraint = normaliseAddConstraintPatch(
            block.after as Record<string, unknown> | null,
            target,
          )
          if (!constraint) {
            // Fail-closed: the `after` record could not resolve a node id, a
            // valid operator, and a finite value. Never fabricate — surface it.
            deferred.push({
              reason: 'add_constraint_unmappable_shape',
              block,
              detail: 'after did not resolve to node_id + operator + finite value.',
            })
            break
          }
          // UPSERT by identity (P1-3). CEE updates an existing goal constraint
          // in place, retaining its constraint_id (add-constraint.ts) — so a
          // matching id is NOT a duplicate to skip; it is an edit to apply. Look
          // up the current value for this identity (queued-this-turn wins over
          // the store snapshot, so coalesced patches settle on the last write).
          //   - deep-equal existing  → no-op, write nothing (exact re-send / echo)
          //   - different content    → replace it (value/label/unit update)
          //   - no existing          → new constraint
          const priorConstraints = store.goalConstraints ?? []
          const pendingIdx = pendingConstraints.findIndex((c) =>
            constraintsSameIdentity(c, constraint),
          )
          const existing =
            pendingIdx >= 0
              ? pendingConstraints[pendingIdx]
              : priorConstraints.find((c) => constraintsSameIdentity(c, constraint))
          if (existing && constraintsDeepEqual(existing, constraint)) {
            // Deep-semantic no-op: identical content already present/queued.
            deferred.push({
              reason: 'add_constraint_noop_skipped',
              block,
              detail: constraint.constraint_id ?? constraint.node_id ?? target,
            })
            break
          }
          if (pendingIdx >= 0) {
            // Coalesce: a later patch for the same identity supersedes the
            // earlier queued one (last-write-wins within the turn).
            pendingConstraints[pendingIdx] = constraint
          } else {
            pendingConstraints.push(constraint)
          }
          applied.push(`graph_patch:add_constraint:${constraint.node_id ?? target}`)
          break
        }
        default: {
          const _exhaustive: never = block.operation
          deferred.push({
            reason: 'graph_patch_unknown_operation',
            block,
            detail: String(_exhaustive),
          })
        }
      }
    } else if (block.type === 'ui_directive') {
      // R4 UI half: execute the AI's "point at the graph" directives at the
      // once-per-envelope side-effect site — never render-driven, so
      // re-renders cannot re-fire them. Three verbs are wired, each reusing
      // the SAME seam its user-driven equivalent uses (the AI can point at the
      // graph, never do something the user cannot):
      //   - highlight      → the coalesced applied-edit pulse (one 2s static
      //                       ring, fail-closed in-graph filter, no viewport
      //                       or selection change) — the AI cannot hijack what
      //                       the user is doing.
      //   - focus          → focusNodeById / focusEdgeById, the guidance
      //                       click-to-focus seam (centre viewport + select +
      //                       brief glow). Single-target.
      //   - open_inspector → selectNodeWithoutHistory / selectEdgeWithoutHistory,
      //                       the user-selection seam that opens/retargets
      //                       inspector-v2. Selection only, no camera move.
      //                       Single-target.
      // Unknown verbs (a newer producer) defer fail-closed. duration_ms is a
      // producer hint not yet honoured (the highlight ring is a fixed 2s).
      // Every verb is fail-closed on the target id: an off-canvas / unknown id
      // is recorded not-found and never executed (keeps applied[] truthful and
      // mirrors the graph_patch path's honesty).
      const targets = Array.isArray(block.targets) ? block.targets : []
      const verb = block.verb
      const verbSupported =
        verb === 'highlight' || verb === 'focus' || verb === 'open_inspector'
      if (!verbSupported) {
        deferred.push({
          reason: 'ui_directive_verb_deferred',
          block,
          detail: String(verb),
        })
      } else if (targets.length === 0) {
        deferred.push({ reason: 'ui_directive_no_targets', block })
      } else if (uiDirectiveExecuted) {
        deferred.push({
          reason: 'ui_directive_rate_limited',
          block,
          detail: 'producer contract is one directive per turn',
        })
      } else {
        uiDirectiveExecuted = true
        // focus / open_inspector act on a SINGLE target (the viewport centres
        // on one element / the inspector opens one element); highlight pulses
        // every resolvable target.
        let singleTargetActioned = false
        for (const t of targets) {
          if (!t?.id) continue
          const isEdge = t.kind === 'edge'
          const exists = isEdge
            ? store.edges.some((e) => e.id === t.id)
            : store.nodes.some((n) => n.id === t.id)
          if (!exists) {
            deferred.push({
              reason: 'ui_directive_target_not_found',
              block,
              detail: t.id,
            })
            continue
          }
          if (verb === 'highlight') {
            if (isEdge) pulsedEdgeIds.push(t.id)
            else pulsedNodeIds.push(t.id)
            applied.push(`ui_directive:highlight:${t.id}`)
            continue
          }
          // focus / open_inspector: act on the first resolvable target only;
          // later targets are extraneous for a viewport/panel verb — record
          // them as ignored so applied[] stays truthful.
          if (singleTargetActioned) {
            deferred.push({
              reason: 'ui_directive_extra_target_ignored',
              block,
              detail: t.id,
            })
            continue
          }
          if (verb === 'focus') {
            if (isEdge) focusEdgeById(t.id)
            else focusNodeById(t.id)
            applied.push(`ui_directive:focus:${t.id}`)
            singleTargetActioned = true
          } else {
            // open_inspector
            const selectFn = isEdge
              ? store.selectEdgeWithoutHistory
              : store.selectNodeWithoutHistory
            if (typeof selectFn === 'function') {
              selectFn(t.id)
              applied.push(`ui_directive:open_inspector:${t.id}`)
              singleTargetActioned = true
            } else {
              deferred.push({
                reason: 'ui_directive_open_inspector_store_lacks_setter',
                block,
                detail: t.id,
              })
            }
          }
        }
      }
    } else if (block.type === 'analysis_result') {
      // Block-level enrichment is the canonical source for decision_review.
      // Always write BOTH review fields — either the extracted value or null —
      // so stale review content from a prior turn cannot persist when the new
      // response carries no valid decision_review. The top-level fallback
      // below may still overwrite null if top-level enrichment is present.
      const blockEnrichment = block.enrichment
      const appliedFromBlock = applyDecisionReviewToRunMeta(blockEnrichment, store, 'block')
      if (appliedFromBlock) {
        applied.push('analysis_result:decision_review:block')
      } else {
        // No review of either recognised shape in block enrichment — clear
        // explicitly so data from a previous analysis turn is not shown. This
        // is the by-design path for the enricher's soft-fail skips and for
        // CEE's `decision_review: null` degraded marker; it is not an error.
        store.setRunMeta({ ceeReviewV1: null, decisionReview030: null })
        deferred.push({
          reason: 'analysis_result_no_decision_review_in_block',
          block,
          detail: 'No valid decision_review in block enrichment; ceeReviewV1 and decisionReview030 cleared (top-level fallback may still apply).',
        })
      }
    }
    // Other block kinds (text, error, explanation, comparison, flip_analysis)
    // are render-only — no side effects.
  }
  if (pulsedNodeIds.length > 0 || pulsedEdgeIds.length > 0) {
    pulseAppliedTargets({ nodeIds: pulsedNodeIds, edgeIds: pulsedEdgeIds })
  }
  // Flush any add_constraint patches in ONE setGoalConstraints write (see
  // pendingConstraints declaration). fromProducerSync: true — a CEE-applied
  // constraint is a producer sync, not a user edit; the response's own
  // analysis_ready.freshness verdict governs staleness, so the write must not
  // self-dirty the freshness overlay. Upsert semantics (P1-3): each pending
  // constraint REPLACES a stored one of the same identity in place (preserving
  // order) or is appended when new — a same-id edit updates rather than
  // duplicates. No-ops never reach this list, so a pending constraint always
  // represents a real add or change.
  if (pendingConstraints.length > 0) {
    const merged = [...(store.goalConstraints ?? [])]
    for (const pc of pendingConstraints) {
      const idx = merged.findIndex((c) => constraintsSameIdentity(c, pc))
      if (idx >= 0) merged[idx] = pc
      else merged.push(pc)
    }
    store.setGoalConstraints?.(merged, { fromProducerSync: true })
  }
  const blockAppliedCount = applied.length - appliedCountBeforeBlocks
  logV5StateStep({
    step_number: 2,
    step_name: 'graph_patches_and_block_effects',
    input_keys: Object.keys(blockTypeCounts),
    output_keys:
      blockAppliedCount > 0
        ? ['nodes', 'edges', 'runMeta.ceeReviewV1', 'runMeta.decisionReview030']
        : [],
    applied: blockAppliedCount > 0,
    skip_reason: blockAppliedCount === 0 ? 'no_applicable_blocks' : undefined,
  })

  // 3. Top-level enrichment fallback. The current OlumiResponse schema
  // (0.7.0) is "strict" and does not include a top-level enrichment field.
  // This check handles a future CEE extension where enrichment is lifted to
  // the response root (e.g. when analysis runs in a multi-block response and
  // the block carries no inline enrichment). It safely no-ops today.
  if (!applied.includes('analysis_result:decision_review:block')) {
    const topEnrichment = (response as unknown as { enrichment?: Record<string, unknown> }).enrichment
    if (topEnrichment?.decision_review) {
      const ok = applyDecisionReviewToRunMeta(
        { decision_review: topEnrichment.decision_review },
        store,
        'top-level',
      )
      if (ok) applied.push('analysis_result:decision_review:top-level')
      logV5StateStep({
        step_number: 3,
        step_name: 'top_level_enrichment_fallback',
        input_keys: ['enrichment.decision_review'],
        output_keys: ok ? ['runMeta.ceeReviewV1', 'runMeta.decisionReview030'] : [],
        applied: ok,
        skip_reason: ok ? undefined : 'decision_review_extraction_failed',
      })
    } else {
      logV5StateStep({
        step_number: 3,
        step_name: 'top_level_enrichment_fallback',
        input_keys: [],
        output_keys: [],
        applied: false,
        skip_reason: 'no_top_level_enrichment',
      })
    }
  } else {
    logV5StateStep({
      step_number: 3,
      step_name: 'top_level_enrichment_fallback',
      input_keys: [],
      output_keys: [],
      applied: false,
      skip_reason: 'block_enrichment_already_applied',
    })
  }

  // 4. Top-level analysis_ready → ceeAnalysisReady. Acts as the catch-all
  // safety net for every turn that does NOT flow through applyDraftResult
  // via the inline-draft_graph path (follow-up turns on a populated canvas,
  // responses with no draft_graph, or payloads that fail the strict
  // attach-contract inside applyDraftResult). When the inline path will
  // run AND the strict contract would accept the payload, skip both the
  // setter and the backfill here — that path owns the write.
  //
  // Stale-turn guard lives at the top of applyV5State (before step 1) so
  // it covers stage, graph_patch, and runMeta writes as well as this step.
  const rawAnalysisReady = (response as { analysis_ready?: unknown }).analysis_ready
  // Freshness slice: retain on absence, order by computed_at, never absence→fresh.
  // Independent of ceeAnalysisReady (which clears on analyse-turns-without-analysis_ready).
  store.setAnalysisFreshness?.(rawAnalysisReady)

  // NOTE: there is intentionally no response-ROOT goal_constraints read here.
  // Constraints reach the store via the two LIVE paths only: CEE's
  // `draft_graph.goal_constraints` (applyDraftResult) and `add_constraint`
  // graph_patch blocks (upserted in step 2 above). A former root-level compat
  // leg was dead — responseParser demotes every unknown top-level key to the
  // non-enumerable `__additive__` sidecar, so `response.goal_constraints` is
  // never set on a really-parsed OlumiResponse (Codex P2-2, removed).
  if (rawAnalysisReady !== undefined) {
    const normalised = normaliseV5AnalysisReady(rawAnalysisReady)
    if (normalised) {
      const inlineOwns = inlinePathWillOwnAnalysisReadyWrite(response, store, normalised)
      if (!inlineOwns) {
        store.setCeeAnalysisReady(normalised)
        applied.push('analysis_ready:set')
        logV5StateStep({
          step_number: 4,
          step_name: 'analysis_ready_consumption',
          input_keys: ['analysis_ready'],
          output_keys: ['ceeAnalysisReady'],
          applied: true,
        })

        // ROADMAP 1.22 — backfill goal_threshold_raw/unit/cap onto the goal
        // node's data. setCeeAnalysisReady above already syncs the bare
        // normalised goal_threshold into store.goalThreshold (store.ts
        // reducer), but GoalNode + the debug bundle's full_graph export read
        // raw/unit/cap from node.data directly (mirrors
        // backfillGoalThresholdOntoGoalNode, the applyDraftResult/
        // mirrorAnalysisReady equivalent for the inline-draft and
        // graph_patch-block paths — this is the V5 top-level-response
        // equivalent, which had no backfill at all before this fix).
        store.backfillGoalThreshold?.(normalised)
        applied.push('analysis_ready:goal_threshold_backfill_requested')
      } else {
        logV5StateStep({
          step_number: 4,
          step_name: 'analysis_ready_consumption',
          input_keys: ['analysis_ready'],
          output_keys: [],
          applied: false,
          skip_reason: 'inline_path_owns_write',
        })
      }
    } else {
      // Present but malformed (or an empty options array) — clear stale
      // store state from prior turns rather than leaving it to mislead the
      // pre-analysis panel.
      store.setCeeAnalysisReady(null)
      deferred.push({
        reason: 'analysis_ready_invalid_shape',
        detail: 'Top-level analysis_ready failed shape validation; store cleared.',
      })
      logV5StateStep({
        step_number: 4,
        step_name: 'analysis_ready_consumption',
        input_keys: ['analysis_ready'],
        output_keys: ['ceeAnalysisReady'],
        applied: true,
        skip_reason: 'normaliser_rejected',
      })
    }
  } else if (responseIsAnalyseShaped(response)) {
    // Explicit-unknown on an analyse-shaped turn with no analysis_ready key.
    // CEE should always include analysis_ready when it returns an
    // analysis_result block or declares stage === 'analyse'; treating the
    // absence as "no longer ready" prevents a prior turn's state from
    // misleading the chip + pre-analysis panel. Conversational turns
    // preserve the existing slice — clearing would race a legit just-set
    // value from a parallel turn.
    store.setCeeAnalysisReady(null)
    applied.push('analysis_ready:cleared_on_analyse_turn')
    logV5StateStep({
      step_number: 4,
      step_name: 'analysis_ready_consumption',
      input_keys: [],
      output_keys: ['ceeAnalysisReady'],
      applied: true,
      skip_reason: 'missing_on_analyse_turn',
    })
  } else {
    logV5StateStep({
      step_number: 4,
      step_name: 'analysis_ready_consumption',
      input_keys: [],
      output_keys: [],
      applied: false,
      skip_reason: 'missing_on_conversational_turn',
    })
  }

  // 5. Results hydration. When the response carries an analysis_result
  // block, build a ReportV1 via mapV5AnalysisToReport and hydrate the
  // canvas store's results slice via resultsComplete. Mirrors the V4
  // envelope path at useConversation.ts:1865+ so the main Results panel
  // renders V5 analyses without selector changes.
  //
  // Dedupe by hash: skip the write when the new block's hash matches the
  // store's currentResultsHash. The stale-turn invariant at the top of
  // applyV5State already covers this write (any stale response returns
  // before reaching step 5).
  //
  // Gated on store.resultsComplete being provided. The applicator is
  // tested against minimal store doubles that may omit it; callers in
  // useConversation.ts wire the real store action. When omitted, the
  // step is a no-op and `deferred` records why.
  const analysisBlock = response.blocks.find(
    (b): b is Extract<V5Block, { type: 'analysis_result' }> =>
      b.type === 'analysis_result',
  )
  if (analysisBlock) {
    if (typeof store.resultsComplete === 'function') {
      const report = mapV5AnalysisToReport(analysisBlock)
      const hash = report.model_card.response_hash
      const prevHash = store.currentResultsHash ?? null
      if (hash !== prevHash) {
        store.resultsComplete({
          report,
          hash,
          resultsSource: 'conversation',
          // V5 carries no V2 envelope; pass null so the canvas store's
          // V2-shaped enrichment / rawV2Response slots are explicitly
          // cleared rather than left to a stale prior write.
          enrichment: null,
          rawV2Response: null,
        })
        applied.push('analysis_result:results_hydrated')
        // Reliable run identity: a NEW analysis_result response_hash (hash !==
        // prevHash) means a genuinely new analysis completed — not a re-delivered
        // analysis_ready echo. Clear the local dirty overlay so a real rerun
        // resolves the verdict even when the analysis_ready payload is byte-
        // identical (the CEE contract carries no computed_at / run id on
        // analysis_ready, so the reducer's echo-guard alone cannot distinguish a
        // rerun from an echo).
        //
        // BUT only clear when THIS response also carries an explicit
        // analysis_ready.freshness verdict. A new analysis_result with NO CEE
        // freshness would otherwise un-dirty a RETAINED prior 'fresh' verdict and
        // re-show false-fresh — so without a freshness verdict we keep the overlay
        // dirty (the retained 'fresh' stays displayed as cannot-confirm).
        const ar =
          rawAnalysisReady && typeof rawAnalysisReady === 'object'
            ? (rawAnalysisReady as { freshness?: unknown })
            : null
        const hasExplicitFreshness =
          !!ar &&
          typeof ar.freshness === 'string' &&
          (['fresh', 'stale', 'unknown', 'none'] as const).includes(ar.freshness as 'fresh')
        if (hasExplicitFreshness) {
          store.clearAnalysisFreshnessDirty?.()
        } else {
          // F10: the run completed but the engine said nothing about
          // freshness. A retained pre-run 'stale' would keep rendering
          // "Model changed since this analysis" OVER the results this very
          // run produced (Paul's 16-Jul session). Unknown, honestly.
          store.noteRunCompletedWithoutVerdict?.()
        }
        logV5StateStep({
          step_number: 5,
          step_name: 'results_hydration',
          input_keys: [
            'analysis_result',
            'win_probabilities',
            'enrichment',
            'leading_option_id',
          ],
          output_keys: ['results.report', 'results.hash'],
          applied: true,
        })
      } else {
        logV5StateStep({
          step_number: 5,
          step_name: 'results_hydration',
          input_keys: ['analysis_result'],
          output_keys: [],
          applied: false,
          skip_reason: 'duplicate_hash',
        })
      }
    } else {
      deferred.push({
        reason: 'results_hydration_store_lacks_resultsComplete',
        block: analysisBlock,
        detail: 'Applicator was passed a store without resultsComplete; analysis_result block content not hydrated into results.report.',
      })
      logV5StateStep({
        step_number: 5,
        step_name: 'results_hydration',
        input_keys: ['analysis_result'],
        output_keys: [],
        applied: false,
        skip_reason: 'store_lacks_resultsComplete',
      })
    }
  } else {
    logV5StateStep({
      step_number: 5,
      step_name: 'results_hydration',
      input_keys: [],
      output_keys: [],
      applied: false,
      skip_reason: 'no_analysis_result_block',
    })
  }

  return { applied, deferred }
}

/**
 * True when the response carries signals that the turn is expected to carry
 * analysis_ready: stage === 'analyse' or an analysis_result block.
 *
 * Distinguishes analyse-shaped turns (where missing analysis_ready is treated
 * as explicit unknown and clears the slice) from conversational turns (where
 * missing analysis_ready is preserved to avoid racing a concurrent write).
 */
function responseIsAnalyseShaped(response: OlumiResponse): boolean {
  const stage = normaliseStage(response.stage_indicator)
  if (stage === 'analyse') return true
  for (const block of response.blocks) {
    if (block.type === 'analysis_result') return true
  }
  return false
}

/** Stale-turn invariant: reject writes from an older turn. See step 4 comment. */
function isStaleTurn(options?: ApplyV5StateOptions): boolean {
  if (!options) return false
  const current = options.currentClientTurnId
  const incoming = options.turnClientId
  if (!current || !incoming) return false
  return incoming !== current
}

