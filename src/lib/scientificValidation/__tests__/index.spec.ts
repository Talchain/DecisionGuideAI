/**
 * Tests for the scientific-validation orchestrator and seven validators.
 *
 * Single combined file (one describe block per validator) to keep
 * fixture setup local. Covers every brief-required honesty rule:
 *
 *   - user_std_propagation emits `unavailable` when ISL request is
 *     missing and never passes from reconstructed values.
 *   - confidence_validation detects plot_unified_v3 and old-lattice
 *     values.
 *   - evidence_gap_validation flags intervention-target leakage.
 *   - evpi_validation separates surfaced values from raw diagnostic
 *     mirrors.
 *   - flip_threshold_validation uses flip_thresholds_status when
 *     present; reports unavailable when absent (no inferred pass).
 *   - auto_noise_validation checks top-level/provenance agreement.
 *   - hydrated/saved report path is labelled honestly and does not
 *     pretend raw payloads exist.
 *   - overall_status = insufficient_raw_evidence when < 3 derived.
 */

import { describe, expect, it } from 'vitest'

import {
  runScientificValidation,
  type ValidatorInputs,
} from '../index'
import { runAutoNoiseValidation } from '../autoNoiseValidation'
import { runConfidenceValidation } from '../confidenceValidation'
import { runEvidenceGapValidation } from '../evidenceGapValidation'
import { runEvpiValidation } from '../evpiValidation'
import { runFlipThresholdValidation } from '../flipThresholdValidation'
import { runResponseShapeValidation } from '../responseShapeValidation'
import { runUserStdPropagation } from '../userStdPropagation'
import { assertHonestyRules } from '../types'

function inputs(overrides: Partial<ValidatorInputs> = {}): ValidatorInputs {
  return {
    plotRequest: null,
    plotResponse: null,
    ceeRequest: null,
    ceeResponse: null,
    islRequest: null,
    islResponse: null,
    resultsReport: null,
    ceeAnalysisReady: null,
    capturePipelineStatus: 'complete',
    ...overrides,
  }
}

// ============================================================================
// user_std_propagation
// ============================================================================

