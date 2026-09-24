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
 *
 * ⛔⛔ AND THE RULE THIS FILE EXISTS TO ENFORCE, BECAUSE ITS FIRST VERSION
 * BROKE IT: A ZONE WITH NOTHING TO SAY RENDERS NO LABEL. The first cut listed
 * only three zones here and left `focus` out — the one zone whose content is
 * conditional, and therefore the only one the rule could catch. Measured on the
 * shipped tree: "Focus now" rendered with ZERO characters beneath it on all
 * SEVEN fixtures. A hardcoded list that omits the one member capable of failing
 * is a guard agreeing with itself, and it is the same omission that cost the
 * row-intervention act its assertion two PRs ago. So the list is exhaustive,
 * and the emptiness rule is proved with a DISCRIMINATING PAIR in the same run:
 * one canvas that earns the zone, one that does not.
 *
 * ⭐ REASONING V2 (24 Sep 2026). Two changes, both deliberate:
 *   · the ANSWER zone's label paragraph is gone (X) — its heading is now the
 *     commitment block's own "Move towards commitment", inside the group. The
 *     zone is still a wrapped group and is still in the exhaustive list; it is
 *     asserted to carry that heading instead of a label;
 *   · the methods left ZONE: FOCUS for the method strip at the top, so FOCUS
 *     holds only the run's nudges again and an empty canvas earns NO focus
 *     zone at all — arm 2 below is back to asserting that absence.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision } from './analysisNewFixtures'
import { COMMITMENT_COPY } from '../commitmentSynthesis'

/**
 * ⚠ EXHAUSTIVE BY CONSTRUCTION, NOT BY RECOLLECTION. Every zone the body can
 * render is named here; a new zone added without a line in this list is the
 * failure mode this file was written after committing.
 */
// V2 fidelity gap 24 (24 Sep 2026): the 'further' zone is deleted — the prototype
// ends commitment → About, and About is a footer, not a zone.
const ZONES = ['focus', 'answer', 'also'] as const
/**
 * The zones that carry a label. V2 retired the ANSWER zone's label; its heading
 * is the commitment block's (asserted below), so it is listed apart rather than
 * dropped — every zone is still in `ZONES`.
 */
const LABELLED_ZONES = ['focus', 'also'] as const
const HEADED_BY_ITS_BLOCK = 'answer'

/** A canvas with options, a factor and an outcome but NO risk: the model
 *  demonstrably lacks one, so Focus Now earns exactly one row. */
const node = (id: string, type: string) => ({ id, type, position: { x: 0, y: 0 }, data: { label: id } })
const EARNS_A_NUDGE = [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor'), node('out1', 'outcome')]

const renderBody = (data: ResultsSectionDataReturn, nodes: ReturnType<typeof node>[] = []) => {
  useCanvasStore.setState({ nodes } as never)
  return render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="zones"
    />,
  )
}

const contentBeyondLabel = (zone: string): number => {
  const group = screen.getByTestId(`analysis-new-zone-${zone}-group`)
  const label = screen.getByTestId(`analysis-new-zone-${zone}`)
  expect(group.contains(label), `${zone}: the label must sit inside its group`).toBe(true)
  return (group.textContent ?? '').replace(label.textContent ?? '', '').trim().length
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [] } as never)
})

