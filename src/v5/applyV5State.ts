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
 *      adjust_edge_strength. add_constraint is a NEEDS_FIX marker (no 1:1
 *      UI store target yet; constraints live on node prior fields and
 *      require a canonical source of truth from CEE).
 *   3. analysis_result.enrichment.decision_review → runMeta.ceeReviewV1.
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

import type { CEEAnalysisReady } from '../adapters/cee/types'
import type { CeeDecisionReviewPayloadV1 } from '../types/cee'
import type { ScenarioStage } from '../types/scenario'
import { logV5StateStep } from './debugLog'
import { extractDecisionReview } from './decisionReviewAdapter'
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
  setRunMeta: (meta: { ceeReviewV1: CeeDecisionReviewPayloadV1 | null }) => void
  /** Write (or clear) the CEE analysis_ready payload that gates the run. */
  setCeeAnalysisReady: (analysisReady: CEEAnalysisReady | null) => void
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
 * Returns true when applied; false when enrichment is absent or invalid.
 */
function applyDecisionReviewToRunMeta(
  enrichment: Record<string, unknown> | undefined,
  store: V5ApplicatorStore,
  source: 'block' | 'top-level',
): boolean {
  if (!enrichment) return false
  const reviewV1 = extractDecisionReview(enrichment)
  if (!reviewV1) return false
  store.setRunMeta({ ceeReviewV1: reviewV1 })
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
          break
        }
        case 'add_constraint': {
          // Not wired yet — constraints live on goal node prior fields.
          // A translator from CEE's constraint shape → prior.range_min/
          // range_max / threshold is deferred until CEE + UI agree on the
          // canonical source of truth.
          deferred.push({
            reason: 'add_constraint_not_wired',
            block,
            detail: 'Constraint application deferred; see walkthrough NEEDS_FIX.',
          })
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
    } else if (block.type === 'analysis_result') {
      // Block-level enrichment is the canonical source for decision_review.
      // Always write ceeReviewV1 — either the extracted value or null — so
      // stale review content from a prior turn cannot persist when the new
      // response carries no valid decision_review. The top-level fallback
      // below may still overwrite null if top-level enrichment is present.
      const blockEnrichment = block.enrichment
      const appliedFromBlock = applyDecisionReviewToRunMeta(blockEnrichment, store, 'block')
      if (appliedFromBlock) {
        applied.push('analysis_result:decision_review:block')
      } else {
        // No valid review in block enrichment — clear explicitly so stale
        // data from a previous analysis turn is not shown.
        store.setRunMeta({ ceeReviewV1: null })
        deferred.push({
          reason: 'analysis_result_no_decision_review_in_block',
          block,
          detail: 'No valid decision_review in block enrichment; ceeReviewV1 cleared (top-level fallback may still apply).',
        })
      }
    }
    // Other block kinds (text, error, explanation, comparison, flip_analysis)
    // are render-only — no side effects.
  }
  const blockAppliedCount = applied.length - appliedCountBeforeBlocks
  logV5StateStep({
    step_number: 2,
    step_name: 'graph_patches_and_block_effects',
    input_keys: Object.keys(blockTypeCounts),
    output_keys:
      blockAppliedCount > 0 ? ['nodes', 'edges', 'runMeta.ceeReviewV1'] : [],
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
        output_keys: ok ? ['runMeta.ceeReviewV1'] : [],
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
