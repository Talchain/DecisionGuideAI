/**
 * applyDraftResult - Apply a CEE draft response to the canvas store
 *
 * Standalone utility extracted from DraftChat's applyDraftToCanvas for reuse
 * in retry flows. Maps CEE adapter output to React Flow node/edge format
 * and updates the store in a single transaction.
 *
 * Key differences from DraftChat's version:
 * - No DEV-only diagnostic logging (keeps module small)
 * - Omits provenance text formatting (display concern, not analysis-critical)
 * - Includes saveAutosave for crash resilience
 */

import { useCanvasStore } from '../store'
import { DEFAULT_EDGE_DATA, readValidationMetadata } from '../domain/edges'
import { edgeValueSourcePatch } from '../domain/edgeValueProvenance'
import { saveAutosave } from '../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../store/autosaveProjection'
import { hasAnalysisReady } from '../../adapters/cee/types'
import type { CEEDraftResponse, CEEGoalConstraint, CEEv2Response, CEEv3Response, EffectDirection } from '../../adapters/cee/types'
import { commitDraftCoachingToStore, edgeProvenanceDisplayPatch } from './draftIngestion'
import { logger } from '../../lib/logger'
import { validateNodesBatch } from '../domain/nodes'
import { devLog } from '../../utils/debugLog'
import { detectBaseline } from './baselineDetection'
import { identityFromCanvasGraph } from './graphIdentity'

/**
 * Map one CEE wire node → React Flow canvas node.
 *
 * Extracted from applyDraftResult (Lane C, edit-journey display closure) so
 * the applied-edit additive merge path (mergeAppliedGraph.ts) converts added
 * nodes with EXACTLY the same treatment as the draft path — kind/type
 * mapping, observed_state → observedState, interventionKeys derivation.
 */
export function mapDraftNodeToCanvas(n: any): any {
  const { id, kind, type: nodeType, label, observed_state, ...rest } = n

  // Derive interventionKeys when interventions object is present (e.g. from CEE add_node)
  const interventions = rest.interventions as Record<string, unknown> | undefined
  const interventionKeys = interventions && typeof interventions === 'object' && !Array.isArray(interventions)
    ? Object.keys(interventions)
    : undefined

  return {
    id,
    type: kind || nodeType,
    position: { x: 0, y: 0 },
    data: {
      ...rest,
      label,
      kind: kind || nodeType,
      ...(observed_state ? { observedState: observed_state } : {}),
      ...(interventionKeys ? { interventionKeys } : {}),
    },
  }
}

/**
 * Map one CEE wire edge → React Flow canvas edge. Same extraction rationale
 * as mapDraftNodeToCanvas. `i` feeds the fallback id (`e-${i}`) for wire
 * edges without one — merge callers must dedupe that fallback against
 * existing canvas ids.
 */
