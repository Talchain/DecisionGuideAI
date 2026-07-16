/**
 * Shared vocabulary for "what counts as a control that reruns the analysis".
 *
 * Lane C1 doctrine (brief §5 / §2.2) is that exactly ONE surface owns the
 * Rerun per viewport. Several specs across the results + canvas trees pin
 * pieces of that, and they must all agree on what a rerun control IS —
 * otherwise a control reintroduced under a name one spec doesn't know about
 * slips through while every suite stays green.
 *
 * This module exists because the first cut of those pins did exactly that:
 *
 *  - the dock spec matched only the literal /rerun|re-run/, so a control
 *    reintroduced as "Run again" or "Refresh analysis" would have passed; and
 *  - five specs asserted `queryByTestId('hero-rerun')` was absent, but that
 *    testid exists NOWHERE in source — so they asserted the absence of
 *    something that could never be present, and could never fail. A pin that
 *    cannot fail is not a pin.
 *
 * Anchor new pins to `collectRerunControls` rather than to a bare testid, and
 * keep this file the single place the vocabulary is edited.
 */

import { within } from '@testing-library/react'

/**
 * Accessible names a rerun control could plausibly carry. Deliberately wide:
 * the cost of a false positive is a loud test telling you to look, while the
 * cost of a false negative is a silently duplicated action in the product.
 */
export const RERUN_NAME_RE =
  /re-?run|run again|re-?analy[sz]e|refresh (the )?analysis|update (the )?analysis|run (the )?analysis/i

/** Testids that name a run-dispatching control, whatever its visible label. */
export const RERUN_TESTID_RE = /re-?run|run-analysis|analysis-run/i

/**
 * Every control in `scope` that could dispatch a run — matched by accessible
 * NAME or by TESTID, so a reintroduction has to evade both to go unnoticed.
 *
 * The testid branch additionally requires CONTROL semantics (a button/link
 * element or role=button): RERUN_TESTID_RE substring-matches non-control
 * testids too — 'analysis-running-banner' contains 'run' via /re-?run|…/i's
 * alternates — and sweeping a status banner in as a "rerun control" would
 * fail a future in-flight sweep on narration rather than a real control. A
 * clickable non-control div would evade this filter, but such a control is
 * already an a11y violation the DS gates reject.
 *
 * Returns a Set so callers can assert on `.size`, or compare identity against
 * the specific element they expect to be the sole owner.
 */
export function collectRerunControls(scope: HTMLElement): Set<Element> {
  const byName = within(scope).queryAllByRole('button', { name: RERUN_NAME_RE })
  const CONTROL_TAGS = new Set(['BUTTON', 'A'])
  const byTestId = Array.from(scope.querySelectorAll('[data-testid]')).filter(el => {
    if (!RERUN_TESTID_RE.test(el.getAttribute('data-testid') ?? '')) return false
    if (CONTROL_TAGS.has(el.tagName)) return true
    if (el.getAttribute('role') === 'button') return true
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type
      return type === 'button' || type === 'submit'
    }
    return false
  })
  return new Set<Element>([...byName, ...byTestId])
}
