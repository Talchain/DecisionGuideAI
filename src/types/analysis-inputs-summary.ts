/**
 * AnalysisInputsSummary — enriched analysis summary assembled from V2RunResponse.
 *
 * The UI is the sole production assembler. CEE owns the schema and validation rules.
 * Sent as `analysis_state.analysis_summary` on turn requests so the orchestrator
 * has structured context about the latest analysis without re-parsing the full response.
 */

export const ANALYSIS_INPUTS_CONTRACT_VERSION = '1.0.0'

export interface AnalysisInputsSummary {
  contract_version: '1.0.0'
  recommendation: { option_id: string; option_label: string; win_probability: number }
  options: Array<{ id: string; label: string; win_probability: number }>
  top_drivers: Array<{ factor_id: string; factor_label: string; elasticity: number }> // max 3
  sensitivity_concentration: number
  confidence_band: 'low' | 'medium' | 'high'
  robustness?: { level: 'robust' | 'moderate' | 'fragile'; recommendation_stability: number } | null
  constraints_status: Array<{ label: string; satisfied: boolean; probability?: number }> // max 5
  run_metadata: {
    seed: string | number | null
    quality_mode: string | null
    timestamp: string | null
  }
}
