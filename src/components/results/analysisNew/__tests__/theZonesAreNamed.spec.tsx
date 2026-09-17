/**
 * ⭐⭐ FOUR NAMED ZONES, NOT A FLAT STACK OF PEER CARDS.
 *
 * The approved prototype's first structural rule, and the one its own
 * in-repo implementation (`prototype/ReasoningPanelV3`) was written to deliver.
 * That implementation had never been mounted, so the panel a user opens was
 * still the composition it was written to replace.
 *
 * ⛔ WHY THE LABELS ARE WRAPPED RATHER THAN LOOSE, and it is the whole reason
 * this is a reduction. Five loose labels took the column's direct children from
 * 8 to 13 and `thePanelCannotRegrow` REDded by name. Wrapping each group makes
 * a zone ONE child carrying its own label and its own blocks: 8 -> 4 on the
 * rich fixture, and the ceilings came down with it.
 *
 * ⚠ A ZONE LABEL NAMES A GROUP, SO IT MUST NOT LOOK LIKE A BLOCK — no border,
 * no fill, no radius — and it must not RESTATE a heading inside its own group.
 * A fifth zone was removed for exactly that: "What would change your mind" sat
 * directly above a section of that name, and `firstViewportCensus` caught the
 * duplicate sentence.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision } from './analysisNewFixtures'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="zones"
    />,
  )

const ZONES = ['answer', 'also', 'further'] as const

afterEach(cleanup)

describe('the panel is grouped into named zones', () => {
  it('⭐ every zone that renders carries a label and wraps its own blocks', () => {
    renderBody(genuineDecision())
    const found = ZONES.filter((z) => screen.queryByTestId(`analysis-new-zone-${z}-group`) !== null)
    expect(found.length, 'precondition: zones render at all on a rich run').toBe(ZONES.length)

    for (const z of found) {
      const group = screen.getByTestId(`analysis-new-zone-${z}-group`)
      const label = screen.getByTestId(`analysis-new-zone-${z}`)
      // The label belongs to the group it names, not beside it.
      expect(group.contains(label), `${z}: the label must sit inside its group`).toBe(true)
      // And the group carries content beyond its own label.
      expect(
        (group.textContent ?? '').replace(label.textContent ?? '', '').trim().length,
        `${z}: a zone with only a label is furniture naming nothing`,
      ).toBeGreaterThan(0)
    }
  })

  /**
   * ⛔ THE RULE A LABEL BREAKS MOST EASILY. Border, fill and radius each say
   * "separate object". A zone label that carried them would read as one more
   * card, which is the weight this grouping exists to remove.
   */
  it('⛔ a zone label is not a block — no border, no fill, no radius', () => {
    renderBody(genuineDecision())
    for (const z of ZONES) {
      const label = screen.queryByTestId(`analysis-new-zone-${z}`)
      if (label === null) continue
      const cls = label.className
      expect(cls, `${z}: a label must not be bordered`).not.toMatch(/\bborder(-|\b)/)
      expect(cls, `${z}: a label must not be filled`).not.toMatch(/\bbg-(?!transparent)/)
      expect(cls, `${z}: a label must not be rounded`).not.toMatch(/\brounded/)
      // Contrast in the same run: it IS styled, so these are absences in a real
      // class string rather than assertions about an empty one.
      expect(cls.trim().length).toBeGreaterThan(0)
    }
  })

  /**
   * ⛔ NO ZONE MAY RESTATE A HEADING INSIDE ITSELF. This is what removed the
   * fifth zone, and it is the rule that would be broken again by the next
   * person adding one.
   */
  it('⛔ no zone label repeats a heading from within its own group', () => {
    renderBody(genuineDecision())
    for (const z of ZONES) {
      const group = screen.queryByTestId(`analysis-new-zone-${z}-group`)
      const label = screen.queryByTestId(`analysis-new-zone-${z}`)
      if (group === null || label === null) continue
      const name = (label.textContent ?? '').trim().toLowerCase()
      expect(name.length, 'precondition: the label says something').toBeGreaterThan(0)
      const headings = Array.from(group.querySelectorAll('h1,h2,h3,h4,h5,h6'))
        .map((h) => (h.textContent ?? '').trim().toLowerCase())
      expect(headings, `${z}: the zone label restates a heading inside it`).not.toContain(name)
    }
  })
})
