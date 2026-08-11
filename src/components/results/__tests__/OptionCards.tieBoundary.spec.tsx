/**
 * OptionCards — the near-tie predicate, at its BOUNDARY and on BOTH arms.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * The runner-up arm and the other-non-winner arm of `hingeAwareDescription`
 * carried byte-identical five-line blocks. They are now one helper
 * (`tiedOrWithheld`) called from both. That dedup is only safe if two things
 * are pinned, and NEITHER was pinned anywhere in the repo before this file:
 *
 *   1. THE BOUNDARY IS `Math.round(diff * 100) > 0`, NOT `diff > 0`. They are
 *      different predicates: a raw difference of +0.002 is a positive `diff`
 *      and a ROUNDED gap of ZERO — a tie at the precision the card displays.
 *      Rounding first is what makes this sentence agree with the two
 *      percentages printed beside it. The pre-existing corpus could not tell
 *      the two apart: its only fixture is 0.66 vs 0.314, where the raw and
 *      rounded answers agree, so `diff > 0` passed every existing spec.
 *
 *   2. BOTH ARMS still produce it. A single shared helper is a REGRESSION if
 *      one caller stops reaching it — and "both arms move together" is the
 *      whole reason the 10 Aug retirement changed them in one commit ("leaving
 *      either one would keep the banned quantity on screen for a different
 *      slice of the option list"). Each arm therefore gets its own case, so a
 *      mutation that breaks ONE caller reds ONE test (trap 19: bind to the
 *      object, and prove the binding with a discriminating pair).
 *
 * ── WHAT THIS FILE IS NOT ─────────────────────────────────────────────────
 * It is not a claim that the tie copy is the RIGHT copy — that is adjudicated
 * in ROADMAP 1.223/1.239 and pinned by `ownedLeaderClaim.optionCards.spec.tsx`,
 * which asserts these sentences are ABSENT on a withheld turn. That absence
 * suite is why the arms' positive content was never covered: a forbidden-string
 * list gets safer, never redder, when the string changes.
 *
 * CLAUDE.md trap 3: this asserts presence/absence of TEXT and DOM structure.
 * jsdom cannot prove visibility and nothing here claims it does.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

const WINNER_ID = 'opt_mac'
const OTHER_ID = 'opt_dell'

/** The exact sentence, spelled out — a regex would survive a truncation. */
const TIE_SENTENCE = 'Statistically tied with the leading option'

/**
 * THE BOUNDARY PAIR. Both have a strictly POSITIVE raw difference; they differ
 * only in whether it survives rounding to whole percentage points.
 */
const TIE = { winner: 0.662, other: 0.66 } // raw +0.002 → rounds to 0pp
const AHEAD = { winner: 0.67, other: 0.66 } // raw +0.010 → rounds to 1pp

function opts(winnerWin: number, otherWin: number): OptionResult[] {
  return [
    {
      id: WINNER_ID,
      label: 'Standardise on MacBook Pro',
      winProbability: winnerWin,
      isRecommended: true,
      expected: 68,
      outcome: { mean: 68, p10: 54, p50: 67, p90: 82 },
    },
    {
      id: OTHER_ID,
      label: 'Standardise on Dell XPS',
      winProbability: otherWin,
      isRecommended: false,
      expected: 41,
      outcome: { mean: 41, p10: 30, p50: 40, p90: 52 },
    },
  ] as unknown as OptionResult[]
}

/**
 * `runnerId` is what selects the ARM: passing it routes the non-winner through
 * the runner-up branch, omitting it routes the same card through the
 * other-non-winner branch. Everything else is held identical, so a difference
 * between the two cases can only come from the arm.
 */
function renderCards(pair: { winner: number; other: number }, runnerId?: string) {
  return render(
    <OptionCards
      options={opts(pair.winner, pair.other)}
      winnerId={WINNER_ID}
      runnerId={runnerId}
      hasLeadingOption
      confidenceTier={'fair' as never}
      recommendationStability={0.5}
      onSendMessage={() => {}}
    />,
  )
}

