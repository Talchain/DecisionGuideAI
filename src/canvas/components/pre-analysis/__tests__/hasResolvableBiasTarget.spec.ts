/**
 * Brief 5.8A D2 — single bias-target normalisation gate.
 *
 * Pure unit tests for hasResolvableBiasTarget. Both the CEE bias_findings
 * shape (target_factor_id) and the coaching bias_signals shape (target) flow
 * through this predicate before normalisation, so D3c (T1 nudge rows) and D5
 * (T2 Sharpen accordion) consume one already-filtered list.
 */

import { describe, it, expect } from 'vitest'
import { hasResolvableBiasTarget } from '../PreAnalysisPanel'

const knownNodes = new Map<string, string>([
  ['fac-1', 'Engineering velocity'],
  ['fac-2', 'Hiring market difficulty'],
])

const resolveLabel = (id: string): string | null => knownNodes.get(id) ?? null

describe('hasResolvableBiasTarget (Brief 5.8A D2)', () => {
  it('returns false when target is undefined', () => {
    expect(hasResolvableBiasTarget(undefined, resolveLabel)).toBe(false)
  })

  it('returns false when target is null', () => {
    expect(hasResolvableBiasTarget(null, resolveLabel)).toBe(false)
  })

  it('returns false when target is an empty string', () => {
    expect(hasResolvableBiasTarget('', resolveLabel)).toBe(false)
  })

  it('returns false when target is whitespace only', () => {
    expect(hasResolvableBiasTarget('   ', resolveLabel)).toBe(false)
    expect(hasResolvableBiasTarget('\t\n', resolveLabel)).toBe(false)
  })

  it('returns false when target does not resolve to a known node', () => {
    expect(hasResolvableBiasTarget('fac-unknown', resolveLabel)).toBe(false)
  })

  it('returns true when target resolves to a known node', () => {
    expect(hasResolvableBiasTarget('fac-1', resolveLabel)).toBe(true)
    expect(hasResolvableBiasTarget('fac-2', resolveLabel)).toBe(true)
  })

  it('trims surrounding whitespace before resolving', () => {
    expect(hasResolvableBiasTarget('  fac-1  ', resolveLabel)).toBe(true)
  })

  it('returns false when resolver returns a blank label', () => {
    const blankResolver = (_id: string): string | null => '   '
    expect(hasResolvableBiasTarget('fac-1', blankResolver)).toBe(false)
  })

  it('returns false when resolver returns null', () => {
    const nullResolver = (_id: string): string | null => null
    expect(hasResolvableBiasTarget('fac-1', nullResolver)).toBe(false)
  })
})
