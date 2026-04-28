/**
 * Brief 5.3 Task 5 / 5.7 D5 — AUTHORITY_BIAS suppression predicate.
 *
 * Exercises the upstream filter that prevents target-less authority-bias
 * findings from reaching either the start-here or Review-next render sites.
 * Other bias kinds must remain unaffected.
 */

import { describe, it, expect } from 'vitest'
import { shouldSuppressBiasFinding } from '../PreAnalysisPanel'

describe('shouldSuppressBiasFinding (Brief 5.3 T5 / 5.7 D5)', () => {
  it('suppresses AUTHORITY_BIAS code without target_factor_id', () => {
    expect(shouldSuppressBiasFinding({ code: 'AUTHORITY_BIAS' })).toBe(true)
  })

  it('suppresses lowercase authority_bias type without target_factor_id', () => {
    expect(shouldSuppressBiasFinding({ type: 'authority_bias' })).toBe(true)
  })

  it('does not suppress AUTHORITY_BIAS WITH a target_factor_id', () => {
    expect(
      shouldSuppressBiasFinding({ code: 'AUTHORITY_BIAS', target_factor_id: 'factor-123' }),
    ).toBe(false)
  })

  it('does not suppress NARROW_FRAMING without target', () => {
    expect(shouldSuppressBiasFinding({ code: 'NARROW_FRAMING' })).toBe(false)
  })

  it('does not suppress CONFIRMATION_BIAS without target', () => {
    expect(shouldSuppressBiasFinding({ code: 'CONFIRMATION_BIAS' })).toBe(false)
  })

  it('does not suppress sunk_cost (lowercase type) without target', () => {
    expect(shouldSuppressBiasFinding({ type: 'sunk_cost' })).toBe(false)
  })

  it('handles empty target_factor_id (empty string) as absent', () => {
    expect(shouldSuppressBiasFinding({ code: 'AUTHORITY_BIAS', target_factor_id: '' })).toBe(true)
  })

  it('does not suppress findings with no code or type at all', () => {
    expect(shouldSuppressBiasFinding({})).toBe(false)
  })

  it('reads code first when both code and type present', () => {
    expect(
      shouldSuppressBiasFinding({ code: 'AUTHORITY_BIAS', type: 'narrow_framing' }),
    ).toBe(true)
    expect(
      shouldSuppressBiasFinding({ code: 'NARROW_FRAMING', type: 'authority_bias' }),
    ).toBe(false)
  })
})
