/**
 * THE NAMED GROUPS THE REASONING TAB'S DETAIL LIVES BEHIND — in ONE place.
 *
 * ⛔ WHY THIS MODULE EXISTS RATHER THAN A COPY PER SPEC. Three spec files need
 * the same list, and three hand-maintained copies of one list is the estate's
 * dominant defect (CLAUDE.md trap 12): a group added to the tab and missed in
 * one copy leaves that file silently measuring a panel it cannot see, green.
 *
 * ⚠ IT IS STILL A MIRROR — one, not three. It cannot be derived from the
 * component without rendering it, which is what the callers are doing anyway;
 * so `openGroups` FAILS LOUD when the list matches nothing on screen rather
 * than returning quietly, which is the only protection a mirror can carry.
 */
import { expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

export const NAMED_GROUPS = [
  // V2 fidelity gap 24 (24 Sep 2026): "How this was worked out" and "Coaching
  // and method" are gone; everything they held folds into About, which is now
  // the disclosure these blocks live behind.
  'analysis-new-about',
  'analysis-new-what-moves-the-outcome',
] as const

/**
 * Opens every named group that rendered, asserting each was CLOSED first — the
 * collapsed-IA rule applies to the groups as much as to the sections inside.
 *
 * ⛔ THE SECTIONS INSIDE ARE NOT TOUCHED. `SectionShell` UNMOUNTS a closed
 * region (unlike `Accordion`, which these groups used to be and which kept its
 * children mounted). So a spec querying an inner section without this was
 * reading content the reader could not see — passing for the wrong reason.
 */
export function openGroups(): void {
  let opened = 0
  for (const id of NAMED_GROUPS) {
    const toggle = screen.queryByTestId(`${id}-toggle`)
    if (toggle === null) continue
    expect(
      toggle,
      `${id} must be a COLLAPSED row at rest — the groups carry the same rule as the sections`,
    ).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    opened += 1
  }
  // POSITIVE CONTROL: with no group on screen every census downstream would be
  // measuring an empty panel and would pass vacuously (trap 13).
  expect(opened, 'no named group rendered — whatever follows would be vacuous').toBeGreaterThan(0)
}

/**
 * Opens whatever named groups are on screen, ASSERTING NOTHING about how many.
 *
 * ⭐⭐ WHY THIS IS A SECOND FUNCTION AND NOT A FLAG ON THE FIRST. `openGroups`
 * demands at least one group because its callers are CENSUSES: if no group
 * rendered, everything they measure afterwards is vacuous and must fail loud.
 * This one exists for helpers that render BOTH pre-run and post-run states —
 * pre-run the tab has no groups AT ALL, by design, so demanding one would
 * turn a correct product state into a test failure.
 *
 * ⛔ THE DISTINCTION IS THE POINT, AND COLLAPSING IT WOULD BREAK BOTH. A single
 * tolerant function would silently let a census measure an empty panel; a
 * single strict one fails on a state the product is right to be in. Two
 * questions, two names (CLAUDE.md trap 21).
 */
export function openGroupsIfPresent(): void {
  for (const id of NAMED_GROUPS) {
    const toggle = screen.queryByTestId(`${id}-toggle`)
    if (toggle !== null && toggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(toggle)
    }
  }
}

/**
 * Opens EVERY disclosure on the surface, to a fixed point.
 *
 * ⛔⛔ FOUR SPEC FILES CARRIED THEIR OWN SINGLE-PASS COPY OF THIS, and all four
 * broke the moment sections were nested inside named groups — for one reason:
 * `SectionShell` UNMOUNTS a closed region, so the inner sections DO NOT EXIST
 * until their group is open. One pass therefore opened the groups, and the
 * sections the helper was written to open were never on screen to be clicked.
 *
 * ⚠ FIXED POINT, NOT A FIXED NUMBER OF PASSES. Two happens to suffice for
 * today's two levels — which is exactly the hand-maintained constant that goes
 * stale when a third arrives (trap 12). The loop asks the DOM instead.
 *
 * ⚠ AND IT ASSERTS IT CONVERGED. A disclosure that re-closes itself, or a
 * toggle whose `aria-expanded` never updates, would otherwise spin to the cap
 * and leave the caller measuring a half-open panel — green, and wrong.
 */
export function openAllSections(): void {
  const closed = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid$="-toggle"]')).filter(
      (t) => t.getAttribute('aria-expanded') === 'false',
    )
  let passes = 0
  while (closed().length > 0 && passes < 8) {
    for (const toggle of closed()) fireEvent.click(toggle)
    passes += 1
  }
  expect(
    closed(),
    'openAllSections did not converge — a disclosure is re-closing itself or never reports open',
  ).toHaveLength(0)
}
