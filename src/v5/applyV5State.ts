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
 * Scope — Phase 3.5 (reviewer P0 #2):
 *   1. stage_indicator → canvas.currentStage
 *   2. graph_patch (applied) → canvas store mutation for set_factor_value,
 *      adjust_edge_strength. add_constraint is a NEEDS_FIX marker (no 1:1
 *      UI store target yet; constraints live on node prior fields and
 *      require a canonical source of truth from CEE).
 *
 * Deferred (NEEDS_FIX, tracked in walkthrough doc):
 *   - analysis_result → useResultsStore population (complex translator
 *     from V5 analysis shape to V2RunResponse shape; needs a separate
 *     slice with realistic fixtures).
 *   - decision_review enrichment → DecisionReviewPanel (the adapter is
 *     in place; the panel wiring reads this via its own hook — when
 *     that hook learns to consume the enrichment value directly, this
 *     applicator can forward it).
 *   - draft_graph shape — CEE doesn't emit it yet; matrix lists it as
 *     NEEDS_FIX.
 *
 * The function is idempotent for repeated application of the same
 * response (e.g. test double-fires) because all downstream store
 * mutations are property assignments keyed by target_id.
 */
import type { OlumiResponse, StageType } from '@talchain/schemas/boundary'
import type { Edge, Node } from 'reactflow'

import type { ScenarioStage } from '../types/scenario'
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
}

type V5Block = OlumiResponse['blocks'][number]

export interface ApplyV5StateResult {
  /** Effect identifiers that ran (for DEV logging + tests) */
  applied: string[]
  /** Effects we intentionally skipped; each is a NEEDS_FIX category */
  deferred: Array<{ reason: string; block?: V5Block; detail?: string }>
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

export function applyV5State(
  response: OlumiResponse,
  store: V5ApplicatorStore,
): ApplyV5StateResult {
  const applied: string[] = []
  const deferred: ApplyV5StateResult['deferred'] = []

  // 1. Stage tracking. V5 StageType → UI ScenarioStage. Callers may bias
  // 'frame' to 'ideate' when the graph is non-empty (preserve pre-V5
  // behaviour); the applicator writes the base mapping and the canvas
  // store's own consistency rules (see useStagePill) handle presentation.
  const stage = normaliseStage(response.stage_indicator)
  if (stage) {
    store.setCurrentStage(v5StageToScenarioStage(stage))
    applied.push(`stage:${stage}`)
  }

  // 2. Per-block side effects.
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
          // Deep-merge so any observed fields not in `after` are preserved.
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
      // Deferred — V5 analysis_result → useResultsStore V2RunResponse
      // translator is a separate effort. The inline card in
      // V5AnalysisResultBlock covers the user-facing case today; the
      // side-panel DecisionReviewPanel read-path is NEEDS_FIX.
      deferred.push({
        reason: 'analysis_result_results_store_not_wired',
        block,
        detail: 'V5AnalysisResultBlock renders inline; useResultsStore population deferred.',
      })
    }
    // Other block kinds (text, error, explanation, comparison, flip_analysis)
    // are render-only — no side effects.
  }

  return { applied, deferred }
}
