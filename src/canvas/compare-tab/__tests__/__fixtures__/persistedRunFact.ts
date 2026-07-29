/**
 * Fixtures shaped like the REAL persisted `run_analysis` fact.
 *
 * Field placement here is byte-derived from staging Supabase
 * (`v5_handler_facts`, 773 non-noop `run_analysis` rows, probed read-only
 * 2026-07-29 — see PHASE0-EVIDENCE-2026-07-28/compare-slice1.md §0):
 *
 *   • `payload` = `{ fact_type, fact_version, result }` — `noop` lives on its
 *     own COLUMN, never inside the payload (CEE `mapFactsForRpc` splits them).
 *   • `result.enrichment` is the PLoT envelope byte-for-byte.
 *   • ⚠ `conditional_winners` / `edge_e_values` / `inference_warnings` are
 *     enrichment-ROOT siblings of `robustness` — 773/773 at the root, 0/773
 *     under `robustness`. The design doc's mapping table said
 *     `enrichment.robustness.*`; it is wrong at the bytes, and a fixture that
 *     copied the doc would have made the mapper's three empty arrays look
 *     correct.
 *   • `recommendation_stability` is present in only 347/773 runs, so it is
 *     OPT-IN here — the default fixture omits it, which is the majority case.
 */
import type { PersistedAnalysisRunRow } from '../../../../services/analysisRunHistoryService'

interface OptionSpec {
  option_id: string
  option_label: string
  win_probability: number
  probability_of_joint_goal?: number
}

export interface PersistedRunFactFixtureOptions {
  id?: string
  createdAt?: string
  computedAt?: string | null
  responseHash?: string
  graphHashAtRun?: string | null
  winner?: OptionSpec
  runnerUp?: OptionSpec | null
  /** Present in only 45% of live runs — omit to exercise the honest-absence path. */
  recommendationStability?: number
  fragileEdges?: unknown[] | null
  factorSensitivity?: Array<Record<string, unknown>>
  inferenceWarnings?: unknown[]
  conditionalWinners?: Array<Record<string, unknown>>
  edgeEValues?: Array<Record<string, unknown>>
  seedUsed?: unknown
  /** Escape hatch for malformed-row tests. */
  payloadOverride?: unknown
}

export function makePersistedRunFactRow(
  opts: PersistedRunFactFixtureOptions = {},
): PersistedAnalysisRunRow {
  const {
    id = 'fact-1',
    createdAt = '2026-07-20T10:00:00.000Z',
    computedAt = createdAt,
    responseHash = 'resp-hash-1',
    graphHashAtRun = 'aag-hash-1',
    winner = { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.62 },
    runnerUp = { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.38 },
    recommendationStability,
    fragileEdges = [],
    factorSensitivity = [
      {
        factor_id: 'factor-1',
        factor_label: 'Factor One',
        elasticity: 0.42,
        rank_flip_rate: 0.11,
        attribution_stability: 'stable',
      },
      {
        factor_id: 'factor-2',
        factor_label: 'Factor Two',
        elasticity: 0.18,
        rank_flip_rate: 0.05,
        attribution_stability: 'unstable',
      },
    ],
    inferenceWarnings = [],
    conditionalWinners = [],
    edgeEValues = [],
    seedUsed = 4242,
    payloadOverride,
  } = opts

  if (payloadOverride !== undefined) {
    return { id, createdAt, payload: payloadOverride, turnId: 'turn-1' }
  }

  const optionComparison = [winner, ...(runnerUp ? [runnerUp] : [])]

  return {
    id,
    createdAt,
    turnId: 'turn-1',
    payload: {
      fact_type: 'run_analysis',
      fact_version: 1,
      result: {
        scenario_id: 'scenario-owned-1',
        leading_option_id: winner.option_id,
        summary: 'A persisted analysis summary.',
        ...(computedAt != null ? { computed_at: computedAt } : {}),
        ...(graphHashAtRun != null ? { graph_hash_at_run: graphHashAtRun } : {}),
        constraint_verdict: {
          may_name_leading_option: true,
          constraint_verdict_state: 'no_constraints',
        },
        enrichment: {
          analysis_status: 'computed',
          option_comparison_status: 'computed',
          robustness_status: 'computed',
          drivers_status: 'computed',
          response_hash: responseHash,
          option_comparison: optionComparison,
          factor_sensitivity: factorSensitivity,
          robustness: {
            level: 'moderate',
            is_robust: true,
            near_tie: false,
            confidence: 0.7,
            robust_edges: [],
            ...(fragileEdges != null ? { fragile_edges: fragileEdges } : {}),
            ...(recommendationStability != null
              ? { recommendation_stability: recommendationStability }
              : {}),
            recommended_option_id: winner.option_id,
            recommended_option_label: winner.option_label,
          },
          // ⚠ ROOT-level siblings of `robustness` — this is where the live
          // bytes put them.
          inference_warnings: inferenceWarnings,
          conditional_winners: conditionalWinners,
          edge_e_values: edgeEValues,
          meta: {
            seed_used: seedUsed,
            computed_at: computedAt,
            n_samples: 5000,
          },
        },
      },
    },
  }
}
