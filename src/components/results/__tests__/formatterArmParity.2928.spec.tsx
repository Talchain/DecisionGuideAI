/**
 * ROADMAP 2.928 member (c) — ONE FORMATTER ARM PER SCREEN.
 *
 * THE DEFECT, AS SEEN BY A USER
 * -----------------------------
 * `win_probability = 0.9995` rendered **"100%"** in the WinGauge legend and
 * **"99.95%"** on the option card directly beneath it — two different claims
 * about ONE number, both on screen at once, one of them asserting a certainty
 * the simulation never measured.
 *
 * WHY, AT THE BYTES. `formatProbabilityWithResolution` has two arms:
 *   · `nSamples` present  → the resolution ladder; 0.9995 → "99.95%"
 *   · `nSamples` null     → `formatPercent(v, {fromDecimal:true})`, i.e.
 *                           `Math.round(99.95)` → "100%"
 * The option card passed `option.nValidSamples`; the gauge passed a literal
 * `null` at BOTH its comparative call sites (the legend readout and the stacked
 * segment's `aria-label`).
 *
 * WHICH CLAIM IS HONEST — DERIVED, NOT CHOSEN
 * -------------------------------------------
 * The legend does not "genuinely lack" a sample count. `OptionWinShare` already
 * declares `nValidSamples` (ROADMAP 2.334, added so the GOAL rows could resolve),
 * `ResultsBody` already populates it from the SAME `OptionResult.nValidSamples`
 * the card reads, and the goal block one block above already uses it. The count
 * was in the props, in scope, one identifier away — the comparative call sites
 * simply never took it.
 *
 * So the honest arm is the resolution arm, and the fix is to take it at every
 * comparative call site in the gauge. The alternative (make the card drop to
 * the rounding arm) would DELETE a measurement the run actually supports and
 * would reintroduce the "100%" over-claim on the card too.
 *
 * THE FIXTURE DISCRIMINATES — AND SAYS SO IN-TEST
 * ----------------------------------------------
 * 0.9995 at n=10000 is chosen because the two arms DISAGREE there (the #623
 * lane's 0.995 pattern). A parity assertion on a value where both arms return
 * the same string is a guard agreeing with itself (CLAUDE.md trap 13b), and it
 * would stay green with the defect fully restored. The first test therefore
 * PINS ITS OWN PRECONDITION: it asserts the arms disagree on this exact input
 * before any parity claim is made, so a later change that flattens the ladder
 * cannot silently hollow the rest of this file out.
 *
 * #2747 re-scope 2 (U0, DL ruling (A)): WinGauge is deleted and the option card shows no win share in C. The formatter's
 * own arm pins stay; the gauge-only rows are deleted; the card rows now pin, by identity, that no share is printed.
 */

import { describe, it, expect } from 'vitest'
import { render, within } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { formatProbabilityWithResolution } from '../../../utils/formatPercent'
import type { OptionResult } from '../types'

/** The run under test: one near-certain leader, one near-zero challenger. */
const N_VALID_SAMPLES = 10000
const LEADER_WIN = 0.9995
const CHALLENGER_WIN = 0.0005

const LEADER: OptionResult = {
  id: 'opt-leader',
  label: 'Leader',
  expected: 50,
  outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
  p10: 20,
  p50: 50,
  p90: 80,
  isRecommended: true,
  winProbability: LEADER_WIN,
  nValidSamples: N_VALID_SAMPLES,
  rank: 1,
}

const CHALLENGER: OptionResult = {
  ...LEADER,
  id: 'opt-challenger',
  label: 'Challenger',
  isRecommended: false,
  winProbability: CHALLENGER_WIN,
  rank: 2,
}

describe('ROADMAP 2.928 (c) — the fixture actually discriminates the two arms', () => {
  it('0.9995 renders DIFFERENTLY on the two arms, so parity below is not vacuous', () => {
    const roundingArm = formatProbabilityWithResolution(LEADER_WIN, null)
    const resolutionArm = formatProbabilityWithResolution(LEADER_WIN, N_VALID_SAMPLES)

    // Named, so a change to either arm fails HERE with the reason, rather than
    // quietly turning every parity test below into a tautology.
    // R3 5903852225: the ceiling mirrors the floor — a value below 1 never prints "100%".
    expect(roundingArm).toBe('> 99%')
    expect(resolutionArm).toBe('99.95%')
    expect(roundingArm).not.toBe(resolutionArm)
  })

  it('the rounding arm no longer over-claims: a value below 1 reads "> 99%", never "100%"', () => {
    // R3 5903852225: the ceiling mirrors the floor — a value below 1 never prints "100%".
    expect(LEADER_WIN).toBeLessThan(1)
    expect(formatProbabilityWithResolution(LEADER_WIN, null)).toBe('> 99%')
  })
})

describe('ROADMAP 2.928 (c) — the option card states NO win share at either arm (#2747 re-scope 2)', () => {
  // #2747 re-scope 2 (U0, DL ruling (A)): was 'the legend readout equals the option card readout for the same option';
  // the legend went with WinGauge and the card prints no share in C, so neither arm's string reaches the card.
  it('the option card prints no win readout for the near-certain leader (no 99.95%, no > 99%, no 100%)', () => {
    const cards = render(<OptionCards options={[LEADER, CHALLENGER]} winnerId={LEADER.id} />)

    expect(within(cards.container).queryByTestId(`win-pct-${LEADER.id}`)).toBeNull()
    const card = within(cards.container).getByTestId(`option-card-${LEADER.id}`).textContent ?? ''
    expect(card).not.toContain('99.95%')
    expect(card).not.toContain('> 99%')
    expect(card).not.toContain('100%')
  })

  // #2747 re-scope 2 (U0, DL ruling (A)): was 'the challenger row takes the same arm too (below-resolution, not floored)'.
  it('the option card prints no win readout for the challenger either (no 0.1%, no < 1%)', () => {
    const cards = render(<OptionCards options={[LEADER, CHALLENGER]} winnerId={LEADER.id} />)

    expect(within(cards.container).queryByTestId(`win-pct-${CHALLENGER.id}`)).toBeNull()
    const card = within(cards.container).getByTestId(`option-card-${CHALLENGER.id}`).textContent ?? ''
    expect(card).not.toContain('0.1%')
    expect(card).not.toContain('< 1%')
  })

  // #2747 re-scope 2 (DL ruling (A)): rows deleted — their only subject, WinGauge, was removed in C:
  //   'the legend does not claim 100% for the near-certain leader';
  //   'the stacked segment aria-label states the legend string, not a second evaluation';
  //   'the segment aria-label equals the option card readout' (its card half is pinned absent above);
  //   'a run with no nValidSamples still renders the legacy rounding on both surfaces';
  //   'the rounding note still renders when every readout is a whole percent';
  //   'the rounding note stands down when the resolution ladder emits decimals';
  //   'the legend readout comes from the comparative block, not some other surface'.
})
