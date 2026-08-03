/**
 * N11 — ONE OPTION CARD PRINTED TWO DIFFERENT ANSWERS FOR ONE NUMBER
 * (ROADMAP 2.333, PC2).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT, AS PHOTOGRAPHED
 * ─────────────────────────────────────────────────────────────────────────
 * A single option card, one render, one value (`goalProbability` 0.0007):
 *
 *     Hits target  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%      ← StatBar
 *     ( < 1% likely to reach target )                            ← badge
 *
 * ~2cm apart. Two hand-rolled formatters: the StatBar readout called bare
 * `formatPercent` (`Math.round(0.0007 * 100)` → "0%"), while the low-goal
 * badge carried its own inline copy of the sub-1% floor. The card
 * contradicted itself, and BOTH strings were reachable from the same
 * `option.goalProbability`.
 *
 * ⚠ The design pack claimed a COMPARATIVE twin of this defect — a "Wins"
 * StatBar row printing "0%" beside a header readout printing "0.3%". That is
 * stale: per-card Wins bars were removed in V12.4 and this file has exactly
 * one `<StatBar>` call site. See the T-2333-3 block below, which pins what is
 * actually true there instead.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE FIX IS A PROP AND NOT A BETTER FORMATTER INSIDE `StatBar`
 * ─────────────────────────────────────────────────────────────────────────
 * Teaching `StatBar` the right formatter would fix these two strings and
 * leave the SHAPE that produced them: a component that computes a readout
 * from a raw value, beside a caller that computes its own readout from the
 * same raw value. `StatBar` now takes `readout` as a required prop and holds
 * no formatter at all; the card computes each register's readout ONCE and
 * passes it to every surface that shows it. N11 becomes impossible by
 * construction rather than merely absent — the two strings can no longer be
 * computed twice, so they cannot differ.
 *
 * Scope limit (trap 3): jsdom pins string identity and presence/absence
 * only. Nothing here claims anything about layout, adjacency or visibility —
 * the "2cm apart" framing above is from the walk photograph, not from this
 * file.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

/** The walk's measured per-option sample count. */
const WALK_N = 10000

/**
 * A bare "0%" — i.e. a zero-percent readout that is NOT the tail of a larger
 * number ("10%", "0.01%", "100%" must not match). This is the string the
 * whole slice exists to stop printing for a measured non-zero probability.
 */
const BARE_ZERO_PERCENT = /(?<![\d.])0%/

function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'option-a',
    label: 'Option A',
    expected: 50,
    outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
    p10: 20,
    p50: 50,
    p90: 80,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.7,
    rank: 1,
    ...overrides,
  }
}

function renderCards(options: OptionResult[]) {
  return render(<OptionCards options={options} winnerId={options[0]?.id} hasGoalThreshold />)
}

describe('positive control — the harness renders a non-degenerate card (trap 13)', () => {
  it('shows a mid-range goal probability on every goal surface before any sub-1% claim', () => {
    // If the goal row stopped rendering (the `hasGoalThreshold` /
    // complete-field gates are easy to trip with a partial fixture), every
    // "no 0% anywhere" assertion below would pass by rendering nothing.
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.34, winProbability: 0.34, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.2, winProbability: 0.2, isRecommended: false, nValidSamples: WALK_N }),
    ])
    expect(screen.getByTestId('goal-readout-a').textContent).toBe('34%')
    expect(screen.getByTestId('win-pct-a').textContent).toBe('34%')
  })
})

describe('T-2333-2 — N11: the goal readout and the low-goal badge share ONE string', () => {
  it('prints no bare "0%" anywhere on a card whose goal probability is 0.0007', () => {
    // The headline assertion, and the one that is RED at the defect: the
    // StatBar's `Math.round(0.0007 * 100)` printed "0%" beside a badge
    // saying "< 1%".
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.65, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.35, isRecommended: false, nValidSamples: WALK_N }),
    ])
    const card = screen.getByTestId('option-card-a')
    expect(card.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })

  it('binds the two surfaces to the SAME numeric string, by identity', () => {
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.65, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.35, isRecommended: false, nValidSamples: WALK_N }),
    ])
    const card = screen.getByTestId('option-card-a')
    const statReadout = within(card).getByTestId('goal-readout-a').textContent
    const badge = within(card).getByTestId('low-goal-warning-a').textContent

    // Executed against the real formatter at this tip: 0.0007 at n=10000.
    expect(statReadout).toBe('0.1%')
    expect(badge).toBe('0.1% likely to reach target')
    // The identity claim itself — not "both are 0.1%", but "the badge is
    // built FROM the readout". A mutant that recomputes the badge with a
    // different threshold breaks this even if both strings look plausible.
    expect(badge?.startsWith(`${statReadout} `)).toBe(true)
  })

  it('keeps the floor readout on both surfaces when the run carries no sample count', () => {
    // The no-resolution fallback still agrees with itself — the register's
    // older guarantee, re-pinned so the new arm cannot regress it.
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.65, nValidSamples: undefined }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.35, isRecommended: false }),
    ])
    const card = screen.getByTestId('option-card-a')
    expect(within(card).getByTestId('goal-readout-a').textContent).toBe('< 1%')
    expect(within(card).getByTestId('low-goal-warning-a').textContent).toBe('< 1% likely to reach target')
  })
})