const cardOf = (container: HTMLElement, id: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-testid="option-card-${id}"]`)
  if (!el) throw new Error(`option-card-${id} did not render`)
  return el
}

const paragraphsOf = (container: HTMLElement, id: string): string[] =>
  Array.from(cardOf(container, id).querySelectorAll('p')).map((p) => p.textContent ?? '')

describe('the fixtures pin their own precondition', () => {
  /**
   * Trap 13b: a boundary test whose fixture silently stops straddling the
   * boundary keeps passing while testing nothing. Both facts are asserted here
   * rather than trusted, because they are the ONLY reason the cases below
   * discriminate `Math.round(diff * 100) > 0` from `diff > 0`.
   */
  it('the TIE pair has a strictly positive RAW difference that rounds to zero', () => {
    expect(TIE.winner - TIE.other).toBeGreaterThan(0)
    expect(Math.round((TIE.winner - TIE.other) * 100)).toBe(0)
  })

  it('the AHEAD pair rounds to a positive gap — so the two cases differ', () => {
    expect(Math.round((AHEAD.winner - AHEAD.other) * 100)).toBeGreaterThan(0)
  })

  it('POSITIVE CONTROL: both cards render on both pairs', () => {
    for (const pair of [TIE, AHEAD]) {
      const { container, unmount } = renderCards(pair, OTHER_ID)
      expect(cardOf(container, WINNER_ID)).toBeDefined()
      expect(cardOf(container, OTHER_ID)).toBeDefined()
      unmount()
    }
  })
})

describe('the near-tie sentence fires at the ROUNDED boundary, on both arms', () => {
  it('RUNNER-UP arm: a lead that rounds to 0pp reads as a tie', () => {
    const { container } = renderCards(TIE, OTHER_ID)
    expect(paragraphsOf(container, OTHER_ID)).toContain(TIE_SENTENCE)
  })

  it('OTHER-NON-WINNER arm: the same lead reads as the same tie', () => {
    const { container } = renderCards(TIE, undefined)
    expect(paragraphsOf(container, OTHER_ID)).toContain(TIE_SENTENCE)
  })

  it('RUNNER-UP arm: a lead that rounds to 1pp is WITHHELD, not called a tie', () => {
    const { container } = renderCards(AHEAD, OTHER_ID)
    expect(paragraphsOf(container, OTHER_ID)).not.toContain(TIE_SENTENCE)
  })

  it('OTHER-NON-WINNER arm: a lead that rounds to 1pp is WITHHELD too', () => {
    const { container } = renderCards(AHEAD, undefined)
    expect(paragraphsOf(container, OTHER_ID)).not.toContain(TIE_SENTENCE)
  })
})

describe("the withhold idiom is SILENCE, not a substitute sentence", () => {
  /**
   * `''` means the caller renders no paragraph at all (`{description ? … :
   * null}`), which is the difference between withholding a claim and making a
   * different one. Asserting the sentence's absence cannot see that: ANY
   * replacement string would also fail to match `TIE_SENTENCE`. Comparing the
   * paragraph COUNT can, and does.
   */
  for (const [arm, runnerId] of [
    ['runner-up', OTHER_ID],
    ['other-non-winner', undefined],
  ] as const) {
    it(`${arm} arm: the withheld card renders exactly one paragraph FEWER`, () => {
      const tie = renderCards(TIE, runnerId)
      const tieParagraphs = paragraphsOf(tie.container, OTHER_ID)
      tie.unmount()

      const ahead = renderCards(AHEAD, runnerId)
      const aheadParagraphs = paragraphsOf(ahead.container, OTHER_ID)
      ahead.unmount()

      // The tie render must actually have produced the extra paragraph, or the
      // count comparison below is comparing two nothings (trap 13).
      expect(tieParagraphs).toContain(TIE_SENTENCE)
      expect(aheadParagraphs).toHaveLength(tieParagraphs.length - 1)
    })
  }
})