export function mapDraftEdgeToCanvas(e: any, i: number): any {
  const id =
    typeof e.id === 'string' && e.id.trim().length > 0 ? e.id : `e-${i}`

  // Weight priority: strength.mean > strength_mean > weight > default
  //
  // `wireSuppliedStrength` is derived from the SAME three probes the priority
  // chain uses (not a hand-kept copy of them), so it cannot drift from the
  // value it describes: true exactly when the last branch — the UI default —
  // was NOT taken.
  const wireSuppliedStrength =
    typeof e.strength?.mean === 'number'
    || typeof e.strength_mean === 'number'
    || typeof e.weight === 'number'
  const rawWeight: number =
    typeof e.strength?.mean === 'number'
      ? e.strength.mean
      : typeof e.strength_mean === 'number'
        ? e.strength_mean
        : typeof e.weight === 'number'
          ? e.weight
          : DEFAULT_EDGE_DATA.weight

  // Direction inference
  const directionFromEdge: EffectDirection | undefined =
    e.effect_direction === 'positive' || e.effect_direction === 'negative'
      ? e.effect_direction
      : undefined
  const direction: EffectDirection =
    directionFromEdge ?? (rawWeight < 0 ? 'negative' : 'positive')

  // UI-SEM-038: Duplicate of UI-SEM-023/024/025 on alternate ingestion path.
  const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))
  const confidence =
    typeof e.belief === 'number'
      ? Math.max(0, Math.min(1, e.belief))
      : undefined
  const beliefExists =
    typeof e.belief_exists === 'number'
      ? Math.max(0, Math.min(1, e.belief_exists))
      : typeof e.exists_probability === 'number'
        ? Math.max(0, Math.min(1, e.exists_probability))
        : confidence
  const strengthStd: number | undefined =
    typeof e.strength?.std === 'number'
      ? e.strength.std
      : typeof e.strength_std === 'number'
        ? e.strength_std
        : undefined

  // V3 edge metadata — explicitly extract known fields (no blind spread)
  const edgeType = typeof e.edge_type === 'string' ? e.edge_type : undefined
  const provenanceSource = typeof e.provenance_source === 'string' ? e.provenance_source : undefined
  const existsProbability =
    typeof e.exists_probability === 'number'
      ? Math.max(0, Math.min(1, e.exists_probability))
      : undefined

  // Two-pass validation metadata from CEE's validation pipeline (ROADMAP 2.146).
  //
  // ⚠ THIS IS HOP 1 OF 3, AND THE OTHER TWO MUST STAY IN STEP. `buildEdge` in
  // src/canvas/conversation/utils/applyPatch.ts is a HAND-MIRRORED copy of this
  // function — a field added only here is present after a full draft and VANISHES
  // on the next graph patch that touches the edge. `overlayEdge` in
  // mergeAppliedGraph.ts derives its baseline FROM this function, so it follows
  // automatically. The lockstep is pinned by
  // src/canvas/utils/__tests__/edgeValidationMapperMirror.spec.ts.
  //
  // For THIS field the lockstep is now STRUCTURAL rather than pinned: hop 2 calls
  // the same `readValidationMetadata` (S2-7). Both hops previously carried a copy
  // of the extraction under a copy of the reasoning — the opaque-passthrough
  // rationale, the "omitted not defaulted" rule and the boundary-cast disclosure
  // all lived twice. That reasoning now lives once, with the schema slot and
  // DEFAULT_EDGE_DATA it depends on, in domain/edges.ts. Read it there.
  const validation = readValidationMetadata(e.validation)

  return {
    id,
    source: e.from,
    target: e.to,
    type: 'styled' as const,
    data: {
      ...DEFAULT_EDGE_DATA,
      weight,
      pathType: 'bezier' as const,
      confidence,
      beliefExists,
      ...(direction ? { direction } : {}),
      ...(strengthStd !== undefined ? { strengthStd } : {}),
      ...(edgeType !== undefined ? { edge_type: edgeType } : {}),
      ...(provenanceSource !== undefined ? { provenance_source: provenanceSource } : {}),
      ...(existsProbability !== undefined ? { exists_probability: existsProbability } : {}),
      ...(validation !== undefined ? { validation } : {}),
      // Set-vs-defaulted markers. Derived from the resolved values themselves,
      // never from "we are in the CEE mapper so it must be CEE": when the wire
      // carried no belief at all, `beliefExists` is `undefined` here and the
      // stamp is omitted, so the edge reads as NOT SET rather than claiming a
      // producer estimate that was never sent.
      // `direction` stamped only when the producer stated one — ROADMAP 2.263.
      // See the twin site in `DraftChat`.
      ...edgeValueSourcePatch({
        beliefExists: beliefExists !== undefined ? 'cee' : undefined,
        weight: wireSuppliedStrength ? 'cee' : undefined,
        strengthStd: strengthStd !== undefined ? 'cee' : undefined,
        direction: directionFromEdge !== undefined ? 'cee' : undefined,
      }),
      // CEE display provenance (snake_case → camelCase). Distinct from `provenance_source`.
      ...edgeProvenanceDisplayPatch(e),
    },
  }
}

