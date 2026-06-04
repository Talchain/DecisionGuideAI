/**
 * Track S — factor value provenance preservation invariants
 *
 * Verifies that the optional, additive value-provenance fields emitted by ISL
 * on factor_sensitivity[*] survive `pickFactorSensitivityForUi()` on BOTH
 * real-data branches (downstream_calls.isl and enrichment):
 *   - value_source           (string)
 *   - value_extraction_type  (string)
 *   - value_defaulted        (boolean)
 *
 * Sibling of importance-score-preservation.test.ts — same explicit-pick
 * preservation pattern. Guards against the fields being dropped by the
 * adapter boundary (the historical drop point before Track S).
 *
 * Preserve-only-when-present contract:
 *   - explicit `false` is preserved (never coerced away);
 *   - an absent field stays absent (never coerced to false / "");
 *   - non-conforming types are ignored (guarded extraction → undefined).
 *
 * A real-data field (sensitivity_score) is included in every fixture so the
 * ISL / enrichment branch is actually taken (not the top-level fallback).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { pickFactorSensitivityForUi } from '../../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../../adapters/plot/v2/types'

const islResponse = (factor: Record<string, unknown>) =>
  ({
    downstream_calls: { isl: { response: { factor_sensitivity: [factor] } } },
  } as unknown as V2RunResponse)

const enrichmentResponse = (factor: Record<string, unknown>) =>
  ({
    enrichment: { sensitivity_analysis: { factors: [factor] } },
  } as unknown as V2RunResponse)

describe('Track S value provenance preservation (pickFactorSensitivityForUi)', () => {
  // pickFactorSensitivityForUi logs DEV branch diagnostics via console.warn.
  // Suppress them here to keep this unit spec's output clean — branch selection
  // is asserted explicitly via `_source_path`, so the logs are redundant.
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('downstream_calls.isl branch', () => {
    it('preserves value_source, value_extraction_type and value_defaulted=true', () => {
      const result = pickFactorSensitivityForUi(
        islResponse({
          factor_id: 'fac_a',
          label: 'Factor A',
          sensitivity_score: 0.5,
          value_source: 'brief_extraction',
          value_extraction_type: 'inferred',
          value_defaulted: true,
        }),
      )

      expect(result._source_path).toBe('downstream_calls.isl')
      expect(result.factors[0].value_source).toBe('brief_extraction')
      expect(result.factors[0].value_extraction_type).toBe('inferred')
      expect(result.factors[0].value_defaulted).toBe(true)
    })

    it('preserves an explicit value_defaulted=false (no coercion)', () => {
      const result = pickFactorSensitivityForUi(
        islResponse({
          factor_id: 'fac_a',
          sensitivity_score: 0.5,
          value_source: 'explicit',
          value_defaulted: false,
        }),
      )

      expect(result.factors[0].value_defaulted).toBe(false)
    })

    it('leaves an absent value_defaulted absent (never coerced to false)', () => {
      const result = pickFactorSensitivityForUi(
        islResponse({
          factor_id: 'fac_a',
          sensitivity_score: 0.5,
          value_source: 'explicit',
          value_extraction_type: 'explicit',
          // value_defaulted intentionally omitted
        }),
      )

      expect(result.factors[0].value_defaulted).toBeUndefined()
      expect(result.factors[0].value_source).toBe('explicit')
      expect(result.factors[0].value_extraction_type).toBe('explicit')
    })

    it('ignores non-conforming types via guarded extraction', () => {
      const result = pickFactorSensitivityForUi(
        islResponse({
          factor_id: 'fac_a',
          sensitivity_score: 0.5,
          value_source: 42, // not a string
          value_defaulted: 'true', // not a boolean
        }),
      )

      expect(result.factors[0].value_source).toBeUndefined()
      expect(result.factors[0].value_defaulted).toBeUndefined()
    })
  })

  describe('enrichment branch', () => {
    it('preserves value_source, value_extraction_type and value_defaulted=true', () => {
      const result = pickFactorSensitivityForUi(
        enrichmentResponse({
          factor_id: 'fac_b',
          label: 'Factor B',
          sensitivity_score: 0.5,
          value_source: 'cee_inference',
          value_extraction_type: 'inferred',
          value_defaulted: true,
        }),
      )

      expect(result._source_path).toBe('enrichment')
      expect(result.factors[0].value_source).toBe('cee_inference')
      expect(result.factors[0].value_extraction_type).toBe('inferred')
      expect(result.factors[0].value_defaulted).toBe(true)
    })

    it('preserves an explicit value_defaulted=false and leaves absent absent', () => {
      const explicitFalse = pickFactorSensitivityForUi(
        enrichmentResponse({ factor_id: 'fac_b', sensitivity_score: 0.5, value_defaulted: false }),
      )
      expect(explicitFalse.factors[0].value_defaulted).toBe(false)

      const omitted = pickFactorSensitivityForUi(
        enrichmentResponse({ factor_id: 'fac_b', sensitivity_score: 0.5 }),
      )
      expect(omitted.factors[0].value_defaulted).toBeUndefined()
    })
  })
})
