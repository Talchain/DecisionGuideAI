/**
 * ONE SURFACE, ONE DISCLOSURE TREATMENT.
 *
 * ⛔ THE DEFECT THIS CLOSES, AND I SHIPPED IT MYSELF. The three named groups
 * were built on `Accordion` — a `ResultsBody` component — on the reasoning that
 * *"the machinery for this existed before the tab did"*. True about the
 * machinery, wrong about the SURFACE. Measured on the rendered tab, seven rows
 * apart:
 *
 *     Accordion      bg-panel · border-b · chevron LEFT of the title · rounded-lg
 *     SectionShell   fill on open · chevron RIGHT · count on the row · rounded-md
 *
 * Two treatments for one meaning is precisely the drift `panelSurfaces` exists
 * to end (*"six container treatments and one meaning between them"*) — arriving
 * at the level of the CHROME, introduced by the restructure meant to fix it.
 * Paul, on the deployed panel: *"lots of formats, and different types of
 * components, so it feels a real jumbly mess."*
 *
 * ⭐ WHY THE ASSERTION IS `data-section-open` AND NOT A CLASS LIST. That
 * attribute is emitted by `SectionShell` and by nothing else, so it is an
 * IDENTITY check (trap 19) rather than a resemblance check: a future component
 * that merely looked similar would not satisfy it, and a class-list assertion
 * would go stale the first time the grammar's radius or padding moved.
 *
 * ⚠ IT DOES NOT CLAIM "EVERY DISCLOSURE ON THE PANEL IS A SectionShell".
 * `DisclosureRow` is a row-level disclosure INSIDE a section and is a different
 * object answering a different question — collapsing the two would be this
 * estate's trap 21. The claim is scoped to the NAMED GROUPS, which is where the
 * two treatments actually collided.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { openStrategicChallenge } from './analysisNewFixtures'
import { NAMED_GROUPS } from './openNamedGroups'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('one surface, one disclosure treatment', () => {
  it('every named group is a SectionShell, by the attribute only it emits', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={openStrategicChallenge()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_one_chrome"
      />,
    )
    // V2 prototype: "What moves the outcome" lives inside the challenge's
    // "Assumptions and evidence" door, so open that door first.
    const door = screen.getByTestId('analysis-new-signals-disclose')
    expect(door).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(door)

    // V2 fidelity gaps 24 + 27 (24 Sep 2026): About joined NAMED_GROUPS when the
    // two tail groups folded into it, and it is deliberately NOT a SectionShell —
    // the prototype draws it as a quiet audit footer (`.about .disclose`), not a
    // peer section. Excluded by identity; it carries its own marker instead.
    const present = NAMED_GROUPS.filter(
      (id) => id !== 'analysis-new-about' && screen.queryByTestId(id) !== null,
    )
    expect(screen.getByTestId('analysis-new-about')).toHaveAttribute('data-about-open')
    // POSITIVE CONTROL: a fixture rendering no group would satisfy the loop
    // below vacuously, and this spec would then guard nothing (trap 13).
    // V2 gap 24: two SectionShell groups left with the tail; one remains.
    expect(
      present.length,
      'no named group rendered — this case would be vacuous',
    ).toBeGreaterThan(0)

    for (const id of present) {
      expect(
        screen.getByTestId(id),
        `${id} must carry SectionShell's own marker — Accordion does not emit it`,
      ).toHaveAttribute('data-section-open')
    }
  })
})
