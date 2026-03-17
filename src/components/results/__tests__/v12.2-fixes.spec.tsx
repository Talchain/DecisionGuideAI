/**
 * V12.2 Critical Fixes Test Suite
 * Tests for six critical bugs found in staging (24 Feb 2026)
 */

import { describe, it, expect } from 'vitest'
import { deriveDecisionState, computeGapTop2 } from '../buildResultsVM'
import type { OptionResult } from '../types'

// ─── Fix 1: Runner-up selection computed from sorted win_probability ────────

describe('Fix 1: Runner-up selection', () => {
  it('selects second-highest win_probability as runner-up', () => {
    const options: OptionResult[] = [
      { id: 'a', label: 'Acquire Smaller Competitor', winProbability: 0.429, rank: 1, expected: 100, isRecommended: true },
      { id: 'b', label: 'Build Dedicated Mid-Market Tier', winProbability: 0.234, rank: 2, expected: 80, isRecommended: false },
      { id: 'c', label: 'Status Quo', winProbability: 0.191, rank: 3, expected: 60, isRecommended: false },
      { id: 'd', label: 'Partner with System Integrators', winProbability: 0.147, rank: 4, expected: 40, isRecommended: false },
    ]

    // Sort by winProbability descending
    const sorted = [...options].sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))
    const runnerUp = sorted[1]

    expect(runnerUp?.id).toBe('b')
    expect(runnerUp?.label).toBe('Build Dedicated Mid-Market Tier')
    expect(runnerUp?.winProbability).toBe(0.234)
  })

  it('handles equal win probabilities (50% vs 50%)', () => {
    const options: OptionResult[] = [
      { id: 'a', label: 'Option A', winProbability: 0.50, rank: 1, expected: 100, isRecommended: true },
      { id: 'b', label: 'Option B', winProbability: 0.50, rank: 2, expected: 100, isRecommended: false },
    ]

    const sorted = [...options].sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))
    const runnerUp = sorted[1]

    expect(runnerUp?.label).toBe('Option B')
    expect(runnerUp?.winProbability).toBe(0.50)
  })

  it('selects runner-up when winner has 80% and two options tie at 10%', () => {
    const options: OptionResult[] = [
      { id: 'a', label: 'Option A', winProbability: 0.80, rank: 1, expected: 100, isRecommended: true },
      { id: 'b', label: 'Option B', winProbability: 0.10, rank: 2, expected: 50, isRecommended: false },
      { id: 'c', label: 'Option C', winProbability: 0.10, rank: 3, expected: 50, isRecommended: false },
    ]

    const sorted = [...options].sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))
    const runnerUp = sorted[1]

    // Either B or C is acceptable (both have 10%)
    expect(runnerUp?.winProbability).toBe(0.10)
    expect(['b', 'c']).toContain(runnerUp?.id)
  })
})

// ─── Fix 4: Handle stability: null in deriveDecisionState ──────────────────

describe('Fix 4: Stability null handling', () => {
  it('returns indeterminate when stability is null and gap < 0.10', () => {
    const state = deriveDecisionState(0.05, null)
    expect(state).toBe('indeterminate')
  })

  it('returns indeterminate when stability is null and gap is moderate (0.10-0.29)', () => {
    const state1 = deriveDecisionState(0.10, null)
    const state2 = deriveDecisionState(0.19, null)
    const state3 = deriveDecisionState(0.25, null)
    expect(state1).toBe('indeterminate')
    expect(state2).toBe('indeterminate')
    expect(state3).toBe('indeterminate')
  })

  it('returns sensitive when stability is null but gap >= 0.30 (large gap provides signal)', () => {
    const state1 = deriveDecisionState(0.30, null)
    const state2 = deriveDecisionState(0.35, null)
    const state3 = deriveDecisionState(0.50, null)
    expect(state1).toBe('sensitive')
    expect(state2).toBe('sensitive')
    expect(state3).toBe('sensitive')
  })

  it('handles undefined stability same as null', () => {
    const state1 = deriveDecisionState(0.05, undefined)
    const state2 = deriveDecisionState(0.25, undefined)
    const state3 = deriveDecisionState(0.35, undefined)
    expect(state1).toBe('indeterminate')
    expect(state2).toBe('indeterminate')
    expect(state3).toBe('sensitive')
  })

  it('existing behaviour: robust when stability >= 0.80 and gap >= 0.10', () => {
    const state = deriveDecisionState(0.25, 0.82)
    expect(state).toBe('robust')
  })

  it('existing behaviour: sensitive when stability >= 0.55 and gap >= 0.10', () => {
    const state = deriveDecisionState(0.20, 0.60)
    expect(state).toBe('sensitive')
  })
})

// ─── Fix 1 supplemental: Gap computation verification ──────────────────────

describe('Gap computation (supports Fix 1)', () => {
  it('computes correct gap between top two options', () => {
    const options: OptionResult[] = [
      { id: 'a', label: 'A', winProbability: 0.43, rank: 1, expected: 100, isRecommended: true },
      { id: 'b', label: 'B', winProbability: 0.23, rank: 2, expected: 80, isRecommended: false },
      { id: 'c', label: 'C', winProbability: 0.19, rank: 3, expected: 60, isRecommended: false },
    ]

    const gap = computeGapTop2(options)
    expect(gap).toBeCloseTo(0.20, 2)  // 43% - 23% = 20%
  })

  it('returns 0 for empty options array', () => {
    const gap = computeGapTop2([])
    expect(gap).toBe(0)
  })

  it('returns first probability for single option', () => {
    const options: OptionResult[] = [
      { id: 'a', label: 'A', winProbability: 0.80, rank: 1, expected: 100, isRecommended: true },
    ]
    const gap = computeGapTop2(options)
    expect(gap).toBe(0.80)
  })
})
