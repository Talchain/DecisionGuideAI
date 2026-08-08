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
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { WinGauge } from '../WinGauge'
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

const SHARES = [LEADER, CHALLENGER].map((o) => ({
  id: o.id,
  label: o.label,
  winProbability: o.winProbability as number,
  isWinner: o.isRecommended === true,
  nValidSamples: o.nValidSamples,
}))

/**
 * The stacked segment's accessible name, bound to its option by that option's
 * own label — never by the value under test, which another segment could match.
 */
function segmentAriaFor(container: HTMLElement, label: string): string {
  const seg = container.querySelector(`[role="img"][aria-label^="${label}: "]`)
  expect(seg, `no stacked segment for "${label}"`).not.toBeNull()
  return seg!.getAttribute('aria-label')!.slice(`${label}: `.length)
}

describe('ROADMAP 2.928 (c) — the fixture actually discriminates the two arms', () => {
  it('0.9995 renders DIFFERENTLY on the two arms, so parity below is not vacuous', () => {
    const roundingArm = formatProbabilityWithResolution(LEADER_WIN, null)
    const resolutionArm = formatProbabilityWithResolution(LEADER_WIN, N_VALID_SAMPLES)

    // Named, so a change to either arm fails HERE with the reason, rather than
    // quietly turning every parity test below into a tautology.
    expect(roundingArm).toBe('100%')
    expect(resolutionArm).toBe('99.95%')
    expect(roundingArm).not.toBe(resolutionArm)
  })

  it('the rounding arm is the one that over-claims: it says 100% of a value below 1', () => {
    expect(LEADER_WIN).toBeLessThan(1)
    expect(formatProbabilityWithResolution(LEADER_WIN, null)).toBe('100%')
  })
})

describe('ROADMAP 2.928 (c) — WinGauge and OptionCards state the SAME string', () => {
  it('the legend readout equals the option card readout for the same option', () => {
    const gauge = render(<WinGauge shares={SHARES} decisionState="robust" />)
    const cards = render(<OptionCards options={[LEADER, CHALLENGER]} winnerId={LEADER.id} />)

    const legend = within(gauge.container).getByTestId(`legend-pct-${LEADER.id}`).textContent
    const card = within(cards.container).getByTestId(`win-pct-${LEADER.id}`).textContent

    expect(legend).toBe(card)
    expect(legend).toBe('99.95%')
  })

  it('the legend does not claim 100% for the near-certain leader', () => {
    const { container } = render(<WinGauge shares={SHARES} decisionState="robust" />)
    const legend = within(container).getByTestId(`legend-pct-${LEADER.id}`).textContent
    expect(legend).not.toBe('100%')
  })

  it('the challenger row takes the same arm too (below-resolution, not floored)', () => {
    const gauge = render(<WinGauge shares={SHARES} decisionState="robust" />)
    const cards = render(<OptionCards options={[LEADER, CHALLENGER]} winnerId={LEADER.id} />)

    const legend = within(gauge.container).getByTestId(`legend-pct-${CHALLENGER.id}`).textContent
    const card = within(cards.container).getByTestId(`win-pct-${CHALLENGER.id}`).textContent

    expect(legend).toBe(card)
    // The resolution ladder's smallest non-collapsing precision for 0.0005.
    // At pristine the legend said "< 1%" here while the card said "0.1%" —
    // the same split as the leader row, at the other end of the scale.
    expect(legend).toBe('0.1%')
  })
})

describe('ROADMAP 2.928 (c) — the screen-reader channel takes the same arm', () => {
  it('the stacked segment aria-label states the legend string, not a second evaluation', () => {
    const { container } = render(<WinGauge shares={SHARES} decisionState="robust" />)

    const aria = segmentAriaFor(container, 'Leader')
    const legend = within(container).getByTestId(`legend-pct-${LEADER.id}`).textContent

    // The sighted and the screen-reader channel must not disagree about a
    // probability. Before this row they did: "100%" spoken, "99.95%" printed.
    expect(aria).toBe(legend)
    expect(aria).toBe('99.95%')
  })

  it('the segment aria-label equals the option card readout', () => {
    const gauge = render(<WinGauge shares={SHARES} decisionState="robust" />)
    const cards = render(<OptionCards options={[LEADER, CHALLENGER]} winnerId={LEADER.id} />)

    expect(segmentAriaFor(gauge.container, 'Leader')).toBe(
      within(cards.container).getByTestId(`win-pct-${LEADER.id}`).textContent,
    )
  })
})

describe('ROADMAP 2.928 (c) — the fallback arm is preserved where the count is genuinely absent', () => {
  it('a run with no nValidSamples still renders the legacy rounding on both surfaces', () => {
    const noCount = SHARES.map((s) => ({ ...s, nValidSamples: null, winProbability: 0.65 }))
    const { container } = render(<WinGauge shares={noCount} decisionState="robust" />)

    // 0.65 is unambiguous on either arm; the point of this case is that a
    // missing count does not throw and does not invent a resolution.
    expect(within(container).getByTestId(`legend-pct-${LEADER.id}`).textContent).toBe('65%')
  })

  it('the rounding note still renders when every readout is a whole percent', () => {
    const wholes = [
      { ...SHARES[0], winProbability: 0.333, nValidSamples: N_VALID_SAMPLES },
      { ...SHARES[1], winProbability: 0.333, nValidSamples: N_VALID_SAMPLES },
    ]
    const { container } = render(<WinGauge shares={wholes} decisionState="robust" />)
    // 33% + 33% = 66% ≠ 100 ⇒ the note is derivable and must still appear.
    expect(within(container).getByTestId('option-odds-rounding-note')).toBeInTheDocument()
  })

  it('the rounding note stands down when the resolution ladder emits decimals', () => {
    const { container } = render(<WinGauge shares={SHARES} decisionState="robust" />)
    // "99.95%" carries decimals ⇒ `deriveOddsRoundingNote` returns null by
    // design (no whole-percent total is derivable). Fail-closed, unchanged.
    expect(within(container).queryByTestId('option-odds-rounding-note')).toBeNull()
  })
})

describe('ROADMAP 2.928 (c) — mount-path pin', () => {
  it('the legend readout comes from the comparative block, not some other surface', () => {
    const { container } = render(<WinGauge shares={SHARES} decisionState="robust" />)
    const block = screen.getByTestId('win-gauge-comparative-block')
    // Binds the guard to the MOUNT PATH: if the legend moves out of the
    // comparative block, this fails loud rather than passing on a stray node.
    expect(block.contains(within(container).getByTestId(`legend-pct-${LEADER.id}`))).toBe(true)
  })
})
