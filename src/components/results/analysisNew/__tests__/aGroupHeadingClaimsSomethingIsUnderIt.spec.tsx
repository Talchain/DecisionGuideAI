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
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision, makeData } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const GROUPS = [
  'analysis-new-how-worked-out',
  'analysis-new-coaching-and-method',
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

afterEach(() => cleanup())

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
    for (const id of ['analysis-new-coaching-and-method', 'analysis-new-what-moves-the-outcome']) {
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
    expect(
      screen.queryByTestId('analysis-new-coaching-and-method'),
      'a completed run that found no insights still owes the reader that sentence',
    ).not.toBeNull()
    // ⚠ NOT asserting the sentence's own testid here. `AnalysisNewSection` is
    // itself collapsed until opened, so that assertion would be testing the
    // SECTION's disclosure rather than the GROUP's gate — a different property,
    // already covered by `AnalysisNewTabBody.spec.tsx`'s "KEEPS the honest empty
    // message", which opens the section first. Binding it here would have made
    // this case fail for a reason that has nothing to do with the gate.
  })
})
