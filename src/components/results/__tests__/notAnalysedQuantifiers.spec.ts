/**
 * THE `every`-QUANTIFIER FAMILY — one never-analysed option must not degrade
 * what the user sees about the options that WERE analysed.
 *
 * ## The class, not the instances
 *
 * `useResultsSectionData.notAnalysed.spec.ts` pins the join. This file pins the
 * three OTHER places the same defect lived, each of which is a completeness
 * quantifier that took ALL options as its domain when its question was only
 * ever about the ones in the comparison:
 *
 *  1. `sortOptionsForDisplay` — `allHaveWinProb` (`every`) → the whole list
 *     re-sorted onto the expected-value comparator.
 *  2. `buildGoalFitRows` — `return null` from inside the loop returns from the
 *     WHOLE builder, so one option blanked the entire goal-fit card. Two
 *     different questions were sharing that `return null` (CLAUDE.md trap 21):
 *     "never analysed" and "analysed, no goal figure".
 *
 * ⚠ A THIRD MEMBER OF THIS FAMILY IS GONE WITH ITS SUBJECT (V7 retirement).
 * `buildV7Lenses` — `hasCompleteGoalField` over all options → the entire goal
 * lens collapsed to a `producer_gap` line, which was also the wrong DIAGNOSIS
 * (the producer had no gap; it was never asked) — had its own describe here.
 * The builder is deleted, so the arm is removed rather than left pointing at
 * nothing. The two surviving members below are untouched.
 *
 * Each is pinned with a CONTRAST CONTROL in the same describe: the same input
 * with the marked option removed must produce the ranked/complete result, so a
 * green assertion is a claim about the marked option and not about a builder
 * that returns nothing under every condition (trap 13e).
 */

import { describe, it, expect } from 'vitest'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
import { buildGoalFitRows } from '../../../canvas/components/model-tab/buildGoalFitRows'
import type { OptionResult } from '../types'
import type { Node } from '@xyflow/react'

const A = 'opt_a'
const B = 'opt_b'
const X = 'opt_excluded'

function analysed(id: string, win: number, expected: number, goalProb: number | null = 0.5): OptionResult {
  return {
    id,
    label: `Option ${id}`,
    expected,
    outcome: { mean: expected, p10: expected - 10, p50: expected, p90: expected + 10 },
    p10: expected - 10,
    p50: expected,
    p90: expected + 10,
    isRecommended: false,
    winProbability: win,
    goalProbability: goalProb,
  } as unknown as OptionResult
}

/** The hook's output for an option the run never analysed: no numbers at all. */
function excluded(): OptionResult {
  return {
    id: X,
    label: 'Excluded option',
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: 'no_interventions',
  } as unknown as OptionResult
}

/**
 * ⚠ DISCRIMINATING BY CONSTRUCTION. Win-probability order (A .60 > B .30) is
 * the REVERSE of expected-value order (B 40 > A 10), so no single ordering
 * satisfies both comparators and a test cannot pass under the wrong one.
 */
const ANALYSED_PAIR = [analysed(A, 0.6, 10), analysed(B, 0.3, 40)]

describe('sortOptionsForDisplay — an unranked option does not re-rank the ranked ones', () => {
  it('keeps win-probability order for the analysed options', () => {
    const out = sortOptionsForDisplay([excluded(), ...ANALYSED_PAIR], { designationsWithheld: false })
    expect(out.map((o) => o.id)).toEqual([A, B, X])
  })

  it('CONTRAST CONTROL — the same pair without it sorts identically', () => {
    const out = sortOptionsForDisplay(ANALYSED_PAIR, { designationsWithheld: false })
    expect(out.map((o) => o.id)).toEqual([A, B])
  })

  it('unranked options keep the CALLER’s order among themselves', () => {
    const x2 = { ...excluded(), id: 'opt_excluded_2' } as OptionResult
    const out = sortOptionsForDisplay([x2, ...ANALYSED_PAIR, excluded()], { designationsWithheld: false })
    // Last two, in the order the caller supplied them — never re-sorted, since
    // there is no quantity to sort them by.
    expect(out.map((o) => o.id)).toEqual([A, B, 'opt_excluded_2', X])
  })

  it('UNCHANGED — a withheld run still returns the caller’s order untouched', () => {
    const input = [excluded(), ...ANALYSED_PAIR]
    const out = sortOptionsForDisplay(input, { designationsWithheld: true })
    expect(out.map((o) => o.id)).toEqual(input.map((o) => o.id))
  })
})

function optionNode(id: string): Node {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: `Option ${id}` } } as Node
}

const GOAL_ENTRY = { goal_probability: 0.42, outcome: { n_valid_samples: 10000 } }

describe('buildGoalFitRows — an unanalysed option does not blank the whole card', () => {
  it('returns rows for the analysed options and omits the excluded one', () => {
    const rows = buildGoalFitRows([optionNode(X), optionNode(A), optionNode(B)], {
      [A]: GOAL_ENTRY,
      [B]: GOAL_ENTRY,
    })
    expect(rows).not.toBeNull()
    expect(rows!.map((r) => r.id)).toEqual([A, B])
  })

  it('CONTRAST CONTROL — the same entries with no excluded node behave identically', () => {
    const rows = buildGoalFitRows([optionNode(A), optionNode(B)], { [A]: GOAL_ENTRY, [B]: GOAL_ENTRY })
    expect(rows!.map((r) => r.id)).toEqual([A, B])
  })

  it('UNCHANGED — an ANALYSED option with no admissible figure still returns null', () => {
    // The complete-field rule, which the original `return null` was written
    // for. Separating the two questions must not delete this one.
    const rows = buildGoalFitRows([optionNode(A), optionNode(B)], {
      [A]: GOAL_ENTRY,
      [B]: { outcome: { n_valid_samples: 10000 } },
    })
    expect(rows).toBeNull()
  })

  it('UNCHANGED — a present but MALFORMED entry still returns null', () => {
    // A producer defect is not an exclusion, and must not be silently
    // re-badged as one (trap 21 — the two questions, kept apart).
    const rows = buildGoalFitRows([optionNode(A), optionNode(B)], {
      [A]: GOAL_ENTRY,
      [B]: 'not-an-object' as unknown as Record<string, unknown>,
    })
    expect(rows).toBeNull()
  })

  it('DOMAIN GUARD — a run that returned nothing for any option still returns null', () => {
    // Not "every option is excluded"; a whole-run producer gap. Rendering an
    // empty goal card there would say something false about the graph.
    const rows = buildGoalFitRows([optionNode(A), optionNode(B)], {})
    expect(rows).toBeNull()
  })
})
