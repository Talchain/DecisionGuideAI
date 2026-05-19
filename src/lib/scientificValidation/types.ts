/**
 * Shared types for scientific validation. Every validator returns the
 * same shape so reviewers can scan the section uniformly.
 *
 * Honesty rules (enforced by the orchestrator + per-validator tests):
 *   - `observed`     — raw captured payload present in bundle.payloads.*
 *   - `derived`      — computed directly from captured raw payloads
 *   - `inferred`     — reconstructed from canvas/store/report state;
 *                      NEVER pairs with status='pass'
 *   - `unavailable`  — required evidence missing; required_upstream_support
 *                      populated
 *
 * `details` is a per-validator opaque object documented inline below.
 */

export type ValidationStatus = 'pass' | 'fail' | 'unavailable' | 'partial'

export type ClaimStrength = 'observed' | 'derived' | 'inferred' | 'unavailable'

export interface ValidatorResult {
  status: ValidationStatus
  claim_strength: ClaimStrength
  /** Bundle-relative dot/bracket paths the validator read from. */
  source_paths: string[]
  /** Free-form notes that explain limitations or context. */
  limitations: string[]
  /** Required upstream fields the validator could not find. */
  required_upstream_support: string[]
  /** Per-validator opaque details object. Documented per validator. */
  details: Record<string, unknown>
}

export type ValidatorName =
  | 'user_std_propagation'
  | 'confidence_validation'
  | 'evidence_gap_validation'
  | 'evpi_validation'
  | 'flip_threshold_validation'
  | 'auto_noise_validation'
  | 'response_shape_validation'

export type ScientificValidationOverallStatus =
  | 'complete'
  | 'partial'
  | 'insufficient_raw_evidence'
  | 'unavailable'

export interface ScientificValidation {
  overall_status: ScientificValidationOverallStatus
  /** Whether any raw PLoT payload was found in the bundle. */
  source: 'live_raw_payloads' | 'hydrated_report' | 'debug_fallback' | 'unavailable'
  /** Validators keyed by name for easy lookup. */
  validators: Record<ValidatorName, ValidatorResult>
}

/**
 * Inputs the orchestrator passes to every validator. Each validator
 * picks what it needs — types stay loose because the underlying payloads
 * are `unknown` and we validate shapes at read time.
 */
export interface ValidatorInputs {
  plotRequest: unknown
  plotResponse: unknown
  ceeRequest: unknown
  ceeResponse: unknown
  islRequest: unknown
  islResponse: unknown
  /** Canvas store results.report (from the canvas store at export time). */
  resultsReport: unknown
  /** Canvas store ceeAnalysisReady.options[*].interventions key set. */
  ceeAnalysisReady: unknown
  /** capture_pipeline_status — drives response_shape_validation source. */
  capturePipelineStatus: string | null
}

/**
 * Tiny helper: assert that `inferred` never pairs with `pass`. Validators
 * call this before returning; tests cover the rule.
 */
export function assertHonestyRules(result: ValidatorResult): ValidatorResult {
  if (result.claim_strength === 'inferred' && result.status === 'pass') {
    return {
      ...result,
      status: 'partial',
      limitations: [
        ...result.limitations,
        'status downgraded from pass to partial: inferred evidence cannot prove a pass',
      ],
    }
  }
  return result
}
