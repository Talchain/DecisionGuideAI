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
  'analysis-new-how-worked-out',
  'analysis-new-coaching-and-method',
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
