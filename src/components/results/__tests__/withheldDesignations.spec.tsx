/**
 * WITHHELD RUNS MAY NOT DESIGNATE — comparator + ranked card repeat.
 *
 * `ownedLeaderClaim.surfaces.spec.ts` pins the PROSE: on a withheld turn no
 * surface may SAY "X leads". This file and its hero sibling
 * (`../analysis-hero/__tests__/withheldDesignations.hero.spec.tsx`) pin
 * everything that designates a leader WITHOUT saying so — the channels a
 * string matcher cannot see:
 *
 *   · ORDER      — probability-descending sort IS a claim about who is first
 *   · ORDINALS   — the rank swatch is `rank == 1` wearing a colour
 *   · CROWN      — the success border on exactly one card
 *   · A11Y       — any designation reaching a screen reader
 *
 * ## The doctrine this APPLIES (it does not invent it)
 *
 * ROADMAP 1.267, ruled 27 Jul and ratified as Codex decision (1) in row
 * 1.306: computed probabilities are DATA the user is entitled to; `rank == 1`,
 * probability-descending order, ordinals, crowns and accessible "highest"
 * labels are DESIGNATIONS — claims wearing numbers. On a withheld run the
 * DATA stays and the DESIGNATIONS go. CEE PR #719 already applied exactly
 * this ruling on the producer side (`rank` gated, `options[]` order
 * canonicalised, probabilities kept). This is the consumer half.
 *
 * ## The over-suppression control is not optional
 *
 * Every WITHHELD case has a PERMITTED twin asserting today's behaviour
 * unchanged. A change that silences the withheld turn by deleting the data
 * is a failure, not a fix — it would cost the user the computed facts the
 * ruling explicitly protects.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * jsdom proves DOM order, accessible names and presence. It cannot prove
 * layout or visual order. The visual leg is the browser walk at
 * `acceptance-evidence/withheld-designations-20260727/walk-withheld-designations.mjs`.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
import OptionCards from '../OptionCards'
import {
  CANONICAL_IDS,
  CANONICAL_LABELS,
  DESIGNATION_RE,
  HIGH_ID,
  LOW_ID,
  MID_ID,
  PERMITTED_VERDICT,
  PROBABILITY_LABELS,
  WIN_HIGH,
  WIN_LOW,
  WIN_MID,
  WITHHELD_VERDICT,
  renderedRowIds,
  screenReaderStrings,
  withheldFixtureOptions as options,
} from '../__fixtures__/withheldDesignations.fixtures'

/**
 * Anti-vacuity: this whole file is about the difference between the two
 * verdicts and the two orders. If either pair ever stops differing, every
 * assertion below starts passing for the wrong reason.
 */
describe('the fixture pair actually discriminates', () => {
  it('withholds on one and permits on the other', () => {
    expect(WITHHELD_VERDICT.hasLeadingOption).toBe(false)
    expect(PERMITTED_VERDICT.hasLeadingOption).toBe(true)
  })

  it('canonical order is not probability order (the order leg can go red)', () => {
    expect([...CANONICAL_LABELS]).not.toEqual([...PROBABILITY_LABELS])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 1 — the shared comparator (`sortOptionsForDisplay`)
//
// Every option list on the results path funnels through this one function,
// so it is where the ORDER designation is authored.
// ─────────────────────────────────────────────────────────────────────────────

describe('sortOptionsForDisplay — order is a designation', () => {
  it('WITHHELD: preserves canonical order (no probability sort)', () => {
    const sorted = sortOptionsForDisplay(options(), { designationsWithheld: true })
    expect(sorted.map((o) => o.id)).toEqual([...CANONICAL_IDS])
  })

  it('PERMITTED: sorts by win probability descending, exactly as today', () => {
    const sorted = sortOptionsForDisplay(options(), { designationsWithheld: false })
    expect(sorted.map((o) => o.label)).toEqual([...PROBABILITY_LABELS])
  })

  it('WITHHELD: every option and every probability survives (data preserved)', () => {
    const sorted = sortOptionsForDisplay(options(), { designationsWithheld: true })
    // Compared id-keyed, so this leg is about DATA and cannot pass or fail
    // for an ordering reason — that is the assertion above.
    expect(Object.fromEntries(sorted.map((o) => [o.id, o.winProbability]))).toEqual({
      [LOW_ID]: WIN_LOW,
      [MID_ID]: WIN_MID,
      [HIGH_ID]: WIN_HIGH,
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 2 — the ranked card repeat beneath the explanation (OptionCards)
// ─────────────────────────────────────────────────────────────────────────────

function renderCards(verdict: typeof WITHHELD_VERDICT) {
  return render(
    <OptionCards
      options={options()}
      winnerId={HIGH_ID}
      hasLeadingOption={verdict.hasLeadingOption}
      hasGoalThreshold={false}
    />,
  )
}

describe('OptionCards — the ranked repeat', () => {
  it('WITHHELD: cards follow canonical order', () => {
    const { container } = renderCards(WITHHELD_VERDICT)
    // Truncated to the top 2 by the existing "Show all" affordance; the
    // point is WHICH two and in what order, not how many.
    expect(renderedRowIds(container).slice(0, 2)).toEqual([LOW_ID, MID_ID])
  })

  it('WITHHELD: renders no rank marker', () => {
    const { container } = renderCards(WITHHELD_VERDICT)
    expect(container.querySelectorAll('[data-testid^="rank-marker-"]')).toHaveLength(0)
  })

  it('WITHHELD: renders no crowned (success) border on any card', () => {
    const { container } = renderCards(WITHHELD_VERDICT)
    expect(container.querySelectorAll('[class*="border-success"]')).toHaveLength(0)
  })

  /**
   * DATA PRESERVED. The win-probability fill bar is gated on
   * `segmentFillColor`, so neutralising the colour by dropping it would have
   * deleted the bar outright — the over-suppression failure this asserts
   * against.
   */
  it('WITHHELD: still renders the win-probability bar for each visible card', () => {
    const { container } = renderCards(WITHHELD_VERDICT)
    expect(
      container.querySelectorAll('[title^="Win probability:"]').length,
    ).toBeGreaterThan(0)
  })

  /**
   * Disclosed as a REGRESSION PIN, not a RED leg: this already passed on the
   * unfixed tree, because the "Highest leading-option likelihood" strings in
   * `hingeAwareDescription` need a `decisionState`/`hinge` this fixture does
   * not supply, and #493/#494 gate them anyway. Kept so a future card cannot
   * reintroduce a spoken designation unnoticed.
   */
  it('WITHHELD: exposes no designation to a screen reader', () => {
    const { container } = renderCards(WITHHELD_VERDICT)
    for (const s of screenReaderStrings(container)) {
      expect(s, `screen-reader string leaked a designation: "${s}"`).not.toMatch(
        DESIGNATION_RE,
      )
    }
  })

  it('PERMITTED: cards follow probability order and keep their rank markers', () => {
    const { container } = renderCards(PERMITTED_VERDICT)
    expect(renderedRowIds(container).slice(0, 2)).toEqual([HIGH_ID, MID_ID])
    expect(
      container.querySelectorAll('[data-testid^="rank-marker-"]').length,
    ).toBeGreaterThan(0)
  })

  it('PERMITTED: still crowns the leading card', () => {
    const { container } = renderCards(PERMITTED_VERDICT)
    expect(
      container.querySelectorAll('[class*="border-success"]').length,
    ).toBeGreaterThan(0)
  })
})
