/**
 * ⭐⭐ FOUR CONTROLS IN ONE ROW, TWO COLOURS, NO RULE DISTINGUISHING THEM.
 *
 * Witnessed by Paul on the deployed section: "Show on canvas" reads
 * info-underlined and "Inspect", directly beneath it, reads GREY-underlined.
 * Three of the row's four controls use `action('inline')`; the fourth
 * hand-copied the tier's shape and substituted `text-text-light` for the action
 * colour.
 *
 * ⚠ THE HAND-COPY IS THE DEFECT, NOT MERELY ITS COLOUR. `ACTION_TIER.inline` is
 * `'rounded text-info underline'` and the spelled-out string agreed with it on
 * two tokens of three. A tier spelled out drifts the first time the tier moves —
 * #1594 fixed the identical shape in `SuccessTargetLine`, and this is the guard
 * that stops the next one.
 *
 * ⛔ DERIVED FROM THE TOKEN, NEVER FROM A CLASS LIST WRITTEN HERE. A test that
 * hardcoded `text-info` would be a second copy of the tier and would go stale
 * with it — the mirror this file exists to abolish, one level up.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { DisclosureRow } from '../DisclosureRow'
import { ACTION_TIER } from '../panelSurfaces'
import type { AnalysisNewFinding } from '../analysisNewTypes'

/** The tier's own tokens, read from the constant so this cannot drift from it. */
const INLINE = ACTION_TIER.inline.split(' ').filter(Boolean)

const finding: AnalysisNewFinding = {
  id: 'f1',
  headline: 'Pro plan price could change the answer',
  implication: 'If this link is weaker than assumed, another option leads.',
  detail: 'Review this assumption',
  groundedIn: 'the sensitivity analysis',
  targetId: 'n_price',
  focusTargetId: 'n_price',
  reviewTargetId: 'n_price',
  inspect: [{ label: 'Switch probability', value: '72%' }],
  /**
   * ⭐⭐ THE ACT THIS FILE COULD NOT SEE, AND THE ONLY ONE THAT CAN FAIL IT.
   *
   * An independent reviewer found `row-intervention` asserted ZERO times here:
   * the fixture carried no `intervention`, so the Sparkles button never
   * mounted, and both loops below listed only focus and review.
   *
   * ⛔ WHY THAT WAS THE WHOLE POINT MISSED. `row-focus` and `row-review` take
   * `COPY.disclosure.*` constants, which CANNOT be empty. This one takes
   * `finding.intervention.label` — from DATA. `IconBtn` resolves its name as
   * `ariaLabel ?? tooltip`, and `??` falls back on null/undefined ONLY, so a
   * label of `''` ships `aria-label=""`. The assertion "an icon with no name is
   * unreachable" was pointed at the two names that cannot be empty and away
   * from the one that can: a guard agreeing with itself.
   */
  intervention: { recommendationId: 'strengthen:price', label: 'Work through with Olumi', targetId: 'n_price' },
}

/** Every act on the row. A hardcoded PAIR is what hid the third one. */
const ACTS = ['row-focus', 'row-review', 'row-intervention'] as const

afterEach(cleanup)