describe('T-2333-3 — the comparative register agrees with itself on one card', () => {
  /**
   * ⚠ A DESIGN PREMISE REFUTED AT THE BYTES, and the reason this block is
   * shaped differently from the goal block above.
   *
   * The design pack described N11 as having a comparative twin: the header
   * win readout using `formatProbabilityWithResolution` while "the 'Wins'
   * StatBar row uses the same bare `formatPercent`". There IS no Wins
   * StatBar row at this tip — `OptionCards`' own header records
   * "V12.4: Per-card 'Wins' bars removed; win % shown as text in card
   * header", and the file has exactly ONE `<StatBar>` call site (the goal
   * row). The comparative half of N11 was fixed by deletion, before this
   * slice, and the design was reading a stale map.
   *
   * What IS true and worth pinning: the card stated the win figure at three
   * separate places (header readout, its tooltip, the fill bar's title),
   * each re-evaluating the same expression. Those are now one hoisted
   * `winsReadout`. That is a single-sourcing claim, not a defect fix, and it
   * is asserted as such.
   */
  it('states ONE win string across the header readout, its tooltip and the bar title', () => {
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.4, winProbability: 0.002675, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.3, winProbability: 0.5, isRecommended: false, nValidSamples: WALK_N }),
    ])
    const card = screen.getByTestId('option-card-a')
    // executed: formatProbabilityWithResolution(0.002675, 10000)
    expect(within(card).getByTestId('win-pct-a').textContent).toBe('0.3%')

    // Every other surface stating the win figure carries the same string.
    const titled = Array.from(card.querySelectorAll('[title]'))
      .map((el) => el.getAttribute('title') ?? '')
      .filter((t) => /came out ahead/i.test(t))
    expect(titled.length).toBeGreaterThan(0)
    for (const t of titled) expect(t).toContain('0.3%')

    expect(card.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })

  it('threads the sample count to BOTH registers, not just the goal row', () => {
    // Guards the half-fix: passing `nValidSamples` to the goal readout and
    // `undefined` to the win readout would leave one register resolved and
    // the other floored on the same card.
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.0001, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.9, isRecommended: false, nValidSamples: WALK_N }),
    ])
    const card = screen.getByTestId('option-card-a')
    expect(within(card).getByTestId('goal-readout-a').textContent).toBe('0.1%')
    expect(within(card).getByTestId('win-pct-a').textContent).toBe('0.01%')
  })
})

describe('T-2334-1b — five sub-1% options render five DISTINCT card readouts', () => {
  it('makes the ordering legible on the option cards, not just the Model tab', () => {
    // PC4 on this surface: the walk's quintet collapsed to five identical
    // "< 1%" strings, so the status-quo-lowest signature was invisible.
    //
    // NOTE the `Show all` click. `OptionCards` renders `TOP_N = 2` cards
    // until the user expands, so a five-option assertion that skips the
    // toggle finds three missing testids and fails for a reason that has
    // nothing to do with formatting. Expanding is what a user comparing five
    // options actually does, and it is the state the claim is about.
    const quintet = [0.0007, 0.0001, 0.0004, 0, 0.0002]
    renderCards(
      quintet.map((p, i) =>
        makeOption({
          id: `o${i}`,
          label: `Option ${i}`,
          goalProbability: p,
          // Descending, so the display sort keeps producer order and the
          // expected array below stays readable.
          winProbability: 0.2 - i * 0.01,
          nValidSamples: WALK_N,
          isRecommended: i === 0,
        }),
      ),
    )
    fireEvent.click(screen.getByTestId('option-cards-toggle'))

    const readouts = quintet.map((_, i) => screen.getByTestId(`goal-readout-o${i}`).textContent)
    expect(readouts).toEqual(['0.1%', '0.01%', '0.04%', '<0.01%', '0.02%'])
    expect(new Set(readouts).size).toBe(quintet.length)
  })
})
