/**
 * ⛔⛔ GROUPING THE SECTIONS BROKE THE RULE EACH OF THEM ENFORCES ALONE.
 *
 * `AnalysisNewSection`, `WhatWeChecked` and `BiasGrounding` each return null
 * when they have nothing to say — "a heading is a claim that there is something
 * under it", a rule this tab adopted after three bare headings shipped.
 * `Accordion` renders its header regardless of what its children decide. So the
 * moment those sections were grouped, a run with no bias findings and no key
 * insights got a named, chevroned "Coaching and method" that opened onto
 * nothing — the same defect one level up, reintroduced by the fix for a
 * different one.
 *
 * ⚠ THE GATES ARE DERIVED FROM THE CHILDREN, NOT FROM `isPreRun`. Pre-run is
 * only the loudest case and is the easiest to write a passing test against;
 * these cases therefore drive the emptiness through the DATA, so a gate
 * rewritten as `!isPreRun` would still fail them.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useContextIntegrityStore } from '../../../../canvas/stores/contextIntegrityStore'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision, makeData } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

// V2 fidelity gap 24 (24 Sep 2026): "How this was worked out" and "Coaching and
// method" are deleted; what they held folds into About, which carries their gate
// ("a heading claims something is under it") from here on.
const GROUPS = [
  'analysis-new-about',
  'analysis-new-what-moves-the-outcome',
] as const

const renderBody = (data: ResultsSectionDataReturn, isPreRun = false) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={isPreRun}
      isRunning={false}
      isStale={false}
      responseHash="group-emptiness"
    />,
  )

afterEach(() => {
  cleanup()
  useContextIntegrityStore.setState({ briefText: null, manifest: null, scenarioId: null } as never)
})

describe('a group heading claims something is under it', () => {
  /**
   * ⭐ THE POSITIVE CONTROL, AND WITHOUT IT THE CASES BELOW ARE VACUOUS. A tab
   * that rendered no groups at all under any data would pass every absence
   * assertion here while the feature was entirely broken.
   */
  it('CONTROL: on a completed run with content, the groups render', () => {
    renderBody(genuineDecision())
    const rendered = GROUPS.filter((id) => screen.queryByTestId(id) !== null)
    expect(
      rendered.length,
      'at least one group must render on a rich run, or every absence case below proves nothing',
    ).toBeGreaterThan(0)
  })

  /**
   * ⛔ THE CASE. Pre-run there is no run to have checked anything, ranked
   * anything or grounded anything — every child of the coaching and
   * what-moves groups is empty, so neither heading may appear.
   */
  it('renders no coaching or what-moves heading pre-run', () => {
    renderBody(makeData(), true)
    // V2 gap 24: the coaching shell is gone; About now holds the coaching, and
    // pre-run with no brief it has nothing to hold.
    for (const id of ['analysis-new-about', 'analysis-new-what-moves-the-outcome']) {
      expect(
        screen.queryByTestId(id),
        `${id} rendered a heading over sections that all returned null`,
      ).toBeNull()
    }
  })

  /**
   * ⭐⭐ THE CASE I GOT WRONG FIRST, AND THE CORRECTION IS THE POINT.
   *
   * I wrote this expecting a completed run with no grounding and no insights to
   * suppress the coaching group. It does not, and it MUST NOT: `AnalysisNewSection`
   * renders an HONEST EMPTY MESSAGE there — "we looked and found none" — which is
   * a different statement from silence, and keeping those two apart is most of
   * what this tab is for. Suppressing the group would have deleted a disclosure
   * in the name of tidiness.
   *
   * ⛔ AND IT NEARLY SHIPPED AS A SUPPRESSION. The first gate asked
   * `insights.length > 0`, which is the same asymmetry as the failure I was
   * fixing (CLAUDE.md trap 13d) — it read "has content" as "has ROWS". The gate
   * now reads the SAME EXPRESSION the section is handed, so the two cannot
   * disagree about what counts as content.
   */
  it('keeps the coaching group when the only content is an honest empty message', () => {
    // `genuineDecision()` grounds no insight well enough to lead with, so the
    // section's honest empty message is the group's ONLY coaching content.
    renderBody(genuineDecision())
    // V2 gap 24: re-pointed from the deleted coaching group to About, which now
    // holds the Key insights section and its honest empty message.
    fireEvent.click(screen.getByTestId('analysis-new-about-toggle'))
    expect(
      within(screen.getByTestId('analysis-new-about')).queryByTestId('analysis-new-key-insights'),
      'a completed run that found no insights still owes the reader that sentence',
    ).not.toBeNull()
    // ⚠ NOT asserting the sentence's own testid here. `AnalysisNewSection` is
    // itself collapsed until opened, so that assertion would be testing the
    // SECTION's disclosure rather than the GROUP's gate — a different property,
    // already covered by `AnalysisNewTabBody.spec.tsx`'s "KEEPS the honest empty
    // message", which opens the section first. Binding it here would have made
    // this case fail for a reason that has nothing to do with the gate.
  })

  /**
   * ⛔⛔ THE REGRESSION I ALMOST SHIPPED, PINNED. The method gate's first
   * version ended in `|| !vm.status.isPreRun` — convenient, and wrong:
   * `WhatIWasGiven` renders PRE-RUN by design, because it is about the BRIEF
   * and not the run. That term would have deleted the one section a reader has
   * before any analysis exists.
   *
   * ⚠ NOTHING I HAD WRITTEN COULD SEE IT. Every other case drives emptiness
   * through RUN-DERIVED data, and this section is the one child that does not
   * depend on a run — so the whole battery agreed with the bug. It needed a
   * case built the other way round: pre-run, with a brief present.
   */
  it('keeps the method group PRE-RUN when there is a brief to show', () => {
    const scenarioId = 'scn-pre-run-brief'
    useCanvasStore.setState({ currentScenarioId: scenarioId } as never)
    useContextIntegrityStore.setState({
      scenarioId,
      briefText: 'We need to decide whether to build the integration in-house.',
      manifest: null,
    } as never)

    renderBody(makeData(), true)
    // V2 gap 24: re-pointed from the deleted method group to About, which now
    // holds the register and must render pre-run for it.
    expect(
      screen.queryByTestId('analysis-new-about'),
      'pre-run with a brief, About is the only thing the reader has — it must not be gated away',
    ).not.toBeNull()
    fireEvent.click(screen.getByTestId('analysis-new-about-toggle'))
    expect(
      within(screen.getByTestId('analysis-new-about')).queryByTestId('what-i-was-given-section'),
      'and it opens onto the register',
    ).not.toBeNull()
  })
})
