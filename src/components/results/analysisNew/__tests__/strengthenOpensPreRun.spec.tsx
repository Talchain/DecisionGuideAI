/**
 * Analysis (New) — THE PRE-RUN PANEL'S ONE PIECE OF COACHING IS ON SCREEN.
 *
 * ⚠⚠ THE DEFECT, DERIVED AT THE MOUNTED RENDER PATH ON `staging` (`3b2df4ce`).
 * Rendering `AnalysisNewTabBody` pre-run against the repo's own fixture and a
 * four-node model, the panel's ENTIRE text ended:
 *
 *   "…Pick a mark to show that part of the model on the canvas.
 *    Strengthen the reasoning1"
 *
 * — a collapsed row, a bare "1", and nothing else. Every testid under
 * `analysis-new-strengthen` was header furniture: `-toggle`, `-title`,
 * `-count`. No `-region`, so no `-item`, so not one word of the finding.
 *
 * ⭐ AND THE THING BEHIND THAT "1" IS EXACTLY WHAT THE READER NEEDS. Pre-run
 * the only recommendation the engine can ground is the success-measure one —
 * `buildRecommendations` mints it from the model, not from a run — and it is
 * the ONLY surface on this tab that says WHY the gap matters:
 *
 *   "Without a target the analysis cannot say how likely each option is to
 *    succeed, only how they compare with one another."
 *
 * `successTargetAskedOnce.spec.tsx` already reasons that this row "keeps its
 * place" for precisely that reason, and `StrengthenTheReasoningProps.analysisHash`
 * already documents the state: "Absent pre-run, which is correct: a pre-run
 * finding is grounded in the MODEL, not in any run." The finding was built,
 * grounded, counted — and put behind a click the reader had no reason to make.
 * That is this estate's first chronic failure ("we build more than we plug in")
 * at the scale of one disclosure row.
 *
 * ── WHAT IS UNDER TEST, AND WHY IT IS NOT "OPEN THE SECTION" ────────────────
 * The collapsed IA is a MEASURED design decision, not a default nobody thought
 * about: `SectionShell`'s header records the panel at 1,584px against a 769px
 * viewport before it landed. Opening this section unconditionally would spend
 * that back. The property is narrower, and every limb is tested:
 *
 *   pre-run AND there is a finding   → open
 *   pre-run AND there is none        → closed (a forced-open empty state is
 *                                      not the fix)
 *   a run is displayed               → closed, exactly as before
 *   pre-run → run displayed          → closes (the opening is SCOPED to the
 *                                      state, never a sticky override)
 *   the reader closes it             → it stays closed (a default, not a lock)
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { SUCCESS_MEASURE_RECOMMENDATION_ID } from '../../strengthen/buildRecommendations'
import { genuineDecision, makeData, openStrategicChallenge } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/**
 * ⚠ A REAL MODEL, NOT AN EMPTY CANVAS. `ModelStrip` renders nothing without
 * rows, and an empty canvas would starve half the panel — making every
 * assertion below pass or fail for a reason other than the one under test.
 */
const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Ship usage pricing' } },
  { id: 'o2', type: 'option', data: { label: 'Hold current strategy' } },
  { id: 'f1', type: 'factor', data: { label: 'Enterprise churn risk' } },
]

/**
 * A model whose goal DOES carry a stated target, so the engine mints no
 * success-measure recommendation and the pre-run section has nothing behind it.
 * Derived, not assumed: `buildRecommendations` gates that row on
 * `hasStatedGoalTarget`, and the count assertion below proves the gate held.
 */
const targetAlreadySet = (): ResultsSectionDataReturn =>
  makeData({
    recommendation: {
      hasGoalTarget: true,
      goalThreshold: 0.8,
      allOptions: [],
      recommendedOption: null,
    },
  })

afterEach(cleanup)

const draw = (data: ResultsSectionDataReturn, isPreRun: boolean) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={isPreRun}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )

beforeEach(() => {
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {} })
})

