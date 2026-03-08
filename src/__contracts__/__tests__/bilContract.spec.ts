import { describe, it, expect } from 'vitest'
import { BIL_CONTRACT_VERSION } from '../../types/brief-intelligence'
import { ANALYSIS_INPUTS_CONTRACT_VERSION } from '../../types/analysis-inputs-summary'
import { extractLocalBIL } from '../../canvas/brief-intelligence/extract'
import type { BriefIntelligence } from '../../types/brief-intelligence'
import type { AnalysisInputsSummary } from '../../types/analysis-inputs-summary'
import fixture from '../analysis-inputs-summary.fixture.json'

describe('BIL Contract', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Contract versions
  // ─────────────────────────────────────────────────────────────────────────

  it('BIL_CONTRACT_VERSION is 1.0.0', () => {
    expect(BIL_CONTRACT_VERSION).toBe('1.0.0')
  })

  it('ANALYSIS_INPUTS_CONTRACT_VERSION is 1.0.0', () => {
    expect(ANALYSIS_INPUTS_CONTRACT_VERSION).toBe('1.0.0')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // BriefIntelligence structural conformance
  // ─────────────────────────────────────────────────────────────────────────

  it('extractLocalBIL output conforms to BriefIntelligence interface', () => {
    const result = extractLocalBIL('I want to achieve 50% growth. Option A: expand. Option B: consolidate.')
    // Type assertion: if this compiles, the structural shape is correct
    const typed: BriefIntelligence = result

    // Runtime shape assertion — every field present
    expect(typed).toHaveProperty('goal')
    expect(typed).toHaveProperty('options')
    expect(typed).toHaveProperty('constraints')
    expect(typed).toHaveProperty('factors')
    expect(typed).toHaveProperty('completeness_band')
    expect(typed).toHaveProperty('ambiguity_flags')
    expect(typed).toHaveProperty('missing_elements')
    expect(typed).toHaveProperty('dsk_cues')

    // Goal shape
    if (typed.goal !== null) {
      expect(typed.goal).toHaveProperty('label')
      expect(typed.goal).toHaveProperty('measurable')
      expect(typed.goal).toHaveProperty('confidence')
      expect(typeof typed.goal.label).toBe('string')
      expect(typeof typed.goal.measurable).toBe('boolean')
      expect(typeof typed.goal.confidence).toBe('number')
    }

    // Array element shapes
    expect(Array.isArray(typed.options)).toBe(true)
    if (typed.options.length > 0) {
      expect(typed.options[0]).toHaveProperty('label')
      expect(typed.options[0]).toHaveProperty('confidence')
    }

    expect(Array.isArray(typed.constraints)).toBe(true)
    if (typed.constraints.length > 0) {
      expect(typed.constraints[0]).toHaveProperty('label')
      expect(typed.constraints[0]).toHaveProperty('type')
      expect(typed.constraints[0]).toHaveProperty('confidence')
      expect(['hard_limit', 'success_condition', 'guardrail']).toContain(typed.constraints[0].type)
    }

    // Completeness band
    expect(['low', 'medium', 'high']).toContain(typed.completeness_band)

    // Missing elements
    expect(Array.isArray(typed.missing_elements)).toBe(true)
    const validMissing = ['goal', 'constraints', 'time_horizon', 'success_metric', 'status_quo_option', 'risk_factors']
    for (const el of typed.missing_elements) {
      expect(validMissing).toContain(el)
    }

    // dsk_cues always empty
    expect(typed.dsk_cues).toEqual([])
  })

  // ─────────────────────────────────────────────────────────────────────────
  // AnalysisInputsSummary structural conformance from fixture
  // ─────────────────────────────────────────────────────────────────────────

  it('canonical fixture conforms to AnalysisInputsSummary type structure', () => {
    // Type assertion: if this compiles, the structural shape is correct
    const typed = fixture as unknown as AnalysisInputsSummary

    // contract_version
    expect(typed.contract_version).toBe('1.0.0')

    // recommendation
    expect(typed.recommendation).toHaveProperty('option_id')
    expect(typed.recommendation).toHaveProperty('option_label')
    expect(typed.recommendation).toHaveProperty('win_probability')
    expect(typeof typed.recommendation.option_id).toBe('string')
    expect(typeof typed.recommendation.option_label).toBe('string')
    expect(typeof typed.recommendation.win_probability).toBe('number')

    // options
    expect(Array.isArray(typed.options)).toBe(true)
    expect(typed.options.length).toBeGreaterThanOrEqual(1)
    for (const opt of typed.options) {
      expect(opt).toHaveProperty('id')
      expect(opt).toHaveProperty('label')
      expect(opt).toHaveProperty('win_probability')
      expect(typeof opt.id).toBe('string')
      expect(typeof opt.label).toBe('string')
      expect(typeof opt.win_probability).toBe('number')
    }

    // top_drivers — max 3
    expect(Array.isArray(typed.top_drivers)).toBe(true)
    expect(typed.top_drivers.length).toBeLessThanOrEqual(3)
    for (const d of typed.top_drivers) {
      expect(d).toHaveProperty('factor_id')
      expect(d).toHaveProperty('factor_label')
      expect(d).toHaveProperty('elasticity')
      expect(typeof d.factor_id).toBe('string')
      expect(typeof d.factor_label).toBe('string')
      expect(typeof d.elasticity).toBe('number')
    }

    // sensitivity_concentration
    expect(typeof typed.sensitivity_concentration).toBe('number')
    expect(typed.sensitivity_concentration).toBeGreaterThanOrEqual(0)
    expect(typed.sensitivity_concentration).toBeLessThanOrEqual(1)

    // confidence_band
    expect(['low', 'medium', 'high']).toContain(typed.confidence_band)

    // robustness
    expect(typed.robustness).toHaveProperty('level')
    expect(typed.robustness).toHaveProperty('recommendation_stability')
    expect(['robust', 'moderate', 'fragile']).toContain(typed.robustness.level)
    expect(typeof typed.robustness.recommendation_stability).toBe('number')

    // constraints_status — max 5
    expect(Array.isArray(typed.constraints_status)).toBe(true)
    expect(typed.constraints_status.length).toBeLessThanOrEqual(5)
    for (const c of typed.constraints_status) {
      expect(c).toHaveProperty('label')
      expect(c).toHaveProperty('satisfied')
      expect(typeof c.label).toBe('string')
      expect(typeof c.satisfied).toBe('boolean')
      // probability is optional
      if ('probability' in c) {
        expect(typeof c.probability).toBe('number')
      }
    }

    // run_metadata
    expect(typed.run_metadata).toHaveProperty('seed')
    expect(typed.run_metadata).toHaveProperty('quality_mode')
    expect(typed.run_metadata).toHaveProperty('timestamp')
    // All fields are string | number | null
    for (const key of ['seed', 'quality_mode', 'timestamp'] as const) {
      const val = typed.run_metadata[key]
      expect(val === null || typeof val === 'string' || typeof val === 'number').toBe(true)
    }
  })

  it('canonical fixture serialised size is ≤ 2048 bytes', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(fixture)).length
    expect(bytes).toBeLessThanOrEqual(2048)
  })
})