/**
 * Apply a CEE draft response to the canvas, replacing the current graph.
 *
 * This function replaces all existing nodes/edges, pushes history, triggers
 * layout, selects the goal node, and stores analysis_ready + quality from
 * the response.
 *
 * ── ROADMAP 2.122: the streamed draft calls this TWICE for one turn ────────
 * The staged V5 turn renders GRAPH_READY's structure at ~36 s and the terminal
 * payload at ~61 s, and both go through here — the second call's wholesale
 * replacement is what makes "the renderer never shows a node the terminal
 * payload lacks" true by construction rather than by a diff.
 *
 * `opts.skipHistory` exists for exactly that second call. Two applies would
 * otherwise push two history entries, so undo would step to the intermediate
 * preview graph and only then to the pre-draft canvas — one step deeper than
 * the buffered path. The PREVIEW pushes (capturing the pre-draft state, exactly
 * as a buffered draft does) and the terminal apply skips, so the undo stack
 * ends up identical. Default `false` reproduces today's behaviour byte for byte
 * for every other caller.
 */
export function applyDraftResult(
  draftData: CEEDraftResponse | CEEv2Response | CEEv3Response,
  opts: { skipHistory?: boolean; skipAutosave?: boolean } = {},
): { nodeCount: number; edgeCount: number } {
  const rawNodes = draftData?.nodes ?? (draftData as any)?.graph?.nodes ?? []
  const rawEdges = draftData?.edges ?? (draftData as any)?.graph?.edges ?? []

  if (!rawNodes.length) return { nodeCount: 0, edgeCount: 0 }

  // --- Map nodes ---
  const nodes = rawNodes.map((n: any) => mapDraftNodeToCanvas(n))

  // --- Map edges ---
  const edges = rawEdges.map((e: any, i: number) => mapDraftEdgeToCanvas(e, i))

  // --- Apply to store ---
  const store = useCanvasStore.getState()
  if (!opts.skipHistory) store.pushHistory()
  useCanvasStore.setState({
    nodes,
    edges,
    // Lane 5 (review fold, Codex P0-2 class): a draft-graph apply is a
    // wholesale graph replacement — clear the previous decision's goal
    // target + its representation + outcome selection so they cannot ride
    // the new graph's runs. The threshold clear is load-bearing: the
    // setCeeAnalysisReady below only syncs the DRAFT's own goal_threshold
    // when the store value is null, so a stale non-null value both dropped
    // the draft's target AND rode the replacement. The goal node is
    // auto-selected just below for the single-goal case.
    goalThreshold: null,
    goalThresholdRepresentation: null,
    outcomeNodeId: null,
    // Interim 2.467: a CEE draft is CEE's OWN graph — a wholesale replacement
    // of any locally-imported graph, so release the import hold (see
    // importPendingServerRegistration in the store).
    importPendingServerRegistration: false,
  })

  // Warning-only schema validation at the mutation boundary. Non-throwing —
  // shape drift is logged via devWarn in DEV builds only.
  validateNodesBatch(nodes)

  // B2: a fresh draft IS an authoritative CEE graph. Recording its element
  // identities is what lets the NEXT applied-edit receipt reconcile a
  // deletion — reconcileAppliedGraph only removes elements CEE has
  // previously acknowledged, so without this the first deletion after a
  // draft would be silently ignored.
  useCanvasStore.getState().setLastAuthoritativeGraph(
    identityFromCanvasGraph(nodes, edges),
  )

  // Draft application replaces the graph via bare setState (bypasses the edit
  // chokepoints), so mark the freshness overlay dirty. If the draft carries an
  // analysis_ready verdict it is routed through setAnalysisFreshness below, which
  // clears the overlay only when a genuine fresh verdict accompanies it.
  useCanvasStore.getState().markAnalysisFreshnessDirty?.()

  // Defer layout until React Flow has measured the inserted nodes (D2 of
  // layout-stabilisation brief). The measurement hook in ReactFlowGraph
  // runs applyLayout once every unlocked node has measured.width/height,
  // or after a 500 ms safety fallback.
  store.setPendingLayout(true)

  // Immediate autosave for crash resilience.
  //
  // ⚠ SKIPPED for a streamed GRAPH_READY preview (ROADMAP 2.122 round 2, review
  // F1). The autosave is localStorage and survives a reload, while
  // `draftStreamPhase` is in-memory and does not — so a guest who closed the tab
  // during the ~25 s settling window came back to the unsettled graph with NO
  // marker and an OPEN run gate: the same dishonest state as the abort hole, with
  // no Stop click needed. The terminal apply autosaves normally, so nothing is
  // lost once the values settle; before then there is deliberately nothing on
  // disk to restore, which is the honest state.
  if (!opts.skipAutosave) try {
    // Shared projection — previously this literal omitted ceeAnalysisReady and
    // selectedGoalNode. NOTE: this runs BEFORE setCeeAnalysisReady below, so
    // the value persisted here is the pre-draft one; the 30s timer corrects it.
    // That is still strictly better than the old behaviour, which DELETED
    // whatever ceeAnalysisReady the last autosave held.
    saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  } catch {
    // Non-critical — swallow save errors
  }

  // Auto-select goal node if exactly one exists
  const goalNodes = nodes.filter((n: any) => n.type === 'goal')
  if (goalNodes.length === 1) {
    useCanvasStore.getState().setOutcomeNode(goalNodes[0].id)
  }

  // Store analysis_ready for pre-analysis panel & run pipeline
  if (hasAnalysisReady(draftData)) {
    // Source from the typed draftCoaching.summary field (post-adapter).
    const coachingSummary = (draftData as CEEDraftResponse).draftCoaching?.summary ?? null
    const analysisReadyWithCoaching = coachingSummary
      ? { ...draftData.analysis_ready, coaching_summary: coachingSummary }
      : draftData.analysis_ready
    useCanvasStore.getState().setCeeAnalysisReady(analysisReadyWithCoaching)
    // Route the draft's analysis_ready through the freshness source of truth
    // (mirrors the accepted-patch path). A draft is readiness, not a run — it
    // typically carries no `freshness`, so the reducer degrades to 'unknown'
    // rather than leaving a prior 'fresh' verdict showing false-fresh.
    useCanvasStore.getState().setAnalysisFreshness?.(analysisReadyWithCoaching)

    // Backfill interventions onto option nodes. CEE publishes intervention data
    // via analysis_ready.options[], not via graph_patch add_node operations, so
    // we mirror them onto node.data.interventions for the consumers that read
    // there directly: OptionNode/FactorNode rendering, islRequestAdapter,
    // useScenarioComparison, and the debug bundle export.
    //
    // The PLoT v2 adapter prefers analysis_ready and falls back to node.data
    // when reconciling — see adapters/plot/v2/adapter.ts:reconcileOptionsWithCanvasNodes.
    //
    // This backfill stays until every consumer migrates to read from
    // ceeAnalysisReady.options[]. The CEE-side fix on 2026-04-08 (preventing
    // envelope.ts from clobbering analysis_ready) does NOT remove this need.
    //
    // Timing: runs synchronously after setCeeAnalysisReady; nodes are already
    // in store from the setState call above. If option nodes don't exist yet,
    // this is a no-op.
    const backfillResult = backfillInterventionsOntoOptionNodes(analysisReadyWithCoaching)

    // Per-draft observability: emit a structured log when any option node
    // received a real intervention backfill. The intervention metric is the
    // one we want to trend to zero after the 2026-04-08 envelope fix; if it
    // stays >0 it means the pipeline still publishes interventions on
    // analysis_ready.options[] rather than on graph_patch add_node operations
    // and the canvas-side backfill is still load-bearing. The baseline-only
    // counter is reported alongside but tracked separately because is_baseline
    // backfill will outlive the intervention backfill (until is_baseline gets
    // its own dedicated source). See docs/intervention-authority-contract.md.
    if (backfillResult.interventionBackfilledCount > 0) {
      logger.warn('apply_draft.intervention_backfill', {
        scenarioId: useCanvasStore.getState().currentScenarioId ?? null,
        interventionBackfilledCount: backfillResult.interventionBackfilledCount,
        baselineOnlyUpdatedCount: backfillResult.baselineOnlyUpdatedCount,
        totalOptionsInPayload: analysisReadyWithCoaching.options?.length ?? 0,
      })
    }

    // Backfill goal_threshold_raw/unit/cap from analysis_ready onto the goal node.
    // CEE sends these on analysis_ready, but the GoalNode component reads from node.data.
    backfillGoalThresholdOntoGoalNode(analysisReadyWithCoaching)
  }

  // Store goal_constraints off whatever draft object we were handed.
  //
  // Sources, both of which land here as `draftData.goal_constraints`:
  //   - V5 `/orchestrate/v2/turn`: nested INSIDE the `draft_graph` block
  //     (@talchain/schemas 0.18.0 declares it there); useConversation passes
  //     that block in via attachAnalysisReadyToInlineDraftGraph, whose
  //     `hasOwnGoalConstraints` guard leaves a nested value untouched.
  //   - legacy V3 `/assist/v1/draft-graph`: at the response ROOT, lifted onto
  //     the inline object by that same helper.
  //
  // This read is deliberately NOT gated on isCEEv3Response(). That guard
  // requires a VALID `analysis_ready` — and validateAnalysisReadyContract
  // rejects any payload whose status is not exactly 'ready'. A fresh draft
  // whose options still need intervention mapping reports
  // status:'needs_user_input', which is an ordinary, common outcome — so the
  // old gate silently discarded the user's stated hard constraint on exactly
  // those turns, and cleared nothing either. Constraint extraction and
  // analysis-readiness are independent facts about a draft; coupling them
  // made a routine readiness state erase a user-stated constraint.
  // Pinned by draftGoalConstraints.wire.spec.ts (HOP 3) against real CEE
  // wire bytes whose analysis_ready is 'needs_user_input'.
  //
  // Clearing on absence is retained: a draft apply is a wholesale graph
  // replacement (see the goalThreshold/outcomeNodeId clears above), so a
  // previous decision's constraints must not ride the new graph.
  const rawGoalConstraints = (draftData as { goal_constraints?: unknown }).goal_constraints
  if (Array.isArray(rawGoalConstraints) && rawGoalConstraints.length > 0) {
    const constraints = rawGoalConstraints as CEEGoalConstraint[]
    // Producer sync (draft ingestion) — must not self-dirty the freshness overlay.
    useCanvasStore.getState().setGoalConstraints(constraints, { fromProducerSync: true })
    logger.info('[constraint-trace] store-write', {
      source: 'applyDraftResult',
      count: constraints.length,
      constraint_ids: constraints.map((c) => c.constraint_id),
    })
  } else {
    useCanvasStore.getState().setGoalConstraints(null, { fromProducerSync: true })
    logger.info('[constraint-trace] store-write', {
      source: 'applyDraftResult',
      count: 0,
      constraint_ids: [],
    })
  }

  // Store quality dimensions
  const quality = (draftData as any).quality
  if (quality && typeof quality.overall === 'number') {
    useCanvasStore.getState().setCeeQuality({
      overall: quality.overall ?? 5,
      structure: quality.structure ?? quality.overall ?? 5,
      coverage: quality.coverage ?? quality.overall ?? 5,
      causality: quality.causality ?? quality.overall ?? 5,
      safety: quality.safety ?? quality.overall ?? 5,
    })
  }

  // Store pipeline trace if present
  const pipelineTrace =
    (draftData as any).pipeline_trace ?? (draftData as any).trace?.pipeline
  if (
    pipelineTrace &&
    typeof pipelineTrace === 'object' &&
    Array.isArray(pipelineTrace.stages)
  ) {
    useCanvasStore.getState().setCeePipelineTrace(pipelineTrace)
  }

  // Commit CEE coaching payload (typed, type-guarded by adapter). Null when absent.
  commitDraftCoachingToStore((draftData as CEEDraftResponse).draftCoaching ?? null)

  // Commit pre-analysis sensitivity (mirrors DraftChat). Always overwrite —
  // a draft replaces the graph, so influence keyed to the previous draft's
  // node ids must not survive; absent payload clears to null.
  const rawSensitivity = (draftData as any).analysis_ready?.pre_analysis_sensitivity
    ?? (draftData as any).pre_analysis_sensitivity
  useCanvasStore.getState().setPreAnalysisSensitivity(
    rawSensitivity?.factor_influence ? rawSensitivity : null
  )

  return { nodeCount: nodes.length, edgeCount: edges.length }
}

