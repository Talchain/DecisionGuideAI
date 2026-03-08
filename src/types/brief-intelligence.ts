/**
 * Brief Intelligence Layer (BIL) — contract types.
 *
 * Mirrors CEE's authoritative BriefIntelligence schema exactly.
 * The UI computes a local preview for immediate guidance; CEE owns the
 * canonical version used in prompts and downstream services.
 */

export const BIL_CONTRACT_VERSION = '1.0.0'

export interface BriefIntelligence {
  goal: { label: string; measurable: boolean; confidence: number } | null
  options: Array<{ label: string; confidence: number }>
  constraints: Array<{
    label: string
    type: 'hard_limit' | 'success_condition' | 'guardrail'
    confidence: number
  }>
  factors: Array<{ label: string; confidence: number }>
  completeness_band: 'low' | 'medium' | 'high'
  ambiguity_flags: string[]
  missing_elements: Array<
    'goal' | 'constraints' | 'time_horizon' | 'success_metric' | 'status_quo_option' | 'risk_factors'
  >
  dsk_cues: Array<{
    bias_type: string
    signal: string
    claim_id: string
    confidence: number
  }>
}
