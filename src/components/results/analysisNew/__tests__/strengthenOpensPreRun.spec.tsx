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
 * that back. The property is narrower, and every limb below names the test that
 * covers it — so the completeness claim is checkable rather than asserted:
 *
 *   pre-run AND there is a finding   → open
 *                                      ("the section is open and its region is
 *                                      mounted")
 *   pre-run AND there is none        → closed (a forced-open empty state is
 *                                      not the fix)
 *                                      ("pre-run with nothing to say stays
 *                                      CLOSED")
 *   a run is displayed               → closed, exactly as before (a FRESH
 *                                      mount — this is the limb that keeps the
 *                                      1,584px budget)
 *                                      ("a displayed run leaves the section
 *                                      CLOSED, as before" and "but a reader who
 *                                      lands on a completed run still meets a
 *                                      collapsed row")
 *   pre-run → run displayed          → STAYS OPEN. The section is already
 *                                      mounted, so `SectionShell`'s
 *                                      `useState(defaultOpen)` is not re-read
 *                                      and the reader keeps what they were
 *                                      reading, composer draft included
 *                                      ("the section the reader was reading
 *                                      stays open across the transition" and
 *                                      "an in-progress disagreement survives a
 *                                      run completing")
 *   the reader closes it             → it stays closed (a default, not a lock)
 *                                      ("the reader can close it, and it stays
 *                                      closed")
 *
 * ⚠ THAT FOURTH LIMB READ "closes (the opening is SCOPED to the state, never a
 * sticky override)" until this correction, which is the INVERSE of what the
 * file has always asserted at "the section the reader was reading stays open
 * across the transition" (`data-section-open` === 'true' after the rerender).
 * It was stale text from a first cut that re-keyed the component and was
 * measured to destroy the reader's unsaved "I disagree" text; the SCOPE claim
 * it was trying to make lives in the fresh-mount limb above, not here.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
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
  useGuidanceStore.setState({ guidanceItems: [] } as never)
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
   * ⭐⭐⭐ THE TRANSITION — AND THIS ROW EXISTS BECAUSE I GOT IT WRONG FIRST.
   *
   * The first cut of this change re-keyed `StrengthenTheReasoning` on
   * `isPreRun`, so `SectionShell` would remount and re-read the default,
   * collapsing the section once the run landed. It looked like the tidy answer
   * and it DISCARDED THE READER'S WORK.
   *
   * Driven at this render path: open the "I disagree" composer pre-run, type
   * into it, complete a run. Pristine kept the draft; the keyed version lost
   * it — `SectionShell` unmounts a closed region, and that composer holds
   * UNSAVED text. Measured, not reasoned about.
   *
   * It was also INCONSISTENT. A section the reader opened BY HAND already
   * survives that transition, because nothing remounts. The key would have made
   * a section opened by DEFAULT behave differently from the identical section
   * opened by the identical toggle — one control, two behaviours.
   *
   * So the state belongs to the toggle after mount, which is `SectionShell`'s
   * own rule. The collapsed IA is untouched for everyone who LANDS on a
   * completed run, which is the state its 1,584px measurement was taken in.
   *
   * ⚠ THIS ROW IS A REGRESSION GUARD, AND IT PASSES AT PRISTINE — stated
   * plainly rather than dressed up as RED-first. Its evidence is the mutant:
   * re-adding the `key` turns it red.
   */
  it('an in-progress disagreement survives a run completing', () => {
    const { rerender } = draw(openStrategicChallenge(), true)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    const box = document.querySelector('textarea') as HTMLTextAreaElement | null
    // PRECONDITION PINNED IN-TEST: without a composer and a value in it, the
    // assertion after the rerender would pass on an absence.
    expect(box, 'no composer opened — the guard would be vacuous').not.toBeNull()
    fireEvent.change(box!, { target: { value: 'The target should be NRR, not ARR' } })
    expect(box!.value).toBe('The target should be NRR, not ARR')

    rerender(
      <AnalysisNewTabBody
        resultsSectionData={genuineDecision()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )

    const after = document.querySelector('textarea') as HTMLTextAreaElement | null
    expect(after, 'the composer was destroyed by the transition').not.toBeNull()
    expect(after!.value).toBe('The target should be NRR, not ARR')
  })

  /**
   * ⚠ AND THE STATE THE READER LEFT IT IN IS THE STATE THEY GET BACK. The
   * section does not slam shut under them; it is exactly what it is today for
   * a reader who opened it themselves.
   */
  it('the section the reader was reading stays open across the transition', () => {
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
      'true',
    )
  })

  /**
   * ⚠ THE TWIN THAT KEEPS THE ABOVE FROM WEAKENING THE IA CLAIM: a reader who
   * LANDS on a completed run — the state the 1,584px measurement was taken in —
   * still meets a collapsed row. Asserted by a FRESH mount, not a rerender,
   * because that is the journey being claimed.
   */
  it('but a reader who lands on a completed run still meets a collapsed row', () => {
    draw(genuineDecision(), false)
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


/**
 * ⭐⭐ AND THE HALF THAT MATTERS MOST — THE PRODUCER'S OWN COACHING.
 *
 * The success-measure card is the finding this panel can always ground, so it
 * is what the tests above bind to. But it is not the only thing behind that
 * row, and the difference is the whole point of the change.
 *
 * `buildRecommendations`' phase-3 promotion is NOT gated on `analysisComplete`
 * — derived at its bytes, unlike the six deterministic triggers around it
 * (`:488`, `:518`, `:554`, `:606`, `:652`) which all are. So every coaching
 * block CEE sends while drafting — the same channel the canvas coaches from —
 * already reaches this list before any run. It reached a COLLAPSED row.
 *
 * That is the "promise, not a coach" gap in one line: the canvas says "Top gap:
 * validate X"; this tab said "No analysis has run yet" and hid the producer's
 * own finding behind a chevron with a number on it.
 *
 * ⚠ IT IS PINNED HERE RATHER THAN LEFT AS A CLAIM IN A COMMIT MESSAGE. A
 * sentence saying "producer coaching reaches this list" is a mirror; a test
 * that REDs when the promotion becomes analysis-gated is not (trap 12).
 */
describe('the producer\'s own coaching reaches the pre-run reader', () => {
  /** A CEE draft-coaching block, in the store's own `GuidanceItem` shape. */
  const seedProducerCoaching = () =>
    useGuidanceStore.setState({
      guidanceItems: [
        {
          item_id: 'g_narrow',
          source: 'coaching',
          title: 'You are comparing only two options',
          detail: 'Narrow framing: consider a third path before committing.',
          category: 'should_fix',
          coaching_kind: 'bias_signal',
          primary_action: { kind: 'ask', label: 'Explore a third option' },
          priority_rank: 1,
        },
      ],
    } as never)

  /**
   * ⚠ THE PRECONDITION IS THE COUNT MOVING, NOT THE COUNT BEING TWO. Asserting
   * a bare "2" would pass if the engine dropped the producer block and minted
   * some other row instead; the identity assertion below is what settles which
   * two. Both are here because each catches what the other cannot.
   */
  it('the block is promoted into the pre-run list at all', () => {
    seedProducerCoaching()
    draw(openStrategicChallenge(), true)
    expect(screen.getByTestId('analysis-new-strengthen-count')).toHaveTextContent('2')
  })

  it('and the reader can READ it — open, and bound to the producer\'s own id', () => {
    seedProducerCoaching()
    draw(openStrategicChallenge(), true)
    expect(screen.getByTestId('analysis-new-strengthen')).toHaveAttribute(
      'data-section-open',
      'true',
    )
    const ids = screen
      .getAllByTestId('analysis-new-strengthen-item')
      .map((r) => r.getAttribute('data-recommendation-id'))
    // ⚠ BY IDENTITY: `strengthen:phase3:${item_id}` is the engine's own key for
    // a producer block, so this cannot be satisfied by a UI-authored row.
    expect(ids).toContain('strengthen:phase3:g_narrow')
    expect(screen.getByTestId('analysis-new-strengthen-region')).toHaveTextContent(
      'You are comparing only two options',
    )
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without it, the two rows above could both come
   * from a panel that renders every guidance item it can find regardless of
   * the store — and the seed would be proving nothing.
   */
  it('with no producer coaching, that row is absent', () => {
    draw(openStrategicChallenge(), true)
    const ids = screen
      .getAllByTestId('analysis-new-strengthen-item')
      .map((r) => r.getAttribute('data-recommendation-id'))
    expect(ids).not.toContain('strengthen:phase3:g_narrow')
    expect(screen.getByTestId('analysis-new-strengthen-count')).toHaveTextContent('1')
  })
})
