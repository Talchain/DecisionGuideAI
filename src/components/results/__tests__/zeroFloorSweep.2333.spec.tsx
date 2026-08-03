/**
 * THE REST OF THE "0%" CLASS — the surfaces N11 was one instance of
 * (ROADMAP 2.333, PC2).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE CLASS, NOT THE INSTANCE
 * ─────────────────────────────────────────────────────────────────────────
 * Fixing the option card alone would have left four more places where a
 * measured, non-zero probability is rounded to a bare "0%" — the same
 * untruth, on surfaces a user reaches in the same session:
 *
 *   · `RangeVisualization`  — bare `formatPercent` on BOTH registers
 *   · `SuccessTargetRow`    — bare `Math.round` on constraint satisfaction
 *   · `GoalNode` (canvas)   — its own literal, with a `> 0` carve-out that
 *                             made an EXACT zero print "0%" while every
 *                             dock surface printed the floor string
 *   · `OptionNode` (canvas) — the same literal, same class
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

// The canvas GoalNode/OptionNode arms of this class live in
// `src/canvas/nodes/__tests__/nodeGoalReadout.zeroFloor.2333.spec.tsx`.
// They need the canvas store mocked at module scope (the proven harness in
// `GoalNode.possessiveGate.spec.tsx`), which cannot be combined in one file
// with the unmocked dock renders above: a per-test `vi.doMock` +
// `resetModules` hands the node a DIFFERENT `@xyflow/react` instance from the
// `ReactFlowProvider` wrapping it, and every canvas assertion then fails with
// "you have not used zustand provider as an ancestor" — a harness fault that
// reads exactly like a real defect.
