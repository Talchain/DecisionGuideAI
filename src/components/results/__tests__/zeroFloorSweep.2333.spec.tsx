/**
 * THE REST OF THE "0%" CLASS — the surfaces N11 was one instance of
 * (ROADMAP 2.333, PC2).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE CLASS, NOT THE INSTANCE
 * ─────────────────────────────────────────────────────────────────────────
 * Fixing the option card alone would have left several more places where a
 * measured, non-zero probability is rounded to a bare "0%" — the same
 * untruth, on surfaces a user reaches in the same session:
 *
 *   · `RangeVisualization`       — bare `formatPercent` on BOTH registers
 *   · `SuccessTargetRow`         — bare `Math.round` on constraint satisfaction
 *   · `TargetProbabilityBars`    — the same constraint numbers, second surface
 *   · `OptionCards` joint badge  — the same joint figure, third surface
 *   · `GoalNode` (canvas)        — its own literal, with a `> 0` carve-out
 *                                  that made an EXACT zero print "0%" while
 *                                  every dock surface printed the floor string
 *
 * ⚠ `OptionNode` was named in the design as "the same literal, same class".
 * It is NOT — its sub-1% predicate has no `> 0` carve-out, so an exact zero
 * already took the floor arm and it never printed "0%". It is left unchanged;
 * the control pinning that is in
 * `canvas/nodes/__tests__/nodeGoalReadout.zeroFloor.2333.spec.tsx`.
 *
 * The `GoalNode` divergence is worth naming precisely, because it was
 * documented as an open question rather than a defect: `displayFloors.ts`
 * carried a correction warning that the canvas renders an exact zero as
 * "0% chance of reaching target" — "live, and the opposite convention". This
 * slice CLOSES it in the goal register's favour, so the canvas node and the
 * card beside it state the same thing about the same number.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY *NOT* CHANGED
 * ─────────────────────────────────────────────────────────────────────────
 * `formatProbabilityWithResolution`'s fallback arm still renders an exact
 * zero as "0%" for the COMPARATIVE register: "came out ahead in 0% of
 * simulated scenarios" is TRUE when an option never came out ahead, and the
 * floor exists to stop a NON-ZERO value printing as zero, not to stop zero
 * printing. Constraint satisfaction takes the comparative register for the
 * same reason ("satisfied in 0 of n runs"). Those are pinned here too, so a
 * later "make everything say < 1%" sweep REDs instead of silently
 * overclaiming.
 *
 * Scope limit (trap 3): string presence/absence only.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RangeVisualization } from '../RangeVisualization'
import { SuccessTargetRow } from '../SuccessTargetRow'
import { TargetProbabilityBars } from '../TargetProbabilityBars'
import type { OptionResult } from '../types'
import type { ConstraintAnalysis } from '../../../types/constraints'

/** A zero-percent readout that is not the tail of a larger number. */
const BARE_ZERO_PERCENT = /(?<![\d.])0%/

function rangeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'option-1',
    label: 'Option A',
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.75,
    ...overrides,
  }
}

