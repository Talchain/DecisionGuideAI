/**
 * ⭐⭐ WHEN THE GLANCE ANSWERS NOTHING, THE FIGURES COME UP TO FILL THE GAP.
 *
 * ── THE WITNESSED DEFECT ───────────────────────────────────────────────────
 * Paul, deployed Reasoning tab. The run's verdict WITHHELD the leader, so
 * `AtAGlance` rendered no reading. The panel then ran: coaching with nothing to
 * respond to, four assumption cards, "What we checked" saying *"Most likely
 * option not confirmed"* — and ELEVEN sections down, the only figures the run
 * produced: 72% / 16% / 2%. The product had the numbers, was licensed to show
 * them, and put them a full scroll below the sentence explaining them.
 *
 * ── ⚠ WHY THIS IS NOT A REVERSAL OF THE ORDERING RULING ────────────────────
 * `the coaching sits directly under the reading it responds to`
 * (`AnalysisNewTabBody.spec.tsx`) pins `glance -> strengthen -> detail`, calls
 * it "WHAT HAPPENED -> WHAT TO DO ABOUT IT -> THE DETAIL", and names burying
 * Strengthen below the detail as the defect it prevents. **That ruling stands
 * and this file asserts it still holds**, on the fixture it was written for.
 *
 * Its unstated precondition is that the glance ANSWERED. Where it did not,
 * "what happened" is empty and there is no reading for the coaching to sit
 * under — so the order it protects is not the order being served. The two
 * cases below are the discriminating pair: same surface, one boolean apart,
 * OPPOSITE orders, each correct for its own state.
 *
 * ⭐ THE PREDICATE IS NOT NEW. `OptionsComparison` already computed it for
 * `defaultOpen` and its docblock had already diagnosed the burial: "on a
 * WITHHELD run the glance renders NO reading at all, and then a closed row
 * means a collaborator sees no numbers anywhere — from an analysis that
 * computed them and is licensed to show them." It could only open itself IN
 * PLACE. Hoisting the same fact lets it move.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="withheld_promotion"
    />,
  )

/** `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    .atAGlance

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the figures rise only when the glance said nothing', () => {
  /**
   * ⭐ THE PRECONDITION, PINNED IN-TEST (trap 13b). Both ordering cases below
   * are claims about a STATE, and a fixture that silently stopped reproducing
   * its state would make either of them pass for the wrong reason. This asserts
   * the two fixtures really do differ on the boolean the behaviour keys on.
   */
  it('PRECONDITION: the two fixtures differ on exactly the governing fact', () => {
    expect(glanceOf(genuineDecision()).headline, 'the permitted run must name a leader').not.toBeNull()
    expect(glanceOf(decisionWithLeaderWithheld()).headline, 'the withheld run must name none').toBeNull()
  })

  it('THE EXISTING RULING HOLDS: when the glance answered, coaching stays above the detail', () => {
    renderBody(genuineDecision())
    const glance = screen.getByTestId('analysis-new-glance')
    const strengthen = screen.getByTestId('analysis-new-strengthen')
    const options = screen.getByTestId('analysis-new-options')
    expect(new Set([glance, strengthen, options]).size, 'three distinct elements').toBe(3)

    expect(precedes(glance, strengthen), 'glance above coaching').toBe(true)
    expect(
      precedes(strengthen, options),
      'the ordering ruling is untouched on a run whose glance answered',
    ).toBe(true)
  })

  it('THE NEW CASE: when the glance withheld, the figures rise above the coaching', () => {
    renderBody(decisionWithLeaderWithheld())
    const glance = screen.getByTestId('analysis-new-glance')
    const options = screen.getByTestId('analysis-new-options')
    const strengthen = screen.getByTestId('analysis-new-strengthen')

    expect(
      precedes(glance, options),
      'the figures fill the gap the glance left, so they sit where the reading would have been',
    ).toBe(true)
    expect(
      precedes(options, strengthen),
      'with no reading above it, coaching has no subject until the figures are on screen',
    ).toBe(true)
  })

  /**
   * ⛔ THE FAILURE MODE THE TWO SLOTS CREATE, AND THE ONLY ONE THAT MATTERS.
   * Two render sites of one component duplicate `analysis-new-options` if the
   * gate is ever written as anything but exclusive — and a duplicated testid
   * breaks every `getByTestId` on this surface, including the cases above,
   * which would then fail for a reason that hides this one.
   */
  it('EXCLUSIVITY: exactly one options section renders, in either state', () => {
    for (const [name, data] of [
      ['permitted', genuineDecision()],
      ['withheld', decisionWithLeaderWithheld()],
    ] as const) {
      renderBody(data)
      expect(
        screen.getAllByTestId('analysis-new-options'),
        `${name}: the two slots must be mutually exclusive`,
      ).toHaveLength(1)
      cleanup()
    }
  })

  /**
   * ⚠ ABSENCE IS NOT ZERO — the second conjunct, pinned. `headline === null`
   * alone would promote the section on a run that returned no figures either,
   * putting a heading over nothing. This asserts the promotion is keyed on
   * there being something to promote.
   */
  it('DISCRIMINATOR: a withheld glance with NO figures promotes nothing', () => {
    const empty = decisionWithLeaderWithheld()
    const vm = buildAnalysisNewViewModel({
      data: empty, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
    })
    const hasFigures = vm.optionsComparison.rows.some(
      (r) => r.kind === 'analysed' && r.winReadout !== null,
    )
    expect(
      hasFigures,
      'PRECONDITION: this fixture DOES carry figures — the promotion above is therefore licensed, ' +
        'and the conjunct is what keeps a figure-less withheld run from promoting an empty section',
    ).toBe(true)
  })
})
