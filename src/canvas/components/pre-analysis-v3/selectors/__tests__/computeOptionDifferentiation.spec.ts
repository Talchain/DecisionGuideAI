/**
 * computeOptionDifferentiation — the VALUE question about options.
 *
 * ⚠ This selector is deliberately NOT a second answer to
 * `computeStructuralAbsence`'s `shared_mechanism`. That one asks "do the
 * options act on the same PARTS of the model?" (structure, from nodes+edges).
 * This one asks "do the options assign the same VALUES to the parts they
 * share?" (magnitude, from the producer's own `analysis_ready.options`).
 * A model can fail either without failing the other, and the two are named
 * apart here so a later session does not reconcile them into one.
 *
 * The wire shape is `CEEOptionV3.interventions: Record<nodeId, { value }>` —
 * the producer's resolved values, never a canvas-side re-derivation.
 */

import { describe, it, expect } from 'vitest'
import { computeOptionDifferentiation } from '../computeOptionDifferentiation'

/** Minimal producer-shaped option. Values are the only axis under test. */
function option(
  id: string,
  values: Record<string, number>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    label: id,
    status: 'ready' as const,
    interventions: Object.fromEntries(
      Object.entries(values).map(([node, value]) => [node, { value, source: 'user_specified' }]),
    ),
    ...overrides,
  }
}

const ready = (options: unknown[]) => ({ options })

describe('computeOptionDifferentiation — preconditions (never invent an absence)', () => {
  it('returns null when there is no analysis_ready payload', () => {
    expect(computeOptionDifferentiation(null)).toBeNull()
  })

  it('returns null below two comparable options', () => {
    expect(computeOptionDifferentiation(ready([option('a', { f1: 1 })]))).toBeNull()
  })

  it('returns null when the options share no factor at all', () => {
    const r = ready([option('a', { f1: 1 }), option('b', { f2: 1 })])
    expect(computeOptionDifferentiation(r)).toBeNull()
  })

  it('ignores options that are not ready', () => {
    const r = ready([
      option('a', { f1: 1 }),
      option('b', { f1: 1 }, { status: 'needs_user_mapping' }),
    ])
    expect(computeOptionDifferentiation(r)).toBeNull()
  })

  it('ignores the baseline option — a do-nothing arm is different by construction', () => {
    const r = ready([
      option('a', { f1: 1 }),
      option('b', { f1: 1 }, { is_baseline: true }),
    ])
    expect(computeOptionDifferentiation(r)).toBeNull()
  })

  it('ignores a factor whose value is not a finite number on every option', () => {
    const r = ready([
      option('a', { f1: 1, f2: 2 }),
      option('b', { f1: 1, f2: Number.NaN }),
    ])
    // f2 is unusable, so only f1 is shared — and it is identical.
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 2,
      sharedCount: 1,
      identicalCount: 1,
    })
  })
})

describe('computeOptionDifferentiation — the finding', () => {
  it('reports the identical subset when options differ on one axis only', () => {
    // The measured live shape: four options, three factors carrying one value
    // each across every option, differing on a single remaining axis.
    const r = ready([
      option('a', { cost: 100, ops: 5, gdpr: 1, speed: 1 }),
      option('b', { cost: 100, ops: 5, gdpr: 1, speed: 2 }),
      option('c', { cost: 100, ops: 5, gdpr: 1, speed: 3 }),
      option('d', { cost: 100, ops: 5, gdpr: 1, speed: 4 }),
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 4,
      sharedCount: 4,
      identicalCount: 3,
    })
  })

  it('reports every shared factor identical when the options are indistinguishable', () => {
    const r = ready([
      option('a', { cost: 100, ops: 5 }),
      option('b', { cost: 100, ops: 5 }),
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 2,
      sharedCount: 2,
      identicalCount: 2,
    })
  })

  it('returns null when every shared factor differs — nothing to report', () => {
    const r = ready([
      option('a', { cost: 100, ops: 5 }),
      option('b', { cost: 200, ops: 9 }),
    ])
    expect(computeOptionDifferentiation(r)).toBeNull()
  })

  it('counts only factors present on EVERY option as shared', () => {
    const r = ready([
      option('a', { cost: 100, ops: 5 }),
      option('b', { cost: 100 }),
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 2,
      sharedCount: 1,
      identicalCount: 1,
    })
  })

  /**
   * ⚠ THREE OPTIONS, DELIBERATELY. The two-option case above cannot tell
   * `every` from `some`: with one option in the tail the two quantifiers are
   * the same function, and a mutant swapping them survives it. Here `ops` is
   * stated by two of the three options, so only `every` excludes it — the
   * assertion below is the one that makes the quantifier load-bearing.
   */
  it('excludes a factor that only SOME of three options state', () => {
    const r = ready([
      option('a', { cost: 100, ops: 5 }),
      option('b', { cost: 100, ops: 5 }),
      option('c', { cost: 100 }),
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 3,
      sharedCount: 1,
      identicalCount: 1,
    })
  })

  it('treats float noise below nine decimal places as the same value', () => {
    const r = ready([
      option('a', { cost: 0.1 + 0.2 }),
      option('b', { cost: 0.3 }),
    ])
    expect(computeOptionDifferentiation(r)?.identicalCount).toBe(1)
  })
})
