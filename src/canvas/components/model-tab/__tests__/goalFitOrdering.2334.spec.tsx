/**
 * PC4 — THE MODEL TAB'S GOAL ROWS PRINTED THE SAME STRING FIVE TIMES
 * (ROADMAP 2.334).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────
 * The walk's run scored five options at `probability_of_goal` 0.0007,
 * 0.0001, 0.0004, 0 and 0.0002. Every one of them rendered
 *
 *     Option N — < 1% likely to reach target
 *
 * because the goal register's formatter was floor-only. The rows were
 * correctly ordered, correctly sourced and completely unreadable: a user
 * could not tell which option was best, could not see that the status quo
 * came LAST, and had no way to know the five numbers differed at all. The
 * data was on the wire the whole time — `option_probabilities[id].outcome.
 * n_valid_samples` was 10000 for every option — and the row builder simply
 * did not carry it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE PINS
 * ─────────────────────────────────────────────────────────────────────────
 *  1. `buildGoalFitRows` CARRIES `nValidSamples` off the producer entry,
 *     through the same positive-integer guard the response mapper uses.
 *  2. `GoalSection` SPENDS it — the rows render five distinct readouts, and
 *     their value ordering is legible in the rendered strings.
 *
 * Both halves are needed: a row builder that carries the count to a section
 * that ignores it is the "threaded but unspent" failure, and a section that
 * would spend a count it is never given is the "spent but unthreaded" one.
 * A mutant for each is in the slice's mutant set.
 *
 * Scope limit (trap 3): string content and DOM order only — no layout,
 * visibility or above-the-fold claim.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { buildGoalFitRows } from '../buildGoalFitRows'

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ setGoalThresholdAndUpdateNode: vi.fn() }),
  ),
}))
vi.mock('../../../utils/focusHelpers', () => ({ focusNodeById: vi.fn() }))
vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { GoalSection } = await import('../GoalSection')

/** The walk's measured quintet, in producer order, with its sample count. */
const WALK_QUINTET = [0.0007, 0.0001, 0.0004, 0, 0.0002] as const
const WALK_N = 10000

/**
 * The producer shape: `probability_of_goal` + `outcome.n_valid_samples`.
 *
 * ⚠ `nValid` is `number | null`, NOT an optional with a default. A default
 * parameter is applied when the argument is `undefined`, so `producerEntry(p,
 * undefined)` would silently mean "the walk's count" rather than "no count" —
 * which is exactly the fixture a no-resolution test needs and exactly what it
 * would NOT get. `null` is the explicit absence sentinel here for that reason.
 */
function producerEntry(p: number, nValid: number | null = WALK_N) {
  return {
    probability_of_goal: p,
    outcome: {
      mean: 1_000_000,
      ...(nValid === null ? {} : { n_valid_samples: nValid }),
    },
  }
}

function optionNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt_${i}`,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label: `Option ${i}` },
  }))
}

function walkReport(nValid: number | null = WALK_N) {
  return Object.fromEntries(
    WALK_QUINTET.map((p, i) => [`opt_${i}`, producerEntry(p, nValid)]),
  )
}

function goalNodeWithTarget(): Node {
  return {
    id: 'goal-1',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      label: 'Grow annual revenue',
      success_threshold: 0.75,
      threshold_source: 'user',
    },
  }
}

describe('buildGoalFitRows — carries the wire sample count (ROADMAP 2.334)', () => {
  it('positive control: the builder resolves the walk fixture to five complete rows', () => {
    // The builder is complete-field gated — it returns null unless EVERY
    // option carries an admissible figure. If the fixture stopped reaching
    // that branch, the assertions below would run against `null`.
    const rows = buildGoalFitRows(optionNodes(5), walkReport())
    expect(rows).not.toBeNull()
    expect(rows).toHaveLength(5)
    expect(rows?.map((r) => r.probability)).toEqual([...WALK_QUINTET])
  })

  it('reads n_valid_samples off the producer entry onto every row', () => {
    const rows = buildGoalFitRows(optionNodes(5), walkReport())
    expect(rows?.map((r) => r.nValidSamples)).toEqual([WALK_N, WALK_N, WALK_N, WALK_N, WALK_N])
  })

  it('yields null nValidSamples when the producer omits the count', () => {
    // Absent ≠ zero, and absent ≠ "assume a default". A run without the
    // count must fall back to the register floor, not invent a resolution.
    const rows = buildGoalFitRows(optionNodes(5), walkReport(null))
    expect(rows).not.toBeNull()
    expect(rows?.every((r) => r.nValidSamples == null)).toBe(true)
  })

  it('rejects a non-positive or non-integer count rather than trusting it', () => {
    // The same `positiveIntegerOrNull` discipline the response mapper
    // applies: a zero sample count would make the resolution threshold
    // infinite, and a fractional one is not a sample count at all.
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      const rows = buildGoalFitRows(optionNodes(1), { opt_0: producerEntry(0.0007, bad) })
      expect(rows?.[0]?.nValidSamples ?? null).toBeNull()
    }
  })
})

describe('T-2334-1 — GoalSection renders the ordering it was always given', () => {
  it('positive control: a mid-range row renders its own percentage', () => {
    render(
      <GoalSection
        goalNode={goalNodeWithTarget()}
        goalFitRows={buildGoalFitRows(optionNodes(1), { opt_0: producerEntry(0.34) })}
      />,
    )
    expect(screen.getByTestId('goal-fit-parity').textContent).toContain('34%')
  })

  it('renders FIVE DISTINCT readouts for the walk quintet', () => {
    render(
      <GoalSection
        goalNode={goalNodeWithTarget()}
        goalFitRows={buildGoalFitRows(optionNodes(5), walkReport())}
      />,
    )
    const block = screen.getByTestId('goal-fit-parity')
    const text = block.textContent ?? ''

    // Executed against the real formatter at this tip, producer order.
    for (const expected of ['0.1%', '0.01%', '0.04%', '<0.01%', '0.02%']) {
      expect(text).toContain(expected)
    }
    // The defect's signature: five identical floor strings.
    expect(text.match(/< 1%/g) ?? []).toHaveLength(0)
  })

  it('makes the value ORDER legible in the rendered strings', () => {
    // PC4's actual claim. Rows are in producer order; sorting the rendered
    // readouts by their underlying value must produce a strictly descending
    // sequence of DISTINCT strings — which is only possible if the readouts
    // discriminate the values at all.
    render(
      <GoalSection
        goalNode={goalNodeWithTarget()}
        goalFitRows={buildGoalFitRows(optionNodes(5), walkReport())}
      />,
    )
    const rowEls = Array.from(
      screen.getByTestId('goal-fit-parity').querySelectorAll('div'),
    ).filter((el) => /Option \d/.test(el.textContent ?? ''))

    const byValueDesc = [...WALK_QUINTET]
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p - a.p)
      .map(({ i }) => rowEls.find((el) => (el.textContent ?? '').startsWith(`Option ${i}`)))
      .map((el) => (el?.textContent ?? '').replace(/^Option \d+ — /, ''))

    expect(byValueDesc.map((s) => s.split(' ')[0])).toEqual([
      '0.1%',
      '0.04%',
      '0.02%',
      '0.01%',
      '<0.01%',
    ])
    expect(new Set(byValueDesc).size).toBe(WALK_QUINTET.length)
  })

  it('falls back to the register floor when the run carries no sample count', () => {
    // The no-overclaim pin: without a wire resolution the rows must NOT
    // invent one — they collapse to the floor exactly as they do today.
    render(
      <GoalSection
        goalNode={goalNodeWithTarget()}
        goalFitRows={buildGoalFitRows(optionNodes(5), walkReport(null))}
      />,
    )
    const text = screen.getByTestId('goal-fit-parity').textContent ?? ''
    expect(text.match(/< 1%/g) ?? []).toHaveLength(5)
  })
})
