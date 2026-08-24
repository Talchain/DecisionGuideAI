/**
 * AnalysisInputsSummary — enriched analysis summary assembled from V2RunResponse.
 *
 * The UI is the sole production assembler. CEE owns the schema and validation rules.
 * Sent as `analysis_state.analysis_summary` on turn requests so the orchestrator
 * has structured context about the latest analysis without re-parsing the full response.
 */

/**
 * 1.1.0 — `constraints_status[]` carries a four-state `status` band instead of a
 * fabricated `satisfied` boolean. See `ConstraintSatisfactionBand`.
 *
 * The removed boolean had ZERO readers estate-wide. Derived 2026-08-24 with
 * contrast controls in every sweep: UI `.satisfied` on a constraint object — 0
 * (contrast `.probability`, 32 files); CEE @ `77e2e7d9` `compact_summary` — 0
 * files (contrasts `constraints_status` 15, `analysis_state` 126, `satisfied`
 * 203, `analysis_status` 238); `olumi-schemas` @ `81493081` `compact_summary` —
 * 0 (contrasts 10 / 13). CEE's ingress schema for this carrier is
 * `z.object({ analysis_status: z.string() }).passthrough()`, so the reshape is
 * admitted unchanged and no consumer breaks. Minor, not major, on that evidence.
 */
import type { ConstraintSatisfactionBand } from './constraints'

export const ANALYSIS_INPUTS_CONTRACT_VERSION = '1.1.0'

export interface AnalysisInputsSummary {
  contract_version: '1.1.0'
  recommendation: { option_id: string; option_label: string; win_probability: number }
  options: Array<{ id: string; label: string; win_probability: number }>
  top_drivers: Array<{ factor_id: string; factor_label: string; elasticity: number }> // max 3
  sensitivity_concentration: number
  confidence_band: 'low' | 'medium' | 'high'
  robustness?: { level: 'robust' | 'moderate' | 'fragile'; recommendation_stability: number } | null
  /**
   * Max 5. `status` is the honest verdict; `probability` is present only when
   * the constraint was actually evaluated (`status !== 'unevaluated'`), so an
   * uncomputed constraint asserts neither outcome.
   */
  constraints_status: Array<{
    label: string
    status: ConstraintSatisfactionBand
    probability?: number
  }>
  run_metadata: {
    seed: string | number | null
    quality_mode: string | null
    timestamp: string | null
  }
}
