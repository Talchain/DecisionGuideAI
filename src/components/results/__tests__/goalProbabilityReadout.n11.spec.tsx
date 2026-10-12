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
 * ⚠ #2747 re-scope 2 round 2 (Codex r1 blocking 1; DL rule C, 12 Oct): the card's goal readout is now CEE's served display,
 * verbatim (`OptionCards.goalCellOf`), never the UI's own formatting of the figure (`formatGoalProbability` printed "100%"
 * beside CEE's "more than 99%"). So N11 holds more strongly: the readout is ONE string, and the UI computes it nowhere.
 * Rows below that pinned the UI formatter's output now pin CEE's display; the sample-count rows pin that it no longer
 * matters. Deleted: T-2334-1b (five distinct sub-1% readouts — the UI formatter's resolution; CEE's display decides it).
 *
 * Scope limit (trap 3): jsdom pins string identity and presence/absence
 * only. Nothing here claims anything about layout, adjacency or visibility —
 * the "2cm apart" framing above is from the walk photograph, not from this
 * file.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

/** Round 2 (rule C): each card's goal readout is CEE's served display for that option, passed through `goalCellOf`. */
function renderCards(options: OptionResult[], served: Readonly<Record<string, string>> = {}) {
  return render(
    <OptionCards
      options={options}
      winnerId={options[0]?.id}
      hasGoalThreshold
      goalCellOf={(id) => (served[id] !== undefined ? { display: served[id], face: null } : null)}
    />,
  )
}
const SUB_ONE = { a: 'less than 1%', b: 'less than 1%' }

describe('positive control — the harness renders a non-degenerate card (trap 13)', () => {
  it('shows a mid-range goal probability on every goal surface before any sub-1% claim', () => {
    // If the goal row stopped rendering (the `hasGoalThreshold` /
    // complete-field gates are easy to trip with a partial fixture), every
    // "no 0% anywhere" assertion below would pass by rendering nothing.
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.34, winProbability: 0.34, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.2, winProbability: 0.2, isRecommended: false, nValidSamples: WALK_N }),
    ], { a: 'about 34%', b: 'about 20%' })
    expect(screen.getByTestId('goal-readout-a').textContent).toBe('about 34%')
    // #2747 re-scope 2 (U0, DL ruling (A)): the card prints no win share in C, so no header win readout.
    expect(screen.queryByTestId('win-pct-a')).toBeNull()
  })
})

