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
}

afterEach(cleanup)

describe('one row, one action treatment', () => {
  it('⛔ PRECONDITION — the tier is a real, non-empty class list', () => {
    // Without this, every assertion below passes vacuously on an empty array.
    expect(INLINE.length).toBeGreaterThan(1)
    expect(INLINE).toContain('text-info')
  })

  it('⭐ every control in the row carries the SAME named tier', () => {
    render(
      <DisclosureRow
        finding={finding}
        testIdPrefix="row"
        onFocusTarget={vi.fn()}
        onReviewTarget={vi.fn()}
      />,
    )
    /**
     * ⚠ `fireEvent`, NOT `.click()`. A bare DOM click does not run React's
     * synthetic handler here, so the row stayed closed and every assertion
     * below had nothing to read — which the precondition caught rather than
     * letting the test pass on an empty set.
     */
    fireEvent.click(screen.getByTestId('row-row-toggle'))

    const controls = ['row-focus', 'row-review', 'row-inspect-toggle']
    const found = controls.filter((t) => screen.queryByTestId(t) !== null)
    expect(found.length, 'precondition: the controls this asserts about are on screen').toBeGreaterThanOrEqual(2)

    for (const testId of found) {
      const el = screen.getByTestId(testId)
      for (const token of INLINE) {
        expect(
          el.className.split(' '),
          `${testId} must carry the tier's ${token}: four controls in one row with two colours is what shipped`,
        ).toContain(token)
      }
    }
  })
})