describe('RangeVisualization — the per-option probability suffix', () => {
  it('positive control: a mid-range goal probability renders its own percentage', () => {
    render(
      <RangeVisualization
        options={[rangeOption({ goalProbability: 0.34 }), rangeOption({ id: 'option-2', label: 'B', isRecommended: false })]}
        goalThreshold={100}
        winnerId="option-1"
      />,
    )
    expect(document.body.textContent ?? '').toContain('34%')
  })

  it('never prints a bare "0%" for a measured sub-1% GOAL probability', () => {
    render(
      <RangeVisualization
        options={[
          rangeOption({ goalProbability: 0.0007, nValidSamples: 10000 }),
          rangeOption({ id: 'option-2', label: 'B', goalProbability: 0.0004, nValidSamples: 10000, isRecommended: false }),
        ]}
        goalThreshold={100}
        winnerId="option-1"
      />,
    )
    expect(document.body.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })

  it('never prints a bare "0%" for a measured sub-1% WIN probability', () => {
    // The comparative arm of the same component — reached when the run has
    // no goal threshold, so the suffix falls back to the win quantity.
    render(
      <RangeVisualization
        options={[
          rangeOption({ goalProbability: null, winProbability: 0.002675, nValidSamples: 10000 }),
          rangeOption({ id: 'option-2', label: 'B', goalProbability: null, winProbability: 0.0001, nValidSamples: 10000, isRecommended: false }),
        ]}
        goalThreshold={null}
        winnerId="option-1"
      />,
    )
    expect(document.body.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })
})

describe('SuccessTargetRow — constraint satisfaction probabilities', () => {
  function constraintAnalysis(probs: number[], joint: number): ConstraintAnalysis {
    return {
      constraints: probs.map((p, i) => ({
        node_id: `c${i}`,
        operator: '>=',
        threshold: 100,
        label: `Constraint ${i}`,
        prob_satisfied: p,
        failure_margin_median: 10,
        near_miss_fraction: 0.1,
        binding: i === 0,
      })),
      joint_probability: joint,
    }
  }

  it('positive control: mid-range constraint probabilities render their own percentages', () => {
    render(<SuccessTargetRow goalThreshold={100} constraintAnalysis={constraintAnalysis([0.34, 0.72], 0.25)} />)
    const text = document.body.textContent ?? ''
    expect(text).toContain('34%')
    expect(text).toContain('72%')
    expect(text).toContain('25%')
  })

  it('never prints a bare "0%" for measured sub-1% satisfaction probabilities', () => {
    render(
      <SuccessTargetRow
        goalThreshold={100}
        constraintAnalysis={constraintAnalysis([0.0007, 0.0002], 0.0001)}
      />,
    )
    expect(document.body.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })

  it('KEEPS "0%" for an exact zero — the comparative register, deliberately', () => {
    // Satisfied in 0 of n runs is a true statement about a measurement, and
    // the floor is not there to suppress it. This is the no-overclaim guard
    // in the other direction.
    render(
      <SuccessTargetRow goalThreshold={100} constraintAnalysis={constraintAnalysis([0, 0.5], 0)} />,
    )
    expect(document.body.textContent ?? '').toMatch(BARE_ZERO_PERCENT)
  })
})

describe('TargetProbabilityBars — the OTHER surface rendering the same constraint numbers', () => {
  /**
   * ⚠ NOT IN THE DESIGN'S MANIFEST — found by re-running the design's OWN
   * regenerating `rg` command at this tip (trap 12d in miniature: a derived
   * query proves agreement among the rows it returns; it cannot tell you the
   * hand-written TABLE is short).
   *
   * This matters because it is the same `prob_satisfied` / `joint_probability`
   * that `SuccessTargetRow` renders. Fixing one and not the other would not
   * have left a pre-existing defect alone — it would have MANUFACTURED a new
   * "one number, two answers" pair between two surfaces of the same panel,
   * with this slice's own change as the cause.
   */
  function analysis(probs: number[], joint: number): ConstraintAnalysis {
    return {
      constraints: probs.map((p, i) => ({
        node_id: `c${i}`,
        operator: '>=',
        threshold: 100,
        label: `Constraint ${i}`,
        prob_satisfied: p,
        failure_margin_median: 10,
        near_miss_fraction: 0.1,
        binding: i === 0,
      })),
      joint_probability: joint,
    }
  }

  it('positive control: mid-range constraint probabilities render their own percentages', () => {
    render(<TargetProbabilityBars constraintAnalysis={analysis([0.34, 0.72], 0.25)} />)
    const text = document.body.textContent ?? ''
    expect(text).toContain('34%')
    expect(text).toContain('72%')
    expect(text).toContain('25%')
  })

  it('never prints a bare "0%" for measured sub-1% satisfaction probabilities', () => {
    render(<TargetProbabilityBars constraintAnalysis={analysis([0.0007, 0.0002], 0.0001)} />)
    expect(document.body.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })

  it('agrees with SuccessTargetRow on the SAME numbers', () => {
    // The claim that motivated including this surface: two components, one
    // constraint analysis, identical strings.
    const ca = analysis([0.0007, 0.0002], 0.0001)
    const { container: bars } = render(<TargetProbabilityBars constraintAnalysis={ca} />)
    const { container: row } = render(<SuccessTargetRow goalThreshold={100} constraintAnalysis={ca} />)
    for (const expected of ['< 1%']) {
      expect(bars.textContent ?? '').toContain(expected)
      expect(row.textContent ?? '').toContain(expected)
    }
  })

  it('KEEPS "0%" for an exact zero — comparative register, deliberately', () => {
    render(<TargetProbabilityBars constraintAnalysis={analysis([0, 0.5], 0)} />)
    expect(document.body.textContent ?? '').toMatch(BARE_ZERO_PERCENT)
  })
})

// The canvas GoalNode/OptionNode arms of this class live in
// `src/canvas/nodes/__tests__/nodeGoalReadout.zeroFloor.2333.spec.tsx`.
// They need the canvas store mocked at module scope (the proven harness in
// `GoalNode.possessiveGate.spec.tsx`), which cannot be combined in one file
// with the unmocked dock renders above: a per-test `vi.doMock` +
// `resetModules` hands the node a DIFFERENT `@xyflow/react` instance from the
// `ReactFlowProvider` wrapping it, and every canvas assertion then fails with
// "you have not used zustand provider as an ancestor" — a harness fault that
// reads exactly like a real defect.
