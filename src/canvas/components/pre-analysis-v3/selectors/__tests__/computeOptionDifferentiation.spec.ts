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
 * ⚠⚠ THE WIRE HAS TWO SHAPES AND THIS SPEC ONCE KNEW ONLY ONE. Its `option()`
 * builder emitted `{ value }` exclusively, so the whole suite stayed green
 * while the selector was dark on every real CEE turn: `intervention?.value` is
 * `undefined` on a bare number, so `comparable` never filled and the finding
 * could not fire. Nothing here could see it, because the fixture and the code
 * shared one assumption. A fixture you wrote yourself is not evidence about
 * the wire.
 *
 *   FLAT   `Record<nodeId, number>`       — the live CEE turn shape.
 *   NESTED `Record<nodeId, { value, … }>` — the saved starter-example shape.
 *
 * Both are exercised below, and `describe.each` runs the ENTIRE behavioural
 * suite against each, so a future change that handles one shape and not the
 * other REDs instead of shipping half-dark.
 */

import { describe, it, expect } from 'vitest'
import { computeOptionDifferentiation } from '../computeOptionDifferentiation'

/** The two live wire encodings of one intervention value. */
const SHAPES = [
  {
    name: 'FLAT Record<nodeId, number> (live CEE turn)',
    encode: (value: number) => value as unknown,
  },
  {
    name: 'NESTED Record<nodeId, {value}> (saved starter example)',
    encode: (value: number) => ({ value, source: 'user_specified' }) as unknown,
  },
] as const

/** Minimal producer-shaped option. Values are the only axis under test. */
function makeOption(encode: (value: number) => unknown) {
  return function option(
    id: string,
    values: Record<string, number>,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id,
      label: id,
      status: 'ready' as const,
      interventions: Object.fromEntries(
        Object.entries(values).map(([node, value]) => [node, encode(value)]),
      ),
      ...overrides,
    }
  }
}

/** Default builder for the shape-agnostic cases below. */
const option = makeOption(SHAPES[1].encode)

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

/**
 * ⭐ THE REPAIR'S LOAD-BEARING SUITE — both live wire shapes, same behaviour.
 *
 * RED-FIRST, MEASURED: at the pre-repair selector (`intervention?.value` only)
 * every case in this block fails on the FLAT arm and passes on the NESTED arm.
 * The flat failures are the shipped defect, reproduced: `(0.5)?.value` is
 * `undefined`, so `statedValues` returned null for every option, `comparable`
 * stayed empty, and the selector returned null on 100% of real CEE turns.
 *
 * Shapes measured in-repo, not assumed:
 *   FLAT   6/6 option-carrying captures in `lib/coherence/__tests__/fixtures/captures/`
 *          and 7/7 in `v5/__tests__/fixtures/`.
 *   NESTED 5/5 saved starters in `docs/evidence/starters/raw/`.
 */
describe.each(SHAPES)('computeOptionDifferentiation — wire shape: $name', ({ encode }) => {
  const opt = makeOption(encode)

  it('reports the finding on the shape the producer actually sent', () => {
    const r = ready([
      opt('opt_alpha', { fac_price: 0.5, fac_speed: 0.2 }),
      opt('opt_beta', { fac_price: 0.5, fac_speed: 0.9 }),
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 2,
      sharedCount: 2,
      identicalCount: 1,
    })
  })

  /**
   * IDENTITY BINDING, via a DISCRIMINATING PAIR.
   *
   * The return carries counts, not ids, so an assertion on a count alone could
   * be satisfied by the wrong factor being the identical one. These two mutants
   * pin WHICH factor is counted: breaking the agreement on the named identical
   * factor (`fac_price`) MUST move `identicalCount`, and perturbing a factor
   * that already differs (`fac_speed`) MUST NOT. Only one arrangement of the
   * named factors satisfies both, so the pair binds the assertion to
   * `fac_price` by identity rather than to "some factor worth 0.5".
   */
  it('counts the NAMED shared factor, not merely some factor with that value', () => {
    const base = () => [
      opt('opt_alpha', { fac_price: 0.5, fac_speed: 0.2 }),
      opt('opt_beta', { fac_price: 0.5, fac_speed: 0.9 }),
    ]

    // Control: fac_price agrees, fac_speed does not.
    expect(computeOptionDifferentiation(ready(base()))?.identicalCount).toBe(1)

    // Mutant A — break agreement on fac_price specifically. The whole finding
    // disappears: with nothing identical left there is nothing to report.
    const brokenPrice = [
      opt('opt_alpha', { fac_price: 0.5, fac_speed: 0.2 }),
      opt('opt_beta', { fac_price: 0.7, fac_speed: 0.9 }),
    ]
    expect(computeOptionDifferentiation(ready(brokenPrice))).toBeNull()

    // Mutant B — move fac_speed, which already differed. fac_price is still the
    // one identical factor, so the count must not budge.
    const movedSpeed = [
      opt('opt_alpha', { fac_price: 0.5, fac_speed: 0.31 }),
      opt('opt_beta', { fac_price: 0.5, fac_speed: 0.77 }),
    ]
    expect(computeOptionDifferentiation(ready(movedSpeed))?.identicalCount).toBe(1)
  })

  it('excludes the baseline arm on this shape too, binding by option id', () => {
    const r = ready([
      opt('opt_alpha', { fac_price: 0.5 }),
      opt('opt_beta', { fac_price: 0.5 }),
      // The do-nothing arm states the same value; counting it would inflate
      // optionCount past the set the analysis will actually compare.
      opt('opt_status_quo', { fac_price: 0.5 }, { is_baseline: true }),
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 2,
      sharedCount: 1,
      identicalCount: 1,
    })
  })

  it('ignores a non-finite value rather than letting it become a shared factor', () => {
    const r = ready([
      opt('opt_alpha', { fac_price: 0.5, fac_broken: Number.NaN }),
      opt('opt_beta', { fac_price: 0.5, fac_broken: Number.NaN }),
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 2,
      sharedCount: 1,
      identicalCount: 1,
    })
  })
})

/**
 * A MIXED payload — one option flat, one nested. Not seen on the wire today,
 * but the two encodings are both contract-legal and the selector must not
 * silently drop half a comparison if a producer ever straddles them.
 */
describe('computeOptionDifferentiation — mixed encodings in one payload', () => {
  it('compares a flat option against a nested one', () => {
    const r = ready([
      { id: 'opt_flat', label: 'flat', status: 'ready', interventions: { fac_price: 0.5 } },
      {
        id: 'opt_nested',
        label: 'nested',
        status: 'ready',
        interventions: { fac_price: { value: 0.5, source: 'brief_extraction' } },
      },
    ])
    expect(computeOptionDifferentiation(r)).toEqual({
      optionCount: 2,
      sharedCount: 1,
      identicalCount: 1,
    })
  })
})
