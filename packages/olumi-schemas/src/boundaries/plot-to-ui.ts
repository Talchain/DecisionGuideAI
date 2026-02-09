/**
 * PLoT → UI Boundary Field Drops
 *
 * Documents fields intentionally removed when PLoT response is stored in UI state.
 *
 * Source: src/adapters/plot/v2/adapter.ts
 * Boundary: V2RunResponse → canvas store / results state
 */

/**
 * Fields removed at PLoT → UI boundary.
 *
 * These fields are dropped because:
 * - They are trace/metadata not needed in UI state
 * - They are redundant with other fields
 * - They are only used for debug display
 */
export const PLOT_TO_UI_DROPS = {
  description: 'Fields removed when PLoT response is stored in UI',
  boundary: 'V2RunResponse → Results State',
  drops: [
    // Metadata (not needed in results state, used for logging only)
    'meta.seed_used',
    'meta.n_samples',
    'meta.detail_level',
    'meta.latency_ms',

    // Request echo (not needed in UI)
    'request_id', // Only used for tracing, not stored

    // CEE trace (debug only)
    'cee_trace.request_id',
    'cee_trace.latency_ms',
  ],
  transformations: [
    // No transformations at this boundary - all fields preserved as-is
  ],
  preserved: [
    // Analysis results
    'analysis_status',
    'option_comparison',
    'option_comparison[].option_id',
    'option_comparison[].option_label',
    'option_comparison[].confidence_interval',
    'option_comparison[].probability_of_goal',
    'option_comparison[].win_probability',
    'option_comparison[].expected_outcome',
    'option_comparison[].outcome',

    // Critiques and guidance
    'critiques',
    'critiques[].code',
    'critiques[].severity',
    'critiques[].message',
    'critiques[].suggestion',
    'critiques[].affected_nodes',

    // Sensitivity analysis
    'factor_sensitivity',
    'factor_sensitivity[].node_id',
    'factor_sensitivity[].label',
    'factor_sensitivity[].importance_score',
    'factor_sensitivity[].sensitivity_score',
    'factor_sensitivity[].elasticity',
    'factor_sensitivity[].direction',
    'factor_sensitivity[].importance_rank',
    'factor_sensitivity[].confidence',

    'edge_sensitivity',
    'robustness',
    'robustness.fragile_edges',
    'robustness.robust_edges',
    'robustness.ranking_stability',
    'robustness.recommendation_stability',

    // Drivers
    'drivers',
    'drivers[].node_id',
    'drivers[].label',
    'drivers[].contribution',
    'drivers[].direction',

    // CEE enrichment (M1)
    'cee_status',
    'decision_quality',
    'insights',
    'improvement_guidance',
    'rationale',
    'robustness_synthesis',
    'm1_coaching',

    // Response hash
    'response_hash',
  ],
} as const

/**
 * Type for field drop documentation.
 */
export type FieldDropDoc = typeof PLOT_TO_UI_DROPS