describe('THE INSTRUMENT — the precondition, pinned in test', () => {
  /**
   * ⭐⭐ WITHOUT THIS EVERY ASSERTION BELOW IS VACUOUS. "The section is open"
   * says nothing if the section has nothing behind it, and a harness that
   * silently stopped producing the pre-run recommendation would satisfy the
   * closed-state twin for entirely the wrong reason (CLAUDE.md trap 13b).
   */
  it('pre-run, the engine really does ground exactly one finding', () => {
    draw(openStrategicChallenge(), true)
    expect(screen.getByTestId('analysis-new-strengthen')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-strengthen-count')).toHaveTextContent('1')
  })

  /** The opposite precondition, for the empty twin: this model grounds NONE. */
  it('with a target already stated, the engine grounds none', () => {
    draw(targetAlreadySet(), true)
    expect(screen.getByTestId('analysis-new-strengthen')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-strengthen-count')).toBeNull()
  })
})

describe('pre-run, the coaching is READ, not promised', () => {
  it('the section is open and its region is mounted', () => {
    draw(openStrategicChallenge(), true)
    expect(screen.getByTestId('analysis-new-strengthen')).toHaveAttribute(
      'data-section-open',
      'true',
    )
    expect(screen.getByTestId('analysis-new-strengthen-region')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-strengthen-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  /**
   * ⭐ BOUND BY IDENTITY, NOT BY A TEXT PREDICATE. Another card could satisfy
   * "a row is on screen"; this must be THE finding about the gap that blocks
   * measurement, so it is matched on the engine's own id (CLAUDE.md trap 19).
   */
  it('the row on screen is the gap that blocks measurement', () => {
    draw(openStrategicChallenge(), true)
    const rows = screen.getAllByTestId('analysis-new-strengthen-item')
    expect(rows.map((r) => r.getAttribute('data-recommendation-id'))).toContain(
      SUCCESS_MEASURE_RECOMMENDATION_ID,
    )
  })

  /**
   * ⚠ AND THE SENTENCE THAT MAKES THE ROW WORTH OPENING FOR. The strip's
   * "Set a target" control states the gap; only this row says what it costs.
   * If the copy is ever moved elsewhere this REDs, which is correct — the
   * reason for opening the section would have gone with it.
   */
  it('and it carries the reason the gap matters', () => {
    draw(openStrategicChallenge(), true)
    expect(screen.getByTestId('analysis-new-strengthen-region')).toHaveTextContent(
      'the analysis cannot say how likely each option is to succeed',
    )
  })
})

describe('the opening is SCOPED — every other limb is unchanged', () => {
  /**
   * ⭐⭐ THE DISCRIMINATING TWIN. A shell that simply opened this section would
   * pass every assertion above and destroy the collapsed IA that
   * `SectionShell`'s header measured at 1,584px.
   */
  it('a displayed run leaves the section CLOSED, as before', () => {
    draw(genuineDecision(), false)
    const section = screen.getByTestId('analysis-new-strengthen')
    expect(section).toHaveAttribute('data-section-open', 'false')
    expect(screen.queryByTestId('analysis-new-strengthen-region')).toBeNull()
  })

  /**
   * ⚠ And no sibling section was opened either — this is not "open everything".
   *
   * ⚠⚠ THE SIBLING IS `analysis-new-options`, NOT `analysis-new-drivers`, AND
   * THE FIRST DRAFT OF THIS TEST HAD IT WRONG. Drivers reads OPEN on this
   * fixture, and correctly so: `AnalysisNewSection` passes
   * `defaultOpen={findings.length === 1}`, the single-item rule that
   * `singleItemSectionOpens.spec.tsx` pins. A control that REDs on existing,
   * intended behaviour is not a control — it is a second defect wearing one.
   * `collapsedIA.spec.tsx:96` already establishes options as closed here.
   */
  it('a displayed run leaves a multi-item sibling section CLOSED too', () => {
    draw(genuineDecision(), false)
    expect(screen.getByTestId('analysis-new-options')).toHaveAttribute(
      'data-section-open',
      'false',
    )
  })

  /**
   * ⚠ AN EMPTY SECTION IS NOT WORTH A VIEWPORT. Opening onto "nothing to
   * strengthen" spends the reader's attention on an absence they can already
   * read off the collapsed row.
   */
  it('pre-run with nothing to say stays CLOSED', () => {
    draw(targetAlreadySet(), true)
    expect(screen.getByTestId('analysis-new-strengthen')).toHaveAttribute(
      'data-section-open',
      'false',
    )
  })

  /**
   * ⭐⭐ THE TRANSITION, AND IT IS THE HALF A `defaultOpen` ALONE CANNOT DO.
   * `SectionShell` seeds `useState(defaultOpen)` and never re-reads it, so a
   * reader who lands pre-run and then runs an analysis would carry the open
   * section into the post-run panel — quietly re-introducing the scroll the
   * collapsed IA was built to remove, on the one path nobody would test.
   */
  it('closes again once a run is displayed', () => {
    const { rerender } = draw(openStrategicChallenge(), true)
    expect(screen.getByTestId('analysis-new-strengthen')).toHaveAttribute(
      'data-section-open',
      'true',
    )
    rerender(
      <AnalysisNewTabBody
        resultsSectionData={genuineDecision()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )
    expect(screen.getByTestId('analysis-new-strengthen')).toHaveAttribute(
      'data-section-open',
      'false',
    )
  })

  /**
   * ⚠ A DEFAULT, NOT A LOCK. The reader stays authoritative over their own
   * panel; an opening that cannot be undone is a worse affordance than a
   * closed row.
   */
  it('the reader can close it, and it stays closed', () => {
    draw(openStrategicChallenge(), true)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
    expect(screen.getByTestId('analysis-new-strengthen')).toHaveAttribute(
      'data-section-open',
      'false',
    )
    expect(screen.queryByTestId('analysis-new-strengthen-region')).toBeNull()
  })
})