// ---------------------------------------------------------------------------
// Intervention backfill — shared between applyDraftResult and handleEnvelope
// ---------------------------------------------------------------------------

/**
 * Backfill interventions and is_baseline from analysis_ready onto option nodes.
 *
 * CEE publishes intervention data and the is_baseline flag on
 * analysis_ready.options[], not on individual graph_patch add_node operations.
 * Multiple UI consumers read from node.data.interventions / node.data.is_baseline
 * directly: OptionNode, FactorNode, islRequestAdapter, useScenarioComparison,
 * the debug bundle export, and the PLoT v2 adapter as a fallback.
 *
 * Idempotent: only writes to store when at least one node's interventions or
 * is_baseline value actually differ (deep equality via JSON serialisation),
 * avoiding unnecessary re-renders on repeated calls.
 *
 * @returns Per-call counters that the caller emits as structured telemetry.
 *
 *   - `interventionBackfilledCount` — option nodes whose intervention map was
 *     written (either added for the first time, or replaced with different
 *     keys/values). This is the metric we want to trend to zero after the
 *     2026-04-08 envelope fix; when it does, the canvas-side intervention
 *     backfill can be retired.
 *   - `baselineOnlyUpdatedCount` — option nodes whose ONLY change was the
 *     `is_baseline` flag. These will continue to fire even after the
 *     intervention backfill is retired (until is_baseline migrates to a
 *     dedicated source), so they must be tracked separately to avoid
 *     poisoning the intervention metric.
 *   - `totalUpdatedCount` — total nodes touched (sum of the above plus any
 *     nodes that received both an intervention write AND a baseline change).
 *
 *   See docs/intervention-authority-contract.md for the removal plan.
 */