describe('user_std_propagation', () => {
  it('emits unavailable when ISL request is missing (the common case)', () => {
    const result = runUserStdPropagation(
      inputs({
        plotRequest: {
          graph: {
            nodes: [
              { id: 'f1', data: { observed_state: { std: 0.05 } } },
            ],
          },
        },
      }),
    )
    expect(result.status).toBe('unavailable')
    expect(result.claim_strength).toBe('unavailable')
    expect(result.required_upstream_support).toContain('plot.debug.isl_request')
  })

  it('never pairs status="pass" with claim_strength="inferred" — assertHonestyRules guard', () => {
    // Hypothetical caller bug: returning inferred + pass. The guard must downgrade.
    const downgraded = assertHonestyRules({
      status: 'pass',
      claim_strength: 'inferred',
      source_paths: [],
      limitations: [],
      required_upstream_support: [],
      details: {},
    })
    expect(downgraded.status).toBe('partial')
    expect(downgraded.limitations[0]).toMatch(/inferred/)
  })

  it('includes expected_from_plot_request as inferred reference (not used as proof)', () => {
    const result = runUserStdPropagation(
      inputs({
        plotRequest: {
          graph: {
            nodes: [
              { id: 'f1', data: { observed_state: { std: 0.05 } } },
              { id: 'f2', data: { observed_state: { std: 0.12 } } },
            ],
          },
        },
      }),
    )
    expect(result.details.expected_from_plot_request).toEqual([
      { factor_id: 'f1', std: 0.05, source: expect.any(String) },
      { factor_id: 'f2', std: 0.12, source: expect.any(String) },
    ])
    expect(result.status).toBe('unavailable') // not 'pass'
  })

  it('passes when ISL request is captured AND std matches PLoT request user input', () => {
    const result = runUserStdPropagation(
      inputs({
        plotRequest: {
          graph: {
            nodes: [{ id: 'f1', data: { observed_state: { std: 0.05 } } }],
          },
        },
        islRequest: {
          parameter_uncertainties: { f1: { mean: 0.4, std: 0.05 } },
        },
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.claim_strength).toBe('derived')
  })

  it('flags widened ISL std as fail', () => {
    const result = runUserStdPropagation(
      inputs({
        plotRequest: {
          graph: {
            nodes: [{ id: 'f1', data: { observed_state: { std: 0.05 } } }],
          },
        },
        islRequest: {
          parameter_uncertainties: { f1: { mean: 0.4, std: 0.10 } },
        },
      }),
    )
    expect(result.status).toBe('fail')
    expect(result.claim_strength).toBe('derived')
  })
})

// ============================================================================
// confidence_validation
// ============================================================================

describe('confidence_validation', () => {
  it('returns unavailable when factor_sensitivity is missing', () => {
    expect(runConfidenceValidation(inputs()).status).toBe('unavailable')
    expect(
      runConfidenceValidation(inputs({ plotResponse: { factor_sensitivity: [] } })).status,
    ).toBe('unavailable')
  })

  it('returns unavailable when no factor carries confidence_provenance', () => {
    const result = runConfidenceValidation(
      inputs({
        plotResponse: {
          factor_sensitivity: [
            { factor_id: 'f1', confidence: 0.5 },
          ],
        },
      }),
    )
    expect(result.status).toBe('unavailable')
    expect(result.required_upstream_support).toContain(
      'plot.response.factor_sensitivity[*].confidence_provenance',
    )
  })

  it('detects plot_unified_v3 formula version and passes', () => {
    const result = runConfidenceValidation(
      inputs({
        plotResponse: {
          factor_sensitivity: [
            {
              factor_id: 'f1',
              confidence: 0.42,
              confidence_provenance: {
                computation_source: 'plot_unified_from_isl_bootstrap',
                formula_version: 'plot_unified_v3',
              },
            },
            {
              factor_id: 'f2',
              confidence: 0.81,
              confidence_provenance: {
                computation_source: 'plot_unified_from_isl_bootstrap',
                formula_version: 'plot_unified_v3',
              },
            },
          ],
        },
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.claim_strength).toBe('derived')
    expect(result.details.v3_plus_count).toBe(2)
  })

  it('flags old-lattice values (0.25/0.375/0.5/0.625/0.75) — partial when present with v3+', () => {
    const result = runConfidenceValidation(
      inputs({
        plotResponse: {
          factor_sensitivity: [
            {
              factor_id: 'f1',
              confidence: 0.375,
              confidence_provenance: {
                computation_source: 'plot_unified_from_graph',
                formula_version: 'plot_unified_v3',
              },
            },
          ],
        },
      }),
    )
    expect(result.status).toBe('partial')
    expect(result.details.old_lattice_match_count).toBe(1)
  })

  it('fails when only old-lattice values present with v1/v2 provenance', () => {
    const result = runConfidenceValidation(
      inputs({
        plotResponse: {
          factor_sensitivity: [
            {
              factor_id: 'f1',
              confidence: 0.5,
              confidence_provenance: {
                computation_source: 'plot_unified_from_graph',
                formula_version: 'plot_unified_v2',
              },
            },
          ],
        },
      }),
    )
    expect(result.status).toBe('fail')
  })
})

// ============================================================================
// evidence_gap_validation
// ============================================================================

describe('evidence_gap_validation', () => {
  it('returns unavailable when m1_coaching.evidence_gaps absent', () => {
    expect(runEvidenceGapValidation(inputs()).status).toBe('unavailable')
  })

  it('passes when evidence gaps exist and none match intervention levers', () => {
    const result = runEvidenceGapValidation(
      inputs({
        plotResponse: {
          m1_coaching: {
            evidence_gaps: [{ factor_id: 'f1', factor_label: 'Cost' }],
          },
        },
        ceeAnalysisReady: {
          options: [{ interventions: { lever_a: { value: 1 } } }],
        },
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.details.intervention_leakage_count).toBe(0)
  })

  it('flags intervention-target leakage (PR #166 regression detector)', () => {
    const result = runEvidenceGapValidation(
      inputs({
        plotResponse: {
          m1_coaching: {
            evidence_gaps: [{ factor_id: 'lever_a', factor_label: 'A' }],
          },
        },
        ceeAnalysisReady: {
          options: [{ interventions: { lever_a: { value: 1 } } }],
        },
      }),
    )
    expect(result.status).toBe('partial')
    expect(result.details.intervention_leakage_count).toBe(1)
  })

  it('handles array-shape interventions (alternate canvas store shape)', () => {
    const result = runEvidenceGapValidation(
      inputs({
        plotResponse: {
          m1_coaching: {
            evidence_gaps: [{ factor_id: 'lever_z' }],
          },
        },
        ceeAnalysisReady: {
          options: [{ interventions: [{ factor_id: 'lever_z', value: 0.5 }] }],
        },
      }),
    )
    expect(result.details.intervention_lever_count).toBe(1)
    expect(result.details.intervention_leakage_count).toBe(1)
  })
})

// ============================================================================
// evpi_validation
// ============================================================================

describe('evpi_validation', () => {
  it('separates surfaced (evpi_percentage_points) from raw (value_of_information)', () => {
    const result = runEvpiValidation(
      inputs({
        plotResponse: {
          factor_sensitivity: [
            { factor_id: 'f1', evpi_percentage_points: 5, value_of_information: 0.05 },
            { factor_id: 'f2', evpi_percentage_points: 2, value_of_information: -0.01 },
          ],
        },
      }),
    )
    expect(result.details.surfaced).toMatchObject({ count: 2, min: 2, max: 5, negative_count: 0 })
    expect(result.details.raw_diagnostic).toMatchObject({ negative_count: 1 })
    expect(result.status).toBe('pass') // surfaced has no negatives
  })

  it('fails when SURFACED EVPI has negative values', () => {
    const result = runEvpiValidation(
      inputs({
        plotResponse: {
          factor_sensitivity: [
            { factor_id: 'f1', evpi_percentage_points: -2 },
          ],
        },
      }),
    )
    expect(result.status).toBe('fail')
  })

  it('returns unavailable when neither field is present', () => {
    expect(
      runEvpiValidation(inputs({ plotResponse: { factor_sensitivity: [{ factor_id: 'f1' }] } })).status,
    ).toBe('unavailable')
  })
})

// ============================================================================
// flip_threshold_validation
// ============================================================================

describe('flip_threshold_validation', () => {
  it('passes when flip_thresholds_status is present (PR #167 upstream)', () => {
    const result = runFlipThresholdValidation(
      inputs({
        plotResponse: {
          flip_thresholds_status: 'all_no_effect',
          flip_thresholds: [{ factor_id: 'f1', flip_reason: 'no_effect' }],
        },
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.claim_strength).toBe('derived')
    expect(result.details.flip_thresholds_status).toBe('all_no_effect')
  })

  it('returns unavailable when flip_thresholds_status is absent — never infers a pass', () => {
    const result = runFlipThresholdValidation(
      inputs({
        plotResponse: {
          flip_thresholds: [{ factor_id: 'f1', flip_value: 0.5 }],
        },
      }),
    )
    expect(result.status).toBe('unavailable')
    expect(result.claim_strength).toBe('unavailable')
    expect(result.required_upstream_support).toContain('plot.response.flip_thresholds_status')
    // Inferred buckets are reported as advisory only
    expect(result.details.inferred_buckets).toMatchObject({ found: 1 })
  })
})

// ============================================================================
// auto_noise_validation
// ============================================================================

describe('auto_noise_validation', () => {
  it('passes when top-level and provenance.applied agree', () => {
    const result = runAutoNoiseValidation(
      inputs({
        plotResponse: {
          auto_noise_applied: true,
          auto_noise_provenance: { applied: true, formula_version: 'v2' },
        },
      }),
    )
    expect(result.status).toBe('pass')
    expect(result.details.agreement).toBe(true)
  })

  it('fails when top-level and provenance.applied disagree', () => {
    const result = runAutoNoiseValidation(
      inputs({
        plotResponse: {
          auto_noise_applied: true,
          auto_noise_provenance: { applied: false },
        },
      }),
    )
    expect(result.status).toBe('fail')
    expect(result.details.agreement).toBe(false)
  })

  it('returns unavailable when neither field is present', () => {
    expect(
      runAutoNoiseValidation(inputs({ plotResponse: {} })).status,
    ).toBe('unavailable')
  })
})

// ============================================================================
// response_shape_validation
// ============================================================================

describe('response_shape_validation', () => {
  it('marks source live when capture_pipeline_status is complete', () => {
    const result = runResponseShapeValidation(
      inputs({
        plotResponse: {
          option_comparison: [],
          factor_sensitivity: [],
          m1_coaching: {},
          flip_thresholds: [],
          robustness: {},
        },
      }),
    )
    expect(result.details.source).toBe('live')
    expect(result.claim_strength).toBe('observed')
    expect(result.status).toBe('pass')
  })

  it('marks source hydrated when capture_pipeline_status is hydrated_only (does NOT pretend live)', () => {
    const result = runResponseShapeValidation(
      inputs({
        plotResponse: { option_comparison: [] },
        capturePipelineStatus: 'hydrated_only',
      }),
    )
    expect(result.details.source).toBe('hydrated')
    expect(result.claim_strength).toBe('inferred')
    expect(result.status).toBe('partial') // never 'pass' with inferred
  })

  it('marks source fallback when capture_pipeline_status is results_rendered_from_store_without_capture', () => {
    const result = runResponseShapeValidation(
      inputs({
        plotResponse: null,
        capturePipelineStatus: 'results_rendered_from_store_without_capture',
      }),
    )
    expect(result.details.source).toBe('fallback')
    expect(result.claim_strength).toBe('inferred')
  })

  it('marks source unavailable when capture_pipeline_status is capture_missing', () => {
    const result = runResponseShapeValidation(
      inputs({
        plotResponse: null,
        capturePipelineStatus: 'capture_missing',
      }),
    )
    expect(result.details.source).toBe('unavailable')
    expect(result.status).toBe('unavailable')
  })
})

// ============================================================================
// orchestrator — overall_status
// ============================================================================

describe('runScientificValidation — overall_status', () => {
  it('emits unavailable when no PLoT response key is present', () => {
    const out = runScientificValidation(inputs({ plotResponse: null, capturePipelineStatus: 'capture_missing' }))
    expect(out.source).toBe('unavailable')
    expect(out.overall_status).toBe('unavailable')
  })

  it('insufficient_raw_evidence when fewer than 3 validators have observed/derived evidence', () => {
    const out = runScientificValidation(
      inputs({
        plotResponse: {
          factor_sensitivity: [
            { factor_id: 'f1', evpi_percentage_points: 3 },
          ],
        },
      }),
    )
    // evpi_validation = derived; response_shape_validation = observed.
    // Others = unavailable. Two derived/observed → insufficient_raw_evidence.
    expect(out.source).toBe('live_raw_payloads')
    expect(out.overall_status).toBe('insufficient_raw_evidence')
  })

  it('complete when ≥3 validators derived/observed AND none fail', () => {
    const out = runScientificValidation(
      inputs({
        plotResponse: {
          option_comparison: [],
          factor_sensitivity: [
            {
              factor_id: 'f1',
              confidence: 0.42,
              evpi_percentage_points: 3,
              confidence_provenance: {
                computation_source: 'plot_unified_from_isl_bootstrap',
                formula_version: 'plot_unified_v3',
              },
            },
          ],
          m1_coaching: { evidence_gaps: [{ factor_id: 'f1' }] },
          flip_thresholds: [],
          flip_thresholds_status: 'all_no_effect',
          robustness: {},
          auto_noise_applied: true,
          auto_noise_provenance: { applied: true },
        },
        ceeAnalysisReady: { options: [{ interventions: {} }] },
      }),
    )
    expect(out.source).toBe('live_raw_payloads')
    expect(out.overall_status).toBe('complete')
  })

  it('partial when ≥3 derived BUT at least one validator fails', () => {
    const out = runScientificValidation(
      inputs({
        plotResponse: {
          option_comparison: [],
          factor_sensitivity: [
            {
              factor_id: 'f1',
              confidence: 0.5,
              evpi_percentage_points: -2, // surfaced negative → evpi_validation fails
              confidence_provenance: {
                computation_source: 'plot_unified_from_graph',
                formula_version: 'plot_unified_v3',
              },
            },
          ],
          m1_coaching: { evidence_gaps: [{ factor_id: 'f1' }] },
          flip_thresholds: [],
          flip_thresholds_status: 'all_no_effect',
          robustness: {},
          auto_noise_applied: true,
          auto_noise_provenance: { applied: true },
        },
        ceeAnalysisReady: { options: [] },
      }),
    )
    expect(out.overall_status).toBe('partial')
  })
})
