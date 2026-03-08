import { describe, it, expect } from 'vitest'
import { extractLocalBIL } from '../extract'
import type { BriefIntelligence } from '../../../types/brief-intelligence'

describe('extractLocalBIL', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Well-formed brief → completeness = high
  // ─────────────────────────────────────────────────────────────────────────
  it('returns high completeness for a well-formed brief with goal, options, constraint, and factor', () => {
    const brief = [
      'I want to increase our quarterly revenue to $5M.',
      'Option A: Expand into European markets.',
      'Option B: Focus on upselling existing customers.',
      'We must not exceed a $500K marketing budget.',
      'Customer retention rate affects our growth trajectory.',
    ].join('\n')

    const result = extractLocalBIL(brief)

    expect(result.completeness_band).toBe('high')
    expect(result.goal).not.toBeNull()
    expect(result.goal!.measurable).toBe(true)
    expect(result.options.length).toBeGreaterThanOrEqual(1)
    expect(result.constraints.length).toBeGreaterThanOrEqual(1)
    expect(result.factors.length).toBeGreaterThanOrEqual(1)
    expect(result.dsk_cues).toEqual([])
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Minimal brief → completeness = low, missing_elements populated
  // ─────────────────────────────────────────────────────────────────────────
  it('returns low completeness for a minimal brief with no actionable content', () => {
    const result = extractLocalBIL('Just thinking about things.')

    expect(result.completeness_band).toBe('low')
    expect(result.goal).toBeNull()
    expect(result.missing_elements).toContain('goal')
    expect(result.missing_elements).toContain('constraints')
    expect(result.missing_elements).toContain('status_quo_option')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Constraints extracted with correct types
  // ─────────────────────────────────────────────────────────────────────────
  it('extracts constraints with correct type classification', () => {
    const brief = [
      'I want to improve customer satisfaction to 90%.',
      'We must not exceed $200K in costs.',
      'We need at least 50 new customers per month.',
      'Everything must be completed by Q2 2026.',
    ].join('\n')

    const result = extractLocalBIL(brief)

    expect(result.constraints.length).toBeGreaterThanOrEqual(1)

    const types = result.constraints.map(c => c.type)
    // Should have at least one hard_limit (must not exceed) and one success_condition (at least)
    expect(types).toContain('hard_limit')
    expect(types).toContain('success_condition')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 4. No status quo → missing_elements includes 'status_quo_option'
  // ─────────────────────────────────────────────────────────────────────────
  it('includes status_quo_option in missing_elements when no status quo phrase present', () => {
    const brief = 'I want to achieve 20% growth. Option A: expand. Option B: diversify.'
    const result = extractLocalBIL(brief)

    expect(result.missing_elements).toContain('status_quo_option')
  })

  it('does not include status_quo_option when "do nothing" is mentioned', () => {
    const brief = 'I want to achieve 20% growth. Option A: expand. Option B: do nothing.'
    const result = extractLocalBIL(brief)

    expect(result.missing_elements).not.toContain('status_quo_option')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Empty string → completeness = low, all arrays empty, goal = null
  // ─────────────────────────────────────────────────────────────────────────
  it('handles empty string gracefully', () => {
    const result = extractLocalBIL('')

    expect(result.completeness_band).toBe('low')
    expect(result.goal).toBeNull()
    expect(result.options).toEqual([])
    expect(result.constraints).toEqual([])
    expect(result.factors).toEqual([])
    expect(result.ambiguity_flags).toEqual([])
    expect(result.missing_elements).toContain('goal')
    expect(result.missing_elements.length).toBe(6) // all elements missing
    expect(result.dsk_cues).toEqual([])
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 6. dsk_cues always empty (no DSK bundle client-side)
  // ─────────────────────────────────────────────────────────────────────────
  it('always returns empty dsk_cues array', () => {
    const brief = 'I want to achieve 50% ROI by investing in Option A or Option B within budget.'
    const result = extractLocalBIL(brief)

    expect(result.dsk_cues).toEqual([])
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Ambiguity flags for vague goals
  // ─────────────────────────────────────────────────────────────────────────
  it('detects ambiguity flags for vague goals', () => {
    const brief = 'I want to improve things and make it better somehow.'
    const result = extractLocalBIL(brief)

    expect(result.ambiguity_flags.length).toBeGreaterThanOrEqual(1)
    expect(result.ambiguity_flags.some(f => f.includes('improve things'))).toBe(true)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Medium completeness: goal + options but no constraints/factors
  // ─────────────────────────────────────────────────────────────────────────
  it('returns medium completeness for goal + options without constraints', () => {
    const brief = 'I want to increase sales. Should we expand or consolidate?'
    const result = extractLocalBIL(brief)

    expect(result.completeness_band).toBe('medium')
    expect(result.goal).not.toBeNull()
    expect(result.options.length).toBeGreaterThanOrEqual(1)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Performance: < 10ms on 500-word brief
  // ─────────────────────────────────────────────────────────────────────────
  it('runs in < 10ms on a 500-word brief', () => {
    // Generate a 500-word brief with mixed content
    const words = [
      'I want to achieve a 30% increase in revenue by expanding into new markets.',
      'Option A: Enter the European market with a direct sales team.',
      'Option B: Partner with local distributors in Asia-Pacific.',
      'Option C: Focus on digital channels and e-commerce expansion.',
      'We must not exceed a $2M annual budget for market expansion.',
      'The timeline must be within 18 months from project kickoff.',
      'Customer acquisition cost affects our profitability trajectory.',
      'Brand recognition drives customer conversion rates significantly.',
      'Market competition influences our pricing strategy options.',
    ]
    const longBrief = Array.from({ length: 10 }, () => words.join(' ')).join('\n')

    const start = performance.now()
    extractLocalBIL(longBrief)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(10)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Structural conformance — result matches BriefIntelligence shape
  // ─────────────────────────────────────────────────────────────────────────
  it('returns a result conforming to BriefIntelligence interface shape', () => {
    const result = extractLocalBIL('I want to reach 100 users. Option A or Option B.')
    const typed: BriefIntelligence = result // type-check at compile time

    expect(typed).toHaveProperty('goal')
    expect(typed).toHaveProperty('options')
    expect(typed).toHaveProperty('constraints')
    expect(typed).toHaveProperty('factors')
    expect(typed).toHaveProperty('completeness_band')
    expect(typed).toHaveProperty('ambiguity_flags')
    expect(typed).toHaveProperty('missing_elements')
    expect(typed).toHaveProperty('dsk_cues')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 11–12. Parity tests — canonical briefs match expected CEE output
  // ─────────────────────────────────────────────────────────────────────────
  it('parity: hiring decision brief produces high completeness with correct missing_elements', () => {
    // Canonical brief that CEE would classify as high completeness
    const brief = [
      'I need to decide whether to hire a senior engineer or promote from within.',
      'Option A: Hire a senior engineer externally at $180K salary.',
      'Option B: Promote a mid-level engineer and invest in training.',
      'Option C: Keep the current team and redistribute workload (status quo).',
      'We must not exceed our $200K annual headcount budget.',
      'Team velocity affects our ability to ship the product on time.',
      'We need at least 2 additional senior-level contributors by Q3.',
      'The risk of a bad hire could set us back 6 months.',
    ].join('\n')

    const result = extractLocalBIL(brief)

    // CEE expected: high completeness
    expect(result.completeness_band).toBe('high')
    // CEE expected: status_quo_option NOT missing (Option C mentions status quo)
    expect(result.missing_elements).not.toContain('status_quo_option')
    // CEE expected: has risk factors
    expect(result.missing_elements).not.toContain('risk_factors')
  })

  it('parity: vague brief produces low completeness with all missing elements', () => {
    // Canonical brief that CEE would classify as low completeness
    const brief = 'We should probably do something about the situation soon.'

    const result = extractLocalBIL(brief)

    // CEE expected: low completeness
    expect(result.completeness_band).toBe('low')
    // CEE expected: goal missing
    expect(result.missing_elements).toContain('goal')
    // CEE expected: constraints missing
    expect(result.missing_elements).toContain('constraints')
    // CEE expected: status_quo_option missing
    expect(result.missing_elements).toContain('status_quo_option')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 13. Debounce contract — rapid calls produce consistent results
  //
  // extractLocalBIL is a pure function. The 500ms debounce is the caller's
  // responsibility (ChatComposer uses useDebounce). This test verifies that
  // repeated rapid calls with the same text produce identical output —
  // confirming the function is safe to debounce (idempotent, no side effects).
  // ─────────────────────────────────────────────────────────────────────────
  it('is idempotent: rapid successive calls with the same text produce identical results', () => {
    const brief = 'I want to achieve 30% growth. Option A: expand. Option B: focus. We must not exceed $1M budget.'

    // Simulate rapid successive calls (as if debounce hasn't fired yet)
    const results = Array.from({ length: 5 }, () => extractLocalBIL(brief))

    // All calls should produce the same completeness band
    const bands = results.map(r => r.completeness_band)
    expect(new Set(bands).size).toBe(1) // all identical

    // goal detection must be stable
    const goalDetected = results.map(r => r.goal !== null)
    expect(new Set(goalDetected).size).toBe(1)

    // options count must be stable
    const optCounts = results.map(r => r.options.length)
    expect(new Set(optCounts).size).toBe(1)
  })

  it('produces different results when text changes — debounce fires on stabilised value', () => {
    // Initial partial brief
    const partial = 'I want to improve sales.'
    const r1 = extractLocalBIL(partial)
    expect(r1.completeness_band).toBe('low') // no options yet

    // Final stable brief after typing stops
    const stable = 'I want to improve sales. Option A: expand. Option B: focus. We must not exceed $500K.'
    const r2 = extractLocalBIL(stable)
    expect(r2.completeness_band).not.toBe('low') // medium or high

    // The two extractions differ — which is why we debounce to the final value
    expect(r1.options.length).not.toBe(r2.options.length)
  })
})