describe('the panel is grouped into named zones', () => {
  it('⭐ every zone that renders carries a label and wraps its own blocks', () => {
    renderBody(genuineDecision(), EARNS_A_NUDGE)
    const found = ZONES.filter((z) => screen.queryByTestId(`analysis-new-zone-${z}-group`) !== null)
    expect(found.length, 'precondition: every zone renders on a rich run').toBe(ZONES.length)

    for (const z of LABELLED_ZONES) {
      expect(
        contentBeyondLabel(z),
        `${z}: a zone with only a label is furniture naming nothing`,
      ).toBeGreaterThan(0)
    }

    // V2: the answer zone is headed by its own block, not by a zone label.
    const answer = screen.getByTestId(`analysis-new-zone-${HEADED_BY_ITS_BLOCK}-group`)
    expect(screen.queryByTestId(`analysis-new-zone-${HEADED_BY_ITS_BLOCK}`)).toBeNull()
    const headings = Array.from(answer.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) =>
      (h.textContent ?? '').trim(),
    )
    expect(headings, 'answer: the zone must carry the commitment heading').toContain(
      COMMITMENT_COPY.heading,
    )
  })

  /**
   * ⛔⛔ THE DISCRIMINATING PAIR. Both arms run the same fixture and differ only
   * in the canvas, so a label that appeared regardless — the state actually
   * shipped in the first cut — fails the second arm while the first still
   * passes. One arm alone proves nothing: the first shows the zone can render,
   * the second shows it is the CONTENT that decides.
   */
  it('⛔ no zone label renders over nothing — every label has content under it', () => {
    renderBody(genuineDecision(), EARNS_A_NUDGE)
    expect(screen.queryByTestId('analysis-new-zone-focus'), 'arm 1: the model lacks a risk, so the zone is earned').not.toBeNull()
    expect(contentBeyondLabel('focus')).toBeGreaterThan(0)

    cleanup()
    /**
     * ⭐ ARM 2 IS BACK TO ITS ORIGINAL SHAPE (V2, 24 Sep 2026). From 18 Sep to
     * V2 the focus zone also held the always-present methods shelf, so an empty
     * canvas still earned the zone and this arm asserted content under it. V2
     * moved the methods to the method strip at the top of the panel, so the
     * focus zone once again holds only the run's nudges — and a canvas that
     * earns none must render NO focus zone and NO label.
     */
    renderBody(genuineDecision(), [])
    expect(screen.queryByTestId('analysis-new-zone-focus-group'), 'arm 2: nothing earned, so no zone').toBeNull()
    expect(screen.queryByTestId('analysis-new-zone-focus'), 'arm 2: and no label over nothing').toBeNull()
    // Contrast in the SAME arm: the unconditional zones are still there, so
    // arm 2 is measuring the gate and not a failed render.
    expect(screen.queryByTestId('analysis-new-zone-answer-group')).not.toBeNull()
    // V2 gap 24: the unconditional tail is now About, not the 'further' zone.
    expect(screen.queryByTestId('analysis-new-about')).not.toBeNull()
  })

  /**
   * ⛔ THE RULE A LABEL BREAKS MOST EASILY. Border, fill and radius each say
   * "separate object". A zone label that carried them would read as one more
   * card, which is the weight this grouping exists to remove.
   */
  it('⛔ a zone label is not a block — no border, no fill, no radius', () => {
    renderBody(genuineDecision(), EARNS_A_NUDGE)
    let checked = 0
    for (const z of LABELLED_ZONES) {
      const label = screen.queryByTestId(`analysis-new-zone-${z}`)
      if (label === null) continue
      checked += 1
      const cls = label.className
      expect(cls, `${z}: a label must not be bordered`).not.toMatch(/\bborder(-|\b)/)
      expect(cls, `${z}: a label must not be filled`).not.toMatch(/\bbg-(?!transparent)/)
      expect(cls, `${z}: a label must not be rounded`).not.toMatch(/\brounded/)
      // Contrast in the same run: it IS styled, so these are absences in a real
      // class string rather than assertions about an empty one.
      expect(cls.trim().length).toBeGreaterThan(0)
    }
    expect(checked, 'precondition: this arm inspected every labelled zone').toBe(LABELLED_ZONES.length)
  })

  /**
   * ⛔ NO ZONE MAY RESTATE A HEADING INSIDE ITSELF. This is what removed the
   * fifth zone, and it is the rule that would be broken again by the next
   * person adding one.
   */
  it('⛔ no zone label repeats a heading from within its own group', () => {
    renderBody(genuineDecision(), EARNS_A_NUDGE)
    let checked = 0
    for (const z of LABELLED_ZONES) {
      const group = screen.queryByTestId(`analysis-new-zone-${z}-group`)
      const label = screen.queryByTestId(`analysis-new-zone-${z}`)
      if (group === null || label === null) continue
      checked += 1
      const name = (label.textContent ?? '').trim().toLowerCase()
      expect(name.length, 'precondition: the label says something').toBeGreaterThan(0)
      // ⚠ V2 gap 16: a zone whose label IS its section title (an h3, the
      // "Move towards commitment" grammar) is not restating itself, so the
      // label element is excluded from the headings it is compared against.
      const headings = Array.from(group.querySelectorAll('h1,h2,h3,h4,h5,h6'))
        .filter((h) => h !== label)
        .map((h) => (h.textContent ?? '').trim().toLowerCase())
      expect(headings, `${z}: the zone label restates a heading inside it`).not.toContain(name)
    }
    expect(checked, 'precondition: this arm inspected every labelled zone').toBe(LABELLED_ZONES.length)
  })
})