export interface BackfillInterventionsResult {
  interventionBackfilledCount: number
  baselineOnlyUpdatedCount: number
  totalUpdatedCount: number
}

export function backfillInterventionsOntoOptionNodes(
  analysisReady: { options?: Array<{ id: string; interventions?: Record<string, unknown>; is_baseline?: boolean | null }> } | null
): BackfillInterventionsResult {
  const empty: BackfillInterventionsResult = {
    interventionBackfilledCount: 0,
    baselineOnlyUpdatedCount: 0,
    totalUpdatedCount: 0,
  }
  if (!analysisReady?.options?.length) return empty

  const currentNodes = useCanvasStore.getState().nodes as any[]
  let interventionBackfilledCount = 0
  let baselineOnlyUpdatedCount = 0

  type PatchEntry = { id: string; data: Record<string, unknown> }
  const patches: PatchEntry[] = []

  for (const n of currentNodes) {
    if (n.data?.kind !== 'option' && n.data?.type !== 'option') continue
    const optEntry = analysisReady.options!.find((o) => o.id === n.id)
    if (!optEntry) continue

    const hasInterventions = optEntry.interventions && Object.keys(optEntry.interventions).length > 0

    // Backfill is_baseline from analysis_ready. Emit regex-fallback telemetry
    // at this normalisation boundary (NOT from render code) when CEE omits
    // is_baseline but the label matches the baseline regex.
    const existingBaseline = (n.data?.is_baseline as boolean | undefined) ?? false
    let newBaseline: boolean
    if (optEntry.is_baseline === true || optEntry.is_baseline === false) {
      newBaseline = optEntry.is_baseline
    } else {
      // CEE omitted the flag — consult the regex fallback and record if it fires.
      const label = (n.data?.label as string | undefined) ?? ''
      const regexHit = detectBaseline(label).isBaseline
      if (regexHit) {
        devLog('canvas/baseline', 'regex fallback fired (CEE omitted is_baseline)', {
          optionId: n.id,
          label,
        })
      }
      newBaseline = regexHit
    }
    const baselineChanged = newBaseline !== existingBaseline

    if (!hasInterventions && !baselineChanged) continue

    const existing = n.data?.interventions as Record<string, unknown> | undefined
    const newKeys = hasInterventions ? Object.keys(optEntry.interventions!) : undefined
    let interventionMapChanged = hasInterventions && !existing
    if (hasInterventions && existing) {
      try {
        const same = JSON.stringify(existing) === JSON.stringify(optEntry.interventions)
        if (same && !baselineChanged) continue
        interventionMapChanged = !same
      } catch {
        interventionMapChanged = true
      }
    }

    if (interventionMapChanged) {
      interventionBackfilledCount += 1
    } else {
      baselineOnlyUpdatedCount += 1
    }

    patches.push({
      id: n.id,
      data: {
        ...(hasInterventions ? { interventions: optEntry.interventions, interventionKeys: newKeys } : {}),
        is_baseline: newBaseline,
      },
    })
  }

  if (patches.length) {
    // Single history entry; diff-aware no-op if shallow-equal to current state.
    useCanvasStore.getState().batchUpdateNodes(patches, 'backfill-interventions')
    // Warning-only schema validation after the write. Use a Set for O(1)
    // membership checks instead of quadratic patches.some lookups.
    const patchedIds = new Set(patches.map(p => p.id))
    const updated = useCanvasStore.getState().nodes
    validateNodesBatch(updated.filter(n => patchedIds.has(n.id)) as any)
  }

  return {
    interventionBackfilledCount,
    baselineOnlyUpdatedCount,
    totalUpdatedCount: interventionBackfilledCount + baselineOnlyUpdatedCount,
  }
}

