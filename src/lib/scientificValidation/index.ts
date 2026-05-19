/**
 * Scientific validation orchestrator.
 *
 * Runs the seven validators and emits the bundle's
 * `scientific_validation` section. Pure function over a slim
 * `ValidatorInputs` shape; tests can drive it without React/Zustand.
 *
 * Overall status rules (from the brief):
 *   - complete                     — ≥3 validators with claim_strength
 *                                    ∈ {observed, derived} AND no
 *                                    `partial`/`fail` results
 *   - partial                      — some derived but < 3 total
 *   - insufficient_raw_evidence    — < 3 validators with observed/derived
 *                                    evidence
 *   - unavailable                  — no live raw payloads at all
 *
 * Order matters less than honesty: the goal is "do not overclaim".
 */

import { runAutoNoiseValidation } from './autoNoiseValidation'
import { runConfidenceValidation } from './confidenceValidation'
import { runEvidenceGapValidation } from './evidenceGapValidation'
import { runEvpiValidation } from './evpiValidation'
import { runFlipThresholdValidation } from './flipThresholdValidation'
import { runResponseShapeValidation } from './responseShapeValidation'
import { runUserStdPropagation } from './userStdPropagation'
import type {
  ScientificValidation,
  ScientificValidationOverallStatus,
  ValidatorInputs,
  ValidatorName,
  ValidatorResult,
} from './types'

export type {
  ClaimStrength,
  ScientificValidation,
  ScientificValidationOverallStatus,
  ValidationStatus,
  ValidatorInputs,
  ValidatorName,
  ValidatorResult,
} from './types'

const RAW_PAYLOAD_INDICATIVE_KEYS = [
  'option_comparison',
  'factor_sensitivity',
  'm1_coaching',
  'flip_thresholds',
  'robustness',
] as const

function classifySource(
  inputs: ValidatorInputs,
): ScientificValidation['source'] {
  // live_raw_payloads — any of the indicative keys exists on the captured
  // PLoT response.
  if (
    inputs.plotResponse &&
    typeof inputs.plotResponse === 'object' &&
    !Array.isArray(inputs.plotResponse)
  ) {
    const obj = inputs.plotResponse as Record<string, unknown>
    if (RAW_PAYLOAD_INDICATIVE_KEYS.some((k) => obj[k] !== undefined && obj[k] !== null)) {
      return 'live_raw_payloads'
    }
  }
  // hydrated_report — capture-pipeline says hydrated_only AND we still
  // have results derived from the canvas store.
  if (inputs.capturePipelineStatus === 'hydrated_only' && inputs.resultsReport) {
    return 'hydrated_report'
  }
  if (inputs.capturePipelineStatus === 'results_rendered_from_store_without_capture') {
    return 'debug_fallback'
  }
  return 'unavailable'
}

function classifyOverall(
  validators: Record<ValidatorName, ValidatorResult>,
  source: ScientificValidation['source'],
): ScientificValidationOverallStatus {
  if (source === 'unavailable') return 'unavailable'
  const derivedCount = Object.values(validators).filter(
    (v) => v.claim_strength === 'observed' || v.claim_strength === 'derived',
  ).length
  const failCount = Object.values(validators).filter((v) => v.status === 'fail').length
  if (derivedCount < 3) return 'insufficient_raw_evidence'
  if (failCount > 0) return 'partial'
  return 'complete'
}

export function runScientificValidation(
  inputs: ValidatorInputs,
): ScientificValidation {
  const validators: Record<ValidatorName, ValidatorResult> = {
    user_std_propagation: runUserStdPropagation(inputs),
    confidence_validation: runConfidenceValidation(inputs),
    evidence_gap_validation: runEvidenceGapValidation(inputs),
    evpi_validation: runEvpiValidation(inputs),
    flip_threshold_validation: runFlipThresholdValidation(inputs),
    auto_noise_validation: runAutoNoiseValidation(inputs),
    response_shape_validation: runResponseShapeValidation(inputs),
  }

  const source = classifySource(inputs)
  const overall_status = classifyOverall(validators, source)

  return {
    overall_status,
    source,
    validators,
  }
}