// #2747 re-scope 2 (U0 rewrite): the low-goal badge that restated the readout in a UI-worded chance sentence is gone in C;
// the card's goal readout is the one string, and no badge restates it.
describe('T-2333-2 — N11: the goal readout is ONE string, and no low-goal badge restates it', () => {
  it('prints no bare "0%" anywhere on a card whose goal probability is 0.0007', () => {
    // The headline assertion, and the one that is RED at the defect: the
    // StatBar's `Math.round(0.0007 * 100)` printed "0%" beside a badge
    // saying "< 1%".
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.65, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.35, isRecommended: false, nValidSamples: WALK_N }),
    ], SUB_ONE)
    const card = screen.getByTestId('option-card-a')
    expect(within(card).getByTestId('goal-readout-a')).toBeTruthy() // the row is drawn, so the absence below is not vacuous
    expect(card.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })

  it('says CEE\'s served display verbatim, never the UI formatter\'s figure, and no low-goal badge (round 2, rule C)', () => {
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.65, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.35, isRecommended: false, nValidSamples: WALK_N }),
    ], SUB_ONE)
    const card = screen.getByTestId('option-card-a')
    const statReadout = within(card).getByTestId('goal-readout-a').textContent

    // The UI formatter would have printed '0.1%' for 0.0007 at n=10000; the card says CEE's words instead.
    expect(statReadout).toBe('less than 1%')
    expect(card.textContent ?? '').not.toContain('0.1%')
    expect(within(card).queryByTestId('low-goal-warning-a')).toBeNull()
    expect(card.textContent ?? '').not.toMatch(/chance of meeting your goal/)
  })

  // Round 2 (rule C): was "keeps the floor readout when the run carries no sample count"; the UI's '< 1%' fallback is gone.
  it('the readout does not depend on the Run\'s sample count: CEE\'s display with none, and no badge', () => {
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.65, nValidSamples: undefined }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.35, isRecommended: false }),
    ], SUB_ONE)
    const card = screen.getByTestId('option-card-a')
    expect(within(card).getByTestId('goal-readout-a').textContent).toBe('less than 1%')
    expect(card.textContent ?? '').not.toContain('< 1%')
    expect(within(card).queryByTestId('low-goal-warning-a')).toBeNull()
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
  // #2747 re-scope 2 (U0, DL ruling (A)): was 'states ONE win string across the header readout, its tooltip and the bar
  // title'. In C the card states the win figure at NONE of the three places: no header readout, no "supported in" title.
  it('states NO win string — no header readout, no tooltip/bar title carrying it', () => {
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.4, winProbability: 0.002675, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.3, winProbability: 0.5, isRecommended: false, nValidSamples: WALK_N }),
    ])
    const card = screen.getByTestId('option-card-a')
    // formatProbabilityWithResolution(0.002675, 10000) would print '0.3%'; it is not printed.
    expect(within(card).queryByTestId('win-pct-a')).toBeNull()
    expect(card.textContent ?? '').not.toContain('0.3%')

    const titled = Array.from(card.querySelectorAll('[title]'))
      .map((el) => el.getAttribute('title') ?? '')
      .filter((t) => /supported in/i.test(t))
    expect(titled).toEqual([])

    expect(card.textContent ?? '').not.toMatch(BARE_ZERO_PERCENT)
  })

  // #2747 re-scope 2 (U0, DL ruling (A)): was 'threads the sample count to BOTH registers, not just the goal row'; the win
  // register is not printed in C, so the row pins the goal row's resolved readout and the win readout's absence.
  // Round 2 (rule C): the goal row says CEE's display, so there is no sample count to thread; the win half is unchanged.
  it('threads the sample count to the goal row; no win register is printed', () => {
    // Guards the half-fix: passing `nValidSamples` to the goal readout and
    // `undefined` to the win readout would leave one register resolved and
    // the other floored on the same card.
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.0007, winProbability: 0.0001, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.0004, winProbability: 0.9, isRecommended: false, nValidSamples: WALK_N }),
    ], SUB_ONE)
    const card = screen.getByTestId('option-card-a')
    expect(within(card).getByTestId('goal-readout-a').textContent).toBe('less than 1%')
    expect(within(card).queryByTestId('win-pct-a')).toBeNull()
    expect(card.textContent ?? '').not.toContain('0.01%')
  })
})

describe('absent ≠ zero — the readouts are computed eagerly, so pin what happens', () => {
  /**
   * `goalReadout` and `winsReadout` are hoisted to the top of `OptionCard` and
   * computed for EVERY card, including one whose probability is absent. That is
   * what makes them single-sourced, and it means `formatGoalProbability` is
   * called with `undefined` on such a card — which would render "NaN%".
   *
   * It never reaches the DOM, and this pins WHY rather than asserting it
   * happens to be fine: the goal row is behind a complete-field gate
   * (`showHitsTarget = hasGoalThreshold && options.every(o => o.goalProbability
   * != null)`) and the win readout behind `option.winProbability != null`. If a
   * later change renders either readout outside its guard, this REDs.
   */
  it('renders no "NaN" when an option carries no goal probability', () => {
    renderCards([
      makeOption({ id: 'a', goalProbability: null, winProbability: 0.5, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.4, winProbability: 0.3, isRecommended: false, nValidSamples: WALK_N }),
    ])
    expect(document.body.textContent ?? '').not.toContain('NaN')
  })

  it('renders no "NaN" when an option carries no win probability', () => {
    renderCards([
      makeOption({ id: 'a', goalProbability: 0.4, winProbability: undefined, nValidSamples: WALK_N }),
      makeOption({ id: 'b', goalProbability: 0.3, winProbability: undefined, isRecommended: false, nValidSamples: WALK_N }),
    ])
    expect(document.body.textContent ?? '').not.toContain('NaN')
  })
})

// #2747 re-scope 2 round 2 (rule C): describe deleted — "T-2334-1b — five sub-1% options render five DISTINCT card readouts"
// (1 row, "makes the ordering legible on the option cards, not just the Model tab"). Its only subject was the UI formatter's
// sample-count resolution ('0.1%', '0.01%', '<0.01%'); the card now says CEE's served display, whose resolution is CEE's.