// ---------------------------------------------------------------------------
// Goal threshold backfill
// ---------------------------------------------------------------------------

/**
 * Backfill goal_threshold_raw/unit/cap from analysis_ready onto the goal node.
 *
 * CEE sends these on analysis_ready, but GoalNode reads from node.data.
 * Distinguishes "field absent" (don't touch) from "field present but null"
 * (clear stale value). Idempotent: only writes when values actually differ.
 */
export function backfillGoalThresholdOntoGoalNode(
  analysisReady: {
    goal_node_id?: string
    goal_threshold_raw?: number | null
    goal_threshold_unit?: string | null
    goal_threshold_cap?: number | null
  } | null
): void {
  if (!analysisReady?.goal_node_id) return

  // Distinguish "field absent from analysisReady" (don't touch) from
  // "field present but null" (clear the value on the goal node).
  const hasRaw = 'goal_threshold_raw' in analysisReady
  const hasUnit = 'goal_threshold_unit' in analysisReady
  const hasCap = 'goal_threshold_cap' in analysisReady

  // Nothing to backfill if none of the fields are present on analysisReady
  if (!hasRaw && !hasUnit && !hasCap) return

  const raw = analysisReady.goal_threshold_raw ?? null
  const unit = analysisReady.goal_threshold_unit ?? null
  const cap = analysisReady.goal_threshold_cap ?? null

  const currentNodes = useCanvasStore.getState().nodes as any[]
  const goalNode = currentNodes.find((n: any) => n.id === analysisReady.goal_node_id)
  if (!goalNode) return

  // Idempotent: skip if already matching (only check fields that are present)
  const d = goalNode.data as Record<string, unknown> | undefined
  if (
    (!hasRaw || d?.goal_threshold_raw === raw) &&
    (!hasUnit || d?.goal_threshold_unit === unit) &&
    (!hasCap || d?.goal_threshold_cap === cap)
  ) return

  const updatedNodes = currentNodes.map((n: any) => {
    if (n.id !== analysisReady.goal_node_id) return n
    return {
      ...n,
      data: {
        ...n.data,
        ...(hasRaw ? { goal_threshold_raw: raw } : {}),
        ...(hasUnit ? { goal_threshold_unit: unit } : {}),
        ...(hasCap ? { goal_threshold_cap: cap } : {}),
      },
    }
  })

  useCanvasStore.setState({ nodes: updatedNodes as any })
}