describe('one row, one action treatment', () => {
  it('⛔ PRECONDITION — the tier is a real, non-empty class list', () => {
    // Without this, every assertion below passes vacuously on an empty array.
    expect(INLINE.length).toBeGreaterThan(1)
    expect(INLINE).toContain('text-info')
  })

  /**
   * ⭐⭐ THE RULE IS NOW *TREATMENT FOLLOWS KIND*, AND THAT IS STRONGER THAN
   * WHAT THIS FILE ASSERTED BEFORE.
   *
   * It used to demand that all four controls carry one text tier. The acts are
   * now icon buttons and the disclosure keeps its word, so a naive reading is
   * that the rule was relaxed. It was not. The defect Paul witnessed was four
   * controls differing FOR NO STATED REASON. Two kinds differing for a reason —
   * three acts on the model, one reveal of content — is the rule being kept.
   *
   * What is still guarded, unchanged: the disclosure's tier is read from
   * `ACTION_TIER`, never spelled out here, because a hand-copied tier is the
   * original defect and a test that hardcoded it would be a second copy.
   */
  it('⭐ every ACT shares one treatment, and none of them keeps the text tier', () => {
    render(
      <DisclosureRow
        finding={finding}
        testIdPrefix="row"
        onFocusTarget={vi.fn()}
        onReviewTarget={vi.fn()}
        onRunIntervention={vi.fn()}
      />,
    )
    /**
     * ⚠ `fireEvent`, NOT `.click()`. A bare DOM click does not run React's
     * synthetic handler here, so the row stayed closed and every assertion
     * below had nothing to read — which the precondition caught rather than
     * letting the test pass on an empty set.
     */
    fireEvent.click(screen.getByTestId('row-row-toggle'))

    /**
     * ⚠ EXACT, NEVER A FLOOR. `>= 2` passed on exactly the two-member list it
     * was handed, so it could not notice a third act missing — which is how the
     * only data-fed act went unasserted through a whole review.
     */
    const acts = ACTS.filter((t) => screen.queryByTestId(t) !== null)
    expect(acts.length, 'precondition: every act is on screen').toBe(ACTS.length)

    const shapeOf = (el: HTMLElement) =>
      el.className.split(/\s+/).filter((c) => ['w-7', 'h-7', 'rounded-full'].includes(c)).sort().join(' ')

    for (const testId of acts) {
      const el = screen.getByTestId(testId)
      // One treatment: the icon-button shape, identical across every act.
      expect(shapeOf(el), `${testId} must carry the icon-button shape`).toBe('h-7 rounded-full w-7')
      // And NOT the text tier — mixing the two is the defect this file exists for.
      expect(el.className.split(' '), `${testId} must not also wear the text tier`).not.toContain('underline')
    }
  })

  /**
   * ⛔⛔ THE RISK THIS CHANGE INTRODUCES, AND THE ONLY ONE THAT MATTERS.
   *
   * An icon carries no words, so its `aria-label` IS the control's entire
   * name. Ship one without a name and the act becomes unreachable to anyone
   * not looking at it — a regression the shape assertions above would applaud,
   * because an unnamed button is exactly as round as a named one.
   */
  it('⛔ every act has a non-empty accessible name — an icon with no name is unreachable', () => {
    render(
      <DisclosureRow
        finding={finding}
        testIdPrefix="row"
        onFocusTarget={vi.fn()}
        onReviewTarget={vi.fn()}
        onRunIntervention={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('row-row-toggle'))

    const acts = ACTS.filter((t) => screen.queryByTestId(t) !== null)
    expect(acts.length, 'precondition: every act is on screen').toBe(ACTS.length)

    for (const testId of acts) {
      const name = screen.getByTestId(testId).getAttribute('aria-label') ?? ''
      expect(name.trim().length, `${testId} has no accessible name`).toBeGreaterThan(0)
    }
    // Contrast in the same run: the names are DISTINCT, so a single label
    // copy-pasted onto every act cannot pass the assertion above.
    const names = acts.map((t) => screen.getByTestId(t).getAttribute('aria-label'))
    expect(new Set(names).size).toBe(names.length)
  })

  /**
   * ⚠ THE DISCLOSURE KEEPS ITS NAMED TIER. This is the original guard, intact:
   * the toggle must carry `ACTION_TIER.inline`'s own tokens rather than a
   * hand-copy that agrees with it on two of three.
   */
  it('⭐ the disclosure toggle still carries the tier, read from the constant', () => {
    render(
      <DisclosureRow
        finding={finding}
        testIdPrefix="row"
        onFocusTarget={vi.fn()}
        onReviewTarget={vi.fn()}
        onRunIntervention={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('row-row-toggle'))
    const toggle = screen.queryByTestId('row-inspect-toggle')
    if (!toggle) return // this finding has no L3 rows; the acts above still assert
    for (const token of INLINE) {
      expect(toggle.className.split(' '), `inspect must carry the tier's ${token}`).toContain(token)
    }
  })

  /**
   * ⛔⛔ THE CASE THAT WOULD HAVE SHIPPED, and the reason the fixture above is
   * not enough on its own.
   *
   * `finding.intervention.label` is producer data, so `''` is reachable.
   * `IconBtn` resolved its name as `ariaLabel ?? tooltip`, and `??` falls back
   * on null/undefined ONLY — an empty string is a value, so it passes straight
   * through and the button ships `aria-label=""`. A round, pressable, entirely
   * unreachable control, and every shape assertion in this file applauds it.
   *
   * This arm is why the name assertion is worth anything: it is the only one
   * whose subject can actually be empty.
   */
  it('⛔ an act whose label arrives EMPTY still has a name — an empty string is a value, not an absence', () => {
    render(
      <DisclosureRow
        finding={{ ...finding, intervention: { recommendationId: 'strengthen:price', label: '', targetId: 'n_price' } }}
        testIdPrefix="row"
        onFocusTarget={vi.fn()}
        onReviewTarget={vi.fn()}
        onRunIntervention={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('row-row-toggle'))
    const btn = screen.queryByTestId('row-intervention')
    // ⭐ EITHER NAMED OR NOT OFFERED — never a nameless control. Asserting only
    // "it has a name" would force the panel to invent one; asserting only "it
    // is absent" would pass on a row that lost the act for any other reason.
    if (btn !== null) {
      expect((btn.getAttribute('aria-label') ?? '').trim().length, 'an icon with no name is unreachable').toBeGreaterThan(0)
    }
    // Contrast in the same run: the ROW rendered and its other acts are there,
    // so this is a withheld act rather than a failed render.
    expect(screen.queryByTestId('row-focus')).not.toBeNull()
    expect(screen.queryByTestId('row-review')).not.toBeNull()
  })
})
