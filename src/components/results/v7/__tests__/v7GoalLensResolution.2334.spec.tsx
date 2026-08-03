/**
 * THE V7 GOAL LENS RESOLVES SUB-1% FIGURES (ROADMAP 2.334) — and RENDERS.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS AT ALL — a coverage hole found by the typecheck gate
 * ─────────────────────────────────────────────────────────────────────────
 * When this slice re-pointed `GoalRow` at the goal register's shared
 * formatter, it removed the old imports and FORGOT to add the new one. The
 * lens referenced a `formatGoalProbability` that was not in scope: every
 * render of the goal lens would have thrown `ReferenceError` in production.
 *
 * All 38 of the slice's other tests stayed GREEN, because vitest transpiles
 * without typechecking and no spec in the slice rendered this component. The
 * defect was caught by `pnpm typecheck` (TS2304, plus two TS6133s for the
 * now-unused imports) — which is the whole argument for that gate being part
 * of the definition of done rather than a formality after it.
 *
 * So this file does two jobs, and the first is the important one:
 *   1. RENDER the goal lens, so a missing/incorrect binding here is a RED
 *      test and not merely a type error someone can baseline away.
 *   2. Pin the 2.334 behaviour on this surface: five sub-1% options must
 *      produce five distinct readouts, not five copies of "< 1%".
 *
 * Scope limit (trap 3): string content only — no layout or visibility claim.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { V7LensGroup } from '../V7LensGroup'
import { buildV7Lenses } from '../buildV7Lenses'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { OptionResult } from '../../types'

/** The walk's measured quintet and its per-option sample count. */
const WALK_QUINTET = [0.0007, 0.0001, 0.0004, 0, 0.0002] as const
const WALK_N = 10000

function opt(
  id: string,
  label: string,
  o: { win: number; goalProb: number; nValidSamples?: number | null },
): OptionResult {
  return {
    id,
    label,
    expected: null,
    outcome: { mean: null, p10: 1, p50: 2, p90: 3 },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    winProbability: o.win,
    goalProbability: o.goalProb,
    nValidSamples: o.nValidSamples,
  } as unknown as OptionResult
}

function data(allOptions: OptionResult[]): ResultsSectionDataReturn {
  return {
    recommendation: {
      allOptions,
      recommendedOption: allOptions[0] ?? null,
      // A user target is required for the goal lens to be available at all.
      goalThreshold: 100,
      outcomeUnit: 'count',
    },
    drivers: { drivers: [] },
    confidence: { challengeFragileEdges: [], conditionalWinners: [] },
  } as unknown as ResultsSectionDataReturn
}

function renderGoalLens(options: OptionResult[]) {
  render(<V7LensGroup model={buildV7Lenses(data(options))} />)
  fireEvent.click(screen.getByRole('tab', { name: /goal/i }))
}

function quintetOptions(nValidSamples: number | null) {
  return WALK_QUINTET.map((p, i) =>
    opt(`o${i}`, `Option ${i}`, { win: 0.2 - i * 0.01, goalProb: p, nValidSamples }),
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('V7 goal lens — renders at all (the regression this file was written for)', () => {
  it('positive control: the goal lens mounts and shows a mid-range readout', () => {
    // If `GoalRow` cannot resolve its formatter, this throws rather than
    // failing an assertion — which is the point. A type-only guard would
    // have let the same defect ship behind an updated baseline.
    renderGoalLens([
      opt('a', 'Option A', { win: 0.7, goalProb: 0.34, nValidSamples: WALK_N }),
      opt('b', 'Option B', { win: 0.3, goalProb: 0.2, nValidSamples: WALK_N }),
    ])
    const rows = screen.getAllByTestId('v7-goal-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('34%')
  })
})

describe('V7 goal lens — sub-1% figures resolve (ROADMAP 2.334)', () => {
  it('renders five DISTINCT readouts for the walk quintet', () => {
    renderGoalLens(quintetOptions(WALK_N))
    const texts = screen.getAllByTestId('v7-goal-row').map((el) => el.textContent ?? '')
    expect(texts).toHaveLength(5)

    // Executed against the real formatter at this tip.
    for (const expected of ['0.1%', '0.01%', '0.04%', '<0.01%', '0.02%']) {
      expect(texts.some((t) => t.includes(expected))).toBe(true)
    }
    // The defect's signature: five copies of the register floor.
    expect(texts.filter((t) => t.includes('< 1%'))).toHaveLength(0)
  })

  it('falls back to the register floor when the run carries no sample count', () => {
    // The no-overclaim pin: without a wire resolution the lens must not
    // invent one.
    renderGoalLens(quintetOptions(null))
    const texts = screen.getAllByTestId('v7-goal-row').map((el) => el.textContent ?? '')
    expect(texts.filter((t) => t.includes('< 1%'))).toHaveLength(5)
  })

  it('never prints a bare "0%" for a measured sub-1% goal probability', () => {
    renderGoalLens(quintetOptions(WALK_N))
    for (const el of screen.getAllByTestId('v7-goal-row')) {
      expect(el.textContent ?? '').not.toMatch(/(?<![\d.])0%/)
    }
  })
})
